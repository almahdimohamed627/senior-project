// src/auth/guards/jwt-auth.guard.ts
import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth.service';
import type { Request } from 'express';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  /**
   * Guard that:
   * - extracts access token from Authorization header (Bearer) OR cookie 'access_token'
   * - calls FusionAuth introspect endpoint via AuthService.introspectAccessToken
   * - if active -> sets req.user with useful fields (sub, email, roles, raw)
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const authHeader = req.headers['authorization'] || (req.headers['Authorization'] as any);
    let token: string | undefined;

    // 1) from header
    if (authHeader && String(authHeader).startsWith('Bearer ')) {
      token = String(authHeader).slice('Bearer '.length).trim();
    }


    // 2) fallback: cookie (if you set access token in cookie)
    if (!token) {
      token = (req as any).cookies?.access_token || (req as any).cookies?.token || undefined;
    }
    if (!token) {
      throw new UnauthorizedException('No access token provided');
    }
    // 3) call introspect on FusionAuth (AuthService wrapper)
    let introspectResp: any;
    try {
      introspectResp = await this.authService.introspectAccessToken(token);
    } catch (err: any) {
      // failed to reach FusionAuth / introspect error
      throw new UnauthorizedException('Failed to validate access token');
    }

    // 4) expected shape: at least { active: boolean } from introspect
    if (!introspectResp || introspectResp.active !== true) {
      throw new UnauthorizedException('Access token is not active');
    }

    // 5) populate req.user using available claims in introspect response:
    // FusionAuth introspect often returns sub/email/scope etc - otherwise we can try getUserById
    const user: any = {};
    user.raw = introspectResp;

    // sub may be available as 'sub' or 'user_id' depending
    user.sub = introspectResp.sub || introspectResp.user_id || introspectResp.username || undefined;
    user.email = introspectResp.email || undefined;

    // roles claim might be present; otherwise RolesGuard will fetch user by id
    if (Array.isArray(introspectResp.roles)) {
      user.roles = introspectResp.roles;
    } else if (introspectResp.resource_access) {
      // try to extract roles from resource_access (common pattern)
      const apps = Object.values(introspectResp.resource_access);
      for (const app of apps) {
        if (app && Array.isArray((app as any).roles)) {
          user.roles = (app as any).roles;
          break;
        }
      }
    }

    // attach to request
    (req as any).user = user;

    // allow
    return true;
  }
}
