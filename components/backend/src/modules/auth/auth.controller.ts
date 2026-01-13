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
  BadRequestException,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import path, { extname, join } from 'path';
import { existsSync, mkdirSync, } from 'fs';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResetPasswordDto } from './dto/resetpassword.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiConsumes, ApiBearerAuth } from '@nestjs/swagger';

const UPLOADS_FOLDER = 'uploads';


function fileFilter(req: any, file: Express.Multer.File, cb: Function) {
  if (!file.mimetype.match(/\/(jpg|jpeg|png)$/)) {
    return cb(new BadRequestException('Unsupported file type. Only jpg/jpeg/png allowed.'), false);
  }
  cb(null, true);
}


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

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);
  constructor(private authService: AuthService) {}



  @Post('login')
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @HttpCode(HttpStatus.OK)
  async loginWithPassword(
    @Body('email') email: string,
    @Body('password') password: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
   
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
  
  @Post('checkemail')
  @ApiOperation({ summary: 'Check if email exists' })
  @ApiBody({ schema: { type: 'object', properties: { email: { type: 'string', example: 'test@example.com' } } } })
  async checkEmail(@Body('email') email:string){
    return await this.authService.checkEmail(email)
  }

  @Post('introspect')
  @ApiOperation({ summary: 'Introspect token' })
  @ApiBody({ schema: { type: 'object', properties: { token: { type: 'string' } } } })
  @HttpCode(HttpStatus.OK)
  async introspect(@Body('token') token: string) {
    const resp = await this.authService.introspectAccessToken(token);
    return resp;
  }


  @Post('profileFromIdToken')
  @ApiOperation({ summary: 'Get profile from ID token' })
  @ApiBody({ schema: { type: 'object', properties: { id_token: { type: 'string' } } } })
  async profileFromIdToken(@Body('id_token') id_token: string) {
    const profile = await this.authService.getUserProfileFromIdToken(id_token);
    return profile;
  }


  @UseInterceptors(FileInterceptor('profilePhoto', {
    storage: diskStorage({
      destination: (_req, _file, cb) => cb(null, UPLOADS_FOLDER),
      filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
      },
    }),
    limits: { fileSize: 5 * 1024 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
      const ext = path.extname(file.originalname).toLowerCase();
      if (!allowed.includes(ext)) {
        return cb(new BadRequestException('Only images are allowed (.jpg .jpeg .png .webp)'), false);
      }
      cb(null, true);
    },
  }))
  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string' },
        password: { type: 'string' },
        firstName: { type: 'string' },
        lastName: { type: 'string' },
        role: { type: 'string', enum: ['doctor', 'patient'] },
        gender: { type: 'string' },
        city: { type: 'number' },
        phoneNumber: { type: 'string' },
        birthYear: { type: 'number' },
        profilePhoto: {
          type: 'string',
          format: 'binary',
        },
        university: { type: 'string' },
        specialty: { type: 'string' },
      },
      required: ['email', 'password', 'firstName', 'lastName', 'role', 'phoneNumber', 'birthYear'],
    },
  })
  async register(@Body() body: RegisterDto,@UploadedFile() file?: Express.Multer.File) {
   let storedPath = file ? `/uploads/${file.filename}` : undefined;
if (!storedPath) storedPath = '/uploads/avatar.png';
  console.log('file:', file?.originalname, file?.mimetype, file?.size);
console.log('body keys:', Object.keys(body));
    const user = await this.authService.registerUserAndProfile(body,storedPath);
    return  user ;
  }

@Post('send-email-otp')
@ApiOperation({ summary: 'Send email OTP' })
@ApiBody({ schema: { type: 'object', properties: { email: { type: 'string' } } } })
async sendEmailOtp(@Body() dto: { email: string }) {
  return this.authService.sendEmailOtp(dto.email);
}

@Post('verify-email-otp')
@ApiOperation({ summary: 'Verify email OTP' })
@ApiBody({ schema: { type: 'object', properties: { email: { type: 'string' }, code: { type: 'string' } } } })
async verifyEmailOtp(@Body() dto: { email: string; code: string }) {
  return this.authService.verifyEmailOtp(dto.email, dto.code);
}

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh tokens' })
  @ApiBody({ schema: { type: 'object', properties: { refreshToken: { type: 'string' } } } })
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: Request, @Res() res: Response) {
    const refreshToken = (req as any).body?.refreshToken || (req as any).cookies?.refresh_token;

    if (!refreshToken) {
      return res.status(401).json({ error: 'No refresh token' });
    }

    try {
      const tokens = await this.authService.refreshTokens(refreshToken);
      if (tokens.refresh_token) {
        res.cookie('refresh_token', tokens.refresh_token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          path: '/',
          maxAge: 30 * 24 * 60 * 60 * 1000, 
        });
      }
      return res.json({ access_token: tokens.access_token, refresh_token: tokens.refresh_token, id_token: tokens.id_token });
    } catch (err: any) {
      this.logger.error('Refresh failed', err?.message || err);
      return res.status(401).json({ error: err?.message || 'Could not refresh tokens' });
    }
  }

  @Post('logout')
  @ApiOperation({ summary: 'Logout' })
  @ApiBody({ schema: { type: 'object', properties: { userId: { type: 'string' } } } })
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
      }
    }

    res.clearCookie('refresh_token', { path: '/' });
    return res.json({ ok: true });
  }
}
