// @ts-nocheck
import { ForbiddenException } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AuthService } from '../../auth/auth.service';
import type { AuthUser } from '../../auth/auth.types';
import { AgoraService } from '../agora/agora.service';
import {
  assertNonEmptyString,
  mapAuthRoleToParticipantRole,
  optionalTrimmedString,
} from './dto/room.dto';
import type { RoomParticipantView } from './room.service';
import { RoomService } from './room.service';

type AuthenticatedSocket = Socket & { user: AuthUser };

type ClientRoomState = {
  userId: string;
  roomId: string;
};

type JoinRoomPayload = {
  roomId: string;
  avatarPersona?: string;
  isAnonymous?: boolean;
};

type TargetUserPayload = {
  roomId?: string;
  targetUserId: string;
};

@WebSocketGateway({ cors: true })
export class RoomGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly clientState = new Map<string, ClientRoomState>();
  private readonly userSockets = new Map<string, string>();

  constructor(
    private readonly roomService: RoomService,
    private readonly agoraService: AgoraService,
    private readonly authService: AuthService,
  ) {}

  afterInit(server: Server) {
    server.use((socket, next) => {
      try {
        const token = this.getSocketToken(socket);
        (socket as AuthenticatedSocket).user = token
          ? this.authService.verifyAccessToken(token)
          : this.authService.createDevUser({
              userId: socket.handshake.auth?.devUserId,
              role: socket.handshake.auth?.devRole,
              email: socket.handshake.auth?.devEmail,
              displayName: socket.handshake.auth?.devDisplayName,
            });
        return next();
      } catch (error) {
        return next(error instanceof Error ? error : new Error('Unauthorized'));
      }
    });
  }

  handleConnection(client: AuthenticatedSocket) {
    client.emit('connected', {
      socketId: client.id,
      user: client.user,
    });
  }

  async handleDisconnect(client: AuthenticatedSocket) {
    const state = this.clientState.get(client.id);
    if (!state) {
      return;
    }

    await this.leaveCurrentRoom(client, state);
  }

  @SubscribeMessage('join_room')
  async handleJoinRoom(
    @MessageBody() data: JoinRoomPayload,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      const user = this.getSocketUser(client);
      const role = mapAuthRoleToParticipantRole(user.role);
      const roomId = assertNonEmptyString(data?.roomId, 'roomId');
      const result = await this.roomService.joinRoom({
        roomId,
        userId: user.userId,
        displayName: user.displayName,
        avatarPersona: optionalTrimmedString(data?.avatarPersona),
        rawRole: user.rawRole,
        role,
        isAnonymous: data?.isAnonymous ?? true,
      });
      const state = {
        roomId: result.room.id,
        userId: result.participant.userId,
      };

      this.clientState.set(client.id, state);
      this.userSockets.set(
        this.userSocketKey(state.roomId, state.userId),
        client.id,
      );
      await client.join(state.roomId);

      const agora = this.agoraService.createRtcToken({
        channelName: result.room.agoraChannelName,
        uid: result.participant.agoraUid,
        role: result.participant.isSpeaker ? 'publisher' : 'subscriber',
      });

      this.server
        .to(state.roomId)
        .emit('participant_list_updated', result.participants);
      this.server
        .to(state.roomId)
        .emit('user_joined', this.toParticipantEvent(result.participant));

      return {
        success: true,
        room: result.room,
        participant: result.participant,
        participants: result.participants,
        agora,
      };
    } catch (error) {
      throw this.toWsException(error);
    }
  }

  @SubscribeMessage('join-room')
  async handleJoinRoomAlias(
    @MessageBody() data: JoinRoomPayload,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    return this.handleJoinRoom(data, client);
  }

  @SubscribeMessage('leave_room')
  async handleLeaveRoom(@ConnectedSocket() client: AuthenticatedSocket) {
    const state = this.clientState.get(client.id);
    if (!state) {
      return { success: true };
    }

    const participants = await this.leaveCurrentRoom(client, state);
    return { success: true, participants };
  }

  @SubscribeMessage('leave-room')
  async handleLeaveRoomAlias(@ConnectedSocket() client: AuthenticatedSocket) {
    return this.handleLeaveRoom(client);
  }

  @SubscribeMessage('raise_hand')
  async handleRaiseHand(@ConnectedSocket() client: AuthenticatedSocket) {
    return this.setHandRaised(client, true);
  }

  @SubscribeMessage('raise-hand')
  async handleRaiseHandAlias(@ConnectedSocket() client: AuthenticatedSocket) {
    return this.handleRaiseHand(client);
  }

  @SubscribeMessage('lower_hand')
  async handleLowerHand(@ConnectedSocket() client: AuthenticatedSocket) {
    return this.setHandRaised(client, false);
  }

  @SubscribeMessage('lower-hand')
  async handleLowerHandAlias(@ConnectedSocket() client: AuthenticatedSocket) {
    return this.handleLowerHand(client);
  }

  @SubscribeMessage('toggle_mic')
  async handleToggleMic(
    @MessageBody() data: { isMicOn: boolean },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    return this.setMic(client, Boolean(data?.isMicOn));
  }

  @SubscribeMessage('mute_mic')
  async handleMuteMic(
    @MessageBody() data: Partial<TargetUserPayload>,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    return this.setMic(client, false, data?.targetUserId, data?.roomId);
  }

  @SubscribeMessage('mute-user')
  async handleMuteUserAlias(
    @MessageBody() data: Partial<TargetUserPayload>,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    return this.handleMuteMic(data, client);
  }

  @SubscribeMessage('unmute_mic')
  async handleUnmuteMic(
    @MessageBody() data: Partial<TargetUserPayload>,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    return this.setMic(client, true, data?.targetUserId, data?.roomId);
  }

  @SubscribeMessage('unmute-user')
  async handleUnmuteUserAlias(
    @MessageBody() data: Partial<TargetUserPayload>,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    return this.handleUnmuteMic(data, client);
  }

  @SubscribeMessage('approve_speaker')
  async handleApproveSpeaker(
    @MessageBody() data: TargetUserPayload,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      const state = this.getClientState(client);
      this.assertRoomManager(client.user);
      const targetUserId = assertNonEmptyString(
        data?.targetUserId,
        'targetUserId',
      );
      const roomId = data.roomId ?? state.roomId;
      const participant = await this.roomService.approveSpeaker(
        roomId,
        targetUserId,
      );
      const room = await this.roomService.getRoom(roomId);
      const participants = await this.roomService.listParticipants(roomId);
      const socketId = this.userSockets.get(
        this.userSocketKey(roomId, targetUserId),
      );

      if (socketId) {
        this.server.to(socketId).emit('agora_token_refreshed', {
          reason: 'approved_to_speak',
          agora: this.agoraService.createRtcToken({
            channelName: room.agoraChannelName,
            uid: participant.agoraUid,
            role: 'publisher',
          }),
        });
      }

      this.server
        .to(roomId)
        .emit('speaker_approved', this.toParticipantEvent(participant));
      this.server.to(roomId).emit('participant_list_updated', participants);

      return { success: true, participant, participants };
    } catch (error) {
      throw this.toWsException(error);
    }
  }

  @SubscribeMessage('approve-speaker')
  async handleApproveSpeakerAlias(
    @MessageBody() data: TargetUserPayload,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    return this.handleApproveSpeaker(data, client);
  }

  @SubscribeMessage('remove_speaker')
  async handleRemoveSpeaker(
    @MessageBody() data: TargetUserPayload,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      const state = this.getClientState(client);
      this.assertRoomManager(client.user);
      const targetUserId = assertNonEmptyString(
        data?.targetUserId,
        'targetUserId',
      );
      const roomId = data.roomId ?? state.roomId;
      const participant = await this.roomService.removeSpeaker(
        roomId,
        targetUserId,
      );
      const participants = await this.roomService.listParticipants(roomId);

      this.server
        .to(roomId)
        .emit('speaker_removed', this.toParticipantEvent(participant));
      this.server.to(roomId).emit('participant_list_updated', participants);

      return { success: true, participant, participants };
    } catch (error) {
      throw this.toWsException(error);
    }
  }

  @SubscribeMessage('remove-speaker')
  async handleRemoveSpeakerAlias(
    @MessageBody() data: TargetUserPayload,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    return this.handleRemoveSpeaker(data, client);
  }

  @SubscribeMessage('end_room')
  async handleEndRoom(@ConnectedSocket() client: AuthenticatedSocket) {
    try {
      const state = this.getClientState(client);
      const room = await this.roomService.getRoom(state.roomId);
      if (
        client.user.role !== 'CREATOR' &&
        room.hostUserId !== client.user.userId
      ) {
        throw new ForbiddenException(
          'Only the room owner or creator can end room',
        );
      }

      const endedRoom = await this.roomService.endRoom(state.roomId);
      this.server.to(state.roomId).emit('room_ended', endedRoom);
      return { success: true, room: endedRoom };
    } catch (error) {
      throw this.toWsException(error);
    }
  }

  @SubscribeMessage('end-room')
  async handleEndRoomAlias(@ConnectedSocket() client: AuthenticatedSocket) {
    return this.handleEndRoom(client);
  }

  @SubscribeMessage('enable-video')
  async handleEnableVideo(@ConnectedSocket() client: AuthenticatedSocket) {
    return this.setVideo(client, true);
  }

  @SubscribeMessage('disable-video')
  async handleDisableVideo(@ConnectedSocket() client: AuthenticatedSocket) {
    return this.setVideo(client, false);
  }

  @SubscribeMessage('remove-user')
  async handleRemoveUser(
    @MessageBody() data: TargetUserPayload,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      const state = this.getClientState(client);
      this.assertRoomManager(client.user);
      const targetUserId = assertNonEmptyString(
        data?.targetUserId,
        'targetUserId',
      );
      const roomId = data.roomId ?? state.roomId;
      const participants = await this.roomService.leaveRoom(
        roomId,
        targetUserId,
      );
      const socketId = this.userSockets.get(
        this.userSocketKey(roomId, targetUserId),
      );

      if (socketId) {
        this.server.to(socketId).emit('removed_from_room', { roomId });
        this.server.sockets.sockets.get(socketId)?.leave(roomId);
      }

      this.userSockets.delete(this.userSocketKey(roomId, targetUserId));
      this.server.to(roomId).emit('user_removed', {
        roomId,
        userId: targetUserId,
      });
      this.server.to(roomId).emit('participant_list_updated', participants);

      return { success: true, participants };
    } catch (error) {
      throw this.toWsException(error);
    }
  }

  private async setHandRaised(
    client: AuthenticatedSocket,
    isHandRaised: boolean,
  ) {
    try {
      const state = this.getClientState(client);
      const participant = await this.roomService.setHandRaised(
        state.roomId,
        client.user.userId,
        isHandRaised,
      );
      const participants = await this.roomService.listParticipants(
        state.roomId,
      );

      this.server
        .to(state.roomId)
        .emit(
          isHandRaised ? 'hand_raised' : 'hand_lowered',
          this.toParticipantEvent(participant),
        );
      this.server
        .to(state.roomId)
        .emit('participant_list_updated', participants);

      return { success: true, participant, participants };
    } catch (error) {
      throw this.toWsException(error);
    }
  }

  private async setMic(
    client: AuthenticatedSocket,
    isMicOn: boolean,
    targetUserId?: string,
    requestedRoomId?: string,
  ) {
    try {
      const state = this.getClientState(client);
      const userId = targetUserId
        ? assertNonEmptyString(targetUserId, 'targetUserId')
        : client.user.userId;
      const roomId = requestedRoomId ?? state.roomId;

      if (userId !== client.user.userId) {
        this.assertRoomManager(client.user);
        if (isMicOn) {
          throw new ForbiddenException('Managers can only mute other users');
        }
      }

      const participant = await this.roomService.setMic(
        roomId,
        userId,
        isMicOn,
      );
      const participants = await this.roomService.listParticipants(roomId);

      this.server
        .to(roomId)
        .emit(
          isMicOn ? 'mic_unmuted' : 'mic_muted',
          this.toParticipantEvent(participant),
        );
      this.server.to(roomId).emit('participant_list_updated', participants);

      return { success: true, participant, participants };
    } catch (error) {
      throw this.toWsException(error);
    }
  }

  private async setVideo(client: AuthenticatedSocket, isVideoEnabled: boolean) {
    try {
      const state = this.getClientState(client);
      const participant = await this.roomService.setVideo(
        state.roomId,
        client.user.userId,
        isVideoEnabled,
      );
      const participants = await this.roomService.listParticipants(
        state.roomId,
      );

      this.server
        .to(state.roomId)
        .emit(
          isVideoEnabled ? 'video_enabled' : 'video_disabled',
          this.toParticipantEvent(participant),
        );
      this.server
        .to(state.roomId)
        .emit('participant_list_updated', participants);

      return { success: true, participant, participants };
    } catch (error) {
      throw this.toWsException(error);
    }
  }

  private async leaveCurrentRoom(
    client: AuthenticatedSocket,
    state: ClientRoomState,
  ): Promise<RoomParticipantView[]> {
    await client.leave(state.roomId);
    const participants = await this.roomService.leaveRoom(
      state.roomId,
      client.user.userId,
    );

    this.clientState.delete(client.id);
    this.userSockets.delete(
      this.userSocketKey(state.roomId, client.user.userId),
    );
    this.server
      .to(state.roomId)
      .emit('user_left', { userId: client.user.userId });
    this.server.to(state.roomId).emit('participant_list_updated', participants);

    return participants;
  }

  private getClientState(client: AuthenticatedSocket): ClientRoomState {
    const state = this.clientState.get(client.id);
    if (!state) {
      throw new WsException('Client has not joined a room');
    }

    return state;
  }

  private getSocketToken(socket: Socket): string | undefined {
    const token = socket.handshake.auth?.token;
    if (typeof token === 'string' && token.trim().length > 0) {
      return token.trim();
    }

    return this.authService.extractBearerToken(
      socket.handshake.headers.authorization,
    );
  }

  private getSocketUser(client: AuthenticatedSocket): AuthUser {
    if (!client.user) {
      throw new WsException('Socket is not authenticated');
    }

    return client.user;
  }

  private assertRoomManager(user: AuthUser) {
    if (user.role !== 'MENTOR' && user.role !== 'CREATOR') {
      throw new ForbiddenException('Only mentor or creator can manage rooms');
    }
  }

  private toParticipantEvent(participant: { userId: string; roomId: string }) {
    return {
      roomId: participant.roomId,
      userId: participant.userId,
    };
  }

  private userSocketKey(roomId: string, userId: string): string {
    return `${roomId}:${userId}`;
  }

  private toWsException(error: unknown): WsException {
    if (error instanceof WsException) {
      return error;
    }

    if (error instanceof Error) {
      return new WsException(error.message);
    }

    return new WsException('Unexpected realtime error');
  }
}
