// src/data-collector/basic-auth.guard.ts
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class BasicAuthGuard implements CanActivate {
  constructor(private config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const auth = req.headers['authorization'];
    if (!auth || !auth.startsWith('Basic ')) {
      throw new UnauthorizedException('Missing Basic auth');
    }

    const b64 = auth.split(' ')[1] || '';
    let decoded = '';
    try {
      decoded = Buffer.from(b64, 'base64').toString('utf8');
    } catch (e) {
      throw new UnauthorizedException('Invalid Basic auth');
    }
    const [user, pass] = decoded.split(':');

    const expectedUser = this.config.get<string>('DATA_COLLECTOR_USER') || 'collector';
    const expectedPass = this.config.get<string>('DATA_COLLECTOR_PASS') || 'collect123';

    if (user !== expectedUser || pass !== expectedPass) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // attach uploader info for later use
    req.uploader = { username: user };
    return true;
  }
}
