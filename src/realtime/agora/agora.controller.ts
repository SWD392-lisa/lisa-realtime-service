import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../auth/current-user.decorator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import type { AuthUser } from '../../auth/auth.types';
import { AgoraTokenService } from './agora-token.service';
import type { AgoraTokenRequest } from './agora.types';

@Controller('api/agora')
@UseGuards(JwtAuthGuard)
export class AgoraController {
  constructor(private readonly agoraTokenService: AgoraTokenService) {}

  @Post('token')
  createToken(
    @Body() payload: AgoraTokenRequest,
    @CurrentUser() user: AuthUser,
  ) {
    return this.agoraTokenService.createToken(payload, user);
  }
}
