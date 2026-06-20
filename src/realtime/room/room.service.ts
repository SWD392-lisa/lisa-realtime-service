// @ts-nocheck
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RoomStatus } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateRoomDto,
  JoinRoomDto,
  type RoomParticipantRole,
  assertNonEmptyString,
  optionalTrimmedString,
  parseParticipantRole,
} from './dto/room.dto';

export type RoomParticipantView = {
  id: string;
  roomId: string;
  userId: string;
  displayName?: string;
  avatarPersona?: string | null;
  role: RoomParticipantRole;
  rawRole?: string | null;
  isAnonymous: boolean;
  isMicOn: boolean;
  isVideoEnabled: boolean;
  isHandRaised: boolean;
  isSpeaker: boolean;
  agoraUid: string;
  joinedAt: Date;
};

export type RoomView = {
  id: string;
  roomId: string;
  name: string;
  title: string;
  description: string | null;
  level: string | null;
  agoraChannelName: string;
  defaultChannelName: string;
  hostUserId: string;
  hostAnonymousId: string;
  status: RoomStatus;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class RoomService {
  constructor(private readonly prisma: PrismaService) {}

  async createRoom(dto: CreateRoomDto, hostUserId: string): Promise<RoomView> {
    const name = assertNonEmptyString(dto.name, 'name');
    const room = await this.prisma.room.create({
      data: {
        roomId: randomUUID(),
        title: name,
        hostAnonymousId: assertNonEmptyString(hostUserId, 'hostUserId'),
        defaultChannelName: this.createChannelName(),
        status: RoomStatus.OPEN,
      },
    });

    return this.mapRoom(room);
  }

  async listRooms(status?: RoomStatus): Promise<RoomView[]> {
    const rooms = await this.prisma.room.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
    });

    return rooms.map((room) => this.mapRoom(room));
  }

  async getRoom(roomId: string): Promise<RoomView> {
    const room = await this.prisma.room.findUnique({ where: { roomId } });
    if (!room) {
      throw new NotFoundException('Room not found');
    }

    return this.mapRoom(room);
  }

  async getRoomWithParticipants(roomId: string) {
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
      throw new NotFoundException('Room not found');
    }

    const latestSession = room.liveSessions[0];
    return {
      ...this.mapRoom(room),
      participants: (latestSession?.participants ?? []).map((participant) =>
        this.mapParticipant(room.roomId, participant),
      ),
    };
  }

  async joinRoom(dto: JoinRoomDto) {
    const roomId = assertNonEmptyString(dto.roomId, 'roomId');
    const userId = assertNonEmptyString(dto.userId, 'userId');
    const role = parseParticipantRole(dto.role);
    const roomEntity = await this.prisma.room.findUnique({ where: { roomId } });

    if (!roomEntity) {
      throw new NotFoundException('Room not found');
    }

    if (roomEntity.status === RoomStatus.CLOSED) {
      throw new BadRequestException('Cannot join a closed room');
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
        displayName: optionalTrimmedString(dto.displayName) ?? userId,
        roleInSession: this.toSessionRole(role),
      },
    });

    return {
      room: this.mapRoom(roomEntity),
      participant: this.mapParticipant(roomId, participant),
      participants: await this.listParticipants(roomId),
    };
  }

  async leaveRoom(
    roomId: string,
    userId: string,
  ): Promise<RoomParticipantView[]> {
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

  async setHandRaised(roomId: string, userId: string, isHandRaised: boolean) {
    await this.getActiveParticipant(roomId, userId);
    return this.getActiveParticipant(roomId, userId);
  }

  async setMic(roomId: string, userId: string, isMicOn: boolean) {
    const participant = await this.getActiveParticipant(roomId, userId);
    if (isMicOn && !participant.isSpeaker) {
      throw new BadRequestException('Participant is not approved to speak');
    }

    return participant;
  }

  async setVideo(roomId: string, userId: string, isVideoEnabled: boolean) {
    const participant = await this.getActiveParticipant(roomId, userId);
    if (isVideoEnabled && !participant.isSpeaker) {
      throw new BadRequestException('Participant is not approved to publish');
    }

    return participant;
  }

  async approveSpeaker(roomId: string, userId: string) {
    return this.getActiveParticipant(roomId, userId);
  }

  async removeSpeaker(roomId: string, userId: string) {
    return this.getActiveParticipant(roomId, userId);
  }

  async endRoom(roomId: string): Promise<RoomView> {
    const room = await this.prisma.room.findUnique({ where: { roomId } });
    if (!room) {
      throw new NotFoundException('Room not found');
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
      data: { status: RoomStatus.CLOSED },
    });

    return this.mapRoom(closedRoom);
  }

  async listParticipants(roomId: string): Promise<RoomParticipantView[]> {
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

  async getActiveParticipant(
    roomId: string,
    userId: string,
  ): Promise<RoomParticipantView> {
    const session = await this.getRoomSessionByRoomId(roomId);
    if (!session) {
      throw new NotFoundException('Participant not found in room');
    }

    const participant = await this.prisma.sessionParticipant.findFirst({
      where: {
        sessionId: session.sessionId,
        anonymousUserId: userId,
        leftAt: null,
      },
    });

    if (!participant) {
      throw new NotFoundException('Participant not found in room');
    }

    return this.mapParticipant(roomId, participant);
  }

  private async getRoomSessionByRoomId(roomId: string) {
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

  private async ensureRoomSession(room: {
    roomId: string;
    defaultChannelName: string;
  }) {
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

  private mapRoom(room: any): RoomView {
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

  private mapParticipant(roomId: string, participant: any): RoomParticipantView {
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

  private toSessionRole(role: RoomParticipantRole) {
    if (role === 'HOST') {
      return 'SUPER';
    }
    if (role === 'MENTOR') {
      return 'HOST';
    }
    return 'STUDENT';
  }

  private fromSessionRole(roleInSession: 'SUPER' | 'HOST' | 'STUDENT') {
    if (roleInSession === 'SUPER') {
      return 'HOST';
    }
    if (roleInSession === 'HOST') {
      return 'MENTOR';
    }
    return 'LEARNER';
  }

  private createChannelName(): string {
    return `lucy-room-${randomUUID()}`;
  }

  private createAgoraUid(userId: string): string {
    const hash = createHash('sha256').update(userId).digest();
    const uid = hash.readUInt32BE(0);

    return String(uid === 0 ? 1 : uid);
  }
}
