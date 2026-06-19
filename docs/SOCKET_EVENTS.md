# Socket Events

Tai lieu nay mo ta event contract cho Phase 1.

## Event List

### `session.join`

Client -> Server payload:

```json
{
  "sessionId": "session-alpha",
  "anonymousUserId": "STUDENT-001",
  "displayName": "Student Demo",
  "role": "STUDENT"
}
```

Ack:

```json
{
  "success": true,
  "session": {
    "sessionId": "session-alpha",
    "participants": [],
    "handRaiseQueue": [],
    "activeSpeakerIds": [],
    "recordingStatus": "IDLE",
    "onlineCount": 1
  }
}
```

Broadcast:

- `presence.updated`
- `hand.queue.updated`

### `session.leave`

Client -> Server payload:

```json
{
  "sessionId": "session-alpha"
}
```

Ack:

```json
{
  "success": true,
  "session": null
}
```

Broadcast:

- `presence.updated`
- `hand.queue.updated`

### `presence.updated`

Server -> Client payload:

```json
{
  "session": {
    "sessionId": "session-alpha",
    "participants": [],
    "handRaiseQueue": [],
    "activeSpeakerIds": [],
    "recordingStatus": "IDLE",
    "onlineCount": 0
  }
}
```

### `hand.raise`

Client -> Server payload:

```json
{
  "sessionId": "session-alpha"
}
```

Rule:

- Chi `STUDENT` duoc raise hand

Broadcast:

```json
{
  "sessionId": "session-alpha",
  "anonymousUserId": "STUDENT-001"
}
```

### `hand.queue.updated`

Server -> Client payload:

```json
{
  "sessionId": "session-alpha",
  "handRaiseQueue": ["STUDENT-001"],
  "queuedParticipants": [
    {
      "anonymousUserId": "STUDENT-001",
      "displayName": "Student Demo",
      "role": "STUDENT"
    }
  ]
}
```

### `speaker.approve`

Client -> Server payload:

```json
{
  "sessionId": "session-alpha",
  "targetAnonymousUserId": "STUDENT-001"
}
```

Rule:

- Chi `HOST` va `SUPER` duoc approve speaker

Broadcast:

- `speaker.approved`
- `hand.queue.updated`
- `presence.updated`

### `speaker.approved`

Server -> Client payload:

```json
{
  "sessionId": "session-alpha",
  "targetAnonymousUserId": "STUDENT-001",
  "approvedByAnonymousUserId": "HOST-001",
  "activeSpeakerIds": ["HOST-001", "STUDENT-001"]
}
```

### `media.status.changed`

Client -> Server payload:

```json
{
  "sessionId": "session-alpha",
  "micEnabled": true,
  "cameraEnabled": false
}
```

Server -> Client payload:

```json
{
  "sessionId": "session-alpha",
  "anonymousUserId": "HOST-001",
  "micEnabled": true,
  "cameraEnabled": false
}
```

### `screen.share.started`

Client -> Server payload:

```json
{
  "sessionId": "session-alpha"
}
```

Server -> Client payload:

```json
{
  "sessionId": "session-alpha",
  "anonymousUserId": "HOST-001",
  "screenSharing": true
}
```

### `screen.share.stopped`

Client -> Server payload:

```json
{
  "sessionId": "session-alpha"
}
```

Server -> Client payload:

```json
{
  "sessionId": "session-alpha",
  "anonymousUserId": "HOST-001",
  "screenSharing": false
}
```

### `recording.status.changed`

Client -> Server payload:

```json
{
  "sessionId": "session-alpha",
  "status": "RECORDING"
}
```

Rule:

- Chi `SUPER` duoc doi recording status

Server -> Client payload:

```json
{
  "sessionId": "session-alpha",
  "status": "RECORDING",
  "changedByAnonymousUserId": "SUPER-001"
}
```
