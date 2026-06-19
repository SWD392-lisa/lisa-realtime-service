import { ConfigService } from '@nestjs/config';
import { ForbiddenException } from '@nestjs/common';
import { sign } from 'jsonwebtoken';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;

  const configService = {
    get: jest.fn((key: string) => {
      switch (key) {
        case 'JWT_SECRET_KEY':
          return 'test-secret-key-for-jwt-signing-1234567890';
        case 'JWT_ISSUER':
          return 'ProjectLucy.API';
        case 'JWT_AUDIENCE':
          return 'ProjectLucy.Client';
        case 'AUTH_MODE':
          return undefined;
        case 'REALTIME_DEV_AUTH':
          return undefined;
        default:
          return undefined;
      }
    }),
  } as unknown as ConfigService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthService(configService);
  });

  it.each([
    ['1', 'USER'],
    ['2', 'MENTOR'],
    ['3', 'CREATOR'],
    ['4', 'CREATOR'],
    ['LUCY', 'USER'],
    ['MENTOR', 'MENTOR'],
    ['SUPER', 'CREATOR'],
  ])('should normalize role %s to %s', (rawRole, expectedRole) => {
    expect(service.normalizeRole(rawRole)).toBe(expectedRole);
  });

  it('should reject unknown numeric roles', () => {
    expect(() => service.normalizeRole('99')).toThrow(ForbiddenException);
  });

  it('should verify access token with numeric role claim', () => {
    const secret = configService.get('JWT_SECRET_KEY') as string;
    const token = sign(
      {
        sub: 'user-123',
        email: 'user@example.com',
        name: 'Test User',
        role: '2',
      },
      secret,
      {
        algorithm: 'HS256',
        issuer: 'ProjectLucy.API',
        audience: 'ProjectLucy.Client',
        expiresIn: '1h',
      },
    );

    expect(service.verifyAccessToken(token)).toEqual({
      userId: 'user-123',
      role: 'MENTOR',
      rawRole: '2',
      email: 'user@example.com',
      displayName: 'Test User',
    });
  });
});
