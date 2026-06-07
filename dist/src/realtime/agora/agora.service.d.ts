import { ConfigService } from '@nestjs/config';
export interface AgoraTokenResult {
    appId: string;
    token: string;
    channelName: string;
    uid: string;
    role: 'publisher' | 'subscriber';
    expiresAt: number;
}
export declare class AgoraService {
    private readonly config;
    constructor(config: ConfigService);
    createRtcToken(params: {
        channelName: string;
        uid: string;
        role?: 'publisher' | 'subscriber';
        ttlSeconds?: number;
    }): AgoraTokenResult;
}
