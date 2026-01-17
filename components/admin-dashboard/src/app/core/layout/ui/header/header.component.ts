import { Component, computed, inject, signal } from '@angular/core';
import { TokenService } from '@core/services/token.service';
import { Router, RouterLink, RouterLinkActive } from "@angular/router";
import { MenuModule } from 'primeng/menu';
import { MenuItem } from 'primeng/api';
import { environment } from 'environments/environment.development';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-header',
  imports: [CommonModule, RouterLink, RouterLinkActive, MenuModule],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent {
  tokenService = inject(TokenService);
  private router = inject(Router);
  baseUrl = environment.baseUrl

  items = computed(() => {
    if (this.tokenService.currentUser()?.role === 'admin') {
      return [
        { icon: '/images/users.png', title: "Users", route: '/admin/users' },
        { icon: '/images/diagnosis.png', title: "Diagnosis", route: '/admin/diagnosis' },
        { icon: '/images/posts.png', title: "Posts", route: '/admin/posts' },
      ]
    }

    return []
  });

  menuItems: MenuItem[] = [
    {
      label: 'Logout',
      icon: 'pi pi-sign-out',
      command: () => {
        this.logout();
      }
    }
  ];

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    this.tokenService.token.set(null);
    this.tokenService.currentUser.set(null);
    this.router.navigate(['/auth']);
  }

  toggleMenu(event: Event, menu: any) {
    menu.toggle(event);
  }
}
