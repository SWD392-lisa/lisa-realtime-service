import { ForbiddenException, Injectable } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types';
import type { AccessIdentity, MockRole } from './access-control.types';

const IDENTITIES: Record<string, AccessIdentity> = {
  'SUPER-001': {
    anonymousUserId: 'SUPER-001',
    role: 'SUPER',
    canJoin: true,
    canApproveSpeaker: true,
    canControlRecording: true,
    canViewRecording: true,
  },
  'HOST-001': {
    anonymousUserId: 'HOST-001',
    role: 'HOST',
    canJoin: true,
    canApproveSpeaker: true,
    canControlRecording: false,
    canViewRecording: false,
  },
  'STUDENT-001': {
    anonymousUserId: 'STUDENT-001',
    role: 'STUDENT',
    canJoin: true,
    canApproveSpeaker: false,
    canControlRecording: false,
    canViewRecording: true,
  },
  'STUDENT-002': {
    anonymousUserId: 'STUDENT-002',
    role: 'STUDENT',
    canJoin: true,
    canApproveSpeaker: false,
    canControlRecording: false,
    canViewRecording: false,
  },
};

@Injectable()
export class AccessControlService {
  resolveFromAuthUser(user: AuthUser): AccessIdentity {
    return {
      anonymousUserId: user.userId,
      role: this.sessionRoleFromAuthUser(user),
      canJoin: true,
      canApproveSpeaker: user.role === 'MENTOR' || user.role === 'CREATOR',
      canControlRecording: user.role === 'CREATOR',
      canViewRecording: true,
    };
  }

  resolveIdentity(
    anonymousUserId: string | AuthUser,
    requestedRole?: string,
  ): AccessIdentity {
    if (typeof anonymousUserId !== 'string') {
      return this.resolveFromAuthUser(anonymousUserId);
    }

    const identity = IDENTITIES[anonymousUserId];
    if (!identity) {
      throw new ForbiddenException('Unknown anonymous user');
    }

    if (requestedRole && identity.role !== requestedRole) {
      throw new ForbiddenException('Role does not match mock access profile');
    }

    return identity;
  }

  assertCanJoinSession(
    anonymousUserId: string | AuthUser,
    requestedRole?: string,
  ): AccessIdentity {
    const identity = this.resolveIdentity(anonymousUserId, requestedRole);
    if (!identity.canJoin) {
      throw new ForbiddenException('User cannot join this session');
    }

    return identity;
  }

  assertCanApproveSpeaker(anonymousUserId: string | AuthUser): AccessIdentity {
    const identity = this.resolveIdentity(anonymousUserId);
    if (!identity.canApproveSpeaker) {
      throw new ForbiddenException('User cannot approve speaker');
    }

    return identity;
  }

  assertCanChangeRecording(anonymousUserId: string | AuthUser): AccessIdentity {
    const identity = this.resolveIdentity(anonymousUserId);
    if (!identity.canControlRecording) {
      throw new ForbiddenException('User cannot control recording');
    }

    return identity;
  }

  assertCanViewRecording(anonymousUserId: string | AuthUser): AccessIdentity {
    const identity = this.resolveIdentity(anonymousUserId);
    if (!identity.canViewRecording) {
      throw new ForbiddenException('User cannot view this recording');
    }

    return identity;
  }

  roleForSession(
    anonymousUserId: string | AuthUser,
    requestedRole?: string,
  ): MockRole {
    return this.assertCanJoinSession(anonymousUserId, requestedRole).role;
  }

  sessionRoleFromAuthUser(user: AuthUser): MockRole {
    if (user.role === 'CREATOR') {
      return 'SUPER';
    }

    if (user.role === 'MENTOR') {
      return 'HOST';
    }

    return 'STUDENT';
  }
}
