import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { RealtimeModule } from '../realtime.module';
import { AgoraController } from './agora.controller';
import { AgoraRecordingService } from './agora-recording.service';
import { AgoraTokenService } from './agora-token.service';

@Module({
  imports: [AuthModule, RealtimeModule],
  controllers: [AgoraController],
  providers: [AgoraTokenService, AgoraRecordingService],
  exports: [AgoraTokenService, AgoraRecordingService],
})
export class AgoraModule {}
