import { Test, TestingModule } from '@nestjs/testing';
import { WsException } from '@nestjs/websockets';
import { AccessControlService } from '../../access-control/access-control.service';
import { AuthService } from '../../auth/auth.service';
import { SessionGateway } from './session.gateway';
import { SessionPersistenceService } from './session-persistence.service';
import { SessionStoreService } from './session-store.service';

describe('SessionGateway', () => {
  let gateway: SessionGateway;
  let authService: { extractBearerToken: jest.Mock; verifyAccessToken: jest.Mock };
  let accessControlService: { assertCanJoinSession: jest.Mock };
  let sessionStore: { join: jest.Mock; getSocketState: jest.Mock; leaveBySocket: jest.Mock };
  let sessionPersistenceService: { ensureLiveSession: jest.Mock; markParticipantJoined: jest.Mock; markParticipantLeft: jest.Mock };

  beforeEach(async () => {
    authService = {
      extractBearerToken: jest.fn(),
      verifyAccessToken: jest.fn(),
    };
    accessControlService = {
      assertCanJoinSession: jest.fn(),
    };
    sessionStore = {
      join: jest.fn(),
      getSocketState: jest.fn(),
      leaveBySocket: jest.fn(),
    };
    sessionPersistenceService = {
      ensureLiveSession: jest.fn(),
      markParticipantJoined: jest.fn(),
      markParticipantLeft: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionGateway,
        { provide: AuthService, useValue: authService },
        { provide: AccessControlService, useValue: accessControlService },
        { provide: SessionStoreService, useValue: sessionStore },
        { provide: SessionPersistenceService, useValue: sessionPersistenceService },
      ],
    }).compile();

    gateway = module.get(SessionGateway);
    gateway.server = {
      to: jest.fn().mockReturnValue({ emit: jest.fn() }),
    } as any;
  });

  it('rejects join when token missing', async () => {
    authService.extractBearerToken.mockReturnValue(undefined);
    const socket = { handshake: { headers: {}, auth: {} } } as any;

    await expect(
      gateway.handleSessionJoin(
        { sessionId: 'session-1', displayName: 'Learner' },
        socket,
      ),
    ).rejects.toBeInstanceOf(WsException);
  });

  it('allows join when token valid', async () => {
    authService.extractBearerToken.mockReturnValue('jwt-token');
    authService.verifyAccessToken.mockReturnValue({
      userId: 'jwt-user-1',
      role: 'USER',
      rawRole: '1',
      displayName: 'JWT Learner',
    });
    accessControlService.assertCanJoinSession.mockReturnValue({
      anonymousUserId: 'jwt-user-1',
      role: 'STUDENT',
      canJoin: true,
      canApproveSpeaker: false,
      canControlRecording: false,
      canViewRecording: true,
    });
    sessionStore.join.mockReturnValue({
      sessionId: 'session-1',
      participants: [],
      handRaiseQueue: [],
      activeSpeakerIds: [],
      recordingStatus: 'IDLE',
      onlineCount: 1,
    });
    sessionPersistenceService.ensureLiveSession.mockResolvedValue(undefined);
    sessionPersistenceService.markParticipantJoined.mockResolvedValue(undefined);
    const socket = {
      id: 'socket-1',
      handshake: { headers: { authorization: 'Bearer jwt-token' }, auth: {} },
      join: jest.fn(),
    } as any;

    const result = await gateway.handleSessionJoin(
      { sessionId: 'session-1', displayName: 'Payload Name' },
      socket,
    );

    expect(result).toEqual(expect.objectContaining({ success: true }));
    expect(authService.verifyAccessToken).toHaveBeenCalledWith('jwt-token');
  });

  it('does not allow anonymousUserId payload to override jwt userId', async () => {
    authService.extractBearerToken.mockReturnValue('jwt-token');
    authService.verifyAccessToken.mockReturnValue({
      userId: 'jwt-user-1',
      role: 'USER',
      rawRole: '1',
      displayName: 'JWT Learner',
    });
    accessControlService.assertCanJoinSession.mockReturnValue({
      anonymousUserId: 'jwt-user-1',
      role: 'STUDENT',
      canJoin: true,
      canApproveSpeaker: false,
      canControlRecording: false,
      canViewRecording: true,
    });
    sessionStore.join.mockReturnValue({
      sessionId: 'session-1',
      participants: [],
      handRaiseQueue: [],
      activeSpeakerIds: [],
      recordingStatus: 'IDLE',
      onlineCount: 1,
    });
    const socket = {
      id: 'socket-1',
      handshake: { headers: { authorization: 'Bearer jwt-token' }, auth: {} },
      join: jest.fn(),
    } as any;

    await gateway.handleSessionJoin(
      {
        sessionId: 'session-1',
        displayName: 'Payload Name',
        anonymousUserId: 'payload-user',
      },
      socket,
    );

    expect(sessionStore.join).toHaveBeenCalledWith(
      expect.objectContaining({ anonymousUserId: 'jwt-user-1' }),
      expect.any(String),
    );
  });

  it('uses role from jwt-derived identity, not client payload', async () => {
    authService.extractBearerToken.mockReturnValue('jwt-token');
    authService.verifyAccessToken.mockReturnValue({
      userId: 'mentor-1',
      role: 'MENTOR',
      rawRole: '2',
      displayName: 'Mentor JWT',
    });
    accessControlService.assertCanJoinSession.mockReturnValue({
      anonymousUserId: 'mentor-1',
      role: 'HOST',
      canJoin: true,
      canApproveSpeaker: true,
      canControlRecording: false,
      canViewRecording: true,
    });
    sessionStore.join.mockReturnValue({
      sessionId: 'session-1',
      participants: [],
      handRaiseQueue: [],
      activeSpeakerIds: ['mentor-1'],
      recordingStatus: 'IDLE',
      onlineCount: 1,
    });
    const socket = {
      id: 'socket-1',
      handshake: { headers: { authorization: 'Bearer jwt-token' }, auth: {} },
      join: jest.fn(),
    } as any;

    await gateway.handleSessionJoin(
      {
        sessionId: 'session-1',
        displayName: 'Payload Name',
        role: 'STUDENT',
      },
      socket,
    );

    expect(sessionStore.join).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'HOST' }),
      expect.any(String),
    );
  });
});
