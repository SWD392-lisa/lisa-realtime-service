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
    createRoom(body: CreateRoomDto, user: AuthUser): Promise<import("./room.service").RoomView>;
    createRoomAlias(body: CreateRoomDto, user: AuthUser): Promise<import("./room.service").RoomView>;
    joinRoom(roomId: string, body: JoinRoomRequest, user: AuthUser): Promise<{
        agora: import("../agora/agora.service").AgoraTokenResult;
        room: import("./room.service").RoomView;
        participant: import("./room.service").RoomParticipantView;
        participants: import("./room.service").RoomParticipantView[];
    }>;
    listRooms(status?: string): Promise<import("./room.service").RoomView[]>;
    getRoom(roomId: string): Promise<{
        participants: import("./room.service").RoomParticipantView[];
        id: string;
        roomId: string;
        name: string;
        title: string;
        description: string | null;
        level: string | null;
        agoraChannelName: string;
        defaultChannelName: string;
        hostUserId: string;
        hostAnonymousId: string;
        status: import("@prisma/client").RoomStatus;
        createdAt: Date;
        updatedAt: Date;
    }>;
    getParticipants(roomId: string): Promise<import("./room.service").RoomParticipantView[]>;
    endRoom(roomId: string, user: AuthUser): Promise<import("./room.service").RoomView>;
    private assertRoomManager;
    private getAgoraRole;
    private createAgoraOrThrowServiceUnavailable;
}
export {};
