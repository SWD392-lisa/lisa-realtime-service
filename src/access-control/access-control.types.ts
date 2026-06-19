export type MockRole = 'SUPER' | 'HOST' | 'STUDENT';

export interface AccessIdentity {
  anonymousUserId: string;
  role: MockRole;
  canJoin: boolean;
  canApproveSpeaker: boolean;
  canControlRecording: boolean;
  canViewRecording: boolean;
}
