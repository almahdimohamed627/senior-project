import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import jwksRsa from 'jwks-rsa';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  private logger = new Logger(JwtStrategy.name);

  constructor(private config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      // use jwks-rsa to get verification key from fusionauth jwks endpoint
      secretOrKeyProvider: jwksRsa.passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: `${(config.get('FUSIONAUTH_BASE_URL') || '').replace(/\/$/, '')}/.well-known/jwks.json`,
      }) as any,
      // verify audience/issuer if you want strict validation
      audience: config.get('FUSIONAUTH_CLIENT_ID') || undefined,
      issuer: `${(config.get('FUSIONAUTH_BASE_URL') || '').replace(/\/$/, '')}`,
      algorithms: ['RS256'],
    });
  }

  // payload = decoded JWT payload
  async validate(payload: any) {
    // keep the payload as user object (you can pluck only needed fields)
    // but we might normalize roles into user.roles for convenience
    const roles: string[] = extractRolesFromPayload(payload);
    const user = {
      sub: payload.sub,
      email: payload.email,
      name: payload.name || payload.firstName || '',
      roles,
      raw: payload,
    };
    return user;
  }
}

// helper to extract roles from common places in JWT
function extractRolesFromPayload(payload: any): string[] {
  if (!payload) return [];
  // common places FusionAuth might put roles:
  // 1) payload.roles (array)
  if (Array.isArray(payload.roles)) return payload.roles;
  // 2) payload.application?.roles or payload.applications
  if (payload.application && Array.isArray(payload.application.roles)) return payload.application.roles;
  // 3) payload.resource_access?.<appId>?.roles
  if (payload.resource_access) {
    const apps = Object.values(payload.resource_access);
    for (const app of apps) {
      if (app && Array.isArray((app as any).roles)) return (app as any).roles;
    }
  }
  // fallback to any roles-like field
  if (payload['app_roles'] && Array.isArray(payload['app_roles'])) return payload['app_roles'];
  return [];
}
