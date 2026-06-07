import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import type { AuthUser } from './auth.types';

export type AuthenticatedRequest = Request & { user: AuthUser };

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.authService.extractBearerToken(
      request.headers.authorization,
    );

    if (!token) {
      request.user = this.authService.createDevUser({
        userId: request.headers['x-dev-user-id'],
        role: request.headers['x-dev-role'],
        email: request.headers['x-dev-email'],
        displayName: request.headers['x-dev-display-name'],
      });
      return true;
    }

    request.user = this.authService.verifyAccessToken(token);
    return true;
  }
}
