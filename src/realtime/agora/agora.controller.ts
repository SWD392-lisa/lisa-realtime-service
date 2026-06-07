import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { AgoraService } from './agora.service';

@Controller('api/agora')
export class AgoraController {
  constructor(private readonly agoraService: AgoraService) {}

  @Get('token')
  getToken(
    @Query('channelName') channelName: string,
    @Query('uid') uid: string,
    @Query('role') roleStr?: string,
  ) {
    if (!channelName) {
      throw new BadRequestException('channelName is required');
    }

    if (roleStr && !['publisher', 'subscriber'].includes(roleStr)) {
      throw new BadRequestException('role must be publisher or subscriber');
    }

    return this.agoraService.createRtcToken({
      channelName,
      uid: uid || '0',
      role: roleStr === 'publisher' ? 'publisher' : 'subscriber',
    });
  }
}
