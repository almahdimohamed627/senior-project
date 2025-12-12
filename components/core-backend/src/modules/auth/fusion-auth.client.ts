// src/auth/fusion-auth.client.ts
import axios from 'axios';
import {

  Logger

} from '@nestjs/common';
export class FusionAuthClientWrapper {
  constructor(
    private baseUrl: string,
    private apiKey?: string,
    private clientId?: string,
    private clientSecret?: string,
   private logger = new Logger(FusionAuthClientWrapper.name)
  ) {}

  // تبادل كلمة المرور للحصول على التوكنات
  async exchangePassword(email: string, password: string, clientId: string, clientSecret: string) {
    const params = new URLSearchParams();
    params.append('grant_type', 'password');
params.append('username', email);
params.append('password', password);
params.append('client_id', clientId);
params.append('client_secret', clientSecret);
// اطلب offline_access للحصول على refresh token، وopenid إذا تريد id_token
params.append('scope', 'offline_access openid');

    const resp = await axios.post(`${this.baseUrl}/oauth2/token`, params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    return resp.data;
  }

  // تبادل refresh token للحصول على توكن جديد
  async exchangeRefreshToken(refreshToken: string, clientId: string, clientSecret: string) {
    const params = new URLSearchParams();
    params.append('grant_type', 'refresh_token');
    params.append('refresh_token', refreshToken);
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);
    params.append('scope', 'openid offline_access');

   const resp = await axios.post(`${this.baseUrl}/oauth2/token`, params, {
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
});
this.logger.debug('FusionAuth refresh response', resp.data);
return resp.data;
  }

  // التحقق من صلاحية التوكن
  async introspectToken(token: string) {
    if (!this.clientId) throw new Error('clientId not set in FusionAuthClientWrapper');

    const params = new URLSearchParams();
    params.append('token', token);
    params.append('client_id', this.clientId);
    if (this.clientSecret) params.append('client_secret', this.clientSecret);

    const resp = await axios.post(`${this.baseUrl}/oauth2/introspect`, params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    return resp.data;
  }
    async updateUser(userId: string, payload: {
    email?: string;
    password?: string;
    firstName?: string;
    lastName?: string;
  }) {
    const url = `${this.baseUrl}/api/user/${userId}`;
    const body = {
      user: {
        email: payload.email,
        password: payload.password, // FusionAuth يقبلها نصياً وسيقوم بالتخزين الآمن
        firstName: payload.firstName,
        lastName: payload.lastName,
      },
    };
    const resp = await axios.patch(url, body, {
      headers: {
        Authorization: this.apiKey || '',
        'Content-Type': 'application/json',
      },
    });
    return resp.data?.user;
  }
  // جلب بيانات المستخدم من FusionAuth
  async getUser(userId: string) {
    const url = `${this.baseUrl}/api/user/${userId}`;
    const resp = await axios.get(url, {
      headers: {
        'Authorization': this.apiKey || '',
      },
    });
    return resp.data.user;
  }

  // إلغاء صلاحية refresh token
  async revokeToken(refreshToken: string, clientId: string, clientSecret: string) {
    const url = `${this.baseUrl}/oauth2/revoke`;
    const params = new URLSearchParams();
    params.append('token', refreshToken);
    params.append('client_id', clientId);
    if (clientSecret) params.append('client_secret', clientSecret);

    await axios.post(url, params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
  }

  // تبادل authorization code للحصول على التوكنات
  async exchangeCodeForToken(code: string, redirectUri: string, clientId: string, clientSecret: string) {
    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('code', code);
    params.append('redirect_uri', redirectUri);
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);

    const resp = await axios.post(`${this.baseUrl}/oauth2/token`, params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    return resp.data;
  }
}
