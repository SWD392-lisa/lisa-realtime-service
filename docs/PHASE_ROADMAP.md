# Phase Roadmap

## Phase 0 - Repository Rules And Foundation

Muc tieu:

- Chot repository conventions
- Chot architecture boundary
- Chot source-of-truth rules
- Chot env/doc setup

Deliverables:

- `README.md`
- `AGENTS.md`
- `.env.example`
- `.gitignore`
- `docs/ARCHITECTURE_OVERVIEW.md`
- `docs/PHASE_ROADMAP.md`

Khong tap trung implement backend phuc tap trong phase nay.

## Phase 1 - Core Realtime Foundation

Muc tieu:

- NestJS module structure
- Basic health/config bootstrap
- In-memory session store
- Basic Socket.IO gateway
- React + Vite demo client
- Local browser camera/mic preview
- Local screen share preview

Ket qua mong muon:

- Backend va web demo client chay local duoc
- Test duoc 3 tab session flow
- Chua duplicate domain cua auth/LMS
- Chua dua Prisma, Redis, Agora, Cloudflare vao phase nay

## Phase 2 - PostgreSQL And Prisma Persistence

Muc tieu:

- Dua PostgreSQL vao local development
- Them Prisma schema va migration
- Persist room/session/participant/hand raise/recording metadata
- Giu in-memory store cho hot realtime state, ket hop voi database cho state quan trong

Bang du lieu:

- `rooms`
- `live_sessions`
- `session_participants`
- `hand_raise_requests`
- `recordings`
- `recording_access_logs`

Luu y:

- Khong tao bang `users`
- Khong tao bang `wallets`
- Khong tao bang `levels/sub_levels`
- Chi luu external references can thiet

## Phase 3 - Mock Permission Service

Muc tieu:

- Tao `AccessControlService`
- Mo phong permission tu `.NET User & Payment Service`
- Enforce join session, approve speaker, recording control, playback access
- Chuan bi boundary de doi sang external permission lookup sau nay

Luu y:

- Chua verify JWT that o phase nay
- Chua goi `.NET User & Payment Service` that
- Identity mock hien tai:
  - `SUPER-001`
  - `HOST-001`
  - `STUDENT-001`
  - `STUDENT-002`

## Phase 4 - Recording And Playback Metadata

Muc tieu:

- Recording metadata model
- Playback metadata model
- Cloudflare Stream references
- Session-to-recording linkage

Khong luu media file truc tiep neu khong can.

## Phase 5 - External Integration Hardening

Muc tieu:

- JWT verification voi .NET service
- Enrollment/access checks thong qua external source of truth
- LMS metadata lookup strategy
- Better error contracts and observability

## Phase 6 - Production Readiness

Muc tieu:

- Logging
- Monitoring
- Rate limiting
- Resilience rules
- Config hardening
- Deployment guidance

## Cross-Phase Guardrails

- Khong tao bang user/password/wallet.
- Khong tao bang level/sub-level that la source of truth.
- Chi luu external references can thiet.
- Web client trong repo chi la demo/test client.
- Frontend production se tich hop sau qua API/socket docs.
