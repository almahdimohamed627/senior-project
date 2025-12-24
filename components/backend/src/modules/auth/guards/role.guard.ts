// src/auth/guards/role.guard.ts
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { AuthService } from '../auth.service';
import { ROLES_KEY } from 'src/modules/auth/decorators/role.decorator';
import { Role } from 'src/enums/role.enum';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const req = context.switchToHttp().getRequest();
    const user = (req as any).user;
    if (!user) throw new UnauthorizedException('User not authenticated');

    // 1) أدوار من الـ JWT إن وجدت
    const jwtRoles: string[] = Array.isArray(user.roles) ? user.roles.map(String) : [];
    if (jwtRoles.length && requiredRoles.some((r) => jwtRoles.includes(r))) return true;

    // 2) جلب مُعتمَد (FusionAuth) مع كاش
    const userId = user.sub || user.userId;
    if (!userId) throw new UnauthorizedException('User id not found in token');

    const cacheKey = `roles:${userId}`;
    const cached = (await this.cache.get<string[]>(cacheKey)) || undefined;
    if (cached) {
      if (requiredRoles.some((r) => cached.includes(r))) return true;
      throw new ForbiddenException('Insufficient role');
    }

    // محاولة الجلب من FusionAuth
    let fusionUser: any;
    try {
      fusionUser = await this.authService.getUserById(userId);
    } catch {
      throw new UnauthorizedException('Failed to verify role with FusionAuth');
    }

    // استخراج الأدوار
    const roles: string[] = [];
    if (fusionUser?.data?.role) roles.push(String(fusionUser.data.role));

    if (Array.isArray(fusionUser?.registrations)) {
      for (const reg of fusionUser.registrations) {
        if (Array.isArray(reg.roles)) {
          for (const r of reg.roles) roles.push(String(r));
        }
      }
    }

    const uniqueRoles = Array.from(new Set(roles));

    // تخزين في الكاش مع TTL
    await this.cache.set(cacheKey, uniqueRoles,60);

    if (requiredRoles.some((r) => uniqueRoles.includes(r))) return true;

    throw new ForbiddenException('Insufficient role');
  }
}
