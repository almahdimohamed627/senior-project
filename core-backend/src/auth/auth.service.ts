// src/auth/auth.service.ts
import {
  Injectable,
  Logger,
  ConflictException,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FusionAuthClientWrapper } from './fusion-auth.client';
import { RegisterDto } from './dto/register.dto';
// Drizzle imports
import { db } from '../db/client';
  import { schema } from '../db/schema/schema';
import * as bcrypt from 'bcrypt';
import { eq, isNull, not, and } from 'drizzle-orm';
import axios from 'axios';
import { Response } from 'express';

@Injectable()
export class AuthService {
  private fusionClient: FusionAuthClientWrapper;
  private baseUrl: string;
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;
  private apiKey?: string;
  private logger = new Logger(AuthService.name);

  constructor(private config: ConfigService) {
    this.baseUrl = this.config.get<string>('FUSIONAUTH_BASE_URL') || '';
    this.clientId = this.config.get<string>('FUSIONAUTH_CLIENT_ID') || '';
    this.clientSecret =
      this.config.get<string>('FUSIONAUTH_CLIENT_SECRET') || '';
    this.redirectUri =
      this.config.get<string>('FUSIONAUTH_REDIRECT_URI') || '';
    this.apiKey = this.config.get<string>('FUSIONAUTH_API_KEY');
    this.fusionClient = new FusionAuthClientWrapper(this.baseUrl, this.apiKey);
   
  }

  getAuthorizationUrl(state = 'state123') {
    const url = new URL(`${this.baseUrl}/oauth2/authorize`);
    url.searchParams.append('response_type', 'code');
    url.searchParams.append('client_id', this.clientId);
    url.searchParams.append('redirect_uri', this.redirectUri);
    url.searchParams.append('scope', 'openid offline_access');
    url.searchParams.append('state', state);
    return url.toString();
  }
  // src/auth/auth.service.ts (أضف هذه الدالة داخل الكلاس)
  async loginWithCredentials(
    email: string,
    password: string,
    res: Response, // نستقبل res ونستخدمه لكتابة الكوكي كما فعلت
    options?: { userAgent?: string; ip?: string | undefined },
  ) {
    // 1) تبليغ FusionAuth لينتج التوكنات
    const tokens: any = await this.fusionClient.exchangePassword(
      email,
      password,
      this.clientId,
      this.clientSecret,
    );

    if (!tokens || !tokens.access_token) {
      throw new UnauthorizedException('Invalid credentials or no access token returned');
    }

    // 2) استخراج userId من id_token أو access_token
    const payload = await this.getUserProfileFromIdToken(tokens.id_token || tokens.access_token);
    const userId = payload?.sub;
    if (!userId) {
      this.logger.warn('No subject (sub) found in id_token; userId missing');
    }

    // 3) إذا في refresh_token — خزّنه كهاش في جدول user_sessions
    if (tokens.refresh_token && userId) {
      try {
        await this.createSessionForUser({
          userId,
          refreshToken: tokens.refresh_token,
          userAgent: options?.userAgent || "",
          ip: options?.ip ?? undefined, // pass undefined (not null) to match signature
          expiresInSeconds: tokens.expires_in ?? null,
        });

        // set httpOnly secure cookie
        res.cookie('refresh_token', tokens.refresh_token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          path: '/',
          maxAge: tokens.expires_in ? tokens.expires_in * 1000 : 30 * 24 * 60 * 60 * 1000,
        });
      } catch (e) {
        this.logger.error('Failed to create session for user after password login', e?.message || e);
      }
    }

