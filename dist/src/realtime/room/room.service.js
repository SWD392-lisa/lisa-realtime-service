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
        const room = await this.prisma.room.create({
            data: {
                roomId: (0, crypto_1.randomUUID)(),
                title: name,
                hostAnonymousId: (0, room_dto_1.assertNonEmptyString)(hostUserId, 'hostUserId'),
                defaultChannelName: this.createChannelName(),
                status: client_1.RoomStatus.OPEN,
            },
        });
        return this.mapRoom(room);
    }
    async listRooms(status) {
        const rooms = await this.prisma.room.findMany({
            where: status ? { status } : undefined,
            orderBy: { createdAt: 'desc' },
        });
        return rooms.map((room) => this.mapRoom(room));
    }
    async getRoom(roomId) {
        const room = await this.prisma.room.findUnique({ where: { roomId } });
        if (!room) {
            throw new common_1.NotFoundException('Room not found');
        }
        return this.mapRoom(room);
    }
    async getRoomWithParticipants(roomId) {
        const room = await this.prisma.room.findUnique({
            where: { roomId },
            include: {
                liveSessions: {
                    orderBy: { updatedAt: 'desc' },
                    take: 1,
                    include: {
                        participants: {
                            where: { leftAt: null },
                            orderBy: [{ joinedAt: 'asc' }],
                        },
                    },
                },
            },
        });
        if (!room) {
            throw new common_1.NotFoundException('Room not found');
        }
        const latestSession = room.liveSessions[0];
        return {
            ...this.mapRoom(room),
            participants: (latestSession?.participants ?? []).map((participant) => this.mapParticipant(room.roomId, participant)),
        };
    }
    async joinRoom(dto) {
        const roomId = (0, room_dto_1.assertNonEmptyString)(dto.roomId, 'roomId');
        const userId = (0, room_dto_1.assertNonEmptyString)(dto.userId, 'userId');
        const role = (0, room_dto_1.parseParticipantRole)(dto.role);
        const roomEntity = await this.prisma.room.findUnique({ where: { roomId } });
        if (!roomEntity) {
            throw new common_1.NotFoundException('Room not found');
        }
        if (roomEntity.status === client_1.RoomStatus.CLOSED) {
            throw new common_1.BadRequestException('Cannot join a closed room');
        }
        const session = await this.ensureRoomSession(roomEntity);
        const existing = await this.prisma.sessionParticipant.findFirst({
            where: { sessionId: session.sessionId, anonymousUserId: userId, leftAt: null },
        });
        if (existing) {
            return {
                room: this.mapRoom(roomEntity),
                participant: this.mapParticipant(roomId, existing),
                participants: await this.listParticipants(roomId),
            };
        }
        const participant = await this.prisma.sessionParticipant.create({
            data: {
                sessionId: session.sessionId,
                anonymousUserId: userId,
                displayName: (0, room_dto_1.optionalTrimmedString)(dto.displayName) ?? userId,
                roleInSession: this.toSessionRole(role),
            },
        });
        return {
            room: this.mapRoom(roomEntity),
            participant: this.mapParticipant(roomId, participant),
            participants: await this.listParticipants(roomId),
        };
    }
    async leaveRoom(roomId, userId) {
        const session = await this.getRoomSessionByRoomId(roomId);
        if (!session) {
            return [];
        }
        await this.prisma.sessionParticipant.updateMany({
            where: {
                sessionId: session.sessionId,
                anonymousUserId: userId,
                leftAt: null,
            },
            data: {
                leftAt: new Date(),
            },
        });
        return this.listParticipants(roomId);
    }
    async setHandRaised(roomId, userId, isHandRaised) {
        await this.getActiveParticipant(roomId, userId);
        return this.getActiveParticipant(roomId, userId);
    }
    async setMic(roomId, userId, isMicOn) {
        const participant = await this.getActiveParticipant(roomId, userId);
        if (isMicOn && !participant.isSpeaker) {
            throw new common_1.BadRequestException('Participant is not approved to speak');
        }
        return participant;
    }
    async setVideo(roomId, userId, isVideoEnabled) {
        const participant = await this.getActiveParticipant(roomId, userId);
        if (isVideoEnabled && !participant.isSpeaker) {
            throw new common_1.BadRequestException('Participant is not approved to publish');
        }
        return participant;
    }
    async approveSpeaker(roomId, userId) {
        return this.getActiveParticipant(roomId, userId);
    }
    async removeSpeaker(roomId, userId) {
        return this.getActiveParticipant(roomId, userId);
    }
    async endRoom(roomId) {
        const room = await this.prisma.room.findUnique({ where: { roomId } });
        if (!room) {
            throw new common_1.NotFoundException('Room not found');
        }
        const session = await this.getRoomSessionByRoomId(roomId);
        if (session) {
            await this.prisma.sessionParticipant.updateMany({
                where: { sessionId: session.sessionId, leftAt: null },
                data: { leftAt: new Date() },
            });
            await this.prisma.liveSession.update({
                where: { sessionId: session.sessionId },
                data: { status: 'ENDED', endedAt: new Date() },
            });
        }
        const closedRoom = await this.prisma.room.update({
            where: { roomId },
            data: { status: client_1.RoomStatus.CLOSED },
        });
        return this.mapRoom(closedRoom);
    }
    async listParticipants(roomId) {
        const session = await this.getRoomSessionByRoomId(roomId);
        if (!session) {
            return [];
        }
        const participants = await this.prisma.sessionParticipant.findMany({
            where: { sessionId: session.sessionId, leftAt: null },
            orderBy: [{ joinedAt: 'asc' }],
        });
        return participants.map((participant) => this.mapParticipant(roomId, participant));
    }
    async getActiveParticipant(roomId, userId) {
        const session = await this.getRoomSessionByRoomId(roomId);
        if (!session) {
            throw new common_1.NotFoundException('Participant not found in room');
        }
        const participant = await this.prisma.sessionParticipant.findFirst({
            where: {
                sessionId: session.sessionId,
                anonymousUserId: userId,
                leftAt: null,
            },
        });
        if (!participant) {
            throw new common_1.NotFoundException('Participant not found in room');
        }
        return this.mapParticipant(roomId, participant);
    }
    async getRoomSessionByRoomId(roomId) {
        return this.prisma.liveSession.findFirst({
            where: {
                roomId,
                status: {
                    in: ['SCHEDULED', 'LIVE'],
                },
            },
            orderBy: { updatedAt: 'desc' },
        });
    }
    async ensureRoomSession(room) {
        const activeSession = await this.getRoomSessionByRoomId(room.roomId);
        if (activeSession) {
            if (activeSession.status !== 'LIVE') {
                return this.prisma.liveSession.update({
                    where: { sessionId: activeSession.sessionId },
                    data: { status: 'LIVE', endedAt: null },
                });
            }
            return activeSession;
        }
        const stableSession = await this.prisma.liveSession.findUnique({
            where: { sessionId: room.roomId },
        });
        if (stableSession) {
            return this.prisma.liveSession.update({
                where: { sessionId: stableSession.sessionId },
                data: {
                    roomId: room.roomId,
                    channelName: room.defaultChannelName,
                    status: 'LIVE',
                    startedAt: stableSession.startedAt ?? new Date(),
                    endedAt: null,
                },
            });
        }
        return this.prisma.liveSession.create({
            data: {
                sessionId: room.roomId,
                roomId: room.roomId,
                channelName: room.defaultChannelName,
                status: 'LIVE',
                startedAt: new Date(),
            },
        });
    }
    mapRoom(room) {
        return {
            id: room.roomId,
            roomId: room.roomId,
            name: room.title,
            title: room.title,
            description: null,
            level: room.externalLevelId ?? null,
            agoraChannelName: room.defaultChannelName,
            defaultChannelName: room.defaultChannelName,
            hostUserId: room.hostAnonymousId,
            hostAnonymousId: room.hostAnonymousId,
            status: room.status,
            createdAt: room.createdAt,
            updatedAt: room.updatedAt,
        };
    }
    mapParticipant(roomId, participant) {
        const role = this.fromSessionRole(participant.roleInSession);
        const isSpeaker = role !== 'LEARNER';
        return {
            id: participant.participantId,
            roomId,
            userId: participant.anonymousUserId,
            displayName: participant.displayName,
            avatarPersona: null,
            role,
            rawRole: participant.roleInSession,
            isAnonymous: true,
            isMicOn: false,
            isVideoEnabled: false,
            isHandRaised: false,
            isSpeaker,
            agoraUid: this.createAgoraUid(participant.anonymousUserId),
            joinedAt: participant.joinedAt,
        };
    }
    toSessionRole(role) {
        if (role === 'HOST') {
            return 'SUPER';
        }
        if (role === 'MENTOR') {
            return 'HOST';
        }
        return 'STUDENT';
    }
    fromSessionRole(roleInSession) {
        if (roleInSession === 'SUPER') {
            return 'HOST';
        }
        if (roleInSession === 'HOST') {
            return 'MENTOR';
        }
        return 'LEARNER';
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