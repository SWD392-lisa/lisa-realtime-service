import { Test, TestingModule } from '@nestjs/testing';
import { AgoraController } from './agora.controller';

describe('AgoraController', () => {
  let controller: AgoraController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AgoraController],
    }).compile();

    controller = module.get<AgoraController>(AgoraController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
