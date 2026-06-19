import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RtcRole, RtcTokenBuilder } from 'agora-token';
import type { AuthUser } from '../../auth/auth.types';
import { AccessControlService } from '../../access-control/access-control.service';
import { SessionStoreService } from '../session/session-store.service';
import type { AgoraMediaType, AgoraTokenRequest, AgoraTokenResponse } from './agora.types';

@Injectable()
export class AgoraTokenService {
  constructor(
    private readonly configService: ConfigService,
    private readonly accessControlService: AccessControlService,
    private readonly sessionStore: SessionStoreService,
  ) {}

  createToken(payload: AgoraTokenRequest, user: AuthUser): AgoraTokenResponse {
    this.assertConfigured();
    this.assertPayload(payload);

    const identity = this.accessControlService.assertCanJoinSession(user);
    const session = this.sessionStore.getSessionSnapshot(payload.sessionId);
    if (!session) {
      throw new NotFoundException('Session not found in realtime store');
    }

    const participant = session.participants.find(
      (item) => item.anonymousUserId === identity.anonymousUserId,
    );
    if (!participant) {
      throw new ForbiddenException('User must join session before requesting Agora token');
    }

    const canPublish =
      identity.role !== 'STUDENT' ||
      session.activeSpeakerIds.includes(identity.anonymousUserId);

    this.assertMediaPermission(payload.mediaType, identity.role, canPublish);

    const appId = this.configService.get<string>('AGORA_APP_ID')!.trim();
    const appCertificate = this.configService
      .get<string>('AGORA_APP_CERTIFICATE')!
      .trim();
    const expiresIn = this.getExpireSeconds();
    const rtcRole = this.isPublisher(payload.mediaType)
      ? RtcRole.PUBLISHER
      : RtcRole.SUBSCRIBER;
    const uid = this.buildUid(
      payload.sessionId,
      identity.anonymousUserId,
      payload.mediaType,
    );
    const token = RtcTokenBuilder.buildTokenWithUid(
      appId,
      appCertificate,
      payload.channelName,
      uid,
      rtcRole,
      expiresIn,
      expiresIn,
    );

    return {
      appId,
      channelName: payload.channelName,
      uid,
      token,
      expiresIn,
    };
  }

  buildUid(
    sessionId: string,
    anonymousUserId: string,
    mediaType: AgoraMediaType,
  ): number {
    const suffix = mediaType === 'screen' ? 'screen' : 'main';
    const seed = `${sessionId}:${anonymousUserId}:${suffix}`;
    let hash = 2166136261;

    for (let index = 0; index < seed.length; index += 1) {
      hash ^= seed.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }

    const normalized = hash >>> 0;
    return normalized === 0 ? 1 : normalized;
  }

  isConfigured() {
    return Boolean(
      this.configService.get<string>('AGORA_APP_ID')?.trim() &&
        this.configService.get<string>('AGORA_APP_CERTIFICATE')?.trim(),
    );
  }

  private assertConfigured() {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        'Agora is not configured. Set AGORA_APP_ID and AGORA_APP_CERTIFICATE.',
      );
    }
  }

  private getExpireSeconds() {
    const rawValue = this.configService.get<string>('AGORA_TOKEN_EXPIRE_SECONDS');
    if (!rawValue) {
      return 3600;
    }

    const parsedValue = Number(rawValue);
    if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
      throw new BadRequestException('AGORA_TOKEN_EXPIRE_SECONDS must be a positive number');
    }

    return Math.floor(parsedValue);
  }

  private assertPayload(payload: AgoraTokenRequest) {
    if (!payload.sessionId?.trim()) {
      throw new BadRequestException('sessionId is required');
    }
    if (!payload.channelName?.trim()) {
      throw new BadRequestException('channelName is required');
    }
    if (!['audience', 'speaker', 'host', 'screen'].includes(payload.mediaType)) {
      throw new BadRequestException(
        'mediaType must be audience, speaker, host, or screen',
      );
    }
  }

  private assertMediaPermission(
    mediaType: AgoraMediaType,
    role: 'SUPER' | 'HOST' | 'STUDENT',
    canPublish: boolean,
  ) {
    if (mediaType === 'audience') {
      return;
    }

    if (mediaType === 'host' && role === 'STUDENT') {
      throw new ForbiddenException('STUDENT cannot request host token');
    }

    if (!canPublish) {
      throw new ForbiddenException(
        'STUDENT must be approved as speaker before requesting publish token',
      );
    }
  }

  private isPublisher(mediaType: AgoraMediaType) {
    return mediaType === 'speaker' || mediaType === 'host' || mediaType === 'screen';
  }
}
