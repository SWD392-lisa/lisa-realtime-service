import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { verify } from 'jsonwebtoken';
import type { AuthRole, AuthUser, JwtClaims } from './auth.types';

const CLAIM_NAME_IDENTIFIER =
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier';
const CLAIM_NAME = 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name';
const CLAIM_EMAIL =
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress';
const CLAIM_ROLE =
  'http://schemas.microsoft.com/ws/2008/06/identity/claims/role';

@Injectable()
export class AuthService {
  constructor(private readonly config: ConfigService) {}

  verifyAccessToken(token: string): AuthUser {
    const secret = this.config.get<string>('JWT_SECRET_KEY');
    const issuer = this.config.get<string>('JWT_ISSUER');
    const audience = this.config.get<string>('JWT_AUDIENCE');

    if (!secret || !issuer || !audience) {
      throw new UnauthorizedException('JWT configuration is missing');
    }

    try {
      const claims = verify(token, secret, {
        algorithms: ['HS256'],
        issuer,
        audience,
      }) as JwtClaims & Record<string, unknown>;

      const userId = this.getStringClaim(
        claims,
        'sub',
        'nameid',
        'nameidentifier',
        CLAIM_NAME_IDENTIFIER,
      );
      const rawRole = this.getRoleClaim(claims);

      if (!userId) {
        throw new UnauthorizedException('JWT userId claim is missing');
      }

      if (!rawRole) {
        throw new ForbiddenException('JWT role claim is missing');
      }

      return {
        userId,
        role: this.normalizeRole(rawRole),
        rawRole,
        email: this.getStringClaim(claims, 'email', CLAIM_EMAIL),
        displayName: this.getStringClaim(
          claims,
          'name',
          'unique_name',
          CLAIM_NAME,
        ),
      };
    } catch (error) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }

      throw new UnauthorizedException('Invalid access token');
    }
  }

  extractBearerToken(authorization?: string | string[]): string | undefined {
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

  isDevAuthEnabled(): boolean {
    return (
      this.config.get<string>('AUTH_MODE') === 'mock' ||
      this.config.get<string>('REALTIME_DEV_AUTH') === 'true'
    );
  }

  createDevUser(input: {
    userId?: unknown;
    role?: unknown;
    email?: unknown;
    displayName?: unknown;
  }): AuthUser {
    if (!this.isDevAuthEnabled()) {
      throw new UnauthorizedException('Bearer token is required');
    }

    const rawRole = this.readDevString(input.role) || 'LUCY';
    const userId =
      this.readDevString(input.userId) ||
      `dev-${rawRole.toLowerCase()}-${Date.now()}`;

    return {
      userId,
      role: this.normalizeRole(rawRole),
      rawRole,
      email: this.readDevString(input.email),
      displayName: this.readDevString(input.displayName) || userId,
    };
  }

  normalizeRole(rawRole: string): AuthRole {
    const role = rawRole.trim().toUpperCase();

    // User Service currently emits numeric RoleId values in JWTs.
    if (['1', 'LUCY', 'USER', 'STUDENT'].includes(role)) {
      return 'USER';
    }

    if (['2', 'LUCY_PRO', 'MENTOR', 'TEACHER'].includes(role)) {
      return 'MENTOR';
    }

    if (['3', '4', 'LUCY_SUPER', 'CREATOR', 'SUPER', 'ADMIN'].includes(role)) {
      return 'CREATOR';
    }

    throw new ForbiddenException('Invalid role');
  }

  canManageRoom(user: AuthUser): boolean {
    return user.role === 'MENTOR' || user.role === 'CREATOR';
  }

  private getRoleClaim(claims: JwtClaims & Record<string, unknown>) {
    const role = claims.role ?? claims[CLAIM_ROLE];
    if (Array.isArray(role)) {
      return role[0];
    }

    return typeof role === 'string' ? role : undefined;
  }

  private getStringClaim(
    claims: Record<string, unknown>,
    ...names: string[]
  ): string | undefined {
    for (const name of names) {
      const value = claims[name];
      if (typeof value === 'string' && value.trim().length > 0) {
        return value.trim();
      }
    }

    return undefined;
  }

  private readDevString(value: unknown): string | undefined {
    if (Array.isArray(value)) {
      return this.readDevString(value[0]);
    }

    if (typeof value !== 'string') {
      return undefined;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
}
