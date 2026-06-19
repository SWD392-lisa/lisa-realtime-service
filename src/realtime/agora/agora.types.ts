import type { SessionRole } from '../session/session.types';

export type AgoraMediaType = 'audience' | 'speaker' | 'host' | 'screen';

export interface AgoraTokenRequest {
  sessionId: string;
  channelName: string;
  anonymousUserId: string;
  role: SessionRole;
  mediaType: AgoraMediaType;
}

export interface AgoraTokenResponse {
  appId: string;
  channelName: string;
  uid: number;
  token: string;
  expiresIn: number;
}
