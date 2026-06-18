# Recording API

Tai lieu nay mo ta recording business flow cua Phase 5 va Phase 6.

## Start Recording

`POST /api/sessions/:sessionId/recordings/start`

Body:

```json
{
  "anonymousUserId": "SUPER-001"
}
```

Rule:

- Chi `SUPER` duoc start
- Session phai dang `LIVE`
- Neu da co recording `RECORDING` hoac `PROCESSING` thi bi tu choi

Ket qua:

- Neu Agora Cloud Recording env day du:
  - Goi `acquire` va `start` that
  - Tao row moi trong `recordings`
  - `provider = AGORA_CLOUD_RECORDING`
  - Luu `agoraResourceId`, `agoraSid`, `providerMetadata`
  - Broadcast `recording.status.changed`

- Neu thieu credential:
  - Tra loi `AGORA_NOT_CONFIGURED`
  - Khong fallback am tham

## Stop Recording

`POST /api/recordings/:recordingId/stop`

Body:

```json
{
  "anonymousUserId": "SUPER-001"
}
```

Rule:

- Chi SUPER owner cua recording duoc stop

Ket qua:

- Goi Agora `stop` neu recording co `agoraResourceId/agoraSid`
- `RECORDING -> PROCESSING -> READY`
- Gan `cloudflareVideoUid` mock
- Gan `durationSeconds`
- Luu `stopResponse` vao `providerMetadata`
- Broadcast `recording.status.changed` voi session status `IDLE`

## Get Recording Metadata

`GET /api/recordings/:recordingId?anonymousUserId=STUDENT-001`

Tra metadata recording, khong tra playback URL.

## List Session Recordings

`GET /api/sessions/:sessionId/recordings?anonymousUserId=STUDENT-001`

Tra danh sach recording cua session.

## Playback URL

`GET /api/recordings/:recordingId/playback-url?anonymousUserId=STUDENT-001`

Neu duoc phep:

```json
{
  "recordingId": "rec-123",
  "playbackUrl": "https://customer-xxx.cloudflarestream.com/<TOKEN>/iframe",
  "playerUrl": "https://customer-xxx.cloudflarestream.com/<TOKEN>/iframe",
  "hlsUrl": "https://customer-xxx.cloudflarestream.com/<TOKEN>/manifest/video.m3u8",
  "expiresIn": 3600
}
```

Neu khong duoc phep:

- Tra `403`
- Ghi `recording_access_logs`

## Register Cloudflare Video UID

`POST /api/recordings/:recordingId/cloudflare-video`

Body:

```json
{
  "anonymousUserId": "SUPER-001",
  "videoUid": "cloudflare-video-uid"
}
```

## Notes

- Phase nay da co Agora Cloud Recording integration o backend
- Van chua tich hop Cloudflare Stream that
- De goi that, can account Agora va REST credential that
