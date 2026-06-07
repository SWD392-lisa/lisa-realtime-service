import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AgoraController } from './agora/agora.controller';
import { AgoraService } from './agora/agora.service';
import { RoomController } from './room/room.controller';
import { RoomGateway } from './room/room.gateway';
import { RoomService } from './room/room.service';

@Module({
  imports: [AuthModule],
  providers: [AgoraService, RoomGateway, RoomService],
  controllers: [AgoraController, RoomController],
})
export class RealtimeModule {}
