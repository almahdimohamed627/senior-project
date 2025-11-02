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
import { db } from './client';
  import { schema } from '../db/schema/schema';
import * as bcrypt from 'bcrypt';
import { eq, isNull, not, and } from 'drizzle-orm';
import axios from 'axios';
import { Response } from 'express';
import { unlink } from 'fs/promises';
import { join } from 'path';
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
    // 1) تبليغ FusionAuth لينتج التوكنات
    const tokens: any = await this.fusionClient.exchangePassword(
      email,
      password,
      this.clientId,
      this.clientSecret,
    );
  console.log(tokens.refresh_token)
    if (!tokens || !tokens.access_token) {
      throw new UnauthorizedException('Invalid credentials or no access token returned');
    }

    // 2) استخراج userId من id_token أو access_token
 
    const payload = await this.getUserProfileFromIdToken(tokens.id_token || tokens.access_token);
      
    const userId = payload?.sub;
    if (!userId) {
      this.logger.warn('No subject (sub) found in id_token; userId missing');
    }
    console.log(tokens.refresh_token)

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
        // res.cookie('refresh_token', tokens.refresh_token, {
        //   httpOnly: true,
        //   secure: process.env.NODE_ENV === 'production',
        //   sameSite: 'strict',
        //   path: '/',
        //   maxAge: tokens.expires_in ? tokens.expires_in * 1000 : 30 * 24 * 60 * 60 * 1000,
        // });
      } catch (e) {
        this.logger.error('Failed to create session for user after password login', e?.message || e);
      }
    }

    return {
      access_token: tokens.access_token,
      id_token: tokens.id_token,
      refreshToken:tokens.refresh_token,
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
  const DEFAULT_AVATAR = 'uploads/avatar.png';
  // Helper: remove uploaded file if it points inside uploads folder
  const removeUploadedFileIfSafe = async (maybePath?: string | null) => {
    if (!maybePath) return;
    try {
      // normalize and ensure we only delete paths inside the project uploads folder
      const normalized = maybePath.replace(/\\/g, '/'); // normalize Windows slashes
      // accept values like 'uploads/filename.jpg' or '/uploads/filename.jpg'
      const trimmed = normalized.startsWith('/') ? normalized.slice(1) : normalized;
      if (!trimmed.startsWith('uploads/')) {
        // safety: do not unlink arbitrary paths
        this.logger.warn(`Skip deleting uploaded file because path is outside uploads/: ${maybePath}`);
        return;
      }
      const fullPath = join(process.cwd(), trimmed);
      await unlink(fullPath).catch(() => null);
      this.logger.warn(`Deleted uploaded file during rollback: ${fullPath}`);
    } catch (e) {
      this.logger.error('Error while trying to delete uploaded file', e?.message || e);
    }
  };

  // Validators (كما عندك)
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
      // If a file was uploaded by controller (dto.profilePhoto set) - delete it
  
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
      // cleanup uploaded file
      throw new InternalServerErrorException('Failed to add user registration in FusionAuth.');
    }

    this.logger.log(`✅ Registration added: ${JSON.stringify(regResp.data.registration)}`);
  } catch (err: any) {
    const status = err?.response?.status;
    const data = err?.response?.data;
    const msg = data?.message || err.message;
    this.logger.error('FusionAuth createUser/registration error', { status, message: msg, data: data || {} });

    // If we failed before DB insert, make sure to remove uploaded file

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

  // 3️⃣ Prepare local profile data
  const birthYearNum = dto.birthYear ? Number(dto.birthYear) : 0;

const newDoctor = {
  fusionAuthId: fusionUserId,
  gender: dto.gender || '',
  university: dto.university || '',
  specialty: dto.specialty || '',
  city: dto.city || '',
  birthYear: Number.isFinite(birthYearNum) ? birthYearNum : 0,
  phoneNumber: dto.phoneNumber || '',
  profilePhoto: DEFAULT_AVATAR, // <<<<<<<<<<
};

const newPatient = {
  fusionAuthId: fusionUserId,
  birthYear: Number.isFinite(birthYearNum) ? birthYearNum : 0,
  gender: dto.gender || '',
  city: dto.city || '',
  phoneNumber: dto.phoneNumber || '',
  profilePhoto: DEFAULT_AVATAR, // <<<<<<<<<<
};

  // 4️⃣ Insert into local DB
  try {
    this.logger.debug('Attempting DB insert. newDoctor:', JSON.stringify(newDoctor));
    this.logger.debug('Attempting DB insert. newPatient:', JSON.stringify(newPatient));

    if (dto.role === 'doctor') {
      await db.insert(schema.doctors).values(newDoctor);
    } else {
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

    const validationErrors = dto.role === 'doctor'
      ? validateDoctorPayload(newDoctor)
      : validatePatientPayload(newPatient);

    if (validationErrors.length > 0) {
      this.logger.error('Local payload validation failed:', validationErrors);
    } else {
      this.logger.log('Local payload validation passed (no obvious client-side issues).');
    }

    // Try rollback: delete registration and delete user from FusionAuth
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

    // cleanup uploaded file if existed

    const clientMsg = validationErrors.length > 0
      ? `Failed to create local profile; validation errors: ${validationErrors.join('; ')}`
      : 'Failed to create local profile; database insert failed (see server logs).';

    throw new InternalServerErrorException(clientMsg);
  }

  return fusionUserId!;
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
