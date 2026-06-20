import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { ForbiddenException as HttpForbiddenException } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { AccessControlService } from '../../access-control/access-control.service';
import { AuthService } from '../../auth/auth.service';
import type { AuthUser } from '../../auth/auth.types';
import { SessionStoreService } from './session-store.service';
import { SessionPersistenceService } from './session-persistence.service';
import type {
  HandRaisePayload,
  MediaStatusPayload,
  RecordingStatusPayload,
  ResolvedSessionJoinPayload,
  ScreenSharePayload,
  SessionJoinPayload,
  SessionLeavePayload,
  SpeakerApprovePayload,
} from './session.types';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class SessionGateway implements OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly accessControlService: AccessControlService,
    private readonly authService: AuthService,
    private readonly sessionStore: SessionStoreService,
    private readonly sessionPersistenceService: SessionPersistenceService,
  ) {}

  async handleDisconnect(client: Socket) {
    const socketState = this.sessionStore.getSocketState(client.id);
    const snapshot = this.sessionStore.leaveBySocket(client.id);

    if (!socketState) {
      return;
    }

    client.leave(socketState.sessionId);
    await this.sessionPersistenceService.markParticipantLeft(
      socketState.sessionId,
      socketState.anonymousUserId,
      snapshot,
    );
    this.broadcastPresence(socketState.sessionId, snapshot);
    if (snapshot) {
      this.server
        .to(socketState.sessionId)
        .emit('hand.queue.updated', this.queueFromSnapshot(snapshot));
    }
  }

  broadcastRecordingStatus(
    sessionId: string,
    event: {
      sessionId: string;
      status: 'IDLE' | 'RECORDING';
      changedByAnonymousUserId: string;
    },
  ) {
    const snapshot = this.sessionStore.getSessionSnapshot(sessionId);
    this.server.to(sessionId).emit('recording.status.changed', event);
    if (snapshot) {
      this.server.to(sessionId).emit('presence.updated', { session: snapshot });
    }
  }

  @SubscribeMessage('session.join')
  async handleSessionJoin(
    @MessageBody() payload: SessionJoinPayload,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      this.assertJoinPayload(payload);
      const user = this.requireSocketUser(client);
      const identity = this.accessControlService.assertCanJoinSession(user);
      const nextPayload: ResolvedSessionJoinPayload = {
        ...payload,
        anonymousUserId: user.userId,
        displayName: user.displayName?.trim() || payload.displayName,
        role: identity.role,
      };
      await this.sessionPersistenceService.ensureLiveSession(
        nextPayload,
        identity.role,
      );
      const snapshot = this.sessionStore.join(nextPayload, client.id);
      await this.sessionPersistenceService.markParticipantJoined(
        nextPayload,
        identity.role,
        snapshot,
      );
      await client.join(payload.sessionId);
      this.broadcastPresence(payload.sessionId, snapshot);
      this.server
        .to(payload.sessionId)
        .emit('hand.queue.updated', this.queueFromSnapshot(snapshot));

      return {
        success: true,
        session: snapshot,
      };
    } catch (error) {
      throw this.toWsException(error);
    }
  }

  @SubscribeMessage('session.leave')
  async handleSessionLeave(
    @MessageBody() payload: SessionLeavePayload,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const state = this.sessionStore.getSocketState(client.id);
      if (!state) {
        return { success: true, session: null };
      }

      const snapshot = this.sessionStore.leave(
        payload,
        state.anonymousUserId,
        client.id,
      );
      await client.leave(payload.sessionId);
      await this.sessionPersistenceService.markParticipantLeft(
        payload.sessionId,
        state.anonymousUserId,
        snapshot,
      );
      this.broadcastPresence(payload.sessionId, snapshot);
      if (snapshot) {
        this.server
          .to(payload.sessionId)
          .emit('hand.queue.updated', this.queueFromSnapshot(snapshot));
      }

      return {
        success: true,
        session: snapshot,
      };
    } catch (error) {
      throw this.toWsException(error);
    }
  }

  @SubscribeMessage('hand.raise')
  async handleHandRaise(
    @MessageBody() payload: HandRaisePayload,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const state = this.requireSocketState(client.id);
      const queue = this.sessionStore.raiseHand(
        payload.sessionId,
        state.anonymousUserId,
      );
      await this.sessionPersistenceService.createHandRaiseRequest(
        payload.sessionId,
        state.anonymousUserId,
      );
      this.server.to(payload.sessionId).emit('hand.raise', {
        sessionId: payload.sessionId,
        anonymousUserId: state.anonymousUserId,
      });
      this.server.to(payload.sessionId).emit('hand.queue.updated', queue);

      return { success: true, queue };
    } catch (error) {
      throw this.toWsException(error);
    }
  }

  @SubscribeMessage('speaker.approve')
  async handleSpeakerApprove(
    @MessageBody() payload: SpeakerApprovePayload,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const state = this.requireSocketState(client.id);
      this.accessControlService.assertCanApproveSpeaker(state.anonymousUserId);
      const result = this.sessionStore.approveSpeaker(
        payload,
        state.anonymousUserId,
      );
      await this.sessionPersistenceService.approveHandRaise(
        payload,
        state.anonymousUserId,
      );

      this.server
        .to(payload.sessionId)
        .emit('speaker.approved', result.event);
      this.server.to(payload.sessionId).emit('hand.queue.updated', result.queue);
      this.server
        .to(payload.sessionId)
        .emit('presence.updated', { session: result.session });

      return { success: true, session: result.session };
    } catch (error) {
      throw this.toWsException(error);
    }
  }

  @SubscribeMessage('media.status.changed')
  handleMediaStatusChanged(
    @MessageBody() payload: MediaStatusPayload,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const state = this.requireSocketState(client.id);
      const result = this.sessionStore.updateMediaStatus(
        payload,
        state.anonymousUserId,
      );

      this.server
        .to(payload.sessionId)
        .emit('media.status.changed', result.event);
      this.server
        .to(payload.sessionId)
        .emit('presence.updated', { session: result.session });

      return { success: true, session: result.session };
    } catch (error) {
      throw this.toWsException(error);
    }
  }

  @SubscribeMessage('screen.share.started')
  handleScreenShareStarted(
    @MessageBody() payload: ScreenSharePayload,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const state = this.requireSocketState(client.id);
      const result = this.sessionStore.setScreenSharing(
        payload.sessionId,
        state.anonymousUserId,
        true,
      );

      this.server
        .to(payload.sessionId)
        .emit('screen.share.started', result.event);
      this.server
        .to(payload.sessionId)
        .emit('presence.updated', { session: result.session });

      return { success: true, session: result.session };
    } catch (error) {
      throw this.toWsException(error);
    }
  }

  @SubscribeMessage('screen.share.stopped')
  handleScreenShareStopped(
    @MessageBody() payload: ScreenSharePayload,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const state = this.requireSocketState(client.id);
      const result = this.sessionStore.setScreenSharing(
        payload.sessionId,
        state.anonymousUserId,
        false,
      );

      this.server
        .to(payload.sessionId)
        .emit('screen.share.stopped', result.event);
      this.server
        .to(payload.sessionId)
        .emit('presence.updated', { session: result.session });

      return { success: true, session: result.session };
    } catch (error) {
      throw this.toWsException(error);
    }
  }

  @SubscribeMessage('recording.status.changed')
  async handleRecordingStatusChanged(
    @MessageBody() payload: RecordingStatusPayload,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const state = this.requireSocketState(client.id);
      this.accessControlService.assertCanChangeRecording(state.anonymousUserId);
      const result = this.sessionStore.setRecordingStatus(
        payload,
        state.anonymousUserId,
      );
      await this.sessionPersistenceService.syncRecordingStatus(
        payload,
        state.anonymousUserId,
      );

      this.server
        .to(payload.sessionId)
        .emit('recording.status.changed', result.event);
      this.server
        .to(payload.sessionId)
        .emit('presence.updated', { session: result.session });

      return { success: true, session: result.session };
    } catch (error) {
      throw this.toWsException(error);
    }
  }

  private broadcastPresence(sessionId: string, snapshot: unknown) {
    this.server.to(sessionId).emit('presence.updated', {
      session: snapshot,
    });
  }

  private requireSocketState(socketId: string) {
    const state = this.sessionStore.getSocketState(socketId);
    if (!state) {
      throw new WsException('Socket is not in a session');
    }

    return state;
  }

  private assertJoinPayload(payload: SessionJoinPayload) {
    if (!payload.sessionId?.trim()) {
      throw new WsException('sessionId is required');
    }
    if (!payload.displayName?.trim()) {
      throw new WsException('displayName is required');
    }
  }

  private requireSocketUser(client: Socket): AuthUser {
    const headerToken = this.authService.extractBearerToken(
      client.handshake.headers.authorization,
    );
    const handshakeToken = this.readHandshakeToken(client);
    const token = headerToken || handshakeToken;
    if (!token) {
      throw new WsException('Access token is required for session.join');
    }

    return this.authService.verifyAccessToken(token);
  }

  private readHandshakeToken(client: Socket): string | undefined {
    const token = client.handshake.auth?.token;
    if (typeof token !== 'string' || token.trim().length === 0) {
      return undefined;
    }

    return token.trim();
  }

  private queueFromSnapshot(snapshot: {
    sessionId: string;
    handRaiseQueue: string[];
    participants: Array<{
      anonymousUserId: string;
      displayName: string;
      role: 'SUPER' | 'HOST' | 'STUDENT';
    }>;
  }) {
    return {
      sessionId: snapshot.sessionId,
      handRaiseQueue: snapshot.handRaiseQueue,
      queuedParticipants: snapshot.handRaiseQueue
        .map((participantId) =>
          snapshot.participants.find(
            (participant) => participant.anonymousUserId === participantId,
          ),
        )
        .filter(Boolean),
    };
  }

  private toWsException(error: unknown) {
    if (error instanceof WsException) {
      return error;
    }

    if (error instanceof HttpForbiddenException) {
      return new WsException(error.message);
    }

    if (error instanceof Error) {
      return new WsException(error.message);
    }

    return new WsException('Unexpected realtime error');
  }
}
