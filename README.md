# LUCY Realtime Service

`lucy-realtime-service` la microservice realtime cua du an LUCY.

## Phase Status

- Phase 1: da xong
- Phase 2: da xong
- Phase 3: da xong
- Phase 4: da xong
- Phase 5: da xong
- Phase 6: da xong
- Phase 7: da xong
- Phase 8: da xong

Da co trong repo hien tai:

- NestJS backend
- Socket.IO realtime workflow
- PostgreSQL local qua Docker Compose
- Prisma schema + migrations
- In-memory hot session state ket hop voi persistence cho room/session/recording metadata
- Mock `AccessControlService`
- Agora token endpoint
- Agora Web SDK demo integration cho camera, microphone, va screen share
- Recording API mock voi database metadata that
- Agora Cloud Recording REST integration
- Cloudflare Stream private playback voi signed URLs
- Classroom demo layout va recorder route on dinh cho webpage recording
- React + Vite web demo client

Chua lam:

- Cloudflare Stream that
- Redis
- Tich hop `.NET User & Payment Service` that
- Tich hop `Java LMS Service` that

## Scope

Realtime Service phu trach:

- Room metadata
- Live session metadata
- Session participants
- Hand raise requests
- Recording metadata
- Recording access logs
- Socket.IO realtime coordination

Khong duoc dua vao service nay:

- `users`
- passwords
- wallets
- real `levels`
- real `sub_levels`

Chi luu external references neu can:

- `anonymousUserId`
- `externalCourseId`
- `externalLevelId`
- `externalSubLevelId`

## Install

Backend:

```bash
npm install
```

Web demo client:

```bash
cd web-client
npm install
```

Web demo env:

```bash
cp web-client/.env.example web-client/.env
```

## Run Local Database

```bash
docker compose up -d
```

## Run Prisma Migration

```bash
npx prisma migrate dev --name phase2_phase3_realtime_db
```

## Run Backend

```bash
npm run start:dev
```

Backend mac dinh chay tai:

```bash
http://localhost:3000
```

## Run Web Client

```bash
cd web-client
npm run dev
```

Web client mac dinh chay tai:

```bash
http://localhost:5173
```

## Test Flow

Mo 3 tab web client va su dung cung `sessionId`, vi du `session-alpha`.

Tab 1:

- `anonymousUserId`: `SUPER-001`
- `displayName`: `Super Demo`
- `role`: `SUPER`

Tab 2:

- `anonymousUserId`: `HOST-001`
- `displayName`: `Host Demo`
- `role`: `HOST`

Tab 3:

- `anonymousUserId`: `STUDENT-001`
- `displayName`: `Student Demo`
- `role`: `STUDENT`

Test:

- Ca 3 tab `Join Session`
- Neu backend da cau hinh Agora env, client tu dong join Agora channel
- `STUDENT-001` bam `Raise Hand`
- `HOST-001` hoac `SUPER-001` bam `Approve`
- Thu `Enable Mic`
- Thu `Enable Camera`
- Thu `Share Screen`
- Thu `Stop Screen`
- Chi `SUPER-001` duoc `Start Recording`
- Chi `SUPER-001` duoc `Stop Recording`
- `STUDENT-001` truoc khi duoc approve se chi join Agora voi audience token
- Sau khi duoc approve, `STUDENT-001` moi publish duoc mic/camera/screen
- `STUDENT-001` bam `Playback` tren recording da `READY` se duoc phep
- `STUDENT-002` bam `Playback` se bi denied va event log hien ly do
- Layout classroom demo hien top bar, main stage, side panel, participant strip, bottom control bar

## Agora Env

Them vao `.env`:

```bash
AGORA_APP_ID=your_app_id
AGORA_APP_CERTIFICATE=your_app_certificate
AGORA_TOKEN_EXPIRE_SECONDS=3600
AGORA_REST_CUSTOMER_ID=your_customer_id
AGORA_REST_CUSTOMER_SECRET=your_customer_secret
AGORA_RECORDING_UID=9999
AGORA_RECORDING_MODE=composite
AGORA_RECORDING_STORAGE_VENDOR=
AGORA_RECORDING_STORAGE_CONFIG=
WEB_CLIENT_BASE_URL=http://localhost:5173
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_API_TOKEN=
CLOUDFLARE_STREAM_SIGNING_KEY=
CLOUDFLARE_STREAM_SIGNING_KEY_ID=
CLOUDFLARE_STREAM_CUSTOMER_CODE=
```

## Agora Cloud Recording

- Neu `AGORA_REST_CUSTOMER_ID`, `AGORA_REST_CUSTOMER_SECRET`, `AGORA_RECORDING_UID`, `AGORA_RECORDING_MODE` chua du:
  - API start recording se tra `AGORA_NOT_CONFIGURED`
  - He thong khong crash, nhung cung khong fallback am tham

- Neu muon test that:
  1. Dien du env Agora REST
  2. Start backend
  3. Join session bang `SUPER-001`
  4. Bam `Start Recording`
  5. Bam `Stop Recording`
6. Kiem tra `recordings.agoraResourceId`, `recordings.agoraSid`, `providerMetadata`

- Route webpage recording demo:
  - `http://localhost:5173/recorder/session/session-alpha`
  - Route nay la read-only layout cho webpage recorder

## Cloudflare Stream Playback

- Backend khong expose Cloudflare API token ra frontend
- Playback URL chi duoc cap sau khi `AccessControlService` cho phep
- Neu thieu Cloudflare env:
  - API playback tra `CLOUDFLARE_STREAM_NOT_CONFIGURED`
  - App khong crash

Demo:

1. Tao hoac chon recording `READY`
2. Neu chua co `cloudflareVideoUid`, dung `SUPER-001` bam `Attach Video UID`
3. Bam `Playback`
4. `STUDENT-001` duoc xem
5. `STUDENT-002` bi denied

## Recorder Layout Demo

1. Mo web demo thuong:
   - `http://localhost:5173`
2. Join session bang `SUPER-001`, `HOST-001`, `STUDENT-001`
3. Thu bat camera va screen share de thay main stage tu doi uu tien
4. Mo route recorder:
   - `http://localhost:5173/recorder/session/session-alpha`
5. Xac nhan recorder route:
   - khong co control buttons
   - co main stage
   - co participant strip
   - co session title va recorder watermark

## Recording Demo

1. Join session bang `SUPER-001`
2. Bam `Start Recording`
3. Bam `Stop Recording`
4. Kiem tra danh sach recordings hien item `READY`
5. Voi `STUDENT-001`, bam `Playback` va xem event log `recordings.playback.allowed`
6. Voi `STUDENT-002`, bam `Playback` va xem event log `recordings.playback.denied`

## Docs

- [AGENTS.md](./AGENTS.md)
- [docs/ARCHITECTURE_OVERVIEW.md](./docs/ARCHITECTURE_OVERVIEW.md)
- [docs/PHASE_ROADMAP.md](./docs/PHASE_ROADMAP.md)
- [docs/SOCKET_EVENTS.md](./docs/SOCKET_EVENTS.md)
- [docs/ACCESS_CONTROL.md](./docs/ACCESS_CONTROL.md)
- [docs/FRONTEND_INTEGRATION.md](./docs/FRONTEND_INTEGRATION.md)
- [docs/RECORDING_API.md](./docs/RECORDING_API.md)
- [docs/AGORA_RECORDING_MODES.md](./docs/AGORA_RECORDING_MODES.md)
- [docs/CLOUDFLARE_STREAM.md](./docs/CLOUDFLARE_STREAM.md)
- [docs/RECORDER_LAYOUT.md](./docs/RECORDER_LAYOUT.md)
