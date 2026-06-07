import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { RoomParticipantRole } from '@prisma/client';
import { CurrentUser } from '../../auth/current-user.decorator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import type { AuthUser } from '../../auth/auth.types';
import { AgoraService } from '../agora/agora.service';
import { mapAuthRoleToParticipantRole, parseRoomStatus } from './dto/room.dto';
import type { CreateRoomDto } from './dto/room.dto';
import { RoomService } from './room.service';

type JoinRoomRequest = {
  displayName?: string;
  avatarPersona?: string;
  isAnonymous?: boolean;
};

@Controller(['api/rooms', 'rooms'])
export class RoomController {
  constructor(
    private readonly roomService: RoomService,
    private readonly agoraService: AgoraService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  createRoom(@Body() body: CreateRoomDto, @CurrentUser() user: AuthUser) {
    this.assertRoomManager(user);
    return this.roomService.createRoom(body, user.userId);
  }

  @Post('create')
  @UseGuards(JwtAuthGuard)
  createRoomAlias(@Body() body: CreateRoomDto, @CurrentUser() user: AuthUser) {
    return this.createRoom(body, user);
  }

  @Post(':roomId/join')
  @UseGuards(JwtAuthGuard)
  async joinRoom(
    @Param('roomId') roomId: string,
    @Body() body: JoinRoomRequest,
    @CurrentUser() user: AuthUser,
  ) {
    const result = await this.roomService.joinRoom({
      roomId,
      userId: user.userId,
      displayName: user.displayName ?? body?.displayName,
      avatarPersona: body?.avatarPersona,
      rawRole: user.rawRole,
      role: mapAuthRoleToParticipantRole(user.role),
      isAnonymous: body?.isAnonymous ?? user.role === 'USER',
    });

    return {
      ...result,
      agora: this.agoraService.createRtcToken({
        channelName: result.room.agoraChannelName,
        uid: result.participant.agoraUid,
        role: this.getAgoraRole(result.participant.role),
      }),
    };
  }

  @Get()
  listRooms(@Query('status') status?: string) {
    return this.roomService.listRooms(parseRoomStatus(status));
  }

  @Get(':roomId')
  getRoom(@Param('roomId') roomId: string) {
    return this.roomService.getRoomWithParticipants(roomId);
  }

  @Get(':roomId/participants')
  getParticipants(@Param('roomId') roomId: string) {
    return this.roomService.listParticipants(roomId);
  }

  @Patch(':roomId/end')
  @UseGuards(JwtAuthGuard)
  async endRoom(
    @Param('roomId') roomId: string,
    @CurrentUser() user: AuthUser,
  ) {
    const room = await this.roomService.getRoom(roomId);
    if (user.role !== 'CREATOR' && room.hostUserId !== user.userId) {
      throw new ForbiddenException(
        'Only the room owner or creator can end room',
      );
    }

    return this.roomService.endRoom(roomId);
  }

  private assertRoomManager(user: AuthUser) {
    if (user.role !== 'MENTOR' && user.role !== 'CREATOR') {
      throw new ForbiddenException('Only mentor or creator can manage rooms');
    }
  }

  private getAgoraRole(role: RoomParticipantRole): 'publisher' | 'subscriber' {
    return role === RoomParticipantRole.LEARNER ? 'subscriber' : 'publisher';
  }
}
