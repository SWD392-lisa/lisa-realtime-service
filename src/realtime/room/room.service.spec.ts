import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RoomStatus } from '@prisma/client';
import { ROOM_PARTICIPANT_ROLES } from './dto/room.dto';
import { RoomService } from './room.service';

describe('RoomService', () => {
  let service: RoomService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      room: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      liveSession: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      sessionParticipant: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        updateMany: jest.fn(),
      },
    };
    service = new RoomService(prisma);
  });

  it('maps request.name to room.title on create', async () => {
    prisma.room.create.mockResolvedValue({
      roomId: 'room-1',
      title: 'Room A',
      hostAnonymousId: 'mentor-1',
      defaultChannelName: 'lucy-room-1',
      status: RoomStatus.OPEN,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.createRoom({ name: 'Room A' }, 'mentor-1');

    expect(prisma.room.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: 'Room A',
          hostAnonymousId: 'mentor-1',
        }),
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        id: 'room-1',
        roomId: 'room-1',
        name: 'Room A',
        agoraChannelName: 'lucy-room-1',
      }),
    );
  });

  it('lists rooms using roomId and title mapping', async () => {
    prisma.room.findMany.mockResolvedValue([
      {
        roomId: 'room-1',
        title: 'Room A',
        hostAnonymousId: 'mentor-1',
        defaultChannelName: 'lucy-room-1',
        status: RoomStatus.OPEN,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const result = await service.listRooms();
    expect(result[0]).toEqual(
      expect.objectContaining({ id: 'room-1', name: 'Room A' }),
    );
  });

  it('gets room by roomId not id', async () => {
    prisma.room.findUnique.mockResolvedValue({
      roomId: 'room-1',
      title: 'Room A',
      hostAnonymousId: 'mentor-1',
      defaultChannelName: 'lucy-room-1',
      status: RoomStatus.OPEN,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await service.getRoom('room-1');
    expect(prisma.room.findUnique).toHaveBeenCalledWith({ where: { roomId: 'room-1' } });
  });

  it('joins open room through session_participants', async () => {
    prisma.room.findUnique.mockResolvedValue({
      roomId: 'room-1',
      title: 'Room A',
      hostAnonymousId: 'mentor-1',
      defaultChannelName: 'lucy-room-1',
      status: RoomStatus.OPEN,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    prisma.liveSession.findFirst.mockResolvedValue({
      sessionId: 'room-1',
      roomId: 'room-1',
      channelName: 'lucy-room-1',
      status: 'LIVE',
      updatedAt: new Date(),
    });
    prisma.sessionParticipant.findFirst.mockResolvedValueOnce(null);
    prisma.sessionParticipant.create.mockResolvedValue({
      participantId: 'p-1',
      sessionId: 'room-1',
      anonymousUserId: 'user-1',
      displayName: 'User One',
      roleInSession: 'STUDENT',
      joinedAt: new Date(),
    });
    prisma.sessionParticipant.findMany.mockResolvedValue([
      {
        participantId: 'p-1',
        sessionId: 'room-1',
        anonymousUserId: 'user-1',
        displayName: 'User One',
        roleInSession: 'STUDENT',
        joinedAt: new Date(),
      },
    ]);

    const result = await service.joinRoom({
      roomId: 'room-1',
      userId: 'user-1',
      displayName: 'User One',
      role: ROOM_PARTICIPANT_ROLES[2],
    });

    expect(prisma.sessionParticipant.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sessionId: 'room-1',
          anonymousUserId: 'user-1',
        }),
      }),
    );
    expect(result.room.id).toBe('room-1');
    expect(result.participant.userId).toBe('user-1');
  });

  it('rejects join when room is closed', async () => {
    prisma.room.findUnique.mockResolvedValue({
      roomId: 'room-1',
      title: 'Room A',
      hostAnonymousId: 'mentor-1',
      defaultChannelName: 'lucy-room-1',
      status: RoomStatus.CLOSED,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(
      service.joinRoom({ roomId: 'room-1', userId: 'user-1' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('ends room using CLOSED status and roomId lookup', async () => {
    prisma.room.findUnique.mockResolvedValue({
      roomId: 'room-1',
      title: 'Room A',
      hostAnonymousId: 'mentor-1',
      defaultChannelName: 'lucy-room-1',
      status: RoomStatus.OPEN,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    prisma.liveSession.findFirst.mockResolvedValue({
      sessionId: 'room-1',
      roomId: 'room-1',
      status: 'LIVE',
      updatedAt: new Date(),
    });
    prisma.sessionParticipant.updateMany.mockResolvedValue({ count: 1 });
    prisma.liveSession.update.mockResolvedValue({});
    prisma.room.update.mockResolvedValue({
      roomId: 'room-1',
      title: 'Room A',
      hostAnonymousId: 'mentor-1',
      defaultChannelName: 'lucy-room-1',
      status: RoomStatus.CLOSED,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.endRoom('room-1');

    expect(prisma.room.update).toHaveBeenCalledWith({
      where: { roomId: 'room-1' },
      data: { status: RoomStatus.CLOSED },
    });
    expect(result.status).toBe(RoomStatus.CLOSED);
  });

  it('throws not found when room missing', async () => {
    prisma.room.findUnique.mockResolvedValue(null);
    await expect(service.getRoom('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});
