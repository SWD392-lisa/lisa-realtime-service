import { ConfigService } from '@nestjs/config';
import { ForbiddenException } from '@nestjs/common';
import { AccessControlService } from '../../access-control/access-control.service';
import { AgoraTokenService } from './agora-token.service';

describe('AgoraTokenService', () => {
  const configService = {
    get: jest.fn((key: string) => {
      const config: Record<string, string> = {
        AGORA_APP_ID: '0123456789abcdef0123456789abcdef',
        AGORA_APP_CERTIFICATE: 'fedcba9876543210fedcba9876543210',
        AGORA_TOKEN_EXPIRE_SECONDS: '3600',
      };

      return config[key];
    }),
  } as unknown as ConfigService;

  const sessionStore = {
    getSessionSnapshot: jest.fn((sessionId: string) => {
      if (sessionId !== 'session-alpha') {
        return null;
      }

      return {
        sessionId: 'session-alpha',
        participants: [
          {
            anonymousUserId: 'STUDENT-001',
            displayName: 'Student Demo',
            role: 'STUDENT',
            micEnabled: false,
            cameraEnabled: false,
            screenSharing: false,
            isActiveSpeaker: false,
          },
          {
            anonymousUserId: 'HOST-001',
            displayName: 'Host Demo',
            role: 'HOST',
            micEnabled: false,
            cameraEnabled: false,
            screenSharing: false,
            isActiveSpeaker: true,
          },
        ],
        handRaiseQueue: [],
        activeSpeakerIds: ['HOST-001'],
        recordingStatus: 'IDLE',
        onlineCount: 2,
      };
    }),
  };

  let service: AgoraTokenService;

  beforeEach(() => {
    service = new AgoraTokenService(
      configService,
      new AccessControlService(),
      sessionStore as never,
    );
  });

  it('should build a stable uid', () => {
    expect(service.buildUid('session-alpha', 'HOST-001', 'host')).toBe(
      service.buildUid('session-alpha', 'HOST-001', 'speaker'),
    );
    expect(service.buildUid('session-alpha', 'HOST-001', 'screen')).not.toBe(
      service.buildUid('session-alpha', 'HOST-001', 'host'),
    );
  });

  it('should reject STUDENT publisher token before approval', () => {
    expect(() =>
      service.createToken(
        {
          sessionId: 'session-alpha',
          channelName: 'channel-session-alpha',
          anonymousUserId: 'STUDENT-001',
          role: 'STUDENT',
          mediaType: 'speaker',
        },
        {
          userId: 'STUDENT-001',
          role: 'USER',
          rawRole: 'STUDENT',
        },
      ),
    ).toThrow(ForbiddenException);
  });

  it('should allow HOST to request host token', () => {
    const response = service.createToken(
      {
        sessionId: 'session-alpha',
        channelName: 'channel-session-alpha',
        anonymousUserId: 'HOST-001',
        role: 'HOST',
        mediaType: 'host',
      },
      {
        userId: 'HOST-001',
        role: 'MENTOR',
        rawRole: 'MENTOR',
      },
    );

    expect(response.appId).toBe('0123456789abcdef0123456789abcdef');
    expect(response.channelName).toBe('channel-session-alpha');
    expect(response.uid).toBeGreaterThan(0);
    expect(response.token).toBeTruthy();
  });
});
