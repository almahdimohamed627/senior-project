// src/auth/guards/role.guard.ts
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from '../auth.service';
import { ROLES_KEY } from 'src/auth/decorators/role.decorator';
import { Role } from 'src/enums/role.enum';
import NodeCache from 'node-cache';

const roleCache = new NodeCache({ stdTTL: 60, checkperiod: 120 }); // cache roles per userId for 60s

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const req = context.switchToHttp().getRequest();
    const user = (req as any).user;
    if (!user) throw new UnauthorizedException('User not authenticated');

    // 1) check roles from token payload if present
    const jwtRoles: string[] = Array.isArray(user.roles) ? user.roles.map(String) : [];

    if (jwtRoles.length) {
      if (requiredRoles.some(r => jwtRoles.includes(r))) return true;
      // if roles present in token but insufficient, we can still try to fetch authoritative role from FusionAuth
    }

    // 2) authoritative fetch from FusionAuth (cached)
    const userId = user.sub || user.userId;
    if (!userId) throw new UnauthorizedException('User id not found in token');

    const cacheKey = `roles:${userId}`;
    const cached: string[] | undefined = roleCache.get(cacheKey);
    if (cached) {
      if (requiredRoles.some(r => cached.includes(r))) return true;
      throw new ForbiddenException('Insufficient role');
    }

    // ask AuthService for user details (which calls FusionAuth Admin API)
    let fusionUser: any;
    try {
      fusionUser = await this.authService.getUserById(userId);
    } catch (err: any) {
      // could not fetch user from FusionAuth
      throw new UnauthorizedException('Failed to verify role with FusionAuth');
    }

    // extract role(s): custom data.role OR registrations[].roles OR fallback
    const roles: string[] = [];
    if (fusionUser?.data && fusionUser.data.role) {
      roles.push(String(fusionUser.data.role));
    }
    // registrations->roles array may contain strings
    if (Array.isArray(fusionUser?.registrations)) {
      try {
        for (const reg of fusionUser.registrations) {
          if (Array.isArray(reg.roles)) {
            for (const r of reg.roles) roles.push(String(r));
          }
        }
      } catch (e) {
        // ignore
      }
    }

    const uniqueRoles = Array.from(new Set(roles));

    // cache for short time
    roleCache.set(cacheKey, uniqueRoles);

    if (requiredRoles.some(r => uniqueRoles.includes(r))) return true;

    // not allowed
    throw new ForbiddenException('Insufficient role');
  }
}