    return {
      access_token: tokens.access_token,
      id_token: tokens.id_token,
      expires_in: tokens.expires_in,
    };
  }
  async handleCallback(code: string) {
    const tokens = await this.fusionClient.exchangeCodeForToken(
      code,
      this.redirectUri,
      this.clientId,
      this.clientSecret,
    );
    return tokens;
  }

  async introspectAccessToken(token: string) {
    const data = await this.fusionClient.introspectToken(token);
    return data;
  }

  // Improved: handle base64url payload safely (padding + replacements)
  async getUserProfileFromIdToken(idToken: string) {
    if (!idToken) return null;
    const parts = idToken.split('.');
    if (parts.length !== 3) return null;
    const payloadB64 = parts[1];

    // Convert base64url -> base64
    let b64 = payloadB64.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4 !== 0) {
      b64 += '=';
    }
    try {
      const payloadJson = Buffer.from(b64, 'base64').toString('utf8');
      return JSON.parse(payloadJson);
    } catch (e) {
      this.logger.error('Failed to parse id_token payload', e?.message || e);
      return null;
    }
  }

  async getUserById(userId: string) {
    return this.fusionClient.getUser(userId);
  }

  // ------------------------------
  // registerUserAndProfile
  // ------------------------------
   async registerUserAndProfile(dto: RegisterDto): Promise<string> {
  let fusionUserId: string | undefined;
  let createdUserResp: any;

  // Helper validators (حسب تعريف الـ schema اللي عطيتني)
  const validateDoctorPayload = (p: any) => {
    const errs: string[] = [];
    if (!p.fusionAuthId) errs.push('fusionAuthId is missing');
    if (!p.gender) errs.push('gender is missing');
    if (typeof p.gender === 'string' && p.gender.length > 20) errs.push('gender length > 20');
    if (!p.university) errs.push('university is missing');
    if (typeof p.university === 'string' && p.university.length > 255) errs.push('university length > 255');
    if (!p.specialty) errs.push('specialty is missing');
    if (typeof p.specialty === 'string' && p.specialty.length > 255) errs.push('specialty length > 255');
    if (p.profilePhoto !== null && p.profilePhoto !== undefined && typeof p.profilePhoto !== 'string') errs.push('profilePhoto must be string or null');
    if (!p.city) errs.push('city is missing');
    if (typeof p.city === 'string' && p.city.length > 100) errs.push('city length > 100');
    if (p.birthYear === undefined || p.birthYear === null || !Number.isInteger(p.birthYear)) errs.push('birthYear must be an integer');
    if (!p.phoneNumber) errs.push('phoneNumber is missing');
    if (typeof p.phoneNumber === 'string' && p.phoneNumber.length > 20) errs.push('phoneNumber length > 20');
    return errs;
  };

  const validatePatientPayload = (p: any) => {
    const errs: string[] = [];
    if (!p.fusionAuthId) errs.push('fusionAuthId is missing');
    if (p.birthYear === undefined || p.birthYear === null || !Number.isInteger(p.birthYear)) errs.push('birthYear must be an integer');
    if (!p.gender) errs.push('gender is missing');
    if (typeof p.gender === 'string' && p.gender.length > 20) errs.push('gender length > 20');
    if (!p.city) errs.push('city is missing');
    if (typeof p.city === 'string' && p.city.length > 100) errs.push('city length > 100');
    if (!p.phoneNumber) errs.push('phoneNumber is missing');
    if (typeof p.phoneNumber === 'string' && p.phoneNumber.length > 20) errs.push('phoneNumber length > 20');
    if (p.profilePhoto !== null && p.profilePhoto !== undefined && typeof p.profilePhoto !== 'string') errs.push('profilePhoto must be string or null');
    return errs;
  };

  try {
    // 1️⃣ إعداد بيانات المستخدم
    const userPayload = {
      user: {
        email: dto.email,
        password: dto.password,
        firstName: dto.firstName,
        lastName: dto.lastName,
        data: { role: dto.role },
      },
    };
    this.logger.log(`Creating FusionAuth user for: ${dto.email}`);

    // 2️⃣ إرسال الطلب إلى FusionAuth (لا نغير هذا الجزء كما طلبت)
    const url = `${this.baseUrl.replace(/\/$/, '')}/api/user`;
    createdUserResp = await axios.post(url, userPayload, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': this.apiKey,
      },
      timeout: 10000,
    });

    // 3️⃣ استخراج الـ userId
    fusionUserId =
      createdUserResp.data?.user?.id ||
      createdUserResp.data?.id;

    if (!fusionUserId) {
      this.logger.error('❌ Invalid FusionAuth response: no user id found', createdUserResp?.data || createdUserResp);
      throw new InternalServerErrorException('Invalid response from FusionAuth');
    }

    this.logger.log(`✅ FusionAuth user created: ${fusionUserId}`);
  } catch (err: any) {
    const status = err?.response?.status;
    const data = err?.response?.data;
    const msg = data?.message || err.message;
    this.logger.error('FusionAuth createUser error', { status, message: msg, data: data || {} });

    if (status === 401) {
      throw new InternalServerErrorException('Unauthorized: check FusionAuth API key.');
    }
    if (status === 409) {
      throw new ConflictException('User with this email already exists.');
    }
    if (!status) {
      throw new InternalServerErrorException(`Cannot reach FusionAuth server: ${msg}`);
    }

    throw new InternalServerErrorException('Failed to create user in FusionAuth.');
  }

  // 4️⃣ تجهيز بيانات البروفايل المحلي
  const birthYearNum = dto.birthYear ? Number(dto.birthYear) : 0;

  const newDoctor = {
    fusionAuthId: fusionUserId,
    gender: dto.gender || '',
    university: dto.university || '',
    specialty: dto.specialty || '',
    profilePhoto: dto.profilePhoto ?? null,
    city: dto.city || '',
    birthYear: Number.isFinite(birthYearNum) ? birthYearNum : 0,
    phoneNumber: dto.phoneNumber || '',
  };

  const newPatient = {
    fusionAuthId: fusionUserId,
    birthYear: Number.isFinite(birthYearNum) ? birthYearNum : 0,
    gender: dto.gender || '',
    city: dto.city || '',
    phoneNumber: dto.phoneNumber || '',
    profilePhoto: dto.profilePhoto ?? null,
  };

  // 5️⃣ إدخال البيانات في قاعدة البيانات
  try {
    // سجّل الـ payload قبل المحاولة — مهم للتشخيص
    this.logger.debug('Attempting DB insert. newDoctor:', JSON.stringify(newDoctor));
    this.logger.debug('Attempting DB insert. newPatient:', JSON.stringify(newPatient));

    if (dto.role === 'doctor') {
      await db.insert(schema.doctors).values(newDoctor);
    } else {
      await db.insert(schema.patients).values(newPatient);
    }

    this.logger.log(`✅ Local profile created for ${dto.email} (${dto.role})`);
  } catch (dbErr: any) {
    // 1) سجل كل تفاصيل الخطأ اللي ممكن تجيبها Drizzle/Postgres
    this.logger.error('DB insert error — full:', {
      message: dbErr?.message,
      code: dbErr?.code,
      detail: dbErr?.detail,
      hint: dbErr?.hint,
      constraint: dbErr?.constraint,
      stack: dbErr?.stack,
    });

    // 2) شغل فحوصات محلية سريعة على الpayload لتتأكد من القيم (قبل rollback)
    const validationErrors = dto.role === 'doctor'
      ? validateDoctorPayload(newDoctor)
      : validatePatientPayload(newPatient);

    if (validationErrors.length > 0) {
      this.logger.error('Local payload validation failed:', validationErrors);
      // رغم فشل الفحص، سنحاول rollback في FusionAuth لأنك تفضل ذلك،
      // لكن نُعطي رسالة خطأ أوضح للـ client تتضمن فحوصاتنا.
    } else {
      this.logger.log('Local payload validation passed (no obvious client-side issues).');
    }

    // 3) محاولة حذف المستخدم من FusionAuth كـ rollback (لا نغير منطق الفيوجن)
    // try {
    //   if (fusionUserId) {
    //     const delUrl = `${this.baseUrl}/api/user/${fusionUserId}`;
    //     await axios.delete(delUrl, {
    //       headers: {
    //         'Authorization': this.apiKey,
    //       },
    //     });
    //     this.logger.warn(`Rolled back FusionAuth user ${fusionUserId}`);
    //   }
    // } catch (delErr: any) {
    //   // سجّل تفاصيل فشل الـ rollback لأن إلّا بيخلي المستخدم في FusionAuth بدون سجل محلي
    //   this.logger.error('Failed to rollback FusionAuth user', {
    //     message: delErr?.message || delErr,
    //     status: delErr?.response?.status,
    //     data: delErr?.response?.data,
    //   });
    // }

    // 4) ارجع رسالة خطأ أوضح للعميل (بدون تسريب معلومات حساسة)
    const clientMsg = validationErrors.length > 0
      ? `Failed to create local profile; validation errors: ${validationErrors.join('; ')}`
      : 'Failed to create local profile; database insert failed (see server logs).';

    throw new InternalServerErrorException(clientMsg);
  }

  return fusionUserId;
}

