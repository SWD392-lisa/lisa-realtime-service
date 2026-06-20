// @ts-nocheck
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../../auth/auth.service';
import { AgoraService } from '../agora/agora.service';
import { ROOM_PARTICIPANT_ROLES } from './dto/room.dto';
import { RoomGateway } from './room.gateway';
import { RoomService } from './room.service';

describe.skip('RoomGateway', () => {
  let gateway: RoomGateway;
  let roomService: { joinRoom: jest.Mock };
  let agoraService: { createRtcToken: jest.Mock };

  beforeEach(async () => {
    roomService = {
      joinRoom: jest.fn(),
    };
    agoraService = {
      createRtcToken: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoomGateway,
        {
          provide: RoomService,
          useValue: roomService,
        },
        {
          provide: AgoraService,
          useValue: agoraService,
        },
        {
          provide: AuthService,
          useValue: {},
        },
      ],
    }).compile();

    gateway = module.get<RoomGateway>(RoomGateway);
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  it('should join with socket user identity instead of payload identity', async () => {
    const room = {
      id: 'room-1',
      agoraChannelName: 'lucy-room-1',
    };
    const participant = {
      roomId: 'room-1',
      userId: 'jwt-user-1',
      isSpeaker: false,
      agoraUid: '123',
    };
    const participants = [participant];
    roomService.joinRoom.mockResolvedValue({ room, participant, participants });
    agoraService.createRtcToken.mockReturnValue({
      token: 'agora-token',
      channelName: room.agoraChannelName,
      uid: participant.agoraUid,
      role: 'subscriber',
      expiresAt: 1,
      appId: 'app-id',
    });
    gateway.server = {
      to: jest.fn().mockReturnValue({ emit: jest.fn() }),
    } as any;
    const socket = {
      id: 'socket-1',
      user: {
        userId: 'jwt-user-1',
        role: 'USER',
        rawRole: 'LUCY',
        email: 'learner@example.com',
        displayName: 'Learner One',
      },
      join: jest.fn(),
    } as any;

    await gateway.handleJoinRoom(
      {
        roomId: 'room-1',
        userId: 'payload-user',
        role: 'HOST',
        displayName: 'Payload Name',
      } as any,
      socket,
    );

    expect(roomService.joinRoom).toHaveBeenCalledWith(
      expect.objectContaining({
        roomId: 'room-1',
        userId: 'jwt-user-1',
        displayName: 'Learner One',
        rawRole: 'LUCY',
        role: ROOM_PARTICIPANT_ROLES[2],
      }),
    );
  });
});
