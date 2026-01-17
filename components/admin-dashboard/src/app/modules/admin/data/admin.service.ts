import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { API_ENDPOINTS } from '@core/constants/api-endpoints';

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private http = inject(HttpClient)
  constructor() { }

  loadUsers(params: {page:any, limit:any}) {
    return this.http.get(API_ENDPOINTS.admin.users, {
      params: new HttpParams({fromObject: params})
    });
  }

  loadPosts() {
    return this.http.get(API_ENDPOINTS.admin.posts);
  }

  toggleUserStatus(userId: any, isActive: any) {
    return this.http.post(API_ENDPOINTS.admin.userChangeStatus.replace(':id', userId), { isActive });
  }

  acceptOrRejectPost(postId: any, accept: boolean) {
    return this.http.get(API_ENDPOINTS.admin.postStatus.replace(':id', postId.toString()).replace(':accept', String(accept)))
  }

  loadDiagnosis() {
    return this.http.get(API_ENDPOINTS.admin.diagnosis)
  }

  changeAccountStatus(userId: any, is_active:any) {
    return this.http.patch<any>(API_ENDPOINTS.admin.userAccountStatus.replace(':id', userId.toString()),{is_active})
  }
}
