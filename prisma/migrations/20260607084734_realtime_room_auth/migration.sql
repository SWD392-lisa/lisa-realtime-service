-- CreateEnum
CREATE TYPE "RoomStatus" AS ENUM ('WAITING', 'LIVE', 'ENDED');

-- CreateEnum
CREATE TYPE "RoomParticipantRole" AS ENUM ('LEARNER', 'MENTOR', 'HOST');

-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "level" TEXT,
    "status" "RoomStatus" NOT NULL DEFAULT 'WAITING',
    "agoraChannelName" TEXT NOT NULL,
    "hostUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomParticipant" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT,
    "avatarPersona" TEXT,
    "role" "RoomParticipantRole" NOT NULL DEFAULT 'LEARNER',
    "rawRole" TEXT,
    "isAnonymous" BOOLEAN NOT NULL DEFAULT true,
    "isMicOn" BOOLEAN NOT NULL DEFAULT false,
    "isHandRaised" BOOLEAN NOT NULL DEFAULT false,
    "isSpeaker" BOOLEAN NOT NULL DEFAULT false,
    "agoraUid" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoomParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Room_agoraChannelName_key" ON "Room"("agoraChannelName");

-- CreateIndex
CREATE INDEX "Room_status_idx" ON "Room"("status");

-- CreateIndex
CREATE INDEX "Room_hostUserId_idx" ON "Room"("hostUserId");

-- CreateIndex
CREATE INDEX "RoomParticipant_roomId_leftAt_idx" ON "RoomParticipant"("roomId", "leftAt");

-- CreateIndex
CREATE INDEX "RoomParticipant_roomId_userId_idx" ON "RoomParticipant"("roomId", "userId");

-- AddForeignKey
ALTER TABLE "RoomParticipant" ADD CONSTRAINT "RoomParticipant_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
