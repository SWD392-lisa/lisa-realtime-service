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
const agora_service_1 = require("./agora.service");
let AgoraController = class AgoraController {
    agoraService;
    constructor(agoraService) {
        this.agoraService = agoraService;
    }
    getToken(channelName, uid, roleStr) {
        if (!channelName) {
            throw new common_1.BadRequestException('channelName is required');
        }
        if (roleStr && !['publisher', 'subscriber'].includes(roleStr)) {
            throw new common_1.BadRequestException('role must be publisher or subscriber');
        }
        return this.agoraService.createRtcToken({
            channelName,
            uid: uid || '0',
            role: roleStr === 'publisher' ? 'publisher' : 'subscriber',
        });
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
    (0, common_1.Controller)('api/agora'),
    __metadata("design:paramtypes", [agora_service_1.AgoraService])
], AgoraController);
//# sourceMappingURL=agora.controller.js.map