// src/auth/auth.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FusionAuthClientWrapper } from './fusion-auth.client';
import axios from 'axios';

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
    this.baseUrl = this.config.get<string>('FUSIONAUTH_BASE_URL')||"";
    this.clientId = this.config.get<string>('FUSIONAUTH_CLIENT_ID')||"";
    this.clientSecret = this.config.get<string>('FUSIONAUTH_CLIENT_SECRET')||"";
    this.redirectUri = this.config.get<string>('FUSIONAUTH_REDIRECT_URI')||"";
    this.apiKey = this.config.get<string>('FUSIONAUTH_API_KEY');
    this.fusionClient = new FusionAuthClientWrapper(this.baseUrl, this.apiKey);
  }

  // يبني رابط الـ authorization ليوجه المستخدم لفيوجن أوث
  getAuthorizationUrl(state = 'state123') {
    const url = new URL(`${this.baseUrl}/oauth2/authorize`);
    url.searchParams.append('response_type', 'code');
    url.searchParams.append('client_id', this.clientId);
    url.searchParams.append('redirect_uri', this.redirectUri);
    url.searchParams.append('scope', 'openid offline_access');
    url.searchParams.append('state', state);
    return url.toString();
  }

  // يتعامل مع الكود اللي بيرجع من FusionAuth بعد الـ OAuth redirect
  async handleCallback(code: string) {
    const tokens = await this.fusionClient.exchangeCodeForToken(
      code,
      this.redirectUri,
      this.clientId,
      this.clientSecret,
    );
    // tokens يحتوي access_token و id_token و refresh_token
    // نقدر نتحقق من id_token أو نعيده للـ frontend
    return tokens;
  }

  // اختياري: يتحقق من التوكن عبر introspection
  async introspectAccessToken(token: string) {
    const data = await this.fusionClient.introspectToken(token);
    return data; // active, scope, sub, exp ...
  }

  // مثال: جلب معلومات المستخدم من id_token (decode) أو من FusionAuth
  async getUserProfileFromIdToken(idToken: string) {
    // بسيط: decode بدون تحقق (لا تستخدمه بالـ production بدون تحقق توقيع)
    const parts = idToken.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
    return payload;
  }

  // مثال: استدعاء Admin API لجلب بيانات مستخدم عبر fusion client
  async getUserById(userId: string) {
    return this.fusionClient.getUser(userId);
  }
}
