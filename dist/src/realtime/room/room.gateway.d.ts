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
        room: import("./room.service").RoomView;
        participant: RoomParticipantView;
        participants: RoomParticipantView[];
        agora: import("../agora/agora.service").AgoraTokenResult;
    }>;
    handleJoinRoomAlias(data: JoinRoomPayload, client: AuthenticatedSocket): Promise<{
        success: boolean;
        room: import("./room.service").RoomView;
        participant: RoomParticipantView;
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
        participant: RoomParticipantView;
        participants: RoomParticipantView[];
    }>;
    handleRaiseHandAlias(client: AuthenticatedSocket): Promise<{
        success: boolean;
        participant: RoomParticipantView;
        participants: RoomParticipantView[];
    }>;
    handleLowerHand(client: AuthenticatedSocket): Promise<{
        success: boolean;
        participant: RoomParticipantView;
        participants: RoomParticipantView[];
    }>;
    handleLowerHandAlias(client: AuthenticatedSocket): Promise<{
        success: boolean;
        participant: RoomParticipantView;
        participants: RoomParticipantView[];
    }>;
    handleToggleMic(data: {
        isMicOn: boolean;
    }, client: AuthenticatedSocket): Promise<{
        success: boolean;
        participant: RoomParticipantView;
        participants: RoomParticipantView[];
    }>;
    handleMuteMic(data: Partial<TargetUserPayload>, client: AuthenticatedSocket): Promise<{
        success: boolean;
        participant: RoomParticipantView;
        participants: RoomParticipantView[];
    }>;
    handleMuteUserAlias(data: Partial<TargetUserPayload>, client: AuthenticatedSocket): Promise<{
        success: boolean;
        participant: RoomParticipantView;
        participants: RoomParticipantView[];
    }>;
    handleUnmuteMic(data: Partial<TargetUserPayload>, client: AuthenticatedSocket): Promise<{
        success: boolean;
        participant: RoomParticipantView;
        participants: RoomParticipantView[];
    }>;
    handleUnmuteUserAlias(data: Partial<TargetUserPayload>, client: AuthenticatedSocket): Promise<{
        success: boolean;
        participant: RoomParticipantView;
        participants: RoomParticipantView[];
    }>;
    handleApproveSpeaker(data: TargetUserPayload, client: AuthenticatedSocket): Promise<{
        success: boolean;
        participant: RoomParticipantView;
        participants: RoomParticipantView[];
    }>;
    handleApproveSpeakerAlias(data: TargetUserPayload, client: AuthenticatedSocket): Promise<{
        success: boolean;
        participant: RoomParticipantView;
        participants: RoomParticipantView[];
    }>;
    handleRemoveSpeaker(data: TargetUserPayload, client: AuthenticatedSocket): Promise<{
        success: boolean;
        participant: RoomParticipantView;
        participants: RoomParticipantView[];
    }>;
    handleRemoveSpeakerAlias(data: TargetUserPayload, client: AuthenticatedSocket): Promise<{
        success: boolean;
        participant: RoomParticipantView;
        participants: RoomParticipantView[];
    }>;
    handleEndRoom(client: AuthenticatedSocket): Promise<{
        success: boolean;
        room: import("./room.service").RoomView;
    }>;
    handleEndRoomAlias(client: AuthenticatedSocket): Promise<{
        success: boolean;
        room: import("./room.service").RoomView;
    }>;
    handleEnableVideo(client: AuthenticatedSocket): Promise<{
        success: boolean;
        participant: RoomParticipantView;
        participants: RoomParticipantView[];
    }>;
    handleDisableVideo(client: AuthenticatedSocket): Promise<{
        success: boolean;
        participant: RoomParticipantView;
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
