import { Injectable } from '@nestjs/common';
import {
  HandRaiseRequestStatus,
  RecordingStatus,
  type RoleInSession,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  RecordingStatusPayload,
  ResolvedSessionJoinPayload,
  SessionJoinPayload,
  SessionSnapshot,
  SpeakerApprovePayload,
} from './session.types';

@Injectable()
export class SessionPersistenceService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureLiveSession(
    payload: ResolvedSessionJoinPayload,
    roleInSession: RoleInSession,
  ) {
    const roomId = this.roomIdForSession(payload.sessionId);
    const channelName = this.channelNameForSession(payload.sessionId);

    const existingRoom = await this.prisma.room.findUnique({
      where: { roomId },
    });

    if (!existingRoom) {
      await this.prisma.room.create({
        data: {
          roomId,
          title: `Room ${payload.sessionId}`,
          hostAnonymousId: payload.anonymousUserId,
          defaultChannelName: channelName,
          status: 'OPEN',
        },
      });
    } else if (
      existingRoom.hostAnonymousId !== payload.anonymousUserId &&
      roleInSession !== 'STUDENT'
    ) {
      await this.prisma.room.update({
        where: { roomId },
        data: {
          hostAnonymousId: payload.anonymousUserId,
          status: 'OPEN',
        },
      });
    }

    const existingSession = await this.prisma.liveSession.findUnique({
      where: { sessionId: payload.sessionId },
    });

    if (!existingSession) {
      await this.prisma.liveSession.create({
        data: {
          sessionId: payload.sessionId,
          roomId,
          channelName,
          status: 'LIVE',
          startedAt: new Date(),
          peakParticipants: 0,
        },
      });
      return;
    }

    if (existingSession.status !== 'LIVE') {
      await this.prisma.liveSession.update({
        where: { sessionId: payload.sessionId },
        data: {
          status: 'LIVE',
          endedAt: null,
        },
      });
    }
  }

  async markParticipantJoined(
    payload: ResolvedSessionJoinPayload,
    roleInSession: RoleInSession,
    snapshot: SessionSnapshot,
  ) {
    const liveSession = await this.prisma.liveSession.findUnique({
      where: { sessionId: payload.sessionId },
      select: { peakParticipants: true },
    });

    await this.prisma.sessionParticipant.upsert({
      where: {
        sessionId_anonymousUserId: {
          sessionId: payload.sessionId,
          anonymousUserId: payload.anonymousUserId,
        },
      },
      create: {
        sessionId: payload.sessionId,
        anonymousUserId: payload.anonymousUserId,
        displayName: payload.displayName,
        roleInSession,
        joinedAt: new Date(),
      },
      update: {
        displayName: payload.displayName,
        roleInSession,
        joinedAt: new Date(),
        leftAt: null,
      },
    });

    await this.prisma.liveSession.update({
      where: { sessionId: payload.sessionId },
      data: {
        peakParticipants: Math.max(
          snapshot.onlineCount,
          liveSession?.peakParticipants ?? 0,
        ),
      },
    });
  }

  async markParticipantLeft(
    sessionId: string,
    anonymousUserId: string,
    snapshot: SessionSnapshot | null,
  ) {
    await this.prisma.sessionParticipant.updateMany({
      where: {
        sessionId,
        anonymousUserId,
      },
      data: {
        leftAt: new Date(),
      },
    });

    await this.prisma.handRaiseRequest.updateMany({
      where: {
        sessionId,
        anonymousUserId,
        status: HandRaiseRequestStatus.WAITING,
      },
      data: {
        status: HandRaiseRequestStatus.CANCELLED,
        handledAt: new Date(),
        handledBy: anonymousUserId,
      },
    });

    if (!snapshot) {
      await this.prisma.liveSession.updateMany({
        where: { sessionId },
        data: {
          status: 'ENDED',
          endedAt: new Date(),
        },
      });
      await this.prisma.room.updateMany({
        where: { roomId: this.roomIdForSession(sessionId) },
        data: {
          status: 'CLOSED',
        },
      });
      return;
    }

  }

  async createHandRaiseRequest(sessionId: string, anonymousUserId: string) {
    await this.prisma.handRaiseRequest.create({
      data: {
        sessionId,
        anonymousUserId,
        status: HandRaiseRequestStatus.WAITING,
      },
    });
  }

  async approveHandRaise(
    payload: SpeakerApprovePayload,
    handledByAnonymousUserId: string,
  ) {
    const waitingRequest = await this.prisma.handRaiseRequest.findFirst({
      where: {
        sessionId: payload.sessionId,
        anonymousUserId: payload.targetAnonymousUserId,
        status: HandRaiseRequestStatus.WAITING,
      },
      orderBy: {
        requestedAt: 'desc',
      },
    });

    if (!waitingRequest) {
      return;
    }

    await this.prisma.handRaiseRequest.update({
      where: {
        requestId: waitingRequest.requestId,
      },
      data: {
        status: HandRaiseRequestStatus.APPROVED,
        handledAt: new Date(),
        handledBy: handledByAnonymousUserId,
      },
    });
  }

  async syncRecordingStatus(
    payload: RecordingStatusPayload,
    createdBySuperId: string,
  ) {
    const roomId = this.roomIdForSession(payload.sessionId);

    if (payload.status === 'RECORDING') {
      await this.prisma.recording.create({
        data: {
          sessionId: payload.sessionId,
          roomId,
          createdBySuperId,
          provider: 'MOCK',
          status: 'RECORDING',
          title: `Mock recording for ${payload.sessionId}`,
          startedAt: new Date(),
        },
      });
      return;
    }

    const activeRecording = await this.prisma.recording.findFirst({
      where: {
        sessionId: payload.sessionId,
        status: RecordingStatus.RECORDING,
      },
      orderBy: {
        startedAt: 'desc',
      },
    });

    if (!activeRecording) {
      return;
    }

    const endedAt = new Date();
    const durationSeconds = Math.max(
      0,
      Math.floor(
        (endedAt.getTime() - activeRecording.startedAt.getTime()) / 1000,
      ),
    );

    await this.prisma.recording.update({
      where: { recordingId: activeRecording.recordingId },
      data: {
        status: 'READY',
        endedAt,
        durationSeconds,
      },
    });
  }

  async getRecordingWithAccess(recordingId: string, anonymousUserId: string) {
    const recording = await this.prisma.recording.findUnique({
      where: { recordingId },
    });

    if (!recording) {
      return null;
    }

    return {
      recording,
      anonymousUserId,
      playbackUrl: `https://mock-stream.local/recordings/${recordingId}`,
    };
  }

  async createRecordingAccessLog(params: {
    recordingId: string;
    anonymousUserId: string;
    action: 'VIEW' | 'DOWNLOAD' | 'DENIED';
    result: 'ALLOWED' | 'DENIED';
    reason: string;
  }) {
    await this.prisma.recordingAccessLog.create({
      data: params,
    });
  }

  private roomIdForSession(sessionId: string) {
    return `room-${sessionId}`;
  }

  private channelNameForSession(sessionId: string) {
    return `channel-${sessionId}`;
  }
}
