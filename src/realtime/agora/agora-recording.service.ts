import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type AgoraRecordingMode = 'composite' | 'individual' | 'webpage';

interface AgoraAcquireResponse {
  resourceId: string;
  sid?: string;
}

interface AgoraStartResponse {
  resourceId: string;
  sid: string;
  serverResponse?: unknown;
}

interface AgoraStopResponse {
  resourceId?: string;
  sid?: string;
  serverResponse?: unknown;
}

@Injectable()
export class AgoraRecordingService {
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    const appId = this.configService.get<string>('AGORA_APP_ID')?.trim() ?? '';
    this.baseUrl = `https://api.agora.io/v1/apps/${appId}/cloud_recording`;
  }

  isConfigured() {
    return Boolean(
      this.configService.get<string>('AGORA_APP_ID')?.trim() &&
        this.configService.get<string>('AGORA_APP_CERTIFICATE')?.trim() &&
        this.configService.get<string>('AGORA_REST_CUSTOMER_ID')?.trim() &&
        this.configService.get<string>('AGORA_REST_CUSTOMER_SECRET')?.trim() &&
        this.configService.get<string>('AGORA_RECORDING_UID')?.trim() &&
        this.configService.get<string>('AGORA_RECORDING_MODE')?.trim(),
    );
  }

  getMode(): AgoraRecordingMode {
    const mode =
      this.configService.get<string>('AGORA_RECORDING_MODE')?.trim() ?? '';

    if (!['composite', 'individual', 'webpage'].includes(mode)) {
      throw new BadRequestException(
        'AGORA_RECORDING_MODE must be composite, individual, or webpage',
      );
    }

    return mode as AgoraRecordingMode;
  }

  getRecordingUid() {
    const uid = this.configService.get<string>('AGORA_RECORDING_UID')?.trim();
    if (!uid) {
      throw this.notConfigured();
    }

    return uid;
  }

  getWebRecorderUrl(sessionId: string) {
    const baseUrl =
      this.configService.get<string>('WEB_CLIENT_BASE_URL')?.trim() ??
      'http://localhost:5173';
    return `${baseUrl}/recorder/session/${encodeURIComponent(sessionId)}`;
  }

  async acquireResource(channelName: string, recordingUid: string) {
    this.assertConfigured();

    return this.request<AgoraAcquireResponse>('/acquire', {
      cname: channelName,
      uid: recordingUid,
      clientRequest: {},
    });
  }

  async startRecording(params: {
    recordingId: string;
    sessionId: string;
    channelName: string;
    recordingUid: string;
    mode: AgoraRecordingMode;
  }) {
    this.assertConfigured();

    const acquire = await this.acquireResource(
      params.channelName,
      params.recordingUid,
    );
    const startPath = `/resourceid/${acquire.resourceId}/mode/${params.mode}/start`;
    const body = {
      cname: params.channelName,
      uid: params.recordingUid,
      clientRequest: this.buildStartRequest(params),
    };
    const start = await this.request<AgoraStartResponse>(startPath, body);

    return {
      resourceId: acquire.resourceId,
      sid: start.sid,
      acquireResponse: acquire,
      startResponse: start,
    };
  }

  async stopRecording(params: {
    channelName: string;
    recordingUid: string;
    resourceId: string;
    sid: string;
    mode?: AgoraRecordingMode;
  }) {
    this.assertConfigured();

    const mode = params.mode ?? this.getMode();
    const stopPath = `/resourceid/${params.resourceId}/sid/${params.sid}/mode/${mode}/stop`;

    return this.request<AgoraStopResponse>(stopPath, {
      cname: params.channelName,
      uid: params.recordingUid,
      clientRequest: {},
    });
  }

  private buildStartRequest(params: {
    recordingId: string;
    sessionId: string;
    channelName: string;
    recordingUid: string;
    mode: AgoraRecordingMode;
  }) {
    const storageVendor = this.configService.get<string>(
      'AGORA_RECORDING_STORAGE_VENDOR',
    );
    const rawStorageConfig = this.configService.get<string>(
      'AGORA_RECORDING_STORAGE_CONFIG',
    );
    const storageConfig = rawStorageConfig
      ? JSON.parse(rawStorageConfig)
      : undefined;
    const commonConfig = {
      channelType: 1,
      streamTypes: 2,
      audioProfile: 1,
      videoStreamType: 0,
      maxIdleTime: 30,
      subscribeUidGroup: 0,
      transcodingConfig:
        params.mode === 'composite'
          ? {
              width: 1280,
              height: 720,
              fps: 15,
              bitrate: 1200,
              mixedVideoLayout: 1,
            }
          : undefined,
    };

    const clientRequest: Record<string, unknown> = {
      recordingConfig: commonConfig,
    };

    if (storageVendor && storageConfig) {
      clientRequest.storageConfig = {
        vendor: Number(storageVendor),
        ...storageConfig,
      };
    }

    if (params.mode === 'webpage') {
      clientRequest.extensionServiceConfig = {
        errorHandlePolicy: 'error_abort',
        extensionServices: [
          {
            serviceName: 'web_recorder_service',
            errorHandlePolicy: 'error_abort',
            serviceParam: {
              url: this.getWebRecorderUrl(params.sessionId),
              audioProfile: 1,
              videoWidth: 1280,
              videoHeight: 720,
              maxRecordingHour: 2,
            },
          },
        ],
      };
    }

    return clientRequest;
  }

  private async request<T>(path: string, body: unknown): Promise<T> {
    const customerId = this.configService.get<string>(
      'AGORA_REST_CUSTOMER_ID',
    )!;
    const customerSecret = this.configService.get<string>(
      'AGORA_REST_CUSTOMER_SECRET',
    )!;
    const auth = Buffer.from(`${customerId}:${customerSecret}`).toString(
      'base64',
    );
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      throw new BadRequestException(
        data?.message ||
          data?.reason ||
          `Agora recording request failed with status ${response.status}`,
      );
    }

    return data as T;
  }

  private assertConfigured() {
    if (!this.isConfigured()) {
      throw this.notConfigured();
    }
  }

  private notConfigured() {
    return new ServiceUnavailableException({
      code: 'AGORA_NOT_CONFIGURED',
      message:
        'Agora Cloud Recording is not configured. Set REST credentials and recording env vars.',
    });
  }
}
