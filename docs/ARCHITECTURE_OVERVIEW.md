# Architecture Overview

## Purpose

`lucy-realtime-service` la microservice rieng cho realtime domain cua LUCY.

Service nay dung `Node.js` va `NestJS`.

## Core Responsibilities

Realtime Service phu trach:

- Room creation and room lifecycle
- Live session lifecycle
- Socket.IO presence and room state coordination
- Agora audio/video session coordination
- Screen share coordination
- Recording metadata
- Cloudflare Stream playback metadata

## Service Ownership

### .NET User & Payment Service

Source of truth cho:

- User identity
- User role
- Payment
- Enrollment
- Access rules

### Java LMS Service

Source of truth cho:

- Course
- Level
- Sub-level
- Learning content

### Realtime Service

Source of truth cho:

- Room state
- Session state
- Realtime presence
- Socket state
- Recording metadata
- Playback metadata needed for realtime workflows

## Data Model Boundaries

Realtime Service khong duoc mo phong lai domain cua service khac.

Khong tao:

- `users`
- `passwords`
- `wallets`
- `levels`
- `sub_levels`

Chi luu external references neu can:

- `anonymousUserId`
- `externalCourseId`
- `externalLevelId`
- `externalSubLevelId`

## Integration Style

### REST

Dung cho:

- Room/session management APIs
- Metadata lookup
- Admin/moderation actions

### Socket.IO

Dung cho:

- Join/leave room
- Presence updates
- Speaker state
- Mic/video/screen-share coordination
- Lightweight realtime events

### Agora

Dung cho:

- Audio/video transport
- Screen share transport
- Token-based media session access

### Cloudflare Stream

Dung cho:

- Playback and recording-related metadata
- Stream playback references

## Web Client Status

Web client trong repo nay chi la:

- Demo client
- Test client
- Internal verification surface

Khong phai frontend production.

Frontend production sau nay se la Flutter hoac frontend rieng, tich hop qua documented API/socket contracts.

## Recommended Internal Structure

- `auth`
- `realtime/room`
- `realtime/session`
- `realtime/agora`
- `prisma`
- `docs`

Muc tieu la modular va ro service boundary, khong bien service nay thanh monolith chua domain data cua he thong khac.
