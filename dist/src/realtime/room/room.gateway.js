"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoomGateway = void 0;
const common_1 = require("@nestjs/common");
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
const auth_service_1 = require("../../auth/auth.service");
const agora_service_1 = require("../agora/agora.service");
const room_dto_1 = require("./dto/room.dto");
const room_service_1 = require("./room.service");
let RoomGateway = class RoomGateway {
    roomService;
    agoraService;
    authService;
    server;
    clientState = new Map();
    userSockets = new Map();
    constructor(roomService, agoraService, authService) {
        this.roomService = roomService;
        this.agoraService = agoraService;
        this.authService = authService;
    }
    afterInit(server) {
        server.use((socket, next) => {
            try {
                const token = this.getSocketToken(socket);
                socket.user = token
                    ? this.authService.verifyAccessToken(token)
                    : this.authService.createDevUser({
                        userId: socket.handshake.auth?.devUserId,
                        role: socket.handshake.auth?.devRole,
                        email: socket.handshake.auth?.devEmail,
                        displayName: socket.handshake.auth?.devDisplayName,
                    });
                return next();
            }
            catch (error) {
                return next(error instanceof Error ? error : new Error('Unauthorized'));
            }
        });
    }
    handleConnection(client) {
        client.emit('connected', {
            socketId: client.id,
            user: client.user,
        });
    }
    async handleDisconnect(client) {
        const state = this.clientState.get(client.id);
        if (!state) {
            return;
        }
        await this.leaveCurrentRoom(client, state);
    }
    async handleJoinRoom(data, client) {
        try {
            const user = this.getSocketUser(client);
            const role = (0, room_dto_1.mapAuthRoleToParticipantRole)(user.role);
            const roomId = (0, room_dto_1.assertNonEmptyString)(data?.roomId, 'roomId');
            const result = await this.roomService.joinRoom({
                roomId,
                userId: user.userId,
                displayName: user.displayName,
                avatarPersona: (0, room_dto_1.optionalTrimmedString)(data?.avatarPersona),
                rawRole: user.rawRole,
                role,
                isAnonymous: data?.isAnonymous ?? true,
            });
            const state = {
                roomId: result.room.roomId,
                userId: result.participant.userId,
            };
            this.clientState.set(client.id, state);
            this.userSockets.set(this.userSocketKey(state.roomId, state.userId), client.id);
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
        }
        catch (error) {
            throw this.toWsException(error);
        }
    }
    async handleJoinRoomAlias(data, client) {
        return this.handleJoinRoom(data, client);
    }
    async handleLeaveRoom(client) {
        const state = this.clientState.get(client.id);
        if (!state) {
            return { success: true };
        }
        const participants = await this.leaveCurrentRoom(client, state);
        return { success: true, participants };
    }
    async handleLeaveRoomAlias(client) {
        return this.handleLeaveRoom(client);
    }
    async handleRaiseHand(client) {
        return this.setHandRaised(client, true);
    }
    async handleRaiseHandAlias(client) {
        return this.handleRaiseHand(client);
    }
    async handleLowerHand(client) {
        return this.setHandRaised(client, false);
    }
    async handleLowerHandAlias(client) {
        return this.handleLowerHand(client);
    }
    async handleToggleMic(data, client) {
        return this.setMic(client, Boolean(data?.isMicOn));
    }
    async handleMuteMic(data, client) {
        return this.setMic(client, false, data?.targetUserId, data?.roomId);
    }
    async handleMuteUserAlias(data, client) {
        return this.handleMuteMic(data, client);
    }
    async handleUnmuteMic(data, client) {
        return this.setMic(client, true, data?.targetUserId, data?.roomId);
    }
    async handleUnmuteUserAlias(data, client) {
        return this.handleUnmuteMic(data, client);
    }
    async handleApproveSpeaker(data, client) {
        try {
            const state = this.getClientState(client);
            this.assertRoomManager(client.user);
            const targetUserId = (0, room_dto_1.assertNonEmptyString)(data?.targetUserId, 'targetUserId');
            const roomId = data.roomId ?? state.roomId;
            const participant = await this.roomService.approveSpeaker(roomId, targetUserId);
            const room = await this.roomService.getRoom(roomId);
            const participants = await this.roomService.listParticipants(roomId);
            const socketId = this.userSockets.get(this.userSocketKey(roomId, targetUserId));
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
        }
        catch (error) {
            throw this.toWsException(error);
        }
    }
    async handleApproveSpeakerAlias(data, client) {
        return this.handleApproveSpeaker(data, client);
    }
    async handleRemoveSpeaker(data, client) {
        try {
            const state = this.getClientState(client);
            this.assertRoomManager(client.user);
            const targetUserId = (0, room_dto_1.assertNonEmptyString)(data?.targetUserId, 'targetUserId');
            const roomId = data.roomId ?? state.roomId;
            const participant = await this.roomService.removeSpeaker(roomId, targetUserId);
            const participants = await this.roomService.listParticipants(roomId);
            this.server
                .to(roomId)
                .emit('speaker_removed', this.toParticipantEvent(participant));
            this.server.to(roomId).emit('participant_list_updated', participants);
            return { success: true, participant, participants };
        }
        catch (error) {
            throw this.toWsException(error);
        }
    }
    async handleRemoveSpeakerAlias(data, client) {
        return this.handleRemoveSpeaker(data, client);
    }
    async handleEndRoom(client) {
        try {
            const state = this.getClientState(client);
            const room = await this.roomService.getRoom(state.roomId);
            if (client.user.role !== 'CREATOR' &&
                room.hostUserId !== client.user.userId) {
                throw new common_1.ForbiddenException('Only the room owner or creator can end room');
            }
            const endedRoom = await this.roomService.endRoom(state.roomId);
            this.server.to(state.roomId).emit('room_ended', endedRoom);
            return { success: true, room: endedRoom };
        }
        catch (error) {
            throw this.toWsException(error);
        }
    }
    async handleEndRoomAlias(client) {
        return this.handleEndRoom(client);
    }
    async handleEnableVideo(client) {
        return this.setVideo(client, true);
    }
    async handleDisableVideo(client) {
        return this.setVideo(client, false);
    }
    async handleRemoveUser(data, client) {
        try {
            const state = this.getClientState(client);
            this.assertRoomManager(client.user);
            const targetUserId = (0, room_dto_1.assertNonEmptyString)(data?.targetUserId, 'targetUserId');
            const roomId = data.roomId ?? state.roomId;
            const participants = await this.roomService.leaveRoom(roomId, targetUserId);
            const socketId = this.userSockets.get(this.userSocketKey(roomId, targetUserId));
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
        }
        catch (error) {
            throw this.toWsException(error);
        }
    }
    async setHandRaised(client, isHandRaised) {
        try {
            const state = this.getClientState(client);
            const participant = await this.roomService.setHandRaised(state.roomId, client.user.userId, isHandRaised);
            const participants = await this.roomService.listParticipants(state.roomId);
            this.server
                .to(state.roomId)
                .emit(isHandRaised ? 'hand_raised' : 'hand_lowered', this.toParticipantEvent(participant));
            this.server
                .to(state.roomId)
                .emit('participant_list_updated', participants);
            return { success: true, participant, participants };
        }
        catch (error) {
            throw this.toWsException(error);
        }
    }
    async setMic(client, isMicOn, targetUserId, requestedRoomId) {
        try {
            const state = this.getClientState(client);
            const userId = targetUserId
                ? (0, room_dto_1.assertNonEmptyString)(targetUserId, 'targetUserId')
                : client.user.userId;
            const roomId = requestedRoomId ?? state.roomId;
            if (userId !== client.user.userId) {
                this.assertRoomManager(client.user);
                if (isMicOn) {
                    throw new common_1.ForbiddenException('Managers can only mute other users');
                }
            }
            const participant = await this.roomService.setMic(roomId, userId, isMicOn);
            const participants = await this.roomService.listParticipants(roomId);
            this.server
                .to(roomId)
                .emit(isMicOn ? 'mic_unmuted' : 'mic_muted', this.toParticipantEvent(participant));
            this.server.to(roomId).emit('participant_list_updated', participants);
            return { success: true, participant, participants };
        }
        catch (error) {
            throw this.toWsException(error);
        }
    }
    async setVideo(client, isVideoEnabled) {
        try {
            const state = this.getClientState(client);
            const participant = await this.roomService.setVideo(state.roomId, client.user.userId, isVideoEnabled);
            const participants = await this.roomService.listParticipants(state.roomId);
            this.server
                .to(state.roomId)
                .emit(isVideoEnabled ? 'video_enabled' : 'video_disabled', this.toParticipantEvent(participant));
            this.server
                .to(state.roomId)
                .emit('participant_list_updated', participants);
            return { success: true, participant, participants };
        }
        catch (error) {
            throw this.toWsException(error);
        }
    }
    async leaveCurrentRoom(client, state) {
        await client.leave(state.roomId);
        const participants = await this.roomService.leaveRoom(state.roomId, client.user.userId);
        this.clientState.delete(client.id);
        this.userSockets.delete(this.userSocketKey(state.roomId, client.user.userId));
        this.server
            .to(state.roomId)
            .emit('user_left', { userId: client.user.userId });
        this.server.to(state.roomId).emit('participant_list_updated', participants);
        return participants;
    }
    getClientState(client) {
        const state = this.clientState.get(client.id);
        if (!state) {
            throw new websockets_1.WsException('Client has not joined a room');
        }
        return state;
    }
    getSocketToken(socket) {
        const token = socket.handshake.auth?.token;
        if (typeof token === 'string' && token.trim().length > 0) {
            return token.trim();
        }
        return this.authService.extractBearerToken(socket.handshake.headers.authorization);
    }
    getSocketUser(client) {
        if (!client.user) {
            throw new websockets_1.WsException('Socket is not authenticated');
        }
        return client.user;
    }
    assertRoomManager(user) {
        if (user.role !== 'MENTOR' && user.role !== 'CREATOR') {
            throw new common_1.ForbiddenException('Only mentor or creator can manage rooms');
        }
    }
    toParticipantEvent(participant) {
        return {
            roomId: participant.roomId,
            userId: participant.userId,
        };
    }
    userSocketKey(roomId, userId) {
        return `${roomId}:${userId}`;
    }
    toWsException(error) {
        if (error instanceof websockets_1.WsException) {
            return error;
        }
        if (error instanceof Error) {
            return new websockets_1.WsException(error.message);
        }
        return new websockets_1.WsException('Unexpected realtime error');
    }
};
exports.RoomGateway = RoomGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], RoomGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('join_room'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], RoomGateway.prototype, "handleJoinRoom", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('join-room'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], RoomGateway.prototype, "handleJoinRoomAlias", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('leave_room'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], RoomGateway.prototype, "handleLeaveRoom", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('leave-room'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], RoomGateway.prototype, "handleLeaveRoomAlias", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('raise_hand'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], RoomGateway.prototype, "handleRaiseHand", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('raise-hand'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], RoomGateway.prototype, "handleRaiseHandAlias", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('lower_hand'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], RoomGateway.prototype, "handleLowerHand", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('lower-hand'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], RoomGateway.prototype, "handleLowerHandAlias", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('toggle_mic'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], RoomGateway.prototype, "handleToggleMic", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('mute_mic'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], RoomGateway.prototype, "handleMuteMic", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('mute-user'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], RoomGateway.prototype, "handleMuteUserAlias", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('unmute_mic'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], RoomGateway.prototype, "handleUnmuteMic", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('unmute-user'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], RoomGateway.prototype, "handleUnmuteUserAlias", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('approve_speaker'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], RoomGateway.prototype, "handleApproveSpeaker", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('approve-speaker'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], RoomGateway.prototype, "handleApproveSpeakerAlias", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('remove_speaker'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], RoomGateway.prototype, "handleRemoveSpeaker", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('remove-speaker'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], RoomGateway.prototype, "handleRemoveSpeakerAlias", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('end_room'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], RoomGateway.prototype, "handleEndRoom", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('end-room'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], RoomGateway.prototype, "handleEndRoomAlias", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('enable-video'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], RoomGateway.prototype, "handleEnableVideo", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('disable-video'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], RoomGateway.prototype, "handleDisableVideo", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('remove-user'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], RoomGateway.prototype, "handleRemoveUser", null);
exports.RoomGateway = RoomGateway = __decorate([
    (0, websockets_1.WebSocketGateway)({ cors: true }),
    __metadata("design:paramtypes", [room_service_1.RoomService,
        agora_service_1.AgoraService,
        auth_service_1.AuthService])
], RoomGateway);
//# sourceMappingURL=room.gateway.js.map