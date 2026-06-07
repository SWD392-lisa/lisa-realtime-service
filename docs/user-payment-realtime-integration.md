# LUCY User Payment Service and Realtime Service Integration

## 1. Purpose

This document defines the integration contract between:

- User & Payment Service: ASP.NET Core service responsible for register, login, refresh token, logout, user identity, and role source of truth.
- Realtime Service: NestJS service responsible for room lifecycle, Socket.io realtime events, participants, and Agora token issuance.
- Frontend/Mobile: client that logs in with User & Payment Service, stores the access token, then uses that token when calling Realtime Service.

Realtime Service must not implement login/register and must not store passwords. It only receives a JWT access token from the client, verifies it, extracts user identity and role, and enforces realtime permissions.

## 2. High-Level Flow

1. Client calls User & Payment Service login.
2. User & Payment Service validates email/password.
3. User & Payment Service returns JWT access token and refresh token.
4. Client stores the access token.
5. Client calls Realtime Service REST APIs or connects Socket.io with the access token.
6. Realtime Service verifies JWT with the same issuer, audience, algorithm, and signing secret.
7. Realtime Service extracts userId, role, email, displayName from JWT claims.
8. Realtime Service maps the role to permissions.
9. If the action is allowed, Realtime Service creates/joins/manages rooms and issues Agora tokens when needed.

## 3. Current User Service Auth Contract

### Login Endpoint

```http
POST /api/Auth/login
```

Request:

```json
{
  "email": "student@test.com",
  "password": "Password123!"
}
```

Response:

```json
{
  "status": 200,
  "message": "Login successful",
  "data": {
    "accessToken": "jwt-access-token",
    "refreshToken": "refresh-token",
    "accessTokenExpiry": "2026-06-07T15:03:17.378527Z",
    "user": {
      "userId": "05b92514-c931-4daf-80e0-64e532b2ae73",
      "fullName": "Student Test",
      "email": "student@test.com",
      "roleCode": "LUCY",
      "roleName": "Lucy"
    }
  }
}
```

### JWT Settings

Realtime Service must use the same JWT settings as User & Payment Service.

User & Payment Service:

```json
{
  "JwtSettings": {
    "SecretKey": "same-secret",
    "Issuer": "ProjectLucy.API",
    "Audience": "ProjectLucy.Client",
    "AccessTokenExpirationMinutes": 15,
    "RefreshTokenExpirationDays": 7
  }
}
```

Realtime Service:

```env
JWT_SECRET_KEY=same-secret
JWT_ISSUER=ProjectLucy.API
JWT_AUDIENCE=ProjectLucy.Client
```

### JWT Claims

Current JWT contains:

| Claim | Meaning |
| --- | --- |
| `sub` | User ID |
| `email` | User email |
| `jti` | JWT ID |
| `nameidentifier` or Microsoft claim URI | User ID |
| `emailaddress` or Microsoft claim URI | User email |
| `name` or Microsoft claim URI | Display name |
| `role` or Microsoft role claim URI | Role code |

Realtime Service should prefer:

```text
userId = sub or nameidentifier claim
email = email or emailaddress claim
displayName = name or unique_name claim
role = role or Microsoft role claim URI
```

## 4. Role Mapping

User & Payment Service currently creates new registered users with default role code `LUCY`.

Realtime Service normalizes role codes as follows:

| Raw role code from User Service | Normalized realtime role | Meaning |
| --- | --- | --- |
| `LUCY` | `USER` | Student/learner |
| `USER` | `USER` | Student/learner |
| `STUDENT` | `USER` | Student/learner |
| `LUCY_PRO` | `MENTOR` | Mentor/teacher |
| `MENTOR` | `MENTOR` | Mentor/teacher |
| `TEACHER` | `MENTOR` | Mentor/teacher |
| `LUCY_SUPER` | `CREATOR` | Creator/super user |
| `CREATOR` | `CREATOR` | Creator/super user |
| `SUPER` | `CREATOR` | Creator/super user |

Frontend must never send role as a trusted field. Role is always read from the verified JWT.

## 5. Permission Matrix

