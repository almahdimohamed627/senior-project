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
}
