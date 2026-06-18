# Access Control

Tai lieu nay mo ta mock `AccessControlService` cho Phase 3 va Phase 5.

## Purpose

Phase nay chua goi `.NET User & Payment Service` that.

Thay vao do, backend dung `AccessControlService` de mo phong access rules cho:

- session join
- speaker approve
- start recording
- stop recording
- recording playback access

## Mock Identities

### `SUPER-001`

- Role: `SUPER`
- Co the join session
- Co the approve speaker
- Co the start/stop recording
- Co the view recording

### `HOST-001`

- Role: `HOST`
- Co the join session
- Co the approve speaker
- Khong duoc start/stop recording
- Khong duoc playback recording trong mock rule hien tai

### `STUDENT-001`

- Role: `STUDENT`
- Co the join session
- Co the raise hand
- Co the view recording

### `STUDENT-002`

- Role: `STUDENT`
- Co the join session
- Co the raise hand
- Khong duoc view recording neu khong enrolled

## Enforcement Points

- `session.join`
  - User phai ton tai trong mock access profile
  - `anonymousUserId` va `role` phai khop profile
- `speaker.approve`
  - Chi `HOST` hoac `SUPER`
- `POST /api/sessions/:sessionId/recordings/start`
  - Chi `SUPER`
- `POST /api/recordings/:recordingId/stop`
  - Chi `SUPER` owner cua recording
- `GET /api/recordings/:recordingId/playback-url`
  - `SUPER-001` va `STUDENT-001` duoc phep
  - `STUDENT-002` bi tu choi va bi log vao `recording_access_logs`

## Recording Behavior

- `SUPER-001`
  - Start duoc recording
  - Stop duoc recording do minh tao
  - View playback duoc

- `HOST-001`
  - Khong duoc start recording
  - Khong duoc stop recording
  - Khong duoc playback recording trong mock rule hien tai

- `STUDENT-001`
  - Xem playback duoc

- `STUDENT-002`
  - Bi deny playback va duoc ghi log

## Future Direction

Khi tich hop `.NET User & Payment Service`, `AccessControlService` se duoc doi tu mock sang external permission lookup, nhung boundary trong service nay van giu nguyen:

- khong co bang `users`
- khong co bang `wallets`
- khong co bang `levels/sub_levels`
- chi su dung external references va permission results
