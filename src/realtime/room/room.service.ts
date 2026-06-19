// @ts-nocheck
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Room,
  RoomParticipant,
  RoomParticipantRole,
  RoomStatus,
} from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateRoomDto,
  JoinRoomDto,
  assertNonEmptyString,
  optionalTrimmedString,
  parseParticipantRole,
} from './dto/room.dto';

export type RoomParticipantView = Pick<
  RoomParticipant,
  | 'id'
  | 'roomId'
  | 'userId'
  | 'displayName'
  | 'avatarPersona'
  | 'role'
  | 'rawRole'
  | 'isAnonymous'
  | 'isMicOn'
  | 'isVideoEnabled'
  | 'isHandRaised'
  | 'isSpeaker'
  | 'agoraUid'
  | 'joinedAt'
>;

@Injectable()
export class RoomService {
  constructor(private readonly prisma: PrismaService) {}

  async createRoom(dto: CreateRoomDto, hostUserId: string): Promise<Room> {
    const name = assertNonEmptyString(dto.name, 'name');
    const description = optionalTrimmedString(dto.description);
    const level = optionalTrimmedString(dto.level);

    return this.prisma.room.create({
      data: {
        name,
        description,
        level,
        hostUserId: assertNonEmptyString(hostUserId, 'hostUserId'),
        agoraChannelName: this.createChannelName(),
      },
    });
  }

  listRooms(status?: RoomStatus): Promise<Room[]> {
    return this.prisma.room.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getRoom(roomId: string): Promise<Room> {
    const room = await this.prisma.room.findUnique({ where: { id: roomId } });
    if (!room) {
      throw new NotFoundException('Room not found');
    }

    return room;
  }

  async getRoomWithParticipants(roomId: string) {
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
      throw new NotFoundException('Room not found');
    }

    return room;
  }

  async joinRoom(dto: JoinRoomDto) {
    const roomId = assertNonEmptyString(dto.roomId, 'roomId');
    const userId = assertNonEmptyString(dto.userId, 'userId');
    const role = parseParticipantRole(dto.role);
    const room = await this.getRoom(roomId);

    if (room.status === RoomStatus.ENDED) {
      throw new BadRequestException('Cannot join an ended room');
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

    const isSpeaker =
      role === RoomParticipantRole.HOST || role === RoomParticipantRole.MENTOR;
    const participant = await this.prisma.roomParticipant.create({
      data: {
        roomId,
        userId,
        displayName: optionalTrimmedString(dto.displayName),
        avatarPersona: optionalTrimmedString(dto.avatarPersona),
        role,
        rawRole: optionalTrimmedString(dto.rawRole),
        isAnonymous: dto.isAnonymous ?? true,
        isSpeaker,
        isMicOn: isSpeaker,
        agoraUid: this.createAgoraUid(userId),
      },
    });

    if (room.status === RoomStatus.WAITING) {
      await this.prisma.room.update({
        where: { id: roomId },
        data: { status: RoomStatus.LIVE },
      });
    }

    return {
      room,
      participant,
      participants: await this.listParticipants(roomId),
    };
  }

  async leaveRoom(
    roomId: string,
    userId: string,
  ): Promise<RoomParticipantView[]> {
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

  async setHandRaised(roomId: string, userId: string, isHandRaised: boolean) {
    return this.updateActiveParticipant(roomId, userId, { isHandRaised });
  }

  async setMic(roomId: string, userId: string, isMicOn: boolean) {
    const participant = await this.getActiveParticipant(roomId, userId);
    if (isMicOn && !participant.isSpeaker) {
      throw new BadRequestException('Participant is not approved to speak');
    }

    return this.updateActiveParticipant(roomId, userId, { isMicOn });
  }

  async setVideo(roomId: string, userId: string, isVideoEnabled: boolean) {
    const participant = await this.getActiveParticipant(roomId, userId);
    if (isVideoEnabled && !participant.isSpeaker) {
      throw new BadRequestException('Participant is not approved to publish');
    }

    return this.updateActiveParticipant(roomId, userId, { isVideoEnabled });
  }

  async approveSpeaker(roomId: string, userId: string) {
    return this.updateActiveParticipant(roomId, userId, {
      isSpeaker: true,
      isHandRaised: false,
    });
  }

  async removeSpeaker(roomId: string, userId: string) {
    return this.updateActiveParticipant(roomId, userId, {
      isSpeaker: false,
      isMicOn: false,
      isVideoEnabled: false,
    });
  }

  async endRoom(roomId: string): Promise<Room> {
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
      data: { status: RoomStatus.ENDED },
    });
  }

  listParticipants(roomId: string): Promise<RoomParticipantView[]> {
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

  async getActiveParticipant(
    roomId: string,
    userId: string,
  ): Promise<RoomParticipant> {
    const participant = await this.prisma.roomParticipant.findFirst({
      where: { roomId, userId, leftAt: null },
    });

    if (!participant) {
      throw new NotFoundException('Participant not found in room');
    }

    return participant;
  }

  private async updateActiveParticipant(
    roomId: string,
    userId: string,
    data: Partial<
      Pick<
        RoomParticipant,
        'isMicOn' | 'isVideoEnabled' | 'isHandRaised' | 'isSpeaker'
      >
    >,
  ) {
    await this.getActiveParticipant(roomId, userId);
    await this.prisma.roomParticipant.updateMany({
      where: { roomId, userId, leftAt: null },
      data,
    });

    return this.getActiveParticipant(roomId, userId);
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
