// src/auth/auth.service.ts
import {
  Injectable,
  Logger,
  ConflictException,
  InternalServerErrorException,
  UnauthorizedException,
  ForbiddenException,
  UnprocessableEntityException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FusionAuthClientWrapper } from './fusion-auth.client';
import { RegisterDto } from './dto/register.dto';
// Drizzle imports
import { db } from '../../db/client';
  import { cities, schema } from '../../db/schema/schema';
import * as bcrypt from 'bcrypt';
import { eq, isNull, not, and } from 'drizzle-orm';
import axios from 'axios';
import { Response } from 'express';
import { unlink } from 'fs/promises';
import { join } from 'path';
import { doctorProfile, users } from 'src/db/schema/profiles.schema';
import { ResetPasswordDto } from './dto/resetpassword.dto';
@Injectable()
export class AuthService {
  private fusionClient: FusionAuthClientWrapper;
  private baseUrl: string;
  private clientId: string;
  private tenantId: string;
  private clientSecret: string;
  private redirectUri: string;
  private apiKey?: string;
  private logger = new Logger(AuthService.name);
  private sessions = new Map<string, { verificationId: string; createdAt: number }>();

  constructor(private config: ConfigService) {
    this.baseUrl = this.config.get<string>('FUSIONAUTH_BASE_URL') || '';
    this.clientId = this.config.get<string>('FUSIONAUTH_CLIENT_ID') || '';
    this.tenantId = this.config.get<string>('FUSIONAUTH_TENANT_ID') || '';
    this.clientSecret =
      this.config.get<string>('FUSIONAUTH_CLIENT_SECRET') || '';
    this.redirectUri =
      this.config.get<string>('FUSIONAUTH_REDIRECT_URI') || '';
    this.apiKey = this.config.get<string>('FUSIONAUTH_API_KEY');
    this.fusionClient = new FusionAuthClientWrapper(this.baseUrl, this.apiKey ,  this.clientId,       // ⚡ جديد
      this.clientSecret);
    
   
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
  // 1) طلب التوكنات من FusionAuth
  const tokens: any = await this.fusionClient.exchangePassword(
    email,
    password,
    this.clientId,
    this.clientSecret,
  );

  this.logger.debug('exchangePassword result', { hasAccessToken: !!tokens?.access_token, hasIdToken: !!tokens?.id_token });

  if (!tokens || !tokens.access_token) {
    throw new UnauthorizedException('Invalid credentials or no access token returned');
  }

  // 2) استخراج userId من id_token أو access_token
  const payload = await this.getUserProfileFromIdToken(tokens.id_token || tokens.access_token);
  const userId = payload?.sub;
  if (!userId) {
    this.logger.warn('No subject (sub) found in id_token; userId missing');
    throw new UnauthorizedException('Unable to determine user id from token');
  }

  // 2.b) تحقق من حالة التحقق (email verified) عبر FusionAuth
  let fusionUserRaw: any = null;
  try {
    fusionUserRaw = await this.fusionClient.getUser(userId);

    // unwrap common wrapper shapes
    if (fusionUserRaw && fusionUserRaw.response && fusionUserRaw.response.user) {
      fusionUserRaw = fusionUserRaw.response.user;
    }
    if (fusionUserRaw && fusionUserRaw.user) {
      fusionUserRaw = fusionUserRaw.user;
    }
  } catch (e) {
    this.logger.error(`Failed to fetch user ${userId} from FusionAuth to check verification`, e?.message || e);
    // تحفظي: منع الدخول إذا تعذر التأكد من حالة التحقق
    throw new UnauthorizedException('Could not verify email status; try again later');
  }

  //FusionAuth may call the flag `verified` or `emailVerified` depending on shape/version
  const identityEmailVerified =
  Array.isArray(fusionUserRaw?.identities) &&
  fusionUserRaw.identities.some((i: any) => i?.type === 'email' && i?.verified === true);

const isVerified = !!(fusionUserRaw?.verified ?? fusionUserRaw?.emailVerified ?? identityEmailVerified ?? false);


  if (!isVerified) {
    // منع الدخول حتى يفعّل المستخدم إيميله
    this.logger.warn(`Login attempt for unverified user ${userId} (${email})`);
    throw new ForbiddenException('Email not verified. Please verify your email before logging in.');
  }

  // 3) إذا في refresh_token — خزّنه كهاش في جدول user_sessions
  if (tokens.refresh_token && userId) {
    try {
      await this.createSessionForUser({
        userId,
        refreshToken: tokens.refresh_token,
        userAgent: options?.userAgent || '',
        ip: options?.ip ?? undefined,
        expiresInSeconds: tokens.expires_in ?? null,
      });

      // إذا أردت تفعيل الكوكي لاحقاً، يمكنك فكّ تعليق السطور التالية
      // res.cookie('refresh_token', tokens.refresh_token, {
      //   httpOnly: true,
      //   secure: process.env.NODE_ENV === 'production',
      //   sameSite: 'strict',
      //   path: '/',
      //   maxAge: tokens.expires_in ? tokens.expires_in * 1000 : 30 * 24 * 60 * 60 * 1000,
      // });
    } catch (e) {
      this.logger.error('Failed to create session for user after password login', e?.message || e);
      // لا نمنع المصادقة النهائية لمجرد فشل حفظ الجلسة، لكن نعلم الخادم
    }
  }
  let user=await db.select().from(users).where(eq(users.fusionAuthId,userId))
  console.log(user)


  return {
    user:user[0],
    access_token: tokens.access_token,
    id_token: tokens.id_token,
    refreshToken: tokens.refresh_token,
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
   // console.log(token)
    const data = await this.fusionClient.introspectToken(token);
   // console.log(data)
    return data;
  }
 async checkEmail(email: string) {
  const row = await db.select().from(users).where(eq(users.email, email));

  if (row.length === 0) {
    // الإيميل غير موجود ⇒ 422
    throw new UnprocessableEntityException('email not found');
  }

  return { exists: true, message: 'email exists' };
}
async sendEmailOtp(emailRaw: string) {
    const email = emailRaw.trim().toLowerCase();
    const url = `${this.baseUrl.replace(/\/$/, '')}/api/user/verify-email`;

    try {
      const resp = await axios.put(url, null, {
        params: {
          applicationId: this.clientId,
          email,
          sendVerifyEmail: true, // يرسل الإيميل
        },
        headers: {
          Authorization: this.apiKey,
          ...(this.tenantId ? { 'X-FusionAuth-TenantId': this.tenantId } : {}),
        },
        timeout: 10000,
      });

      const verificationId = resp.data?.verificationId;
      if (!verificationId) {
        // إذا ما رجّع body: غالباً لأن الطلب مو authenticated بـ API key
        throw new Error('Missing verificationId in response');
      }

      // خزّنها بقاعدة البيانات عندك (بدل الـ Map)
      this.sessions.set(email, { verificationId, createdAt: Date.now() });

      return { ok: true };
    } catch (e: any) {
      const msg =
        e?.response?.data?.generalErrors?.[0]?.message ||
        e?.response?.data?.fieldErrors?.email?.[0]?.message ||
        e?.message ||
        'Failed to send verification code';
      throw new BadRequestException(msg);
    }
  }

  /**
   * العميل يرسل email + otp فقط
   * السيرفر يطلع verificationId المخزن وينادي FusionAuth verify
   */
  async verifyEmailOtp(emailRaw: string, codeRaw: string) {
    const email = emailRaw.trim().toLowerCase();
    const code = codeRaw.trim();

    const session = this.sessions.get(email);
    if (!session) {
      throw new BadRequestException('No pending verification session for this email');
    }

    const url = `${this.baseUrl.replace(/\/$/, '')}/api/user/verify-email`;

    try {
      await axios.post(
        url,
        {
          verificationId: session.verificationId,
          oneTimeCode: code,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            ...(this.tenantId ? { 'X-FusionAuth-TenantId': this.tenantId } : {}),
          },
          timeout: 10000,
        },
      );

      // نجاح: امسح الجلسة
      this.sessions.delete(email);

      return { ok: true };
    } catch (e: any) {
      const msg =
        e?.response?.data?.generalErrors?.[0]?.message ||
        e?.response?.data?.message ||
        e?.message ||
        'Invalid code';
      throw new BadRequestException(msg);
    }
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


async registerUserAndProfile(dto: RegisterDto,storedPath:string|undefined): Promise<object> {
  let fusionUserId: string | undefined;
  let createdUserResp: any;

  
  if(!storedPath){
    storedPath='uploads/avatar.png'
  }



  try {
    // 1️⃣ Create user in FusionAuth
    const createPayload = {
      user: {
        email: dto.email,
        password: dto.password,
        firstName: dto.firstName,
        lastName: dto.lastName,
      },
    };

    this.logger.log(`Creating FusionAuth user for: ${dto.email}`);
    const urlCreate = `${this.baseUrl.replace(/\/$/, '')}/api/user`;
    createdUserResp = await axios.post(urlCreate, createPayload, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': this.apiKey,
      },
      timeout: 10000,
    });

    fusionUserId = createdUserResp.data?.user?.id || createdUserResp.data?.id;
    if (!fusionUserId) {
      this.logger.error('❌ Invalid FusionAuth response: no user id found', createdUserResp?.data || createdUserResp);
      throw new InternalServerErrorException('Invalid response from FusionAuth (no user id).');
    }
    this.logger.log(`✅ FusionAuth user created: ${fusionUserId}`);

    // Determine tenantId
    const tenantIdFromResp = createdUserResp.data?.user?.tenantId;
    const tenantId = tenantIdFromResp || this.config.get<string>('FUSIONAUTH_TENANT_ID') || undefined;

    // 2️⃣ Add registration to the application (link user -> application + role)
    const registrationUrl = `${this.baseUrl.replace(/\/$/, '')}/api/user/registration/${fusionUserId}`;
    const registrationPayload = {
      registration: {
        applicationId: this.clientId,
        roles: [dto.role],
      },
    };
    const registrationHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': this.apiKey || '',
    };
    if (tenantId) {
      registrationHeaders['X-FusionAuth-TenantId'] = tenantId;
    }

