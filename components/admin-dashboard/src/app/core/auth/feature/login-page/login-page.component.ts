import { Component, inject, signal } from '@angular/core';

import { ReactiveFormsModule, FormBuilder, Validators, FormGroup } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from "@angular/router";
import { finalize, tap } from 'rxjs';
import { AuthService } from '../../data/auth.service';
import { HotToastService } from '@ngxpert/hot-toast';
import { TokenService } from '@core/services/token.service';

@Component({
  selector: 'app-login-page',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    InputTextModule,
    PasswordModule,
    ButtonModule,
    CardModule,
    RouterLink
],
  templateUrl: './login-page.component.html',
  styleUrl: './login-page.component.scss'
})
export class LoginPageComponent {
  private fb = inject(FormBuilder);
  private readonly router = inject(Router)
  private authService = inject(AuthService)
  private readonly toast = inject(HotToastService)
  private readonly tokenService = inject(TokenService)

  loading = signal<boolean>(false);

  loginForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  onSubmit() {
    if (this.loginForm.invalid) return;
    const credentials = this.loginForm.value as { email: string; password: string };
    this.loading.set(true);

    this.authService
      .login(credentials!)
      .pipe(
        tap((res:any) => {
          this.tokenService.saveToken(res.access_token)
          this.tokenService.saveCurrentUser(res.user);  
          this.toast.success(`${res.user?.firstName + ' ' + res.user?.lastName} Logged In Successfully`)
          if (res.user?.role === 'admin') {
            this.router.navigate(['/admin']);
          }
        }),
        finalize(() => this.loading.set(false))
      )
      .subscribe({
        error: (err) => {
          this.toast.error('Please Check Email or Password !')
          this.router.navigate(['/admin']);

        }
      });
  }
}
