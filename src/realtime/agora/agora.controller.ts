import { Controller, Get, Query, HttpException, HttpStatus } from '@nestjs/common';
import { RtcTokenBuilder, RtcRole } from 'agora-token';

@Controller('api/agora')
export class AgoraController {
  @Get('token')
  getToken(
    @Query('channelName') channelName: string,
    @Query('uid') uid: string,
    @Query('role') roleStr?: string,
  ) {
    if (!channelName) {
      throw new HttpException('channelName is required', HttpStatus.BAD_REQUEST);
    }

    const appId = process.env.AGORA_APP_ID;
    const appCertificate = process.env.AGORA_APP_CERTIFICATE;

    if (!appId || !appCertificate) {
      throw new HttpException('Agora credentials are not configured', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    let role = RtcRole.PUBLISHER;
    if (roleStr === 'subscriber') {
      role = RtcRole.SUBSCRIBER;
    }

    const expirationTimeInSeconds = 3600;
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

    const token = RtcTokenBuilder.buildTokenWithUserAccount(
      appId,
      appCertificate,
      channelName,
      uid || '0',
      role,
      expirationTimeInSeconds,
      privilegeExpiredTs
    );

    return {
      token,
      channelName,
      uid: uid || '0',
      appId, // Return appId to the client so they can use it
    };
  }
}
