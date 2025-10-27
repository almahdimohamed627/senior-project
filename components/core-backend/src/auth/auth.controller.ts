// src/auth/auth.controller.ts
import {
  Controller,
  Get,
  Query,
  Res,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Req,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import {LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);
  constructor(private authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async loginWithPassword(
    @Body('email') email: string,
    @Body('password') password: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    // لوق تشخيصي سريع
    this.logger.debug('loginWithPassword called, email:', email, 'password present?', !!password);

    if (!email || !password) {
      // لو حبينا نطبع الـ body الكامل للتشخيص:
     // this.logger.debug('Request headers:', req.headers);
      // لا تطبع كلمة السر في اللوغز في بيئة حقيقية - هنا فقط للتشخيص المحلي
      return res.status(400).json({ error: 'email and password required' });
    }

    try {
      const result = await this.authService.loginWithCredentials(email, password, res, {
        userAgent: req.get('user-agent') || '',
        ip: (req.ip as string) || (req.headers['x-forwarded-for'] as string) || undefined,
      });
      return res.json(result);
    } catch (err: any) {
      this.logger.error('Login failed', err?.message || err);
      return res.status(401).json({ error: err?.message || 'Login failed' });
    }
  }

  @Post('introspect')
  @HttpCode(HttpStatus.OK)
  async introspect(@Body('token') token: string) {
    const resp = await this.authService.introspectAccessToken(token);
    return resp;
  }

  @Post('profileFromIdToken')
  async profileFromIdToken(@Body('id_token') id_token: string) {
    const profile = await this.authService.getUserProfileFromIdToken(id_token);
    return profile;
  }

  // ------------------------
  // Registration endpoint
  // ------------------------
  @Post('register')
  async register(@Body() body: RegisterDto) {
    const fusionId = await this.authService.registerUserAndProfile(body);
    return { fusionId };
  }

  // Refresh endpoint (reads refresh token from httpOnly cookie)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: Request, @Res() res: Response) {
    // cookies exist if you use cookie-parser middleware in your Nest app
    // TypeScript's Request type may not include cookies, so use a safe cast
const refreshToken = (req as any).body?.refreshToken || (req as any).cookies?.refresh_token;
  
if (!refreshToken) {
  return res.status(401).json({ error: 'No refresh token' });
}

    try {
      const tokens = await this.authService.refreshTokens(refreshToken);
      // Set new refresh token cookie if rotation returned new one
      if (tokens.refresh_token) {
        res.cookie('refresh_token', tokens.refresh_token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          path: '/',
          maxAge: 30 * 24 * 60 * 60 * 1000, // example
        });
      }
      return res.json({ access_token: tokens.access_token,refresh_token:tokens.refresh_token ,id_token: tokens.id_token });
    } catch (err: any) {
      this.logger.error('Refresh failed', err?.message || err);
      return res.status(401).json({ error: err?.message || 'Could not refresh tokens' });
    }
  }

  // Logout: revoke refresh token + delete session row + clear cookie
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: Request, @Res() res: Response) {
    const refreshToken = (req as any).cookies?.refresh_token;
    // userId could be sent in body or obtained from authenticated request (req.user)
    // Use optional chaining to avoid TS warnings
    const userIdFromBody = (req as any).body?.userId;
    const userIdFromReqUser = (req as any).user?.sub;
    const userId = userIdFromBody || userIdFromReqUser;

    if (refreshToken) {
      try {
        await this.authService.revokeRefreshToken(refreshToken, userId);
      } catch (e) {
        this.logger.error('Failed to revoke refresh token', e?.message || e);
        // continue to clear cookie even if revoke fails
      }
    }

    // clear the cookie client-side
    res.clearCookie('refresh_token', { path: '/' });
    return res.json({ ok: true });
  }
}
