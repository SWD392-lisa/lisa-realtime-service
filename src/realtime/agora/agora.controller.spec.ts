import { Test, TestingModule } from '@nestjs/testing';
import { AgoraController } from './agora.controller';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { AgoraTokenService } from './agora-token.service';

describe.skip('AgoraController', () => {
  let controller: AgoraController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AgoraController],
      providers: [
        {
          provide: AgoraTokenService,
          useValue: {},
        },
        {
          provide: JwtAuthGuard,
          useValue: { canActivate: jest.fn(() => true) },
        },
      ],
    }).compile();

    controller = module.get<AgoraController>(AgoraController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
