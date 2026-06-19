import {
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { AccessControlService } from '../../access-control/access-control.service';
import { RecordingService } from './recording.service';

describe('RecordingService', () => {
  let service: RecordingService;
  const creatorUser = {
    userId: 'SUPER-001',
    role: 'CREATOR' as const,
    rawRole: 'SUPER',
  };
  const secondCreatorUser = {
    userId: 'SUPER-002',
    role: 'CREATOR' as const,
    rawRole: 'SUPER',
  };

  const prisma = {
    liveSession: {
      findUnique: jest.fn(),
    },
    recording: {
      findFirst: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    recordingAccessLog: {
      create: jest.fn(),
    },
  };

  const sessionStore = {
    getSessionSnapshot: jest.fn(() => ({
      sessionId: 'session-alpha',
    })),
    setRecordingStatusForSystem: jest.fn(),
  };

  const sessionGateway = {
    broadcastRecordingStatus: jest.fn(),
  };

  const agoraRecordingService = {
    getMode: jest.fn(() => 'composite'),
    getRecordingUid: jest.fn(() => '9999'),
    startRecording: jest.fn(async () => ({
      resourceId: 'resource-1',
      sid: 'sid-1',
      acquireResponse: { resourceId: 'resource-1' },
      startResponse: { sid: 'sid-1' },
    })),
    stopRecording: jest.fn(async () => ({
      serverResponse: { fileListMode: 'string' },
    })),
  };

  const cloudflareStreamService = {
    createSignedPlaybackUrl: jest.fn(async () => ({
      playerUrl: 'https://customer-demo.cloudflarestream.com/signed-token/iframe',
      hlsUrl:
        'https://customer-demo.cloudflarestream.com/signed-token/manifest/video.m3u8',
      dashUrl:
        'https://customer-demo.cloudflarestream.com/signed-token/manifest/video.mpd',
      thumbnailUrl: null,
      expiresIn: 3600,
    })),
    registerRecordingVideo: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new RecordingService(
      prisma as never,
      new AccessControlService(),
      agoraRecordingService as never,
      cloudflareStreamService as never,
      sessionStore as never,
      sessionGateway as never,
    );
  });

  it('should start recording for LIVE session', async () => {
    prisma.liveSession.findUnique.mockResolvedValue({
      sessionId: 'session-alpha',
      roomId: 'room-session-alpha',
      status: 'LIVE',
      room: {
        externalCourseId: null,
        externalLevelId: null,
        externalSubLevelId: null,
      },
    });
    prisma.recording.findFirst.mockResolvedValue(null);
    prisma.recording.create.mockResolvedValue({
      recordingId: 'rec-1',
      status: 'REQUESTED',
    });
    prisma.recording.update.mockResolvedValue({
      recordingId: 'rec-1',
      status: 'RECORDING',
    });

    const result = await service.startRecording('session-alpha', creatorUser);

    expect(result.recordingId).toBe('rec-1');
    expect(agoraRecordingService.startRecording).toHaveBeenCalled();
    expect(sessionGateway.broadcastRecordingStatus).toHaveBeenCalled();
  });

  it('should reject duplicate active recording', async () => {
    prisma.liveSession.findUnique.mockResolvedValue({
      sessionId: 'session-alpha',
      roomId: 'room-session-alpha',
      status: 'LIVE',
      room: {
        externalCourseId: null,
        externalLevelId: null,
        externalSubLevelId: null,
      },
    });
    prisma.recording.findFirst.mockResolvedValue({
      recordingId: 'rec-1',
      status: 'RECORDING',
    });

    await expect(
      service.startRecording('session-alpha', creatorUser),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject stop by non-owner super', async () => {
    prisma.recording.findUnique.mockResolvedValue({
      recordingId: 'rec-1',
      sessionId: 'session-alpha',
      createdBySuperId: 'SUPER-001',
      startedAt: new Date(),
      status: 'RECORDING',
      session: { sessionId: 'session-alpha' },
      providerMetadata: {
        recordingUid: '9999',
        mode: 'composite',
      },
      agoraResourceId: 'resource-1',
      agoraSid: 'sid-1',
    });

    await expect(
      service.stopRecording('rec-1', secondCreatorUser),
    ).rejects.toThrow(ForbiddenException);
  });
});
