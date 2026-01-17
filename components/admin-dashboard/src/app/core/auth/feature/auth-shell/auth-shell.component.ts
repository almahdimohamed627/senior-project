import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-auth-shell',
  standalone: true,
  imports: [RouterOutlet, CommonModule],
  template: `
    <div class="auth-transition-wrapper">
      <router-outlet></router-outlet>
    </div>
  `,
  styles: [`
    .auth-transition-wrapper {
      position: relative;
      width: 100%;
      min-height: 100vh;
    }
    
    .auth-transition-wrapper > * {
      animation: fadeIn 0.5s ease-in-out;
    }
  `]
})
export class AuthShellComponent {
}
