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
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const jsonwebtoken_1 = require("jsonwebtoken");
const CLAIM_NAME_IDENTIFIER = 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier';
const CLAIM_NAME = 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name';
const CLAIM_EMAIL = 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress';
const CLAIM_ROLE = 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role';
let AuthService = class AuthService {
    config;
    constructor(config) {
        this.config = config;
    }
    verifyAccessToken(token) {
        const secret = this.config.get('JWT_SECRET_KEY');
        const issuer = this.config.get('JWT_ISSUER');
        const audience = this.config.get('JWT_AUDIENCE');
        if (!secret || !issuer || !audience) {
            throw new common_1.UnauthorizedException('JWT configuration is missing');
        }
        try {
            const claims = (0, jsonwebtoken_1.verify)(token, secret, {
                algorithms: ['HS256'],
                issuer,
                audience,
            });
            const userId = this.getStringClaim(claims, 'sub', 'nameid', 'nameidentifier', CLAIM_NAME_IDENTIFIER);
            const rawRole = this.getRoleClaim(claims);
            if (!userId) {
                throw new common_1.UnauthorizedException('JWT userId claim is missing');
            }
            if (!rawRole) {
                throw new common_1.ForbiddenException('JWT role claim is missing');
            }
            return {
                userId,
                role: this.normalizeRole(rawRole),
                rawRole,
                email: this.getStringClaim(claims, 'email', CLAIM_EMAIL),
                displayName: this.getStringClaim(claims, 'name', 'unique_name', CLAIM_NAME),
            };
        }
        catch (error) {
            if (error instanceof common_1.UnauthorizedException ||
                error instanceof common_1.ForbiddenException) {
                throw error;
            }
            throw new common_1.UnauthorizedException('Invalid access token');
        }
    }
    extractBearerToken(authorization) {
        const value = Array.isArray(authorization)
            ? authorization[0]
            : authorization;
        if (!value) {
            return undefined;
        }
        const [scheme, token] = value.split(' ');
        if (scheme?.toLowerCase() !== 'bearer' || !token) {
            return undefined;
        }
        return token;
    }
    isDevAuthEnabled() {
        return (this.config.get('AUTH_MODE') === 'mock' ||
            this.config.get('REALTIME_DEV_AUTH') === 'true');
    }
    createDevUser(input) {
        if (!this.isDevAuthEnabled()) {
            throw new common_1.UnauthorizedException('Bearer token is required');
        }
        const rawRole = this.readDevString(input.role) || 'LUCY';
        const userId = this.readDevString(input.userId) ||
            `dev-${rawRole.toLowerCase()}-${Date.now()}`;
        return {
            userId,
            role: this.normalizeRole(rawRole),
            rawRole,
            email: this.readDevString(input.email),
            displayName: this.readDevString(input.displayName) || userId,
        };
    }
    normalizeRole(rawRole) {
        const role = rawRole.trim().toUpperCase();
        if (['1', 'LUCY', 'USER', 'STUDENT'].includes(role)) {
            return 'USER';
        }
        if (['2', 'PRO', 'LUCY_PRO', 'MENTOR', 'TEACHER'].includes(role)) {
            return 'MENTOR';
        }
        if (['3', '4', 'SUPER', 'LUCY_SUPER', 'CREATOR'].includes(role)) {
            return 'CREATOR';
        }
        throw new common_1.ForbiddenException('Invalid role');
    }
    canManageRoom(user) {
        return user.role === 'MENTOR' || user.role === 'CREATOR';
    }
    getRoleClaim(claims) {
        const role = claims.role ?? claims[CLAIM_ROLE];
        if (Array.isArray(role)) {
            return role[0];
        }
        return typeof role === 'string' ? role : undefined;
    }
    getStringClaim(claims, ...names) {
        for (const name of names) {
            const value = claims[name];
            if (typeof value === 'string' && value.trim().length > 0) {
                return value.trim();
            }
        }
        return undefined;
    }
    readDevString(value) {
        if (Array.isArray(value)) {
            return this.readDevString(value[0]);
        }
        if (typeof value !== 'string') {
            return undefined;
        }
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : undefined;
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], AuthService);
//# sourceMappingURL=auth.service.js.map