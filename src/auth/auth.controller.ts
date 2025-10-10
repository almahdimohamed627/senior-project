import { Controller, Get, Req, Res, Query, Post, Body, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('login')
  login(@Res() res: Response, @Query('state') state?: string) {
    const url = this.authService.buildAuthorizeUrl(state ?? '');
    return res.redirect(url);
  }

  @Get('callback')
  async callback(
    @Req() req: Request,
    @Res() res: Response,
    @Query('code') code?: string,
    @Query('state') state?: string,
  ) {
    if (!code) {
      return res.status(400).json({ message: 'Missing code' });
    }

    const tokens = await this.authService.exchangeCodeForTokens(code);

    return res.json({
      message: 'Authentication successful',
      tokens,
      state: state ?? null,
    });
  }

  @Post('refresh')
  async refresh(@Body('refresh_token') refreshToken: string) {
    if (!refreshToken) {
      return { message: 'Missing refresh_token' };
    }
    return this.authService.refreshToken(refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Req() req: Request) {
    return { user: (req as any).user };
  }
}
