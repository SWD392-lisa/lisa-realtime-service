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
exports.RoomController = void 0;
const common_1 = require("@nestjs/common");
const current_user_decorator_1 = require("../../auth/current-user.decorator");
const jwt_auth_guard_1 = require("../../auth/jwt-auth.guard");
const agora_service_1 = require("../agora/agora.service");
const room_dto_1 = require("./dto/room.dto");
const room_service_1 = require("./room.service");
let RoomController = class RoomController {
    roomService;
    agoraService;
    constructor(roomService, agoraService) {
        this.roomService = roomService;
        this.agoraService = agoraService;
    }
    createRoom(body, user) {
        this.assertRoomManager(user);
        return this.roomService.createRoom(body, user.userId);
    }
    createRoomAlias(body, user) {
        return this.createRoom(body, user);
    }
    async joinRoom(roomId, body, user) {
        const result = await this.roomService.joinRoom({
            roomId,
            userId: user.userId,
            displayName: user.displayName ?? body?.displayName,
            avatarPersona: body?.avatarPersona,
            rawRole: user.rawRole,
            role: (0, room_dto_1.mapAuthRoleToParticipantRole)(user.role),
            isAnonymous: body?.isAnonymous ?? user.role === 'USER',
        });
        return {
            ...result,
            agora: this.createAgoraOrThrowServiceUnavailable(result),
        };
    }
    listRooms(status) {
        return this.roomService.listRooms((0, room_dto_1.parseRoomStatus)(status));
    }
    getRoom(roomId) {
        return this.roomService.getRoomWithParticipants(roomId);
    }
    getParticipants(roomId) {
        return this.roomService.listParticipants(roomId);
    }
    async endRoom(roomId, user) {
        const room = await this.roomService.getRoom(roomId);
        if (user.role !== 'CREATOR' && room.hostUserId !== user.userId) {
            throw new common_1.ForbiddenException('Only the room owner or creator can end room');
        }
        return this.roomService.endRoom(roomId);
    }
    assertRoomManager(user) {
        if (user.role !== 'MENTOR' && user.role !== 'CREATOR') {
            throw new common_1.ForbiddenException('Only mentor or creator can manage rooms');
        }
    }
    getAgoraRole(role) {
        return role === 'LEARNER' ? 'subscriber' : 'publisher';
    }
    createAgoraOrThrowServiceUnavailable(result) {
        try {
            return this.agoraService.createRtcToken({
                channelName: result.room.agoraChannelName,
                uid: result.participant.agoraUid,
                role: this.getAgoraRole(result.participant.role),
            });
        }
        catch (error) {
            if (error instanceof Error &&
                error.message.includes('Agora credentials are not configured')) {
                throw new common_1.ServiceUnavailableException(error.message);
            }
            throw error;
        }
    }
};
exports.RoomController = RoomController;
__decorate([
    (0, common_1.Post)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], RoomController.prototype, "createRoom", null);
__decorate([
    (0, common_1.Post)('create'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], RoomController.prototype, "createRoomAlias", null);
__decorate([
    (0, common_1.Post)(':roomId/join'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Param)('roomId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], RoomController.prototype, "joinRoom", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], RoomController.prototype, "listRooms", null);
__decorate([
    (0, common_1.Get)(':roomId'),
    __param(0, (0, common_1.Param)('roomId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], RoomController.prototype, "getRoom", null);
__decorate([
    (0, common_1.Get)(':roomId/participants'),
    __param(0, (0, common_1.Param)('roomId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], RoomController.prototype, "getParticipants", null);
__decorate([
    (0, common_1.Patch)(':roomId/end'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Param)('roomId')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], RoomController.prototype, "endRoom", null);
exports.RoomController = RoomController = __decorate([
    (0, common_1.Controller)(['api/rooms', 'rooms']),
    __metadata("design:paramtypes", [room_service_1.RoomService,
        agora_service_1.AgoraService])
], RoomController);
//# sourceMappingURL=room.controller.js.map