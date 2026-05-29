import { Module } from '@nestjs/common';
import { RoomGateway } from './room/room.gateway';
import { AgoraController } from './agora/agora.controller';

@Module({
  providers: [RoomGateway],
  controllers: [AgoraController]
})
export class RealtimeModule {}
