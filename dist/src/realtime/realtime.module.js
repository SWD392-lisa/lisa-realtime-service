"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RealtimeModule = void 0;
const common_1 = require("@nestjs/common");
const access_control_service_1 = require("../access-control/access-control.service");
const auth_module_1 = require("../auth/auth.module");
const agora_recording_service_1 = require("./agora/agora-recording.service");
const cloudflare_stream_service_1 = require("./cloudflare/cloudflare-stream.service");
const recording_controller_1 = require("./recording/recording.controller");
const recording_service_1 = require("./recording/recording.service");
const session_gateway_1 = require("./session/session.gateway");
const session_persistence_service_1 = require("./session/session-persistence.service");
const session_store_service_1 = require("./session/session-store.service");
let RealtimeModule = class RealtimeModule {
};
exports.RealtimeModule = RealtimeModule;
exports.RealtimeModule = RealtimeModule = __decorate([
    (0, common_1.Module)({
        imports: [auth_module_1.AuthModule],
        providers: [
            access_control_service_1.AccessControlService,
            agora_recording_service_1.AgoraRecordingService,
            cloudflare_stream_service_1.CloudflareStreamService,
            recording_service_1.RecordingService,
            session_gateway_1.SessionGateway,
            session_persistence_service_1.SessionPersistenceService,
            session_store_service_1.SessionStoreService,
        ],
        controllers: [recording_controller_1.RecordingController],
        exports: [access_control_service_1.AccessControlService, session_persistence_service_1.SessionPersistenceService, session_store_service_1.SessionStoreService],
    })
], RealtimeModule);
//# sourceMappingURL=realtime.module.js.map