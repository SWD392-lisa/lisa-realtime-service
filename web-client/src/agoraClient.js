import AgoraRTC from 'agora-rtc-sdk-ng';

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

export function createAgoraClients() {
  return {
    mainClient: AgoraRTC.createClient({
      mode: 'live',
      codec: 'vp8',
    }),
    screenClient: AgoraRTC.createClient({
      mode: 'live',
      codec: 'vp8',
    }),
  };
}

export function buildAgoraChannelName(sessionId) {
  return `channel-${sessionId}`;
}

export function buildAgoraUid(sessionId, anonymousUserId, kind = 'main') {
  const seed = `${sessionId}:${anonymousUserId}:${kind}`;
  let hash = 2166136261;

  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  const normalized = hash >>> 0;
  return normalized === 0 ? 1 : normalized;
}

export function resolveAgoraIdentity(sessionId, participants, uid) {
  for (const participant of participants) {
    if (buildAgoraUid(sessionId, participant.anonymousUserId, 'main') === uid) {
      return {
        anonymousUserId: participant.anonymousUserId,
        displayName: participant.displayName,
        role: participant.role,
        isScreen: false,
      };
    }

    if (
      buildAgoraUid(sessionId, participant.anonymousUserId, 'screen') === uid
    ) {
      return {
        anonymousUserId: participant.anonymousUserId,
        displayName: participant.displayName,
        role: participant.role,
        isScreen: true,
      };
    }
  }

  return {
    anonymousUserId: `uid-${uid}`,
    displayName: `UID ${uid}`,
    role: 'UNKNOWN',
    isScreen: false,
  };
}

export function getJoinMediaType(role, canPublish) {
  if (role === 'SUPER' || role === 'HOST') {
    return 'host';
  }

  return canPublish ? 'speaker' : 'audience';
}

export async function fetchAgoraToken(payload) {
  const response = await fetch(`${API_BASE_URL}/api/agora/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      data?.message ||
        'Unable to get Agora token. Check backend config and permissions.',
    );
  }

  return data;
}
