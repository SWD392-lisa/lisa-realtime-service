import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import jwt from 'jsonwebtoken';
import { PrismaService } from '../../prisma/prisma.service';

interface CloudflareVideoDetails {
  uid: string;
  preview?: string;
  thumbnail?: string;
  readyToStream?: boolean;
  status?: {
    state?: string;
    pctComplete?: string;
  };
  playback?: {
    hls?: string;
    dash?: string;
  };
  requireSignedURLs?: boolean;
}

@Injectable()
export class CloudflareStreamService {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  isConfigured() {
    return Boolean(
      this.configService.get<string>('CLOUDFLARE_ACCOUNT_ID')?.trim() &&
        this.configService.get<string>('CLOUDFLARE_API_TOKEN')?.trim(),
    );
  }

  async getVideo(videoUid: string): Promise<CloudflareVideoDetails> {
    this.assertConfigured();

    const response = await this.request<CloudflareVideoDetails>(
      `/stream/${videoUid}`,
      {
        method: 'GET',
      },
    );

    return response;
  }

  async createSignedPlaybackUrl(videoUid: string, expiresInSeconds: number) {
    this.assertConfigured();

    const video = await this.getVideo(videoUid);
    const signedToken = await this.createSignedToken(videoUid, expiresInSeconds);
    const previewUrl = video.preview ?? this.inferPreviewUrl(videoUid);
    const hlsUrl = video.playback?.hls ?? this.inferHlsUrl(videoUid);
    const dashUrl = video.playback?.dash ?? this.inferDashUrl(videoUid);

    return {
      token: signedToken,
      playerUrl: previewUrl.replace(videoUid, signedToken),
      hlsUrl: hlsUrl.replace(videoUid, signedToken),
      dashUrl: dashUrl.replace(videoUid, signedToken),
      thumbnailUrl: video.thumbnail?.replace(videoUid, signedToken) ?? null,
      expiresIn: expiresInSeconds,
    };
  }

  async createUploadUrl() {
    this.assertConfigured();

    return this.request<{
      uid: string;
      uploadURL: string;
    }>('/stream/direct_upload', {
      method: 'POST',
      body: JSON.stringify({
        maxDurationSeconds: 60 * 60,
      }),
    });
  }

  async registerRecordingVideo(recordingId: string, videoUid: string) {
    if (!videoUid?.trim()) {
      throw new BadRequestException('videoUid is required');
    }

    const recording = await this.prisma.recording.findUnique({
      where: { recordingId },
    });
    if (!recording) {
      throw new NotFoundException('Recording not found');
    }

    return this.prisma.recording.update({
      where: { recordingId },
      data: {
        cloudflareVideoUid: videoUid.trim(),
        providerMetadata: {
          ...((recording.providerMetadata as Record<string, unknown> | null) ?? {}),
          cloudflareRegisteredAt: new Date().toISOString(),
          cloudflareVideoUid: videoUid.trim(),
        },
      },
    });
  }

  private async createSignedToken(videoUid: string, expiresInSeconds: number) {
    const signingKey = this.configService
      .get<string>('CLOUDFLARE_STREAM_SIGNING_KEY')
      ?.trim();
    const signingKeyId = this.configService
      .get<string>('CLOUDFLARE_STREAM_SIGNING_KEY_ID')
      ?.trim();

    if (signingKey && signingKeyId) {
      const privateKey = this.decodeSigningKey(signingKey);
      return jwt.sign(
        {
          sub: videoUid,
          kid: signingKeyId,
          exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
        },
        privateKey,
        {
          algorithm: 'RS256',
          header: {
            alg: 'RS256',
            kid: signingKeyId,
          },
        },
      );
    }

    const result = await this.request<{ token: string }>(
      `/stream/${videoUid}/token`,
      {
        method: 'POST',
        body: JSON.stringify({
          exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
        }),
      },
    );

    return result.token;
  }

  private decodeSigningKey(signingKey: string) {
    if (signingKey.includes('BEGIN')) {
      return signingKey;
    }

    return Buffer.from(signingKey, 'base64').toString('utf8');
  }

  private inferPreviewUrl(videoUid: string) {
    const customerCode = this.configService
      .get<string>('CLOUDFLARE_STREAM_CUSTOMER_CODE')
      ?.trim();

    if (customerCode) {
      return `https://customer-${customerCode}.cloudflarestream.com/${videoUid}/iframe`;
    }

    return `https://iframe.videodelivery.net/${videoUid}`;
  }

  private inferHlsUrl(videoUid: string) {
    const customerCode = this.configService
      .get<string>('CLOUDFLARE_STREAM_CUSTOMER_CODE')
      ?.trim();

    if (!customerCode) {
      return `https://videodelivery.net/${videoUid}/manifest/video.m3u8`;
    }

    return `https://customer-${customerCode}.cloudflarestream.com/${videoUid}/manifest/video.m3u8`;
  }

  private inferDashUrl(videoUid: string) {
    const customerCode = this.configService
      .get<string>('CLOUDFLARE_STREAM_CUSTOMER_CODE')
      ?.trim();

    if (!customerCode) {
      return `https://videodelivery.net/${videoUid}/manifest/video.mpd`;
    }

    return `https://customer-${customerCode}.cloudflarestream.com/${videoUid}/manifest/video.mpd`;
  }

  private async request<T>(
    path: string,
    init: {
      method: 'GET' | 'POST';
      body?: string;
    },
  ) {
    const accountId = this.configService.get<string>('CLOUDFLARE_ACCOUNT_ID')!;
    const apiToken = this.configService.get<string>('CLOUDFLARE_API_TOKEN')!;
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}${path}`,
      {
        method: init.method,
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: init.body,
      },
    );
    const payload = await response.json().catch(() => null);

    if (!response.ok || !payload?.success) {
      throw new BadRequestException(
        payload?.errors?.[0]?.message ||
          payload?.messages?.[0]?.message ||
          payload?.result?.error ||
          `Cloudflare Stream request failed with status ${response.status}`,
      );
    }

    return payload.result as T;
  }

  private assertConfigured() {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException({
        code: 'CLOUDFLARE_STREAM_NOT_CONFIGURED',
        message:
          'Cloudflare Stream is not configured. Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN.',
      });
    }
  }
}