| Action | USER/STUDENT/LUCY | MENTOR/TEACHER | CREATOR/SUPER |
| --- | --- | --- | --- |
| Login/register in Realtime Service | No | No | No |
| Create room | No | Yes | Yes |
| Join room | Yes | Yes | Yes |
| Leave room | Yes | Yes | Yes |
| Raise hand | Yes | Yes | Yes |
| Lower hand | Yes | Yes | Yes |
| Mute self | Yes | Yes | Yes |
| Unmute self | Only if approved speaker | Yes | Yes |
| Approve speaker | No | Yes | Yes |
| Mute other user | No | Yes | Yes |
| Remove speaker | No | Yes | Yes |
| Remove user | No | Yes | Yes |
| End room | No | Room owner | Yes |
| Record room | Future | Future | Future |

## 6. Realtime REST API Contract

All protected endpoints require:

```http
Authorization: Bearer <accessToken>
```

### Create Room

```http
POST /rooms/create
```

Compatibility route:

```http
POST /api/rooms/create
POST /api/rooms
```

Allowed roles:

```text
MENTOR, CREATOR
```

Request:

```json
{
  "name": "A1 Speaking Room",
  "level": "A1",
  "description": "Daily speaking practice"
}
```

Response:

```json
{
  "id": "room-id",
  "name": "A1 Speaking Room",
  "description": "Daily speaking practice",
  "level": "A1",
  "status": "WAITING",
  "agoraChannelName": "lucy-room-...",
  "hostUserId": "mentor-user-id",
  "createdAt": "2026-06-07T...",
  "updatedAt": "2026-06-07T..."
}
```

Rules:

- `hostUserId` must come from JWT.
- Client must not send `hostUserId`.
- USER/STUDENT/LUCY must receive `403 Forbidden`.

### Join Room

```http
POST /rooms/:roomId/join
```

Compatibility route:

```http
POST /api/rooms/:roomId/join
```

Allowed roles:

```text
USER, MENTOR, CREATOR
```

Request:

```json
{
  "avatarPersona": "student-avatar",
  "isAnonymous": true
}
```

Response:

```json
{
  "room": {
    "id": "room-id",
    "agoraChannelName": "lucy-room-...",
    "status": "LIVE"
  },
  "participant": {
    "id": "participant-id",
    "roomId": "room-id",
    "userId": "student-user-id",
    "displayName": "Student Test",
    "avatarPersona": "student-avatar",
    "role": "LEARNER",
    "rawRole": "LUCY",
    "isAnonymous": true,
    "isMicOn": false,
    "isVideoEnabled": false,
    "isHandRaised": false,
    "isSpeaker": false,
    "agoraUid": "numeric-stable-uid"
  },
  "participants": [],
  "agora": {
    "appId": "agora-app-id",
    "token": "agora-token",
    "channelName": "lucy-room-...",
    "uid": "numeric-stable-uid",
    "role": "subscriber",
    "expiresAt": 1780844597
  }
}
```

Rules:

- `userId`, `displayName`, and `rawRole` come from JWT.
- Student/LUCY joins as `LEARNER`.
- Mentor joins as `MENTOR`.
- Creator joins as `HOST`.
- Student starts as Agora `subscriber` unless approved as speaker.

### List Rooms

```http
GET /rooms
GET /api/rooms
```

Optional:

```http
GET /rooms?status=WAITING
GET /rooms?status=LIVE
GET /rooms?status=ENDED
```

### List Participants

```http
GET /rooms/:roomId/participants
GET /api/rooms/:roomId/participants
```

### End Room

```http
PATCH /rooms/:roomId/end
PATCH /api/rooms/:roomId/end
```

Allowed:

- Creator can end any room.
- Room owner can end own room.

## 7. Socket.io Contract

Client connects:

```js
const socket = io("http://localhost:3000", {
  auth: {
    token: accessToken
  }
});
```

Backend also supports `Authorization: Bearer <token>` during handshake.

### Client-to-Server Events