async login(email:string,password:string){


}


  // ------------------------------
  // session / refresh logic
  // ------------------------------
  private async hashToken(token: string) {
    const saltRounds = 10;
    return await bcrypt.hash(token, saltRounds);
  }

   async createSessionForUser(params: {
    userId: string;
    refreshToken: string;
    userAgent?: string;
    ip?: string | null;
    expiresInSeconds?: number | null;
  }) {
    const { userId, refreshToken, userAgent, ip, expiresInSeconds } = params;
    const hashed = await this.hashToken(refreshToken);

    const expiresAt = typeof expiresInSeconds === 'number' && expiresInSeconds > 0
      ? new Date(Date.now() + expiresInSeconds * 1000)
      : null;

    const inserted = await db.insert(schema.userSessions).values({
      userId,
      refreshTokenHash: hashed,
      userAgent: userAgent || null,
      ip: ip || null,
      expiresAt: expiresAt || null,
    }).returning();

    return Array.isArray(inserted) ? inserted[0] : inserted;
  }

  // refresh tokens
  async refreshTokens(refreshToken: string) {
    // 1) find candidate sessions that are not revoked and not expired
    const now = new Date();
    const candidates = await db.select().from(schema.userSessions)
      .where(
        and(
          eq(schema.userSessions.revoked, false),
          not(isNull(schema.userSessions.refreshTokenHash))
          // you can also add expiresAt check if desired
        )
      )
      .limit(200); // limit to reasonable number

    // 2) find matching session by comparing bcrypt
    let matchedSession: any = null;
    for (const s of candidates) {
      const ok = await bcrypt.compare(refreshToken, s.refreshTokenHash);
      if (ok) {
        matchedSession = s;
        break;
      }
    }

    if (!matchedSession) {
      // token not recognized -> security: reject
      throw new UnauthorizedException('Refresh token not recognized');
    }

    // 3) call FusionAuth to exchange refresh token
    const tokens = await this.fusionClient.exchangeRefreshToken(refreshToken, this.clientId, this.clientSecret);

    // 4) if FusionAuth returned a rotated refresh token, update the matched session
    if (tokens.refresh_token) {
      const newHashed = await this.hashToken(tokens.refresh_token);
      await db.update(schema.userSessions).set({
        refreshTokenHash: newHashed,
        lastUsedAt: new Date(),
        expiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null,
      }).where(eq(schema.userSessions.id, matchedSession.id));
    } else {
      // at least update lastUsedAt
      await db.update(schema.userSessions).set({
        lastUsedAt: new Date(),
      }).where(eq(schema.userSessions.id, matchedSession.id));
    }

    return tokens;
  }

  // revoke refresh token: call FusionAuth revoke endpoint + delete session row
  async revokeRefreshToken(refreshToken: string, userId?: string) {
    try {
      await this.fusionClient.revokeToken(refreshToken, this.clientId, this.clientSecret);
    } catch (e) {
      this.logger.error('Failed to revoke token at FusionAuth', e?.message || e);
    }

    if (userId) {
      // find rows for user and compare bcrypt
      const rows = await db.select().from(schema.userSessions).where(eq(schema.userSessions.userId, userId));
      for (const r of rows) {
        const match = await bcrypt.compare(refreshToken, r.refreshTokenHash);
        if (match) {
          await db.delete(schema.userSessions).where(eq(schema.userSessions.id, r.id));
        }
      }
    }
  }
}
