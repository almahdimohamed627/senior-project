import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import jwksRsa from 'jwks-rsa';
import { ConfigService } from '@nestjs/config';

export type JwtUser = {
  userId?: string; 
  sub?: string;
  email?: string;
  name?: string;
  roles?: string[];
  raw?: any;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(private readonly config: ConfigService) {
    // build jwksUri and issuer in a robust way
    const baseUrl = (config.get<string>('FUSIONAUTH_BASE_URL') || '').replace(/\/$/, '');
    const jwksUrl = config.get<string>('FUSIONAUTH_JWKS_URL') || `${baseUrl}/.well-known/jwks.json`;
    const issuer = config.get<string>('FUSIONAUTH_ISSUER') || baseUrl;
    const audience = config.get<string>('FUSIONAUTH_CLIENT_ID') || undefined;

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKeyProvider: jwksRsa.passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: jwksUrl,
      }) as any,
      audience,
      issuer,
      algorithms: ['RS256'],
      // you can enable passReqToCallback: true if you need the request in validate()
    });
  }

  // payload = decoded JWT payload
  async validate(payload: any): Promise<JwtUser> {
    try {
      const roles: string[] = extractRolesFromPayload(payload);
      const user: JwtUser = {
        sub: payload.sub,
        userId: payload.sub, // alias for convenience in your code
        email: payload.email || payload.preferred_username || undefined,
        name: payload.name || payload.firstName || `${payload.given_name || ''} ${payload.family_name || ''}`.trim(),
        roles,
        raw: payload,
      };

      // optional: log during development
      // this.logger.debug(`JWT validated for user ${user.userId} roles=${roles.join(',')}`);

      return user;
    } catch (err) {
      this.logger.error('JWT validation error', err?.message || err);
      throw new UnauthorizedException('Invalid token');
    }
  }
}

// helper to extract roles from common places in JWT
function extractRolesFromPayload(payload: any): string[] {
  if (!payload) return [];
  // 1) payload.roles (array)
  if (Array.isArray(payload.roles)) return payload.roles.map(String);
  // 2) payload.application?.roles or payload.applications
  if (payload.application && Array.isArray((payload.application as any).roles)) {
    return (payload.application as any).roles.map(String);
  }
  // 3) payload.resource_access?.<appId>?.roles (Keycloak-style)
  if (payload.resource_access && typeof payload.resource_access === 'object') {
    const apps = Object.values(payload.resource_access);
    for (const app of apps) {
      if (app && Array.isArray((app as any).roles)) return (app as any).roles.map(String);
    }
  }
  // 4) fallback to app_roles or custom claim
  if (payload['app_roles'] && Array.isArray(payload['app_roles'])) return payload['app_roles'].map(String);
  if (payload['roles_claim'] && Array.isArray(payload['roles_claim'])) return payload['roles_claim'].map(String);

  return [];
}
