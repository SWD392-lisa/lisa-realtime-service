import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  HandQueueUpdatedEvent,
  MediaStatusPayload,
  MediaStatusChangedEvent,
  RealtimeSession,
  RecordingStatusChangedEvent,
  RecordingStatusPayload,
  ResolvedSessionJoinPayload,
  ScreenShareChangedEvent,
  SessionJoinPayload,
  SessionLeavePayload,
  SessionParticipant,
  SessionSnapshot,
  SpeakerApprovePayload,
} from './session.types';

@Injectable()
export class SessionStoreService {
  private readonly sessions = new Map<string, RealtimeSession>();
  private readonly socketIndex = new Map<
    string,
    { sessionId: string; anonymousUserId: string }
  >();

  join(payload: ResolvedSessionJoinPayload, socketId: string): SessionSnapshot {
    const session = this.sessions.get(payload.sessionId) ?? {
      sessionId: payload.sessionId,
      lmsSessionId: payload.lmsSessionId,
      externalSessionId: payload.externalSessionId,
      participants: [],
      handRaiseQueue: [],
      activeSpeakerIds: [],
      recordingStatus: 'IDLE' as const,
    };

    if (payload.lmsSessionId) {
      session.lmsSessionId = payload.lmsSessionId;
    }
    if (payload.externalSessionId) {
      session.externalSessionId = payload.externalSessionId;
    }

    const existingParticipantIndex = session.participants.findIndex(
      (participant) => participant.anonymousUserId === payload.anonymousUserId,
    );

    const nextParticipant: SessionParticipant = {
      anonymousUserId: payload.anonymousUserId,
      displayName: payload.displayName,
      role: payload.role,
      micEnabled: false,
      cameraEnabled: false,
      screenSharing: false,
      socketId,
    };

    if (existingParticipantIndex >= 0) {
      session.participants[existingParticipantIndex] = nextParticipant;
    } else {
      session.participants.push(nextParticipant);
    }

    if (payload.role !== 'STUDENT') {
      session.activeSpeakerIds = this.unique([
        ...session.activeSpeakerIds,
        payload.anonymousUserId,
      ]);
    }

    this.sessions.set(payload.sessionId, session);
    this.socketIndex.set(socketId, {
      sessionId: payload.sessionId,
      anonymousUserId: payload.anonymousUserId,
    });

    return this.toSnapshot(session);
  }

  leaveBySocket(socketId: string): SessionSnapshot | null {
    const state = this.socketIndex.get(socketId);
    if (!state) {
      return null;
    }

    return this.leave({
      sessionId: state.sessionId,
    }, state.anonymousUserId, socketId);
  }

  leave(
    payload: SessionLeavePayload,
    anonymousUserId: string,
    socketId?: string,
  ): SessionSnapshot | null {
    const session = this.sessions.get(payload.sessionId);
    if (!session) {
      return null;
    }

    session.participants = session.participants.filter(
      (participant) => participant.anonymousUserId !== anonymousUserId,
    );
    session.handRaiseQueue = session.handRaiseQueue.filter(
      (participantId) => participantId !== anonymousUserId,
    );
    session.activeSpeakerIds = session.activeSpeakerIds.filter(
      (participantId) => participantId !== anonymousUserId,
    );

    if (socketId) {
      this.socketIndex.delete(socketId);
    } else {
      for (const [storedSocketId, state] of this.socketIndex.entries()) {
        if (
          state.sessionId === payload.sessionId &&
          state.anonymousUserId === anonymousUserId
        ) {
          this.socketIndex.delete(storedSocketId);
        }
      }
    }

    if (session.participants.length === 0) {
      this.sessions.delete(payload.sessionId);
      return null;
    }

    return this.toSnapshot(session);
  }

  raiseHand(sessionId: string, anonymousUserId: string): HandQueueUpdatedEvent {
    const session = this.requireSession(sessionId);
    const participant = this.requireParticipant(session, anonymousUserId);

    if (participant.role !== 'STUDENT') {
      throw new ForbiddenException('Only STUDENT can raise hand');
    }

    session.handRaiseQueue = this.unique([
      ...session.handRaiseQueue,
      anonymousUserId,
    ]);

    return this.toQueueEvent(session);
  }

  approveSpeaker(
    payload: SpeakerApprovePayload,
    approverAnonymousUserId: string,
  ): {
    session: SessionSnapshot;
    event: {
      sessionId: string;
      targetAnonymousUserId: string;
      approvedByAnonymousUserId: string;
      activeSpeakerIds: string[];
    };
    queue: HandQueueUpdatedEvent;
  } {
    const session = this.requireSession(payload.sessionId);
    const approver = this.requireParticipant(session, approverAnonymousUserId);
    if (approver.role !== 'HOST' && approver.role !== 'SUPER') {
      throw new ForbiddenException('Only HOST or SUPER can approve speaker');
    }

    this.requireParticipant(session, payload.targetAnonymousUserId);
    session.handRaiseQueue = session.handRaiseQueue.filter(
      (participantId) => participantId !== payload.targetAnonymousUserId,
    );
    session.activeSpeakerIds = this.unique([
      ...session.activeSpeakerIds,
      payload.targetAnonymousUserId,
    ]);

    return {
      session: this.toSnapshot(session),
      event: {
        sessionId: payload.sessionId,
        targetAnonymousUserId: payload.targetAnonymousUserId,
        approvedByAnonymousUserId: approverAnonymousUserId,
        activeSpeakerIds: [...session.activeSpeakerIds],
      },
      queue: this.toQueueEvent(session),
    };
  }

