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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgoraController = void 0;
const common_1 = require("@nestjs/common");
const agora_token_1 = require("agora-token");
let AgoraController = class AgoraController {
    getToken(channelName, uid, roleStr) {
        if (!channelName) {
            throw new common_1.HttpException('channelName is required', common_1.HttpStatus.BAD_REQUEST);
        }
        const appId = process.env.AGORA_APP_ID;
        const appCertificate = process.env.AGORA_APP_CERTIFICATE;
        if (!appId || !appCertificate) {
            throw new common_1.HttpException('Agora credentials are not configured', common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
        let role = agora_token_1.RtcRole.PUBLISHER;
        if (roleStr === 'subscriber') {
            role = agora_token_1.RtcRole.SUBSCRIBER;
        }
        const expirationTimeInSeconds = 3600;
        const currentTimestamp = Math.floor(Date.now() / 1000);
        const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;
        const token = agora_token_1.RtcTokenBuilder.buildTokenWithUserAccount(appId, appCertificate, channelName, uid || '0', role, expirationTimeInSeconds, privilegeExpiredTs);
        return {
            token,
            channelName,
            uid: uid || '0',
            appId,
        };
    }
};
exports.AgoraController = AgoraController;
__decorate([
    (0, common_1.Get)('token'),
    __param(0, (0, common_1.Query)('channelName')),
    __param(1, (0, common_1.Query)('uid')),
    __param(2, (0, common_1.Query)('role')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], AgoraController.prototype, "getToken", null);
exports.AgoraController = AgoraController = __decorate([
    (0, common_1.Controller)('api/agora')
], AgoraController);
//# sourceMappingURL=agora.controller.js.map