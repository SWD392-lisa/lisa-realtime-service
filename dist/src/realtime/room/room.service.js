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
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoomService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const crypto_1 = require("crypto");
const prisma_service_1 = require("../../prisma/prisma.service");
const room_dto_1 = require("./dto/room.dto");
let RoomService = class RoomService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async createRoom(dto, hostUserId) {
        const name = (0, room_dto_1.assertNonEmptyString)(dto.name, 'name');
        const description = (0, room_dto_1.optionalTrimmedString)(dto.description);
        const level = (0, room_dto_1.optionalTrimmedString)(dto.level);
        return this.prisma.room.create({
            data: {
                name,
                description,
                level,
                hostUserId: (0, room_dto_1.assertNonEmptyString)(hostUserId, 'hostUserId'),
                agoraChannelName: this.createChannelName(),
            },
        });
    }
    listRooms(status) {
        return this.prisma.room.findMany({
            where: status ? { status } : undefined,
            orderBy: { createdAt: 'desc' },
        });
    }
    async getRoom(roomId) {
        const room = await this.prisma.room.findUnique({ where: { id: roomId } });
        if (!room) {
            throw new common_1.NotFoundException('Room not found');
        }
        return room;
    }
    async getRoomWithParticipants(roomId) {
        const room = await this.prisma.room.findUnique({
            where: { id: roomId },
            include: {
                participants: {
                    where: { leftAt: null },
                    orderBy: [{ isSpeaker: 'desc' }, { joinedAt: 'asc' }],
                },
            },
        });
        if (!room) {
            throw new common_1.NotFoundException('Room not found');
        }
        return room;
    }
    async joinRoom(dto) {
        const roomId = (0, room_dto_1.assertNonEmptyString)(dto.roomId, 'roomId');
        const userId = (0, room_dto_1.assertNonEmptyString)(dto.userId, 'userId');
        const role = (0, room_dto_1.parseParticipantRole)(dto.role);
        const room = await this.getRoom(roomId);
        if (room.status === client_1.RoomStatus.ENDED) {
            throw new common_1.BadRequestException('Cannot join an ended room');
        }
        const existing = await this.prisma.roomParticipant.findFirst({
            where: { roomId, userId, leftAt: null },
        });
        if (existing) {
            return {
                room,
                participant: existing,
                participants: await this.listParticipants(roomId),
            };
        }
        const isSpeaker = role === client_1.RoomParticipantRole.HOST || role === client_1.RoomParticipantRole.MENTOR;
        const participant = await this.prisma.roomParticipant.create({
            data: {
                roomId,
                userId,
                displayName: (0, room_dto_1.optionalTrimmedString)(dto.displayName),
                avatarPersona: (0, room_dto_1.optionalTrimmedString)(dto.avatarPersona),
                role,
                rawRole: (0, room_dto_1.optionalTrimmedString)(dto.rawRole),
                isAnonymous: dto.isAnonymous ?? true,
                isSpeaker,
                isMicOn: isSpeaker,
                agoraUid: this.createAgoraUid(userId),
            },
        });
        if (room.status === client_1.RoomStatus.WAITING) {
            await this.prisma.room.update({
                where: { id: roomId },
                data: { status: client_1.RoomStatus.LIVE },
            });
        }
        return {
            room,
            participant,
            participants: await this.listParticipants(roomId),
        };
    }
    async leaveRoom(roomId, userId) {
        await this.prisma.roomParticipant.updateMany({
            where: { roomId, userId, leftAt: null },
            data: {
                leftAt: new Date(),
                isMicOn: false,
                isVideoEnabled: false,
                isHandRaised: false,
                isSpeaker: false,
            },
        });
        return this.listParticipants(roomId);
    }
    async setHandRaised(roomId, userId, isHandRaised) {
        return this.updateActiveParticipant(roomId, userId, { isHandRaised });
    }
    async setMic(roomId, userId, isMicOn) {
        const participant = await this.getActiveParticipant(roomId, userId);
        if (isMicOn && !participant.isSpeaker) {
            throw new common_1.BadRequestException('Participant is not approved to speak');
        }
        return this.updateActiveParticipant(roomId, userId, { isMicOn });
    }
    async setVideo(roomId, userId, isVideoEnabled) {
        const participant = await this.getActiveParticipant(roomId, userId);
        if (isVideoEnabled && !participant.isSpeaker) {
            throw new common_1.BadRequestException('Participant is not approved to publish');
        }
        return this.updateActiveParticipant(roomId, userId, { isVideoEnabled });
    }
    async approveSpeaker(roomId, userId) {
        return this.updateActiveParticipant(roomId, userId, {
            isSpeaker: true,
            isHandRaised: false,
        });
    }
    async removeSpeaker(roomId, userId) {
        return this.updateActiveParticipant(roomId, userId, {
            isSpeaker: false,
            isMicOn: false,
            isVideoEnabled: false,
        });
    }
    async endRoom(roomId) {
        await this.getRoom(roomId);
        await this.prisma.roomParticipant.updateMany({
            where: { roomId, leftAt: null },
            data: {
                leftAt: new Date(),
                isMicOn: false,
                isVideoEnabled: false,
                isHandRaised: false,
                isSpeaker: false,
            },
        });
        return this.prisma.room.update({
            where: { id: roomId },
            data: { status: client_1.RoomStatus.ENDED },
        });
    }
    listParticipants(roomId) {
        return this.prisma.roomParticipant.findMany({
            where: { roomId, leftAt: null },
            orderBy: [{ isSpeaker: 'desc' }, { joinedAt: 'asc' }],
            select: {
                id: true,
                roomId: true,
                userId: true,
                displayName: true,
                avatarPersona: true,
                role: true,
                rawRole: true,
                isAnonymous: true,
                isMicOn: true,
                isVideoEnabled: true,
                isHandRaised: true,
                isSpeaker: true,
                agoraUid: true,
                joinedAt: true,
            },
        });
    }
    async getActiveParticipant(roomId, userId) {
        const participant = await this.prisma.roomParticipant.findFirst({
            where: { roomId, userId, leftAt: null },
        });
        if (!participant) {
            throw new common_1.NotFoundException('Participant not found in room');
        }
        return participant;
    }
    async updateActiveParticipant(roomId, userId, data) {
        await this.getActiveParticipant(roomId, userId);
        await this.prisma.roomParticipant.updateMany({
            where: { roomId, userId, leftAt: null },
            data,
        });
        return this.getActiveParticipant(roomId, userId);
    }
    createChannelName() {
        return `lucy-room-${(0, crypto_1.randomUUID)()}`;
    }
    createAgoraUid(userId) {
        const hash = (0, crypto_1.createHash)('sha256').update(userId).digest();
        const uid = hash.readUInt32BE(0);
        return String(uid === 0 ? 1 : uid);
    }
};
exports.RoomService = RoomService;
exports.RoomService = RoomService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], RoomService);
//# sourceMappingURL=room.service.js.map