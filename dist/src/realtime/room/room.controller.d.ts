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
        roomId: string;
        externalCourseId: string | null;
        externalLevelId: string | null;
        externalSubLevelId: string | null;
        status: import("@prisma/client").$Enums.RoomStatus;
        title: string;
        createdAt: Date;
        updatedAt: Date;
        hostAnonymousId: string;
        defaultChannelName: string;
    }>;
    createRoomAlias(body: CreateRoomDto, user: AuthUser): Promise<{
        roomId: string;
        externalCourseId: string | null;
        externalLevelId: string | null;
        externalSubLevelId: string | null;
        status: import("@prisma/client").$Enums.RoomStatus;
        title: string;
        createdAt: Date;
        updatedAt: Date;
        hostAnonymousId: string;
        defaultChannelName: string;
    }>;
    joinRoom(roomId: string, body: JoinRoomRequest, user: AuthUser): Promise<{
        agora: import("../agora/agora.service").AgoraTokenResult;
        room: {
            roomId: string;
            externalCourseId: string | null;
            externalLevelId: string | null;
            externalSubLevelId: string | null;
            status: import("@prisma/client").$Enums.RoomStatus;
            title: string;
            createdAt: Date;
            updatedAt: Date;
            hostAnonymousId: string;
            defaultChannelName: string;
        };
        participant: any;
        participants: import("./room.service").RoomParticipantView[];
    }>;
    listRooms(status?: string): Promise<{
        roomId: string;
        externalCourseId: string | null;
        externalLevelId: string | null;
        externalSubLevelId: string | null;
        status: import("@prisma/client").$Enums.RoomStatus;
        title: string;
        createdAt: Date;
        updatedAt: Date;
        hostAnonymousId: string;
        defaultChannelName: string;
    }[]>;
    getRoom(roomId: string): Promise<{
        roomId: string;
        externalCourseId: string | null;
        externalLevelId: string | null;
        externalSubLevelId: string | null;
        status: import("@prisma/client").$Enums.RoomStatus;
        title: string;
        createdAt: Date;
        updatedAt: Date;
        hostAnonymousId: string;
        defaultChannelName: string;
    }>;
    getParticipants(roomId: string): Promise<import("./room.service").RoomParticipantView[]>;
    endRoom(roomId: string, user: AuthUser): Promise<{
        roomId: string;
        externalCourseId: string | null;
        externalLevelId: string | null;
        externalSubLevelId: string | null;
        status: import("@prisma/client").$Enums.RoomStatus;
        title: string;
        createdAt: Date;
        updatedAt: Date;
        hostAnonymousId: string;
        defaultChannelName: string;
    }>;
    private assertRoomManager;
    private getAgoraRole;
}
export {};
