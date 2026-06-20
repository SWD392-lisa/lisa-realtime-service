export type SessionRole = 'SUPER' | 'HOST' | 'STUDENT';

export type RecordingStatus = 'IDLE' | 'RECORDING';

export interface SessionParticipant {
  anonymousUserId: string;
  displayName: string;
  role: SessionRole;
  micEnabled: boolean;
  cameraEnabled: boolean;
  screenSharing: boolean;
  socketId: string;
}

export interface RealtimeSession {
  sessionId: string;
  lmsSessionId?: string;
  externalSessionId?: string;
  participants: SessionParticipant[];
  handRaiseQueue: string[];
  activeSpeakerIds: string[];
  recordingStatus: RecordingStatus;
}

export interface SessionSnapshot {
  sessionId: string;
  lmsSessionId?: string;
  externalSessionId?: string;
  participants: Array<
    Omit<SessionParticipant, 'socketId'> & { isActiveSpeaker: boolean }
  >;
  handRaiseQueue: string[];
  activeSpeakerIds: string[];
  recordingStatus: RecordingStatus;
  onlineCount: number;
}

export interface SessionJoinPayload {
  sessionId: string;
  anonymousUserId?: string;
  displayName: string;
  role?: SessionRole;
  lmsSessionId?: string;
  externalSessionId?: string;
}

export interface SessionLeavePayload {
  sessionId: string;
}

export interface HandRaisePayload {
  sessionId: string;
}

export interface SpeakerApprovePayload {
  sessionId: string;
  targetAnonymousUserId: string;
}

export interface MediaStatusPayload {
  sessionId: string;
  micEnabled?: boolean;
  cameraEnabled?: boolean;
}

export interface ScreenSharePayload {
  sessionId: string;
}

export interface RecordingStatusPayload {
  sessionId: string;
  status: RecordingStatus;
}

export interface PresenceUpdatedEvent {
  session: SessionSnapshot;
}

export interface HandQueueUpdatedEvent {
  sessionId: string;
  handRaiseQueue: string[];
  queuedParticipants: Array<{
    anonymousUserId: string;
    displayName: string;
    role: SessionRole;
  }>;
}

export interface SpeakerApprovedEvent {
  sessionId: string;
  targetAnonymousUserId: string;
  approvedByAnonymousUserId: string;
  activeSpeakerIds: string[];
}

export interface MediaStatusChangedEvent {
  sessionId: string;
  anonymousUserId: string;
  micEnabled: boolean;
  cameraEnabled: boolean;
}

export interface ScreenShareChangedEvent {
  sessionId: string;
  anonymousUserId: string;
  screenSharing: boolean;
}

export interface RecordingStatusChangedEvent {
  sessionId: string;
  status: RecordingStatus;
  changedByAnonymousUserId: string;
}
