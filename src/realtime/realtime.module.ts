import { Module } from '@nestjs/common';
import { AccessControlService } from '../access-control/access-control.service';
import { AuthModule } from '../auth/auth.module';
import { AgoraRecordingService } from './agora/agora-recording.service';
import { CloudflareStreamService } from './cloudflare/cloudflare-stream.service';
import { RecordingController } from './recording/recording.controller';
import { RecordingService } from './recording/recording.service';
import { SessionGateway } from './session/session.gateway';
import { SessionPersistenceService } from './session/session-persistence.service';
import { SessionStoreService } from './session/session-store.service';

@Module({
  imports: [AuthModule],
  providers: [
    AccessControlService,
    AgoraRecordingService,
    CloudflareStreamService,
    RecordingService,
    SessionGateway,
    SessionPersistenceService,
    SessionStoreService,
  ],
  controllers: [RecordingController],
  exports: [AccessControlService, SessionPersistenceService, SessionStoreService],
})
export class RealtimeModule {}