    this.logger.log(`Adding registration for user ${fusionUserId} to app ${this.clientId} with roles ${JSON.stringify([dto.role])}`);
    const regResp = await axios.post(registrationUrl, registrationPayload, {
      headers: registrationHeaders,
      timeout: 10000,
    });

    // check registration response minimal
    if (!regResp?.data?.registration) {
      this.logger.error('Failed to register user to application — empty registration response', regResp?.data || regResp);
      // Rollback: delete created user
      try {
        const delUrl = `${this.baseUrl.replace(/\/$/, '')}/api/user/${fusionUserId}`;
        const delHeaders: Record<string, string> = { 'Authorization': this.apiKey || '' };
        if (tenantId) delHeaders['X-FusionAuth-TenantId'] = tenantId;
        await axios.delete(delUrl, { headers: delHeaders, timeout: 10000 });
        this.logger.warn(`Rolled back FusionAuth user ${fusionUserId} after failed registration`);
      } catch (delErr: any) {
        this.logger.error('Failed to rollback FusionAuth user after registration failure', delErr?.response?.data || delErr?.message || delErr);
      }
      throw new InternalServerErrorException('Failed to add user registration in FusionAuth.');
    }

    this.logger.log(`✅ Registration added: ${JSON.stringify(regResp.data.registration)}`);

 
  } catch (err: any) {
    const status = err?.response?.status;
    const data = err?.response?.data;
    const msg = data?.message || err.message;
    this.logger.error('FusionAuth createUser/registration error', { status, message: msg, data: data || {} });

    if (status === 401) {
      throw new InternalServerErrorException('Unauthorized: check FusionAuth API key.');
    }
    if (status === 409) {
      throw new ConflictException('User with this email already exists.');
    }
    if (!status) {
      throw new InternalServerErrorException(`Cannot reach FusionAuth server: ${msg}`);
    }

    throw new InternalServerErrorException('Failed to create user or register in FusionAuth.');
  }

  // 3️⃣ Prepare local profile data (no profilePhoto in DTO; set default avatar)
  const birthYearNum = dto.birthYear ? Number(dto.birthYear) : 0;

  const newDoctor = {
    fusionAuthId: fusionUserId,
    university: dto.university || '',
    specialty: dto.specialty || '',
  };

  const newPatient = {
    fusionAuthId: fusionUserId,

  };
  const newUser = {
    fusionAuthId: fusionUserId,
    firstName:dto.firstName,
    lastName:dto.lastName,
    email:dto.email,
    birthYear: Number.isFinite(birthYearNum) ? birthYearNum : 0,
    gender: dto.gender || '',
    role:dto.role,
    city: dto.city,
    phoneNumber: dto.phoneNumber || '',
    profilePhoto: storedPath,
  };

  // 4️⃣ Insert into local DB
  try {
    this.logger.debug('Attempting DB insert. newDoctor:', JSON.stringify(newDoctor));
    this.logger.debug('Attempting DB insert. newPatient:', JSON.stringify(newPatient));
     
    await db.insert(schema.users).values(newUser);
   
    if (dto.role === 'doctor') {
      await db.insert(schema.doctors).values(newDoctor);
    }else if(dto.role === 'patient'){
      await db.insert(schema.patients).values(newPatient);
    }

    this.logger.log(`✅ Local profile created for ${dto.email} (${dto.role})`);
  } catch (dbErr: any) {
    // Log details
    this.logger.error('DB insert error — full:', {
      message: dbErr?.message,
      code: dbErr?.code,
      detail: dbErr?.detail,
      hint: dbErr?.hint,
      constraint: dbErr?.constraint,
      stack: dbErr?.stack,
      
    });
 
    try {
      const delRegUrl = `${this.baseUrl.replace(/\/$/, '')}/api/user/${fusionUserId}/registration/${this.clientId}`;
      const delHeaders: Record<string, string> = { 'Authorization': this.apiKey || '' };
      const tenantFromCreated = createdUserResp?.data?.user?.tenantId;
      if (tenantFromCreated) delHeaders['X-FusionAuth-TenantId'] = tenantFromCreated;

      await axios.delete(delRegUrl, { headers: delHeaders, timeout: 10000 });
      this.logger.warn(`Deleted registration for user ${fusionUserId} due to local DB error.`);
    } catch (delRegErr: any) {
      this.logger.error('Failed to delete registration during rollback', delRegErr?.response?.data || delRegErr?.message || delRegErr);
    }

    try {
      const delUrl = `${this.baseUrl.replace(/\/$/, '')}/api/user/${fusionUserId}`;
      const delHeaders: Record<string, string> = { 'Authorization': this.apiKey || '' };
      const tenantFromCreated = createdUserResp?.data?.user?.tenantId;
      if (tenantFromCreated) delHeaders['X-FusionAuth-TenantId'] = tenantFromCreated;
      await axios.delete(delUrl, { headers: delHeaders, timeout: 10000 });
      this.logger.warn(`Rolled back FusionAuth user ${fusionUserId} after local DB error`);
    } catch (delErr: any) {
      this.logger.error('Failed to rollback FusionAuth user after DB insert error', delErr?.response?.data || delErr?.message || delErr);
    }

    // const clientMsg = validationErrors.length > 0
    //   ? `Failed to create local profile; validation errors: ${validationErrors.join('; ')}`
    //   : 'Failed to create local profile; database insert failed (see server logs).';

  //  throw new InternalServerErrorException(clientMsg);
  }
  
    const tokens: any = await this.fusionClient.exchangePassword(
    dto.email,
    dto.password,
    this.clientId,
    this.clientSecret,
  );

  this.logger.debug('exchangePassword result', { hasAccessToken: !!tokens?.access_token, hasIdToken: !!tokens?.id_token });

  if (!tokens || !tokens.access_token) {
    throw new UnauthorizedException('Invalid credentials or no access token returned');
  }
  const authTokens = {

};

  
  if(dto.city){
  
    let city=await db.select().from(cities).where(eq(cities.id,dto.city))
     console.log('with city')
     let profilePhoto=storedPath
     return {
      
     user:{ fusionUserId,...dto,profilePhoto,city:city[0]}
     ,
     access_token: tokens.access_token,
  refresh_token: tokens.refresh_token,
};
 }
  
  // success
  //await db.select().from(schema.cities).where(eq(schema.cities.id,dto.city?.toString()??1))
  console.log('without city')
  return {fusionUserId,...dto,storedPath,};
}


// reset password

async resetPassword(resetPassword:ResetPasswordDto){

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
  // 3) call FusionAuth to exchange refresh token
  const tokens = await this.fusionClient.exchangeRefreshToken(
    refreshToken,
    this.clientId,
    this.clientSecret,
  );

  // ✅ هنا بتحط الكود مباشرة
  const accessToken = tokens.access_token ?? tokens.accessToken;
  const idToken = tokens.id_token ?? tokens.idToken;
  const refreshTok = tokens.refresh_token ?? tokens.refreshToken ?? tokens.refresh;

  // فقط حتى تتأكد شو رجع فعلياً
  console.log('Tokens from FusionAuth:', tokens);
  console.log('Parsed Tokens:', { accessToken, idToken, refreshTok });

  // بعدين ترجّعهم بالشكل الموحّد
  return {
    access_token: accessToken,
    id_token: idToken,
    refresh_token: refreshTok,
  };
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
