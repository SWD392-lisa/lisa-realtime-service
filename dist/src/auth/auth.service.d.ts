import { ConfigService } from '@nestjs/config';
import type { AuthRole, AuthUser } from './auth.types';
export declare class AuthService {
    private readonly config;
    constructor(config: ConfigService);
    verifyAccessToken(token: string): AuthUser;
    extractBearerToken(authorization?: string | string[]): string | undefined;
    isDevAuthEnabled(): boolean;
    createDevUser(input: {
        userId?: unknown;
        role?: unknown;
        email?: unknown;
        displayName?: unknown;
    }): AuthUser;
    normalizeRole(rawRole: string): AuthRole;
    canManageRoom(user: AuthUser): boolean;
    private getRoleClaim;
    private getStringClaim;
    private readDevString;
}
