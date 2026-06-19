import type { AuthUser } from '../../auth/auth.types';
import { AgoraTokenService } from './agora-token.service';
import type { AgoraTokenRequest } from './agora.types';
export declare class AgoraController {
    private readonly agoraTokenService;
    constructor(agoraTokenService: AgoraTokenService);
    createToken(payload: AgoraTokenRequest, user: AuthUser): import("./agora.types").AgoraTokenResponse;
}
