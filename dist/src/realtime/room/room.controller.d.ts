import type { AuthUser } from '../../auth/auth.types';
import { AgoraService } from '../agora/agora.service';
import type { CreateRoomDto } from './dto/room.dto';
import { RoomService } from './room.service';
type JoinRoomRequest = {
    displayName?: string;
    avatarPersona?: string;
    isAnonymous?: boolean;
};
export declare class RoomController {
    private readonly roomService;
    private readonly agoraService;
    constructor(roomService: RoomService, agoraService: AgoraService);
    createRoom(body: CreateRoomDto, user: AuthUser): Promise<{
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        level: string | null;
        status: import("@prisma/client").$Enums.RoomStatus;
        agoraChannelName: string;
        hostUserId: string | null;
    }>;
    createRoomAlias(body: CreateRoomDto, user: AuthUser): Promise<{
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        level: string | null;
        status: import("@prisma/client").$Enums.RoomStatus;
        agoraChannelName: string;
        hostUserId: string | null;
    }>;
    joinRoom(roomId: string, body: JoinRoomRequest, user: AuthUser): Promise<{
        agora: import("../agora/agora.service").AgoraTokenResult;
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
        participants: import("./room.service").RoomParticipantView[];
    }>;
    listRooms(status?: string): Promise<{
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        level: string | null;
        status: import("@prisma/client").$Enums.RoomStatus;
        agoraChannelName: string;
        hostUserId: string | null;
    }[]>;
    getRoom(roomId: string): Promise<{
        participants: {
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
        }[];
    } & {
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        level: string | null;
        status: import("@prisma/client").$Enums.RoomStatus;
        agoraChannelName: string;
        hostUserId: string | null;
    }>;
    getParticipants(roomId: string): Promise<import("./room.service").RoomParticipantView[]>;
    endRoom(roomId: string, user: AuthUser): Promise<{
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        level: string | null;
        status: import("@prisma/client").$Enums.RoomStatus;
        agoraChannelName: string;
        hostUserId: string | null;
    }>;
    private assertRoomManager;
    private getAgoraRole;
}
export {};
