import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { AgoraRecordingService } from './agora-recording.service';

describe('AgoraRecordingService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should reject when Agora recording env is missing', async () => {
    const configService = {
      get: jest.fn(() => ''),
    } as unknown as ConfigService;
    const service = new AgoraRecordingService(configService);

    await expect(
      service.acquireResource('channel-session-alpha', '9999'),
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it('should call acquire endpoint when configured', async () => {
    const configService = {
      get: jest.fn((key: string) => {
        const config: Record<string, string> = {
          AGORA_APP_ID: '0123456789abcdef0123456789abcdef',
          AGORA_APP_CERTIFICATE: 'fedcba9876543210fedcba9876543210',
          AGORA_REST_CUSTOMER_ID: 'customer-id',
          AGORA_REST_CUSTOMER_SECRET: 'customer-secret',
          AGORA_RECORDING_UID: '9999',
          AGORA_RECORDING_MODE: 'composite',
        };
        return config[key];
      }),
    } as unknown as ConfigService;
    const service = new AgoraRecordingService(configService);
    const fetchMock = jest.spyOn(global, 'fetch' as never).mockResolvedValue({
      ok: true,
      json: async () => ({ resourceId: 'resource-1' }),
    } as Response);

    const response = await service.acquireResource('channel-1', '9999');

    expect(response.resourceId).toBe('resource-1');
    expect(fetchMock).toHaveBeenCalled();
  });
});
