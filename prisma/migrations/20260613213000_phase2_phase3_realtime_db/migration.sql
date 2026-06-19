DROP TABLE IF EXISTS "recording_access_logs" CASCADE;
DROP TABLE IF EXISTS "recordings" CASCADE;
DROP TABLE IF EXISTS "hand_raise_requests" CASCADE;
DROP TABLE IF EXISTS "session_participants" CASCADE;
DROP TABLE IF EXISTS "live_sessions" CASCADE;
DROP TABLE IF EXISTS "rooms" CASCADE;
DROP TABLE IF EXISTS "RoomParticipant" CASCADE;
DROP TABLE IF EXISTS "Room" CASCADE;

DROP TYPE IF EXISTS "AccessResult" CASCADE;
DROP TYPE IF EXISTS "RecordingAccessAction" CASCADE;
DROP TYPE IF EXISTS "RecordingStatus" CASCADE;
DROP TYPE IF EXISTS "RecordingProvider" CASCADE;
DROP TYPE IF EXISTS "HandRaiseRequestStatus" CASCADE;
DROP TYPE IF EXISTS "RoleInSession" CASCADE;
DROP TYPE IF EXISTS "LiveSessionStatus" CASCADE;
DROP TYPE IF EXISTS "RoomParticipantRole" CASCADE;
DROP TYPE IF EXISTS "RoomStatus" CASCADE;

CREATE TYPE "RoomStatus" AS ENUM ('OPEN', 'CLOSED');
CREATE TYPE "LiveSessionStatus" AS ENUM ('SCHEDULED', 'LIVE', 'ENDED', 'CANCELLED');
CREATE TYPE "RoleInSession" AS ENUM ('SUPER', 'HOST', 'STUDENT');
CREATE TYPE "HandRaiseRequestStatus" AS ENUM ('WAITING', 'APPROVED', 'REJECTED', 'CANCELLED', 'FINISHED');
CREATE TYPE "RecordingProvider" AS ENUM ('MOCK', 'AGORA_CLOUD_RECORDING', 'CLOUDFLARE_STREAM');
CREATE TYPE "RecordingStatus" AS ENUM ('REQUESTED', 'RECORDING', 'PROCESSING', 'READY', 'FAILED', 'DELETED');
CREATE TYPE "RecordingAccessAction" AS ENUM ('VIEW', 'DOWNLOAD', 'DENIED');
CREATE TYPE "AccessResult" AS ENUM ('ALLOWED', 'DENIED');

CREATE TABLE "rooms" (
  "roomId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "hostAnonymousId" TEXT NOT NULL,
  "externalCourseId" TEXT,
  "externalLevelId" TEXT,
  "externalSubLevelId" TEXT,
  "defaultChannelName" TEXT NOT NULL,
  "status" "RoomStatus" NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "rooms_pkey" PRIMARY KEY ("roomId")
);

CREATE TABLE "live_sessions" (
  "sessionId" TEXT NOT NULL,
  "roomId" TEXT NOT NULL,
  "channelName" TEXT NOT NULL,
  "status" "LiveSessionStatus" NOT NULL DEFAULT 'SCHEDULED',
  "startedAt" TIMESTAMP(3) NOT NULL,
  "endedAt" TIMESTAMP(3),
  "peakParticipants" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "live_sessions_pkey" PRIMARY KEY ("sessionId")
);

CREATE TABLE "session_participants" (
  "participantId" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "anonymousUserId" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "roleInSession" "RoleInSession" NOT NULL,
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leftAt" TIMESTAMP(3),
  "totalSpeakingSeconds" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "session_participants_pkey" PRIMARY KEY ("participantId")
);

CREATE TABLE "hand_raise_requests" (
  "requestId" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "anonymousUserId" TEXT NOT NULL,
  "status" "HandRaiseRequestStatus" NOT NULL DEFAULT 'WAITING',
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "handledAt" TIMESTAMP(3),
  "handledBy" TEXT,
  CONSTRAINT "hand_raise_requests_pkey" PRIMARY KEY ("requestId")
);

CREATE TABLE "recordings" (
  "recordingId" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "roomId" TEXT NOT NULL,
  "createdBySuperId" TEXT NOT NULL,
  "externalCourseId" TEXT,
  "externalLevelId" TEXT,
  "externalSubLevelId" TEXT,
  "provider" "RecordingProvider" NOT NULL DEFAULT 'MOCK',
  "agoraResourceId" TEXT,
  "agoraSid" TEXT,
  "cloudflareVideoUid" TEXT,
  "status" "RecordingStatus" NOT NULL DEFAULT 'REQUESTED',
  "title" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL,
  "endedAt" TIMESTAMP(3),
  "durationSeconds" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "recordings_pkey" PRIMARY KEY ("recordingId")
);

CREATE TABLE "recording_access_logs" (
  "accessLogId" TEXT NOT NULL,
  "recordingId" TEXT NOT NULL,
  "anonymousUserId" TEXT NOT NULL,
  "action" "RecordingAccessAction" NOT NULL,
  "result" "AccessResult" NOT NULL,
  "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "recording_access_logs_pkey" PRIMARY KEY ("accessLogId")
);

CREATE INDEX "rooms_hostAnonymousId_idx" ON "rooms"("hostAnonymousId");
CREATE INDEX "rooms_status_idx" ON "rooms"("status");
CREATE INDEX "live_sessions_roomId_idx" ON "live_sessions"("roomId");
CREATE INDEX "live_sessions_status_idx" ON "live_sessions"("status");
CREATE INDEX "session_participants_sessionId_leftAt_idx" ON "session_participants"("sessionId", "leftAt");
CREATE UNIQUE INDEX "session_participants_sessionId_anonymousUserId_key" ON "session_participants"("sessionId", "anonymousUserId");
CREATE INDEX "hand_raise_requests_sessionId_status_idx" ON "hand_raise_requests"("sessionId", "status");
CREATE INDEX "hand_raise_requests_anonymousUserId_idx" ON "hand_raise_requests"("anonymousUserId");
CREATE INDEX "recordings_sessionId_status_idx" ON "recordings"("sessionId", "status");
CREATE INDEX "recordings_roomId_idx" ON "recordings"("roomId");
CREATE INDEX "recording_access_logs_recordingId_idx" ON "recording_access_logs"("recordingId");
CREATE INDEX "recording_access_logs_anonymousUserId_idx" ON "recording_access_logs"("anonymousUserId");

ALTER TABLE "live_sessions"
  ADD CONSTRAINT "live_sessions_roomId_fkey"
  FOREIGN KEY ("roomId") REFERENCES "rooms"("roomId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "session_participants"
  ADD CONSTRAINT "session_participants_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "live_sessions"("sessionId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "hand_raise_requests"
  ADD CONSTRAINT "hand_raise_requests_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "live_sessions"("sessionId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "recordings"
  ADD CONSTRAINT "recordings_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "live_sessions"("sessionId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "recordings"
  ADD CONSTRAINT "recordings_roomId_fkey"
  FOREIGN KEY ("roomId") REFERENCES "rooms"("roomId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "recording_access_logs"
  ADD CONSTRAINT "recording_access_logs_recordingId_fkey"
  FOREIGN KEY ("recordingId") REFERENCES "recordings"("recordingId") ON DELETE CASCADE ON UPDATE CASCADE;
