"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgoraService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const agora_token_1 = require("agora-token");
const DEFAULT_TOKEN_TTL_SECONDS = 60 * 60;
let AgoraService = class AgoraService {
    config;
    constructor(config) {
        this.config = config;
    }
    createRtcToken(params) {
        const appId = this.config.get('AGORA_APP_ID');
        const appCertificate = this.config.get('AGORA_APP_CERTIFICATE');
        if (!appId || !appCertificate) {
            throw new common_1.InternalServerErrorException('Agora credentials are not configured');
        }
        const role = params.role ?? 'subscriber';
        const ttlSeconds = params.ttlSeconds ?? DEFAULT_TOKEN_TTL_SECONDS;
        const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
        const rtcRole = role === 'publisher' ? agora_token_1.RtcRole.PUBLISHER : agora_token_1.RtcRole.SUBSCRIBER;
        const token = agora_token_1.RtcTokenBuilder.buildTokenWithUserAccount(appId, appCertificate, params.channelName, params.uid, rtcRole, ttlSeconds, ttlSeconds);
        return {
            appId,
            token,
            channelName: params.channelName,
            uid: params.uid,
            role,
            expiresAt,
        };
    }
};
exports.AgoraService = AgoraService;
exports.AgoraService = AgoraService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], AgoraService);
//# sourceMappingURL=agora.service.js.map