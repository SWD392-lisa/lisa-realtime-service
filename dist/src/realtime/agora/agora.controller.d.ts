import { AgoraService } from './agora.service';
export declare class AgoraController {
    private readonly agoraService;
    constructor(agoraService: AgoraService);
    getToken(channelName: string, uid: string, roleStr?: string): import("./agora.service").AgoraTokenResult;
}
