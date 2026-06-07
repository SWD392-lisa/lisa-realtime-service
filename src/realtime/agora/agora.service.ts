import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RtcRole, RtcTokenBuilder } from 'agora-token';

const DEFAULT_TOKEN_TTL_SECONDS = 60 * 60;

export interface AgoraTokenResult {
  appId: string;
  token: string;
  channelName: string;
  uid: string;
  role: 'publisher' | 'subscriber';
  expiresAt: number;
}

@Injectable()
export class AgoraService {
  constructor(private readonly config: ConfigService) {}

  createRtcToken(params: {
    channelName: string;
    uid: string;
    role?: 'publisher' | 'subscriber';
    ttlSeconds?: number;
  }): AgoraTokenResult {
    const appId = this.config.get<string>('AGORA_APP_ID');
    const appCertificate = this.config.get<string>('AGORA_APP_CERTIFICATE');

    if (!appId || !appCertificate) {
      throw new InternalServerErrorException(
        'Agora credentials are not configured',
      );
    }

    const role = params.role ?? 'subscriber';
    const ttlSeconds = params.ttlSeconds ?? DEFAULT_TOKEN_TTL_SECONDS;
    const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
    const rtcRole =
      role === 'publisher' ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;

    const token = RtcTokenBuilder.buildTokenWithUserAccount(
      appId,
      appCertificate,
      params.channelName,
      params.uid,
      rtcRole,
      ttlSeconds,
      ttlSeconds,
    );

    return {
      appId,
      token,
      channelName: params.channelName,
      uid: params.uid,
      role,
      expiresAt,
    };
  }
}
