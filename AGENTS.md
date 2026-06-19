# AGENTS.md

Tai lieu nay dinh nghia cac nguyen tac lam viec cho nguoi va coding agent khi thay doi `lucy-realtime-service`.

## Mission

Xay dung va duy tri microservice realtime cho LUCY bang `Node.js` va `NestJS`.

## Product Responsibility

Realtime Service phu trach:

- Room management
- Live session management
- Socket.IO realtime events
- Agora audio/video coordination
- Screen share coordination
- Recording metadata
- Cloudflare Stream playback metadata

## Hard Boundaries

Khong dua vao service nay cac phan sau:

- User tables
- Password/auth database local
- Wallet/payment tables
- Course catalog source of truth
- Real `levels` / `sub_levels` tables

Service nay chi luu external references:

- `anonymousUserId`
- `externalCourseId`
- `externalLevelId`
- `externalSubLevelId`

## Source Of Truth Rules

- `.NET User & Payment Service`
  - User
  - Role
  - Payment
  - Enrollment
  - Access
- `Java LMS Service`
  - Course
  - Level
  - Sub-level
  - Content
- `Realtime Service`
  - Room
  - Session
  - Socket state
  - Realtime state transitions
  - Recording metadata

## Coding Rules

- Uu tien NestJS module/service/controller/gateway ro rang.
- Khong hardcode secrets.
- Moi config lay tu environment variables.
- Khong duplicate business domain cua service khac vao schema local.
- Uu tien external reference + cached metadata nhe neu thuc su can.
- Web client trong repo chi la demo/test client.
- Khong coi web client nay la frontend production.

## Documentation Rules

Khi them feature moi, cap nhat it nhat mot trong cac tai lieu:

- `README.md`
- `docs/ARCHITECTURE_OVERVIEW.md`
- `docs/PHASE_ROADMAP.md`

## Delivery Style

- MVP truoc, optimization sau.
- Chot contract ro rang truoc khi mo rong schema.
- Neu can luu du lieu moi, uu tien mo ta ly do va service ownership truoc.
