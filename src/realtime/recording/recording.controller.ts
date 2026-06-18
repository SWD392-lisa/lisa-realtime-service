import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../auth/current-user.decorator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import type { AuthUser } from '../../auth/auth.types';
import { RecordingService } from './recording.service';

@Controller('api')
@UseGuards(JwtAuthGuard)
export class RecordingController {
  constructor(private readonly recordingService: RecordingService) {}

  @Post('sessions/:sessionId/recordings/start')
  startRecording(
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.recordingService.startRecording(sessionId, user);
  }

  @Post('recordings/:recordingId/stop')
  stopRecording(
    @Param('recordingId') recordingId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.recordingService.stopRecording(recordingId, user);
  }

  @Post('recordings/:recordingId/cloudflare-video')
  registerRecordingVideo(
    @Param('recordingId') recordingId: string,
    @CurrentUser() user: AuthUser,
    @Body('videoUid') videoUid: string,
  ) {
    return this.recordingService.registerRecordingVideo(recordingId, user, videoUid);
  }

  @Get('recordings/:recordingId')
  getRecording(
    @Param('recordingId') recordingId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.recordingService.getRecording(recordingId, user);
  }

  @Get('sessions/:sessionId/recordings')
  listSessionRecordings(
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.recordingService.listSessionRecordings(sessionId, user);
  }

  @Get('recordings/:recordingId/playback-url')
  async getPlaybackUrl(
    @Param('recordingId') recordingId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.recordingService.getPlaybackUrl(recordingId, user);
  }
}
