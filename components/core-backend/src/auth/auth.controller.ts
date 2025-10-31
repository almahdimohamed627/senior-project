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
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';

const UPLOADS_FOLDER = 'uploads';

// ensure uploads folder exists (will create if missing)
if (!existsSync(UPLOADS_FOLDER)) {
  mkdirSync(UPLOADS_FOLDER, { recursive: true });
}

/**
 * Helper: filter allowed mime types (jpg/jpeg/png) — throws BadRequestException on reject.
 */
function fileFilter(req: any, file: Express.Multer.File, cb: Function) {
  if (!file.mimetype.match(/\/(jpg|jpeg|png)$/)) {
    return cb(new BadRequestException('Unsupported file type. Only jpg/jpeg/png allowed.'), false);
  }
  cb(null, true);
}

/**
 * Helper: create deterministic filename with timestamp to avoid collisions.
 * You can replace with uuid if preferred.
 */
function editFileName(req: any, file: Express.Multer.File, callback: Function) {
  const name = file.originalname
    .replace(/\.[^/.]+$/, '') // remove extension
    .replace(/\s+/g, '-')
    .toLowerCase();
  const fileExtName = extname(file.originalname).toLowerCase();
  const timestamp = Date.now();
  const finalName = `${name}-${timestamp}${fileExtName}`;
  callback(null, finalName);
}

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
  // Registration endpoint (supports profilePhoto upload)
  // ------------------------
  @Post('register')
  @UseInterceptors(
    FileInterceptor('profilePhoto', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          cb(null, UPLOADS_FOLDER);
        },
        filename: editFileName,
      }),
      fileFilter,
      limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
    }),
  )
  async register(@Body() body: RegisterDto, @UploadedFile() file?: Express.Multer.File) {
    // If client uploaded a file, attach its relative path to the DTO
    // (we store `uploads/<filename>` so it can be served from /uploads/<filename>)
    try {
      if (file) {
        body.profilePhoto = `${UPLOADS_FOLDER}/${file.filename}`;
      } else {
        // ensure explicit null when not provided (so service validation uses null)
        body.profilePhoto = body.profilePhoto ?? null;
      }

      const fusionId = await this.authService.registerUserAndProfile(body);
      return { fusionId };
    } catch (err) {
      // On error, if file was uploaded attempt to remove it to avoid orphan files
      if (file) {
        const filePath = join(process.cwd(), `${UPLOADS_FOLDER}/${file.filename}`);
        // Lazy unlink: don't block on it, but try to remove
        import('fs/promises')
          .then(({ unlink }) => unlink(filePath).catch(() => null))
          .catch(() => null);
        this.logger.warn(`Removed uploaded file after register error: ${file?.filename}`);
      }
      // rethrow so Nest handles as 500 (or the service may have thrown better error)
      throw err;
    }
  }

  // Refresh endpoint (reads refresh token from httpOnly cookie)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: Request, @Res() res: Response) {
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
          maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days example
        });
      }
      return res.json({ access_token: tokens.access_token, refresh_token: tokens.refresh_token, id_token: tokens.id_token });
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

    res.clearCookie('refresh_token', { path: '/' });
    return res.json({ ok: true });
  }
}
