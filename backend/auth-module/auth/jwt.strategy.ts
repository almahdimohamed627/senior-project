import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy as JwtStrategyBase, ExtractJwt } from 'passport-jwt';
import jwksRsa from 'jwks-rsa';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class JwtStrategy extends PassportStrategy(JwtStrategyBase, 'jwt') {
  private jwksClient: jwksRsa.JwksClient;

  constructor(private readonly config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      // secretOrKeyProvider expects us to call done(null, secret) or done(err)
      secretOrKeyProvider: (request, rawJwtToken, done) => {
        const issuer = config.get<string>('FUSIONAUTH_BASE_URL')?.replace(/\/$/, '');
        if (!issuer) {
          return done(new Error('Missing FUSIONAUTH_BASE_URL in config'), null);
        }

        const jwksUri = `${issuer}/oauth2/.well-known/jwks.json`;
        this.jwksClient = jwksRsa({
          cache: true,
          rateLimit: true,
          jwksUri,
        });

        // decode token to extract kid
        const decoded: any | null = jwt.decode(rawJwtToken, { complete: true });
        const kid = decoded?.header?.kid;
        if (!kid) {
          return done(new Error('Invalid token: missing "kid" in header'), null);
        }

        // use Promise API to fetch signing key and return public key
        this.jwksClient.getSigningKey(kid)
          .then((key) => {
            if (!key) {
              return done(new Error('Signing key not found'), null);
            }
            // Some typings may have different method names; getPublicKey() is common
            const signingKey = (key as any).getPublicKey
              ? (key as any).getPublicKey()
              : (key as any).publicKey ?? null;

            if (!signingKey) {
              return done(new Error('Public key not available on signing key'), null);
            }
            done(null, signingKey);
          })
          .catch((err) => {
            done(err, null);
          });
      },
      algorithms: ['RS256'],
    });
  }

  async validate(payload: any) {
    // يمكنك هنا استرجاع المستخدم من قاعدة البيانات أو إجراء تحقق إضافي
    if (!payload) {
      throw new UnauthorizedException();
    }
    return payload;
  }
}
