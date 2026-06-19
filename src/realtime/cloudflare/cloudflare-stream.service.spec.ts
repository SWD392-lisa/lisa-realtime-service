import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { CloudflareStreamService } from './cloudflare-stream.service';

describe('CloudflareStreamService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should reject playback creation when env is missing', async () => {
    const service = new CloudflareStreamService(
      {
        get: jest.fn(() => ''),
      } as unknown as ConfigService,
      {} as never,
    );

    await expect(
      service.createSignedPlaybackUrl('video-1', 3600),
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it('should call token endpoint when configured', async () => {
    const config = {
      CLOUDFLARE_ACCOUNT_ID: 'account-1',
      CLOUDFLARE_API_TOKEN: 'token-1',
      CLOUDFLARE_STREAM_CUSTOMER_CODE: 'demo-code',
    };
    const service = new CloudflareStreamService(
      {
        get: jest.fn((key: string) => config[key as keyof typeof config] ?? ''),
      } as unknown as ConfigService,
      {} as never,
    );
    const fetchMock = jest
      .spyOn(global, 'fetch' as never)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          result: {
            uid: 'video-1',
            preview:
              'https://customer-demo-code.cloudflarestream.com/video-1/iframe',
            playback: {
              hls: 'https://customer-demo-code.cloudflarestream.com/video-1/manifest/video.m3u8',
              dash: 'https://customer-demo-code.cloudflarestream.com/video-1/manifest/video.mpd',
            },
          },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          result: {
            token: 'signed-token',
          },
        }),
      } as Response);

    const result = await service.createSignedPlaybackUrl('video-1', 3600);

    expect(result.playerUrl).toContain('signed-token');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
