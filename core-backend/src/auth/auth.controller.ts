// src/auth/auth.controller.ts
import { Controller, Get, Query, Res, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import {type Response } from 'express';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  // يُعيد رابط الدخول إلى FusionAuth (frontend يوجه المستخدم إلى هذا الـ endpoint)
  @Get('login')
  login(@Query('state') state: string, @Res() res: Response) {
    const url = this.authService.getAuthorizationUrl(state || 'state123');
    return res.redirect(url);
  }

  // callback endpoint: FusionAuth يعيد المستخدم مع ?code=...
  @Get('callback')
  async callback(@Query('code') code: string, @Res() res: Response) {
    if (!code) {
      return res.status(400).json({ error: 'Code not found' });
    }
    const tokens = await this.authService.handleCallback(code);
    // هنا عندك خيارات:
    // 1) تعيد الـ tokens للـ SPA (مع الحذر)
    // 2) تحفظ جلسة server-side وتعيد cookie آمن httpOnly
    // مؤقتاً نعيد الـ tokens كـ JSON
    return res.json(tokens);
  }

  // endpoint لاختبار introspect
  @Post('introspect')
  @HttpCode(HttpStatus.OK)
  async introspect(@Body('token') token: string) {
    const resp = await this.authService.introspectAccessToken(token);
    return resp;
  }

  // جلب بيانات المستخدم من id_token (مثال)
  @Post('profileFromIdToken')
  async profileFromIdToken(@Body('id_token') id_token: string) {
    const profile = await this.authService.getUserProfileFromIdToken(id_token);
    return profile;
  }
}
