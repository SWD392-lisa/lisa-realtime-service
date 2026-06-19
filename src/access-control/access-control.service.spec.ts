import { ForbiddenException } from '@nestjs/common';
import { AccessControlService } from './access-control.service';

describe('AccessControlService', () => {
  let service: AccessControlService;

  beforeEach(() => {
    service = new AccessControlService();
  });

  it('should resolve SUPER-001', () => {
    expect(service.assertCanJoinSession('SUPER-001', 'SUPER').role).toBe(
      'SUPER',
    );
  });

  it('should reject mismatched role', () => {
    expect(() => service.assertCanJoinSession('HOST-001', 'STUDENT')).toThrow(
      ForbiddenException,
    );
  });

  it('should reject recording access for STUDENT-002', () => {
    expect(() => service.assertCanViewRecording('STUDENT-002')).toThrow(
      ForbiddenException,
    );
  });
});
