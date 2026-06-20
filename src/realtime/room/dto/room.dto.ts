// @ts-nocheck
import { BadRequestException } from '@nestjs/common';
import { RoomStatus } from '@prisma/client';
import type { AuthRole } from '../../../auth/auth.types';

export const ROOM_PARTICIPANT_ROLES = ['HOST', 'MENTOR', 'LEARNER'] as const;
export type RoomParticipantRole =
  (typeof ROOM_PARTICIPANT_ROLES)[number];

export interface CreateRoomDto {
  name: string;
  description?: string;
  level?: string;
}

export interface JoinRoomDto {
  roomId: string;
  userId: string;
  displayName?: string;
  avatarPersona?: string;
  rawRole?: string;
  role?: RoomParticipantRole;
  isAnonymous?: boolean;
}

export interface ParticipantStateDto {
  isMicOn?: boolean;
  isHandRaised?: boolean;
}

export interface SpeakerActionDto {
  roomId?: string;
  targetUserId: string;
}

export function mapAuthRoleToParticipantRole(
  role: AuthRole,
): RoomParticipantRole {
  if (role === 'MENTOR') {
    return 'MENTOR';
  }

  if (role === 'CREATOR') {
    return 'HOST';
  }

  return 'LEARNER';
}

export function parseRoomStatus(value?: string): RoomStatus | undefined {
  if (!value) {
    return undefined;
  }

  const status = value.toUpperCase();
  if (!Object.values(RoomStatus).includes(status as RoomStatus)) {
    throw new BadRequestException('Invalid room status');
  }

  return status as RoomStatus;
}

export function parseParticipantRole(value?: string): RoomParticipantRole {
  if (!value) {
    return 'LEARNER';
  }

  const role = value.toUpperCase();
  if (!ROOM_PARTICIPANT_ROLES.includes(role as RoomParticipantRole)) {
    throw new BadRequestException('Invalid participant role');
  }

  return role as RoomParticipantRole;
}

export function assertNonEmptyString(
  value: unknown,
  fieldName: string,
): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new BadRequestException(`${fieldName} is required`);
  }

  return value.trim();
}

export function optionalTrimmedString(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new BadRequestException('Expected string value');
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
