import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma, RecordingStatus } from '@prisma/client';
import type { AuthUser } from '../../auth/auth.types';
import { AccessControlService } from '../../access-control/access-control.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AgoraRecordingService } from '../agora/agora-recording.service';
import { CloudflareStreamService } from '../cloudflare/cloudflare-stream.service';
import { SessionGateway } from '../session/session.gateway';
import { SessionStoreService } from '../session/session-store.service';

@Injectable()
export class RecordingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessControlService: AccessControlService,
    private readonly agoraRecordingService: AgoraRecordingService,
    private readonly cloudflareStreamService: CloudflareStreamService,
    private readonly sessionStore: SessionStoreService,
    private readonly sessionGateway: SessionGateway,
  ) {}

  async startRecording(sessionId: string, user: AuthUser) {
    const identity = this.accessControlService.assertCanChangeRecording(user);

    const session = await this.prisma.liveSession.findUnique({
      where: { sessionId },
      include: { room: true },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    if (session.status !== 'LIVE') {
      throw new BadRequestException('Session must be LIVE to start recording');
    }

    const existingRecording = await this.prisma.recording.findFirst({
      where: {
        sessionId,
        status: {
          in: [RecordingStatus.RECORDING, RecordingStatus.PROCESSING],
        },
      },
      orderBy: {
        startedAt: 'desc',
      },
    });

    if (existingRecording) {
      throw new BadRequestException('Session is already recording');
    }

    const mode = this.agoraRecordingService.getMode();
    const recordingUid = this.agoraRecordingService.getRecordingUid();
    const recording = await this.prisma.recording.create({
      data: {
        sessionId,
        roomId: session.roomId,
        createdBySuperId: identity.anonymousUserId,
        externalCourseId: session.room.externalCourseId,
        externalLevelId: session.room.externalLevelId,
        externalSubLevelId: session.room.externalSubLevelId,
        provider: 'AGORA_CLOUD_RECORDING',
        status: 'REQUESTED',
        title: `Agora recording for ${sessionId}`,
        startedAt: new Date(),
        providerMetadata: {
          mode,
          requestedBy: identity.anonymousUserId,
          requestedAt: new Date().toISOString(),
        } as unknown as Prisma.InputJsonObject,
      },
    });

    const agoraStart = await this.agoraRecordingService.startRecording({
      recordingId: recording.recordingId,
      sessionId,
      channelName: session.channelName,
      recordingUid,
      mode,
    });

    const updatedRecording = await this.prisma.recording.update({
      where: { recordingId: recording.recordingId },
      data: {
        provider: 'AGORA_CLOUD_RECORDING',
        agoraResourceId: agoraStart.resourceId,
        agoraSid: agoraStart.sid,
        status: 'RECORDING',
        providerMetadata: {
          mode,
          recordingUid,
          channelName: session.channelName,
          acquireResponse: agoraStart.acquireResponse,
          startResponse: agoraStart.startResponse,
        } as unknown as Prisma.InputJsonObject,
      },
    });

    if (this.sessionStore.getSessionSnapshot(sessionId)) {
      this.sessionStore.setRecordingStatusForSystem(
        sessionId,
        'RECORDING',
        identity.anonymousUserId,
      );
      this.sessionGateway.broadcastRecordingStatus(sessionId, {
        sessionId,
        status: 'RECORDING',
        changedByAnonymousUserId: identity.anonymousUserId,
      });
    }

    return updatedRecording;
  }

  async stopRecording(recordingId: string, user: AuthUser) {
    const identity = this.accessControlService.assertCanChangeRecording(user);

    const recording = await this.prisma.recording.findUnique({
      where: { recordingId },
      include: { session: true },
    });

    if (!recording) {
      throw new NotFoundException('Recording not found');
    }

    if (recording.createdBySuperId !== identity.anonymousUserId) {
      throw new ForbiddenException('Only the owner SUPER can stop this recording');
    }

    if (recording.status !== 'RECORDING') {
      throw new BadRequestException('Recording is not in RECORDING state');
    }

    const processing = await this.prisma.recording.update({
      where: { recordingId },
      data: {
        status: 'PROCESSING',
      },
    });

    let stopResponse: unknown = null;
    if (recording.agoraResourceId && recording.agoraSid) {
      stopResponse = await this.agoraRecordingService.stopRecording({
        channelName: recording.session.channelName,
        recordingUid:
          (recording.providerMetadata as { recordingUid?: string } | null)
            ?.recordingUid ??
          this.agoraRecordingService.getRecordingUid(),
        resourceId: recording.agoraResourceId,
        sid: recording.agoraSid,
        mode:
          (recording.providerMetadata as { mode?: 'composite' | 'individual' | 'webpage' } | null)
            ?.mode,
      });
    }

    const endedAt = new Date();
    const durationSeconds = Math.max(
      0,
      Math.floor((endedAt.getTime() - recording.startedAt.getTime()) / 1000),
    );

    const ready = await this.prisma.recording.update({
      where: { recordingId },
      data: {
        status: 'READY',
        endedAt,
        durationSeconds,
        cloudflareVideoUid: `mock-cf-${recordingId}`,
        providerMetadata: {
          ...((recording.providerMetadata as Record<string, unknown> | null) ??
            {}),
          stopResponse,
          finalizedAt: endedAt.toISOString(),
        } as unknown as Prisma.InputJsonObject,
      },
    });

    if (this.sessionStore.getSessionSnapshot(recording.sessionId)) {
      this.sessionStore.setRecordingStatusForSystem(
        recording.sessionId,
        'IDLE',
        identity.anonymousUserId,
      );
      this.sessionGateway.broadcastRecordingStatus(recording.sessionId, {
        sessionId: recording.sessionId,
        status: 'IDLE',
        changedByAnonymousUserId: identity.anonymousUserId,
      });
    }

    return {
      processing,
      ready,
    };
  }

  async getRecording(recordingId: string, user: AuthUser) {
    this.accessControlService.assertCanJoinSession(user);

    const recording = await this.prisma.recording.findUnique({
      where: { recordingId },
      include: {
        room: true,
        session: true,
      },
    });

    if (!recording) {
      throw new NotFoundException('Recording not found');
    }

    return recording;
  }

  async listSessionRecordings(sessionId: string, user: AuthUser) {
    this.accessControlService.assertCanJoinSession(user);

    return this.prisma.recording.findMany({
      where: { sessionId },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async getPlaybackUrl(recordingId: string, user: AuthUser) {
    try {
      const identity = this.accessControlService.assertCanViewRecording(user);
      const recording = await this.prisma.recording.findUnique({
        where: { recordingId },
      });

      if (!recording) {
        throw new NotFoundException('Recording not found');
      }

       if (recording.status !== 'READY') {
        throw new BadRequestException('Recording must be READY before playback');
      }

      if (!recording.cloudflareVideoUid) {
        throw new BadRequestException('Recording does not have a Cloudflare video UID');
      }

      const playback = await this.cloudflareStreamService.createSignedPlaybackUrl(
        recording.cloudflareVideoUid,
        3600,
      );

      await this.prisma.recordingAccessLog.create({
        data: {
          recordingId,
          anonymousUserId: identity.anonymousUserId,
          action: 'VIEW',
          result: 'ALLOWED',
          reason: 'Mock playback permission granted',
        },
      });

      return {
        recordingId,
        cloudflareVideoUid: recording.cloudflareVideoUid,
        playbackUrl: playback.playerUrl,
        playerUrl: playback.playerUrl,
        hlsUrl: playback.hlsUrl,
        dashUrl: playback.dashUrl,
        thumbnailUrl: playback.thumbnailUrl,
        expiresIn: playback.expiresIn,
      };
    } catch (error) {
      if (error instanceof ForbiddenException) {
        await this.prisma.recordingAccessLog.create({
          data: {
            recordingId,
            anonymousUserId: user.userId,
            action: 'DENIED',
            result: 'DENIED',
            reason: error.message,
          },
        });
      }

      throw error;
    }
  }

  async registerRecordingVideo(
    recordingId: string,
    user: AuthUser,
    videoUid: string,
  ) {
    this.accessControlService.assertCanChangeRecording(user);

    return this.cloudflareStreamService.registerRecordingVideo(
      recordingId,
      videoUid,
    );
  }
}
