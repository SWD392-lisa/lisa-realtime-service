# Frontend Integration

Tai lieu nay mo ta flow frontend cho Phase 4.

## REST Token Endpoint

Frontend goi:

`POST /api/agora/token`

Body:

```json
{
  "sessionId": "session-alpha",
  "channelName": "channel-session-alpha",
  "anonymousUserId": "STUDENT-001",
  "role": "STUDENT",
  "mediaType": "audience"
}
```

Response:

```json
{
  "appId": "your-agora-app-id",
  "channelName": "channel-session-alpha",
  "uid": 123456789,
  "token": "agora-token",
  "expiresIn": 3600
}
```

## Join Flow

1. Frontend join Socket.IO session bang `session.join`.
2. Backend dua user vao in-memory session va xac dinh active speaker state.
3. Frontend request Agora token tu `/api/agora/token`.
4. Frontend join Agora channel bang Web SDK.
5. Sau khi join thanh cong:
   - `SUPER`/`HOST` vao voi publisher-capable token
   - `STUDENT` vao voi audience token neu chua duoc approve
   - `STUDENT` vao voi speaker token neu da duoc approve

## Publish Rules

- `SUPER`
  - Co the publish microphone
  - Co the publish camera
  - Co the publish screen share

- `HOST`
  - Co the publish microphone
  - Co the publish camera
  - Co the publish screen share

- `STUDENT`
  - Truoc `speaker.approved`: chi audience token, khong duoc publish
  - Sau `speaker.approved`: co the xin speaker token va publish mic/camera/screen

## Screen Share

- Screen share dung token rieng va numeric uid rieng.
- Client co the join cung channel bang screen client thu hai.
- Neu browser ket thuc screen track, frontend phai goi `screen.share.stopped`.

## Recorder Route

- Route read-only cho webpage recording:
  - `/recorder/session/:sessionId`
- Route nay co the duoc Agora webpage recording mo truc tiep.
- Mac dinh demo dung query params:
  - `anonymousUserId`
  - `displayName`
  - `role`

## Failure Handling

- Neu backend chua co `AGORA_APP_ID` hoac `AGORA_APP_CERTIFICATE`, endpoint se tra loi.
- Frontend phai hien warning ro rang va tiep tuc giu duoc phan Socket.IO/session UI.
- Frontend khong duoc crash chi vi Agora env chua cau hinh.