| Event | Payload | Allowed |
| --- | --- | --- |
| `join-room` | `{ "roomId": "room-id", "avatarPersona": "student-avatar", "isAnonymous": true }` | USER, MENTOR, CREATOR |
| `leave-room` | none | Joined users |
| `raise-hand` | none | Joined users |
| `lower-hand` | none | Joined users |
| `mute-user` | `{ "targetUserId": "user-id" }` | Self or manager muting another user |
| `unmute-user` | `{ "targetUserId": "user-id" }` | Self only, unless future rule changes |
| `approve-speaker` | `{ "targetUserId": "user-id" }` | MENTOR, CREATOR |
| `remove-speaker` | `{ "targetUserId": "user-id" }` | MENTOR, CREATOR |
| `remove-user` | `{ "targetUserId": "user-id" }` | MENTOR, CREATOR |
| `enable-video` | none | Approved speaker |
| `disable-video` | none | Joined users |
| `end-room` | none | Room owner or CREATOR |

Snake case compatibility events are also supported:

```text
join_room
leave_room
raise_hand
lower_hand
approve_speaker
remove_speaker
mute_mic
unmute_mic
end_room
```

### Server-to-Client Events

| Event | Meaning |
| --- | --- |
| `connected` | Socket authenticated successfully |
| `participant_list_updated` | Participant list changed |
| `user_joined` | User joined room |
| `user_left` | User left room |
| `hand_raised` | User raised hand |
| `hand_lowered` | User lowered hand |
| `mic_muted` | User mic muted |
| `mic_unmuted` | User mic unmuted |
| `video_enabled` | User enabled video |
| `video_disabled` | User disabled video |
| `speaker_approved` | User became speaker |
| `speaker_removed` | User speaker permission removed |
| `agora_token_refreshed` | Client must update Agora token, usually after speaker approval |
| `user_removed` | User removed from room |
| `removed_from_room` | Current client was removed |
| `room_ended` | Room ended |

## 8. Agora Contract

Realtime Service creates Agora tokens only after JWT authentication succeeds.

Agora token parameters:

| Field | Source |
| --- | --- |
| `channelName` | `room.agoraChannelName` |
| `uid` | Stable numeric UID generated from `userId` |
| `role` | `publisher` for mentor/creator/speaker, `subscriber` for learner |

Rules:

- Mentor/Creator can start as publisher.
- Student starts as subscriber.
- When Mentor/Creator approves Student as speaker, Realtime Service emits `agora_token_refreshed` with publisher token.
- Frontend must update Agora client token when receiving `agora_token_refreshed`.

## 9. Frontend Requirements

Frontend/Mobile should implement:

### Auth

- Login screen calls User & Payment Service, not Realtime Service.
- Store `accessToken`.
- Store/display `user.roleCode` only for UI state. Do not send role to Realtime Service as authority.
- If access token expires, call User Service refresh token flow, then reconnect/retry realtime calls.

### Room List

- Call `GET /rooms` or `GET /api/rooms`.
- Allow filtering by `WAITING`, `LIVE`, `ENDED`.

### Create Room

- Show create room UI only if user role is Mentor/Creator.
- Still expect backend to enforce permission.
- Call `POST /rooms/create` with Bearer token.

### Join Room

- Any authenticated role can join if room is valid.
- Call `POST /rooms/:roomId/join` before entering audio room, or use `join-room` socket event depending on product flow.
- Store returned Agora token, channelName, uid.

### Socket Flow

1. Connect Socket.io with access token.
2. Emit `join-room`.
3. Render participant list from `participant_list_updated`.
4. Student can raise/lower hand.
5. Mentor can approve speaker.
6. Student receives `agora_token_refreshed` and switches to publisher token.
7. On leave/end/remove, leave Agora channel and socket room.

### UI Permission Rules

Frontend should hide or disable actions by role:

| UI action | USER | MENTOR | CREATOR |
| --- | --- | --- | --- |
| Create room button | Hidden | Visible | Visible |
| End room button | Hidden | Visible if owner | Visible |
| Approve speaker | Hidden | Visible | Visible |
| Remove user | Hidden | Visible | Visible |
| Raise hand | Visible | Optional | Optional |
| Mic button | Visible, gated by speaker state | Visible | Visible |
| Video button | Visible, gated by speaker state | Visible | Visible |

