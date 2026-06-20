import { RoomStatus } from '@prisma/client';
import type { AuthRole } from '../../../auth/auth.types';
export declare const ROOM_PARTICIPANT_ROLES: readonly ["HOST", "MENTOR", "LEARNER"];
export type RoomParticipantRole = (typeof ROOM_PARTICIPANT_ROLES)[number];
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
export declare function mapAuthRoleToParticipantRole(role: AuthRole): RoomParticipantRole;
export declare function parseRoomStatus(value?: string): RoomStatus | undefined;
export declare function parseParticipantRole(value?: string): RoomParticipantRole;
export declare function assertNonEmptyString(value: unknown, fieldName: string): string;
export declare function optionalTrimmedString(value: unknown): string | undefined;
