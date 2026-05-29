import { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../../prisma/prisma.service';
export declare class RoomGateway implements OnGatewayConnection, OnGatewayDisconnect {
    private prisma;
    server: Server;
    private clientState;
    constructor(prisma: PrismaService);
    handleConnection(client: Socket): void;
    handleDisconnect(client: Socket): Promise<void>;
    handleJoinRoom(data: {
        roomId: string;
        userId: string;
    }, client: Socket): Promise<{
        success: boolean;
    }>;
    handleRaiseHand(data: {
        isRaising: boolean;
    }, client: Socket): Promise<void>;
    handleToggleMic(data: {
        isMicOn: boolean;
    }, client: Socket): Promise<void>;
    handleLeaveRoom(client: Socket): Promise<void>;
    private leaveRoom;
}