Backend remains the final permission authority.

## 10. Database Model in Realtime Service

### Room

| Field | Meaning |
| --- | --- |
| `id` | Room ID |
| `name` | Room title/name |
| `description` | Optional description |
| `level` | Learning level |
| `status` | `WAITING`, `LIVE`, `ENDED` |
| `agoraChannelName` | Agora channel |
| `hostUserId` | Mentor/Creator user ID from JWT |
| `createdAt` | Created timestamp |
| `updatedAt` | Updated timestamp |

### RoomParticipant

| Field | Meaning |
| --- | --- |
| `id` | Participant ID |
| `roomId` | Room ID |
| `userId` | User ID from JWT |
| `displayName` | Name from JWT |
| `avatarPersona` | Anonymous avatar/persona |
| `role` | `LEARNER`, `MENTOR`, `HOST` |
| `rawRole` | Original role code from JWT |
| `isAnonymous` | Anonymous mode |
| `isMicOn` | Mic state |
| `isVideoEnabled` | Video state |
| `isHandRaised` | Hand raise state |
| `isSpeaker` | Whether user is allowed to publish |
| `agoraUid` | Stable Agora UID |
| `joinedAt` | Join timestamp |
| `leftAt` | Leave timestamp |

## 11. Test Scenarios

### Scenario A: Student Cannot Create Room

1. Register user through User Service.
2. Login through User Service.
3. Confirm `roleCode = LUCY`.
4. Call Realtime:

```http
POST /rooms/create
Authorization: Bearer <student-token>
```

Expected:

```text
403 Forbidden
```

### Scenario B: Mentor Creates Room

Prerequisite: User Service has a user with role `MENTOR`, `TEACHER`, `CREATOR`, or `SUPER`.

1. Login Mentor through User Service.
2. Call:

```http
POST /rooms/create
Authorization: Bearer <mentor-token>
```

Expected:

```text
201 Created
```

Response contains `id`, `hostUserId`, `agoraChannelName`.

### Scenario C: Student Joins Room

1. Use room ID created by Mentor.
2. Login Student.
3. Call:

```http
POST /rooms/:roomId/join
Authorization: Bearer <student-token>
```

Expected:

- Participant role is `LEARNER`.
- `isSpeaker = false`.
- Agora role is `subscriber`.

### Scenario D: Mentor Approves Speaker

1. Mentor and Student connect Socket.io.
2. Student emits `raise-hand`.
3. Mentor emits `approve-speaker`.
4. Student receives `agora_token_refreshed`.

Expected:

- Student participant `isSpeaker = true`.
- New Agora token role is `publisher`.

## 12. Operational Notes

- User Service local Swagger usually runs at `http://localhost:5149/swagger`.
- Realtime Service local frontend usually runs at `http://localhost:3000`.
- User Service appsettings must exist under `ProjectLucy.API`.
- Realtime Service `.env` must contain JWT and Agora settings.
- `JwtSettings.SecretKey` and `JWT_SECRET_KEY` must match exactly.
- If Realtime returns `401`, token is missing/invalid/expired or JWT config does not match.
- If Realtime returns `403`, token is valid but role does not allow the action.
- If User Service register/login returns `500`, check appsettings, DB connection, and whether default role `LUCY` exists.

## 13. Things Realtime Service Must Not Do

- Must not login user directly.
- Must not register user directly.
- Must not store password.
- Must not accept role from request body as authority.
- Must not trust client-provided `userId`, `mentorId`, `hostUserId`.
- Must not issue Agora token before JWT auth succeeds.

## 14. Future Improvements

- Add User Service `/me` or `/validate-token` endpoint if runtime role changes must be reflected immediately.
- Add JWKS/public key support if User Service moves from HS256 shared secret to asymmetric signing.
- Add frontend token refresh handling.
- Add formal OpenAPI docs for Realtime REST endpoints.
- Add Socket.io event documentation page or Postman Socket.io collection.
- Add Mentor/Creator seed accounts for repeatable integration testing.
