import { Room, RoomParticipant, RoomStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateRoomDto, JoinRoomDto } from './dto/room.dto';
export type RoomParticipantView = Pick<RoomParticipant, 'id' | 'roomId' | 'userId' | 'displayName' | 'avatarPersona' | 'role' | 'rawRole' | 'isAnonymous' | 'isMicOn' | 'isVideoEnabled' | 'isHandRaised' | 'isSpeaker' | 'agoraUid' | 'joinedAt'>;
export declare class RoomService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    createRoom(dto: CreateRoomDto, hostUserId: string): Promise<Room>;
    listRooms(status?: RoomStatus): Promise<Room[]>;
    getRoom(roomId: string): Promise<Room>;
    getRoomWithParticipants(roomId: string): Promise<{
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
    joinRoom(dto: JoinRoomDto): Promise<{
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
        participants: RoomParticipantView[];
    }>;
    leaveRoom(roomId: string, userId: string): Promise<RoomParticipantView[]>;
    setHandRaised(roomId: string, userId: string, isHandRaised: boolean): Promise<RoomParticipant>;
    setMic(roomId: string, userId: string, isMicOn: boolean): Promise<RoomParticipant>;
    setVideo(roomId: string, userId: string, isVideoEnabled: boolean): Promise<RoomParticipant>;
    approveSpeaker(roomId: string, userId: string): Promise<RoomParticipant>;
    removeSpeaker(roomId: string, userId: string): Promise<RoomParticipant>;
    endRoom(roomId: string): Promise<Room>;
    listParticipants(roomId: string): Promise<RoomParticipantView[]>;
    getActiveParticipant(roomId: string, userId: string): Promise<RoomParticipant>;
    private updateActiveParticipant;
    private createChannelName;
    private createAgoraUid;
}
