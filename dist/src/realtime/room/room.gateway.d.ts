import { OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AuthService } from '../../auth/auth.service';
import type { AuthUser } from '../../auth/auth.types';
import { AgoraService } from '../agora/agora.service';
import type { RoomParticipantView } from './room.service';
import { RoomService } from './room.service';
type AuthenticatedSocket = Socket & {
    user: AuthUser;
};
type JoinRoomPayload = {
    roomId: string;
    avatarPersona?: string;
    isAnonymous?: boolean;
};
type TargetUserPayload = {
    roomId?: string;
    targetUserId: string;
};
export declare class RoomGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    private readonly roomService;
    private readonly agoraService;
    private readonly authService;
    server: Server;
    private readonly clientState;
    private readonly userSockets;
    constructor(roomService: RoomService, agoraService: AgoraService, authService: AuthService);
    afterInit(server: Server): void;
    handleConnection(client: AuthenticatedSocket): void;
    handleDisconnect(client: AuthenticatedSocket): Promise<void>;
    handleJoinRoom(data: JoinRoomPayload, client: AuthenticatedSocket): Promise<{
        success: boolean;
        room: {
            name: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            description: string | null;
            level: string | null;
            status: import("@prisma/client").$Enums.RoomStatus;
            agoraChannelName: string;
            hostUserId: string | null;
        };
        participant: {
            role: import("@prisma/client").$Enums.RoomParticipantRole;
            id: string;
            roomId: string;
            userId: string;
            displayName: string | null;
            avatarPersona: string | null;
            rawRole: string | null;
            isAnonymous: boolean;
            isMicOn: boolean;
            isVideoEnabled: boolean;
            isHandRaised: boolean;
            isSpeaker: boolean;
            agoraUid: string;
            joinedAt: Date;
            leftAt: Date | null;
            createdAt: Date;
            updatedAt: Date;
        };
        participants: RoomParticipantView[];
        agora: import("../agora/agora.service").AgoraTokenResult;
    }>;
    handleJoinRoomAlias(data: JoinRoomPayload, client: AuthenticatedSocket): Promise<{
        success: boolean;
        room: {
            name: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            description: string | null;
            level: string | null;
            status: import("@prisma/client").$Enums.RoomStatus;
            agoraChannelName: string;
            hostUserId: string | null;
        };
        participant: {
            role: import("@prisma/client").$Enums.RoomParticipantRole;
            id: string;
            roomId: string;
            userId: string;
            displayName: string | null;
            avatarPersona: string | null;
            rawRole: string | null;
            isAnonymous: boolean;
            isMicOn: boolean;
            isVideoEnabled: boolean;
            isHandRaised: boolean;
            isSpeaker: boolean;
            agoraUid: string;
            joinedAt: Date;
            leftAt: Date | null;
            createdAt: Date;
            updatedAt: Date;
        };
        participants: RoomParticipantView[];
        agora: import("../agora/agora.service").AgoraTokenResult;
    }>;
    handleLeaveRoom(client: AuthenticatedSocket): Promise<{
        success: boolean;
        participants?: undefined;
    } | {
        success: boolean;
        participants: RoomParticipantView[];
    }>;
    handleLeaveRoomAlias(client: AuthenticatedSocket): Promise<{
        success: boolean;
        participants?: undefined;
    } | {
        success: boolean;
        participants: RoomParticipantView[];
    }>;
    handleRaiseHand(client: AuthenticatedSocket): Promise<{
        success: boolean;
        participant: {
            role: import("@prisma/client").$Enums.RoomParticipantRole;
            id: string;
            roomId: string;
            userId: string;
            displayName: string | null;
            avatarPersona: string | null;
            rawRole: string | null;
            isAnonymous: boolean;
            isMicOn: boolean;
            isVideoEnabled: boolean;
            isHandRaised: boolean;
            isSpeaker: boolean;
            agoraUid: string;
            joinedAt: Date;
            leftAt: Date | null;
            createdAt: Date;
            updatedAt: Date;
        };
        participants: RoomParticipantView[];
    }>;
    handleRaiseHandAlias(client: AuthenticatedSocket): Promise<{
        success: boolean;
        participant: {
            role: import("@prisma/client").$Enums.RoomParticipantRole;
            id: string;
            roomId: string;
            userId: string;
            displayName: string | null;
            avatarPersona: string | null;
            rawRole: string | null;
            isAnonymous: boolean;
            isMicOn: boolean;
            isVideoEnabled: boolean;
            isHandRaised: boolean;
            isSpeaker: boolean;
            agoraUid: string;
            joinedAt: Date;
            leftAt: Date | null;
            createdAt: Date;
            updatedAt: Date;
        };
        participants: RoomParticipantView[];
    }>;
    handleLowerHand(client: AuthenticatedSocket): Promise<{
        success: boolean;
        participant: {
            role: import("@prisma/client").$Enums.RoomParticipantRole;
            id: string;
            roomId: string;
            userId: string;
            displayName: string | null;
            avatarPersona: string | null;
            rawRole: string | null;
            isAnonymous: boolean;
            isMicOn: boolean;
            isVideoEnabled: boolean;
            isHandRaised: boolean;
            isSpeaker: boolean;
            agoraUid: string;
            joinedAt: Date;
            leftAt: Date | null;
            createdAt: Date;
            updatedAt: Date;
        };
        participants: RoomParticipantView[];
    }>;
    handleLowerHandAlias(client: AuthenticatedSocket): Promise<{
        success: boolean;
        participant: {
            role: import("@prisma/client").$Enums.RoomParticipantRole;
            id: string;
            roomId: string;
            userId: string;
            displayName: string | null;
            avatarPersona: string | null;
            rawRole: string | null;
            isAnonymous: boolean;
            isMicOn: boolean;
            isVideoEnabled: boolean;
            isHandRaised: boolean;
            isSpeaker: boolean;
            agoraUid: string;
            joinedAt: Date;
            leftAt: Date | null;
            createdAt: Date;
            updatedAt: Date;
        };
        participants: RoomParticipantView[];
    }>;
    handleToggleMic(data: {
        isMicOn: boolean;
    }, client: AuthenticatedSocket): Promise<{
        success: boolean;
        participant: {
            role: import("@prisma/client").$Enums.RoomParticipantRole;
            id: string;
            roomId: string;
            userId: string;
            displayName: string | null;
            avatarPersona: string | null;
            rawRole: string | null;
            isAnonymous: boolean;
            isMicOn: boolean;
            isVideoEnabled: boolean;
            isHandRaised: boolean;
            isSpeaker: boolean;
            agoraUid: string;
            joinedAt: Date;
            leftAt: Date | null;
            createdAt: Date;
            updatedAt: Date;
        };
        participants: RoomParticipantView[];
    }>;
    handleMuteMic(data: Partial<TargetUserPayload>, client: AuthenticatedSocket): Promise<{
        success: boolean;
        participant: {
            role: import("@prisma/client").$Enums.RoomParticipantRole;
            id: string;
            roomId: string;
            userId: string;
            displayName: string | null;
            avatarPersona: string | null;
            rawRole: string | null;
            isAnonymous: boolean;
            isMicOn: boolean;
            isVideoEnabled: boolean;
            isHandRaised: boolean;
            isSpeaker: boolean;
            agoraUid: string;
            joinedAt: Date;
            leftAt: Date | null;
            createdAt: Date;
            updatedAt: Date;
        };
        participants: RoomParticipantView[];
    }>;
    handleMuteUserAlias(data: Partial<TargetUserPayload>, client: AuthenticatedSocket): Promise<{
        success: boolean;
        participant: {
            role: import("@prisma/client").$Enums.RoomParticipantRole;
            id: string;
            roomId: string;
            userId: string;
            displayName: string | null;
            avatarPersona: string | null;
            rawRole: string | null;
            isAnonymous: boolean;
            isMicOn: boolean;
            isVideoEnabled: boolean;
            isHandRaised: boolean;
            isSpeaker: boolean;
            agoraUid: string;
            joinedAt: Date;
            leftAt: Date | null;
            createdAt: Date;
            updatedAt: Date;
        };
        participants: RoomParticipantView[];
    }>;
    handleUnmuteMic(data: Partial<TargetUserPayload>, client: AuthenticatedSocket): Promise<{
        success: boolean;
        participant: {
            role: import("@prisma/client").$Enums.RoomParticipantRole;
            id: string;
            roomId: string;
            userId: string;
            displayName: string | null;
            avatarPersona: string | null;
            rawRole: string | null;
            isAnonymous: boolean;
            isMicOn: boolean;
            isVideoEnabled: boolean;
            isHandRaised: boolean;
            isSpeaker: boolean;
            agoraUid: string;
            joinedAt: Date;
            leftAt: Date | null;
            createdAt: Date;
            updatedAt: Date;
        };
        participants: RoomParticipantView[];
    }>;
    handleUnmuteUserAlias(data: Partial<TargetUserPayload>, client: AuthenticatedSocket): Promise<{
        success: boolean;
        participant: {
            role: import("@prisma/client").$Enums.RoomParticipantRole;
            id: string;
            roomId: string;
            userId: string;
            displayName: string | null;
            avatarPersona: string | null;
            rawRole: string | null;
            isAnonymous: boolean;
            isMicOn: boolean;
            isVideoEnabled: boolean;
            isHandRaised: boolean;
            isSpeaker: boolean;
            agoraUid: string;
            joinedAt: Date;
            leftAt: Date | null;
            createdAt: Date;
            updatedAt: Date;
        };
        participants: RoomParticipantView[];
    }>;
    handleApproveSpeaker(data: TargetUserPayload, client: AuthenticatedSocket): Promise<{
        success: boolean;
        participant: {
            role: import("@prisma/client").$Enums.RoomParticipantRole;
            id: string;
            roomId: string;
            userId: string;
            displayName: string | null;
            avatarPersona: string | null;
            rawRole: string | null;
            isAnonymous: boolean;
            isMicOn: boolean;
            isVideoEnabled: boolean;
            isHandRaised: boolean;
            isSpeaker: boolean;
            agoraUid: string;
            joinedAt: Date;
            leftAt: Date | null;
            createdAt: Date;
            updatedAt: Date;
        };
        participants: RoomParticipantView[];
    }>;
    handleApproveSpeakerAlias(data: TargetUserPayload, client: AuthenticatedSocket): Promise<{
        success: boolean;
        participant: {
            role: import("@prisma/client").$Enums.RoomParticipantRole;
            id: string;
            roomId: string;
            userId: string;
            displayName: string | null;
            avatarPersona: string | null;
            rawRole: string | null;
            isAnonymous: boolean;
            isMicOn: boolean;
            isVideoEnabled: boolean;
            isHandRaised: boolean;
            isSpeaker: boolean;
            agoraUid: string;
            joinedAt: Date;
            leftAt: Date | null;
            createdAt: Date;
            updatedAt: Date;
        };
        participants: RoomParticipantView[];
    }>;
    handleRemoveSpeaker(data: TargetUserPayload, client: AuthenticatedSocket): Promise<{
        success: boolean;
        participant: {
            role: import("@prisma/client").$Enums.RoomParticipantRole;
            id: string;
            roomId: string;
            userId: string;
            displayName: string | null;
            avatarPersona: string | null;
            rawRole: string | null;
            isAnonymous: boolean;
            isMicOn: boolean;
            isVideoEnabled: boolean;
            isHandRaised: boolean;
            isSpeaker: boolean;
            agoraUid: string;
            joinedAt: Date;
            leftAt: Date | null;
            createdAt: Date;
            updatedAt: Date;
        };
        participants: RoomParticipantView[];
    }>;
    handleRemoveSpeakerAlias(data: TargetUserPayload, client: AuthenticatedSocket): Promise<{
        success: boolean;
        participant: {
            role: import("@prisma/client").$Enums.RoomParticipantRole;
            id: string;
            roomId: string;
            userId: string;
            displayName: string | null;
            avatarPersona: string | null;
            rawRole: string | null;
            isAnonymous: boolean;
            isMicOn: boolean;
            isVideoEnabled: boolean;
            isHandRaised: boolean;
            isSpeaker: boolean;
            agoraUid: string;
            joinedAt: Date;
            leftAt: Date | null;
            createdAt: Date;
            updatedAt: Date;
        };
        participants: RoomParticipantView[];
    }>;
    handleEndRoom(client: AuthenticatedSocket): Promise<{
        success: boolean;
        room: {
            name: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            description: string | null;
            level: string | null;
            status: import("@prisma/client").$Enums.RoomStatus;
            agoraChannelName: string;
            hostUserId: string | null;
        };
    }>;
    handleEndRoomAlias(client: AuthenticatedSocket): Promise<{
        success: boolean;
        room: {
            name: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            description: string | null;
            level: string | null;
            status: import("@prisma/client").$Enums.RoomStatus;
            agoraChannelName: string;
            hostUserId: string | null;
        };
    }>;
    handleEnableVideo(client: AuthenticatedSocket): Promise<{
        success: boolean;
        participant: {
            role: import("@prisma/client").$Enums.RoomParticipantRole;
            id: string;
            roomId: string;
            userId: string;
            displayName: string | null;
            avatarPersona: string | null;
            rawRole: string | null;
            isAnonymous: boolean;
            isMicOn: boolean;
            isVideoEnabled: boolean;
            isHandRaised: boolean;
            isSpeaker: boolean;
            agoraUid: string;
            joinedAt: Date;
            leftAt: Date | null;
            createdAt: Date;
            updatedAt: Date;
        };
        participants: RoomParticipantView[];
    }>;
    handleDisableVideo(client: AuthenticatedSocket): Promise<{
        success: boolean;
        participant: {
            role: import("@prisma/client").$Enums.RoomParticipantRole;
            id: string;
            roomId: string;
            userId: string;
            displayName: string | null;
            avatarPersona: string | null;
            rawRole: string | null;
            isAnonymous: boolean;
            isMicOn: boolean;
            isVideoEnabled: boolean;
            isHandRaised: boolean;
            isSpeaker: boolean;
            agoraUid: string;
            joinedAt: Date;
            leftAt: Date | null;
            createdAt: Date;
            updatedAt: Date;
        };
        participants: RoomParticipantView[];
    }>;
    handleRemoveUser(data: TargetUserPayload, client: AuthenticatedSocket): Promise<{
        success: boolean;
        participants: RoomParticipantView[];
    }>;
    private setHandRaised;
    private setMic;
    private setVideo;
    private leaveCurrentRoom;
    private getClientState;
    private getSocketToken;
    private getSocketUser;
    private assertRoomManager;
    private toParticipantEvent;
    private userSocketKey;
    private toWsException;
}
export {};