  updateMediaStatus(
    payload: MediaStatusPayload,
    anonymousUserId: string,
  ): { session: SessionSnapshot; event: MediaStatusChangedEvent } {
    const session = this.requireSession(payload.sessionId);
    const participant = this.requireParticipant(session, anonymousUserId);

    participant.micEnabled = payload.micEnabled ?? participant.micEnabled;
    participant.cameraEnabled =
      payload.cameraEnabled ?? participant.cameraEnabled;

    return {
      session: this.toSnapshot(session),
      event: {
        sessionId: payload.sessionId,
        anonymousUserId,
        micEnabled: participant.micEnabled,
        cameraEnabled: participant.cameraEnabled,
      },
    };
  }

  setScreenSharing(
    sessionId: string,
    anonymousUserId: string,
    screenSharing: boolean,
  ): { session: SessionSnapshot; event: ScreenShareChangedEvent } {
    const session = this.requireSession(sessionId);
    const participant = this.requireParticipant(session, anonymousUserId);
    participant.screenSharing = screenSharing;

    return {
      session: this.toSnapshot(session),
      event: {
        sessionId,
        anonymousUserId,
        screenSharing,
      },
    };
  }

  setRecordingStatus(
    payload: RecordingStatusPayload,
    anonymousUserId: string,
  ): { session: SessionSnapshot; event: RecordingStatusChangedEvent } {
    const session = this.requireSession(payload.sessionId);
    const participant = this.requireParticipant(session, anonymousUserId);

    if (participant.role !== 'SUPER') {
      throw new ForbiddenException('Only SUPER can change recording status');
    }

    session.recordingStatus = payload.status;

    return {
      session: this.toSnapshot(session),
      event: {
        sessionId: payload.sessionId,
        status: payload.status,
        changedByAnonymousUserId: anonymousUserId,
      },
    };
  }

  setRecordingStatusForSystem(
    sessionId: string,
    status: RealtimeSession['recordingStatus'],
    changedByAnonymousUserId: string,
  ) {
    const session = this.requireSession(sessionId);
    session.recordingStatus = status;

    return {
      session: this.toSnapshot(session),
      event: {
        sessionId,
        status,
        changedByAnonymousUserId,
      },
    };
  }

  getSocketState(socketId: string) {
    return this.socketIndex.get(socketId);
  }

  getSessionSnapshot(sessionId: string): SessionSnapshot | null {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    return this.toSnapshot(session);
  }

  private requireSession(sessionId: string): RealtimeSession {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new NotFoundException('Session not found');
    }

    return session;
  }

  private requireParticipant(
    session: RealtimeSession,
    anonymousUserId: string,
  ): SessionParticipant {
    const participant = session.participants.find(
      (item) => item.anonymousUserId === anonymousUserId,
    );
    if (!participant) {
      throw new NotFoundException('Participant not found');
    }

    return participant;
  }

  private toSnapshot(session: RealtimeSession): SessionSnapshot {
    return {
      sessionId: session.sessionId,
      lmsSessionId: session.lmsSessionId,
      externalSessionId: session.externalSessionId,
      participants: session.participants.map((participant) => ({
        anonymousUserId: participant.anonymousUserId,
        displayName: participant.displayName,
        role: participant.role,
        micEnabled: participant.micEnabled,
        cameraEnabled: participant.cameraEnabled,
        screenSharing: participant.screenSharing,
        isActiveSpeaker: session.activeSpeakerIds.includes(
          participant.anonymousUserId,
        ),
      })),
      handRaiseQueue: [...session.handRaiseQueue],
      activeSpeakerIds: [...session.activeSpeakerIds],
      recordingStatus: session.recordingStatus,
      onlineCount: session.participants.length,
    };
  }

  private toQueueEvent(session: RealtimeSession): HandQueueUpdatedEvent {
    return {
      sessionId: session.sessionId,
      handRaiseQueue: [...session.handRaiseQueue],
      queuedParticipants: session.handRaiseQueue
        .map((participantId) =>
          session.participants.find(
            (participant) => participant.anonymousUserId === participantId,
          ),
        )
        .filter((participant): participant is SessionParticipant => Boolean(participant))
        .map((participant) => ({
          anonymousUserId: participant.anonymousUserId,
          displayName: participant.displayName,
          role: participant.role,
        })),
    };
  }

  private unique(values: string[]) {
    return [...new Set(values)];
  }
}
