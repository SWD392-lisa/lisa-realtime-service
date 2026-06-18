import { ForbiddenException } from '@nestjs/common';
import { SessionStoreService } from './session-store.service';

describe('SessionStoreService', () => {
  let service: SessionStoreService;

  beforeEach(() => {
    service = new SessionStoreService();
  });

  it('should join and return session snapshot', () => {
    const snapshot = service.join(
      {
        sessionId: 'session-1',
        anonymousUserId: 'HOST-001',
        displayName: 'Host Demo',
        role: 'HOST',
      },
      'socket-1',
    );

    expect(snapshot.sessionId).toBe('session-1');
    expect(snapshot.onlineCount).toBe(1);
    expect(snapshot.activeSpeakerIds).toContain('HOST-001');
  });

  it('should allow student to raise hand', () => {
    service.join(
      {
        sessionId: 'session-1',
        anonymousUserId: 'STUDENT-001',
        displayName: 'Student Demo',
        role: 'STUDENT',
      },
      'socket-1',
    );

    const queue = service.raiseHand('session-1', 'STUDENT-001');

    expect(queue.handRaiseQueue).toEqual(['STUDENT-001']);
    expect(queue.queuedParticipants[0]?.displayName).toBe('Student Demo');
  });

  it('should reject hand raise for host', () => {
    service.join(
      {
        sessionId: 'session-1',
        anonymousUserId: 'HOST-001',
        displayName: 'Host Demo',
        role: 'HOST',
      },
      'socket-1',
    );

    expect(() =>
      service.raiseHand('session-1', 'HOST-001'),
    ).toThrow(ForbiddenException);
  });

  it('should allow host to approve a student speaker', () => {
    service.join(
      {
        sessionId: 'session-1',
        anonymousUserId: 'HOST-001',
        displayName: 'Host Demo',
        role: 'HOST',
      },
      'socket-host',
    );
    service.join(
      {
        sessionId: 'session-1',
        anonymousUserId: 'STUDENT-001',
        displayName: 'Student Demo',
        role: 'STUDENT',
      },
      'socket-student',
    );
    service.raiseHand('session-1', 'STUDENT-001');

    const result = service.approveSpeaker(
      {
        sessionId: 'session-1',
        targetAnonymousUserId: 'STUDENT-001',
      },
      'HOST-001',
    );

    expect(result.session.activeSpeakerIds).toContain('STUDENT-001');
    expect(result.queue.handRaiseQueue).toEqual([]);
  });

  it('should allow only super to change recording status', () => {
    service.join(
      {
        sessionId: 'session-1',
        anonymousUserId: 'HOST-001',
        displayName: 'Host Demo',
        role: 'HOST',
      },
      'socket-host',
    );

    expect(() =>
      service.setRecordingStatus(
        {
          sessionId: 'session-1',
          status: 'RECORDING',
        },
        'HOST-001',
      ),
    ).toThrow(ForbiddenException);
  });
});
