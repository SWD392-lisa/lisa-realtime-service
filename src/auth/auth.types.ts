export type AuthRole = 'USER' | 'MENTOR' | 'CREATOR';

export interface AuthUser {
  userId: string;
  role: AuthRole;
  rawRole: string;
  email?: string;
  displayName?: string;
}

export interface JwtClaims {
  sub?: string;
  nameid?: string;
  nameidentifier?: string;
  email?: string;
  name?: string;
  unique_name?: string;
  role?: string | string[];
}
