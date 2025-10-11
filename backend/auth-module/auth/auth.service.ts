import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as querystring from 'querystring';

@Injectable()
export class AuthService {
  private fusionBaseUrl: string;
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;

  constructor(
    private readonly config: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.fusionBaseUrl = this.config.get<string>('FUSIONAUTH_BASE_URL')?.replace(/\/$/, '') ?? 'http://localhost:9011';
    this.clientId = this.config.get<string>('FUSIONAUTH_CLIENT_ID')!;
    this.clientSecret = this.config.get<string>('FUSIONAUTH_CLIENT_SECRET')!;
    this.redirectUri = this.config.get<string>('FUSIONAUTH_REDIRECT_URI')!;
  }

  /**
   * Build the authorize URL to redirect user to FusionAuth
   */
  buildAuthorizeUrl(state = ''): string {
    const params = {
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: 'openid offline_access email profile', // عدِّل scopes حسب حاجتك
      state,
    };
    return `${this.fusionBaseUrl}/oauth2/authorize?${querystring.stringify(params)}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string) {
    const url = `${this.fusionBaseUrl}/oauth2/token`;
    const body = {
      grant_type: 'authorization_code',
      code,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      redirect_uri: this.redirectUri,
    };

    try {
      const resp = await firstValueFrom(this.httpService.post(url, querystring.stringify(body), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }));
      return resp.data; // { access_token, refresh_token, id_token, expires_in, token_type, scope }
    } catch (err: any) {
      throw new HttpException({
        message: 'Failed to exchange code for tokens',
        details: err?.response?.data ?? err.message,
      }, HttpStatus.BAD_GATEWAY);
    }
  }

  /**
   * Refresh tokens using refresh_token
   */
  async refreshToken(refreshToken: string) {
    const url = `${this.fusionBaseUrl}/oauth2/token`;
    const body = {
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: this.clientId,
      client_secret: this.clientSecret,
    };

    try {
      const resp = await firstValueFrom(this.httpService.post(url, querystring.stringify(body), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }));
      return resp.data;
    } catch (err: any) {
      throw new HttpException({
        message: 'Failed to refresh token',
        details: err?.response?.data ?? err.message,
      }, HttpStatus.BAD_GATEWAY);
    }
  }

  /**
   * Get user info from FusionAuth using the access token (userinfo endpoint)
   */
  async getUserInfo(accessToken: string) {
    const url = `${this.fusionBaseUrl}/oauth2/userinfo`;
    try {
      const resp = await firstValueFrom(this.httpService.get(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      }));
      return resp.data;
    } catch (err: any) {
      throw new HttpException({
        message: 'Failed to fetch user info',
        details: err?.response?.data ?? err.message,
      }, HttpStatus.BAD_GATEWAY);
    }
  }

  /**
   * Optional: call FusionAuth Admin API to retrieve user by id (requires API Key)
   */
  async getUserByIdFromAdmin(userId: string) {
    const apiKey = this.config.get<string>('FUSIONAUTH_API_KEY');
    if (!apiKey) throw new HttpException('Missing FusionAuth API key', HttpStatus.INTERNAL_SERVER_ERROR);
    const url = `${this.fusionBaseUrl}/api/user/${userId}`;
    try {
      const resp = await firstValueFrom(this.httpService.get(url, {
        headers: { 'Authorization': apiKey },
      }));
      return resp.data;
    } catch (err: any) {
      throw new HttpException({
        message: 'Failed to fetch user (admin API)',
        details: err?.response?.data ?? err.message,
      }, HttpStatus.BAD_GATEWAY);
    }
  }
}
