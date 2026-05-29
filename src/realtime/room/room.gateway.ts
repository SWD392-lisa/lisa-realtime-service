import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../../prisma/prisma.service';

@WebSocketGateway({ cors: true })
export class RoomGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  // In-memory mapping of socketId -> { userId, roomId }
  private clientState = new Map<string, { userId: string; roomId: string }>();

  constructor(private prisma: PrismaService) {}

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  async handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
    const state = this.clientState.get(client.id);
    if (state) {
      await this.leaveRoom(client, state);
      this.clientState.delete(client.id);
    }
  }

  @SubscribeMessage('join_room')
  async handleJoinRoom(
    @MessageBody() data: { roomId: string; userId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { roomId, userId } = data;
    
    // Check if room exists, if not, wait we could just let them join
    let room = await this.prisma.room.findUnique({ where: { id: roomId } });
    if (!room) {
      room = await this.prisma.room.create({
        data: { id: roomId, name: 'Default Room' }
      });
    }

    let user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      user = await this.prisma.user.create({
        data: { id: userId, name: `User ${userId.substring(0, 4)}`, email: `${userId}@example.com` }
      });
    }

    this.clientState.set(client.id, { roomId, userId });
    client.join(roomId);

    // Save or update Session in DB
    let session = await this.prisma.session.findFirst({
      where: { roomId, userId, leftAt: null }
    });

    if (!session) {
      session = await this.prisma.session.create({
        data: {
          roomId,
          userId,
          isMicOn: false,
          isRaisingHand: false,
        }
      });
    }

    // Broadcast that a user joined
    this.server.to(roomId).emit('user_joined', { userId, name: user.name });
    
    // Send current participants to the new user
    const participants = await this.prisma.session.findMany({
      where: { roomId, leftAt: null },
      include: { user: true }
    });
    client.emit('room_state', participants);

    return { success: true };
  }

  @SubscribeMessage('raise_hand')
  async handleRaiseHand(
    @MessageBody() data: { isRaising: boolean },
    @ConnectedSocket() client: Socket,
  ) {
    const state = this.clientState.get(client.id);
    if (!state) return;

    await this.prisma.session.updateMany({
      where: { roomId: state.roomId, userId: state.userId, leftAt: null },
      data: { isRaisingHand: data.isRaising }
    });

    this.server.to(state.roomId).emit('user_raised_hand', {
      userId: state.userId,
      isRaising: data.isRaising
    });
  }

  @SubscribeMessage('toggle_mic')
  async handleToggleMic(
    @MessageBody() data: { isMicOn: boolean },
    @ConnectedSocket() client: Socket,
  ) {
    const state = this.clientState.get(client.id);
    if (!state) return;

    await this.prisma.session.updateMany({
      where: { roomId: state.roomId, userId: state.userId, leftAt: null },
      data: { isMicOn: data.isMicOn }
    });

    this.server.to(state.roomId).emit('mic_toggled', {
      userId: state.userId,
      isMicOn: data.isMicOn
    });
  }

  @SubscribeMessage('leave_room')
  async handleLeaveRoom(@ConnectedSocket() client: Socket) {
    const state = this.clientState.get(client.id);
    if (state) {
      await this.leaveRoom(client, state);
      this.clientState.delete(client.id);
    }
  }

  private async leaveRoom(client: Socket, state: { userId: string; roomId: string }) {
    client.leave(state.roomId);
    await this.prisma.session.updateMany({
      where: { roomId: state.roomId, userId: state.userId, leftAt: null },
      data: { leftAt: new Date(), isMicOn: false, isRaisingHand: false }
    });
    this.server.to(state.roomId).emit('user_left', { userId: state.userId });
  }
}
