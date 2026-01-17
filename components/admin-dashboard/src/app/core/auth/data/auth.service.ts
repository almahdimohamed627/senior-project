import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_ENDPOINTS } from '@core/constants/api-endpoints';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private readonly http = inject(HttpClient)

  login(credentials: { email: string; password: string }): Observable<any> {
    return this.http.post<any>(`${API_ENDPOINTS.auth.login}`, credentials);
  }
}
