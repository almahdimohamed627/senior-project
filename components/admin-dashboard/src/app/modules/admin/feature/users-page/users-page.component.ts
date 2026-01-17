import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { AdminService } from '@modules/admin/data/admin.service';
import { HotToastService } from '@ngxpert/hot-toast';
import {
  TableAction,
  TableColumn,
  TableComponent,
  TableFilterConfig,
  TableSearchConfig
} from '@shared/components/ui/table/table.component';
import { environment } from 'environments/environment.development';
import { catchError, finalize, map, of } from 'rxjs';

@Component({
  selector: 'app-users-page',
  imports: [CommonModule, TableComponent],
  templateUrl: './users-page.component.html',
  styleUrl: './users-page.component.scss',
})
export class UsersPageComponent {
  private adminService = inject(AdminService);
  private toast = inject(HotToastService);

  loading = signal<boolean>(true);
  baseUrl = environment.baseUrl;
  selectedUser = signal<any>(null);
  users = signal<any[]>([]);

  constructor() {
    this.loadUsers();
  }

  loadUsers() {
    this.loading.set(true);

    this.adminService.loadUsers({ page: 1, limit: 10 }).pipe(
      map((res: any) => {
        this.loading.set(false);
        if (res && Array.isArray(res)) {
          return res.map((user: any) => ({ ...user }));
        }
        return [];
      }),
      catchError((err) => {
        this.loading.set(false);
        this.toast.error('Failed to load users');
        console.error('Error loading users:', err);
        return of([]);
      }),
      finalize(() => this.loading.set(false))
    ).subscribe({
      next: (users: any) => {
        this.users.set(users);
      }
    });
  }

  columns: TableColumn[] = [
    { field: 'firstName', header: 'First Name', type: 'text' },
    { field: 'lastName', header: 'Last Name', type: 'text' },
    { field: 'gender', header: 'Gender', type: 'text' },
    { field: 'role', header: 'Role', type: 'chip' },
  ];

  private isAdmin(user: any): boolean {
    return String(user?.role || '').toLowerCase().includes('admin');
  }

  actions = (user: any): TableAction[] => {
    if (this.isAdmin(user)) return [];

    return [
      {
        type: 'toggle',
        toggleField: 'is_active',
        onToggle: (is_active: any, row: any) => {
          const msg = this.toast.loading('Wait while change status of user account')
          console.log(is_active);
          console.log(row);
          
          this.adminService.changeAccountStatus(row.fusionAuthId, is_active).subscribe({
            next: () => {
              this.toast.success(`User ${is_active ? 'activated' : 'deactivated'}`);
              row.isActive = is_active;
              msg.close()
            },
            error: () => {
              this.toast.error('Failed to update status');
              row.isActive = !is_active;
              msg.close()
            },
          });
        },
      },
    ];
  };

  searchConfig: TableSearchConfig = {
    placeholder: 'Search users by name, gender...',
    fields: ['firstName', 'lastName', 'gender'],
  };

  filtersConfig: TableFilterConfig[] = [
    {
      field: 'role',
      label: 'Role',
      placeholder: 'Filter by role',
      type: 'select',
    },
  ];
}
