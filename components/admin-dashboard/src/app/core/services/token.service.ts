import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class TokenService {
  currentUser = signal<any|null>(null);

  token = signal<string|null>(null)

  constructor() {
    this.currentUser.set(JSON.parse(localStorage.getItem('user')??'null'));
    this.token.set(localStorage.getItem('token')??null);
  }

  saveToken(token:string){
    localStorage.setItem('token',token);
    this.token.set(token);
  }

  saveCurrentUser(user:any){
    localStorage.setItem('user',JSON.stringify(user));
    this.currentUser.set(user);
  }  
}
