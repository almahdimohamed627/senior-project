// src/auth/fusion-auth.client.ts
import FusionAuthClient from '@fusionauth/typescript-client';
import axios from 'axios';

export class FusionAuthClientWrapper {
  private client: FusionAuthClient;
  constructor(private baseUrl: string, private apiKey?: string) {
    this.client = new FusionAuthClient(apiKey || '', baseUrl);
  }

  // Admin API - create user (example)
  async createUser(userObj: any) {
    const resp = await this.client.createUser("", { user: userObj });
    return resp.response;
  }

  // Get user by id
  async getUser(userId: string) {
    const resp = await this.client.retrieveUser(userId);
    return resp.response?.user;
  }
  async deleteUser(userId:string){
    return await this.client.deleteUser(userId)
  }
  async exchangePassword(username: string, password: string, clientId: string, clientSecret?: string) {
  const tokenUrl = `${this.baseUrl.replace(/\/$/, '')}/oauth2/token`;
  const params = new URLSearchParams();
  params.append('grant_type', 'password');
  params.append('username', username);
  params.append('password', password);
  params.append('scope', 'openid offline_access');
  params.append('client_id', clientId);
  if (clientSecret) params.append('client_secret', clientSecret);

  const { data } = await axios.post(tokenUrl, params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  return data; // access_token, id_token, refresh_token, expires_in, ...
}

  // Token exchange (authorization code -> tokens)
  async exchangeCodeForToken(code: string, redirectUri: string, clientId: string, clientSecret: string) {
    const tokenUrl = `${this.baseUrl}/oauth2/token`;
    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('code', code);
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);
    params.append('redirect_uri', redirectUri);

    const { data } = await axios.post(tokenUrl, params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    return data; // access_token, id_token, refresh_token...
  }

  // Introspect token (optional)
  async introspectToken(token: string) {
    const introspectUrl = `${this.baseUrl}/oauth2/introspect`;
    const params = new URLSearchParams();
    params.append('token', token);

    const { data } = await axios.post(introspectUrl, params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    return data;
  }

  // Retrieve JWKS for local JWT verification
  jwksUrl() {
    return `${this.baseUrl}/.well-known/jwks.json`;
  }
   // 1) exchange refresh token -> new tokens
  async exchangeRefreshToken(refreshToken: string, clientId: string, clientSecret: string) {
    const tokenUrl = `${this.baseUrl}/oauth2/token`;
    const params = new URLSearchParams();
    params.append('grant_type', 'refresh_token');
    params.append('refresh_token', refreshToken);
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);

    const { data } = await axios.post(tokenUrl, params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    return data; // access_token, id_token, refresh_token (maybe rotated)
  }

  // 2) revoke token (access or refresh)
  async revokeToken(token: string, clientId?: string, clientSecret?: string) {
    const revokeUrl = `${this.baseUrl}/oauth2/revoke`;
    const params = new URLSearchParams();
    params.append('token', token);
    if (clientId) params.append('client_id', clientId);
    if (clientSecret) params.append('client_secret', clientSecret);

    const { data } = await axios.post(revokeUrl, params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    return data;
  }
}
