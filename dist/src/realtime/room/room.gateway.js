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
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
const prisma_service_1 = require("../../prisma/prisma.service");
let RoomGateway = class RoomGateway {
    prisma;
    server;
    clientState = new Map();
    constructor(prisma) {
        this.prisma = prisma;
    }
    handleConnection(client) {
        console.log(`Client connected: ${client.id}`);
    }
    async handleDisconnect(client) {
        console.log(`Client disconnected: ${client.id}`);
        const state = this.clientState.get(client.id);
        if (state) {
            await this.leaveRoom(client, state);
            this.clientState.delete(client.id);
        }
    }
    async handleJoinRoom(data, client) {
        const { roomId, userId } = data;
        let room = await this.prisma.room.findUnique({ where: { id: roomId } });
        if (!room) {
            room = await this.prisma.room.create({
                data: { id: roomId, name: 'Default Room' }
            });
        }
        let user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            user = await this.prisma.user.create({
                data: { id: userId, name: `User ${userId.substring(0, 4)}`, email: `${userId}@example.com` }
            });
        }
        this.clientState.set(client.id, { roomId, userId });
        client.join(roomId);
        let session = await this.prisma.session.findFirst({
            where: { roomId, userId, leftAt: null }
        });
        if (!session) {
            session = await this.prisma.session.create({
                data: {
                    roomId,
                    userId,
                    isMicOn: false,
                    isRaisingHand: false,
                }
            });
        }
        this.server.to(roomId).emit('user_joined', { userId, name: user.name });
        const participants = await this.prisma.session.findMany({
            where: { roomId, leftAt: null },
            include: { user: true }
        });
        client.emit('room_state', participants);
        return { success: true };
    }
    async handleRaiseHand(data, client) {
        const state = this.clientState.get(client.id);
        if (!state)
            return;
        await this.prisma.session.updateMany({
            where: { roomId: state.roomId, userId: state.userId, leftAt: null },
            data: { isRaisingHand: data.isRaising }
        });
        this.server.to(state.roomId).emit('user_raised_hand', {
            userId: state.userId,
            isRaising: data.isRaising
        });
    }
    async handleToggleMic(data, client) {
        const state = this.clientState.get(client.id);
        if (!state)
            return;
        await this.prisma.session.updateMany({
            where: { roomId: state.roomId, userId: state.userId, leftAt: null },
            data: { isMicOn: data.isMicOn }
        });
        this.server.to(state.roomId).emit('mic_toggled', {
            userId: state.userId,
            isMicOn: data.isMicOn
        });
    }
    async handleLeaveRoom(client) {
        const state = this.clientState.get(client.id);
        if (state) {
            await this.leaveRoom(client, state);
            this.clientState.delete(client.id);
        }
    }
    async leaveRoom(client, state) {
        client.leave(state.roomId);
        await this.prisma.session.updateMany({
            where: { roomId: state.roomId, userId: state.userId, leftAt: null },
            data: { leftAt: new Date(), isMicOn: false, isRaisingHand: false }
        });
        this.server.to(state.roomId).emit('user_left', { userId: state.userId });
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
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", Promise)
], RoomGateway.prototype, "handleJoinRoom", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('raise_hand'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", Promise)
], RoomGateway.prototype, "handleRaiseHand", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('toggle_mic'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", Promise)
], RoomGateway.prototype, "handleToggleMic", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('leave_room'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket]),
    __metadata("design:returntype", Promise)
], RoomGateway.prototype, "handleLeaveRoom", null);
exports.RoomGateway = RoomGateway = __decorate([
    (0, websockets_1.WebSocketGateway)({ cors: true }),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], RoomGateway);
//# sourceMappingURL=room.gateway.js.map