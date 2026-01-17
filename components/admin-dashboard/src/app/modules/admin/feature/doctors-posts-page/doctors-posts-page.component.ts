import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { AdminService } from '@modules/admin/data/admin.service';
import { HotToastService } from '@ngxpert/hot-toast';
import {
  TableAction,
  TableColumn,
  TableFilterConfig,
  TableSearchConfig,
  TableComponent
} from '@shared/components/ui/table/table.component';
import { environment } from 'environments/environment.development';
import { TableModule } from 'primeng/table';
import { catchError, finalize, map, of } from 'rxjs';

@Component({
  selector: 'app-doctors-posts-page',
  imports: [CommonModule, TableModule, TableComponent],
  templateUrl: './doctors-posts-page.component.html',
  styleUrl: './doctors-posts-page.component.scss'
})
export class DoctorsPostsPageComponent {
  private adminService = inject(AdminService);
  private toast = inject(HotToastService);

  loading = signal<boolean>(true);
  baseUrl = environment.baseUrl;
  posts = signal<any[]>([]);

  constructor() {
    this.loadPosts(true);
  }

  loadPosts(showLoader: boolean = true) {
    if (showLoader) this.loading.set(true);

    this.adminService.loadPosts().pipe(
      map((res: any) => {
        if (res && Array.isArray(res)) {
          return res.map((post: any) => ({ ...post }));
        }
        return [];
      }),
      catchError(() => {
        this.toast.error('Failed to load posts');
        return of([]);
      }),
      finalize(() => {
        if (showLoader) this.loading.set(false);
      })
    ).subscribe({
      next: (posts: any[]) => {
        this.posts.set(posts);
      }
    });
  }

  columns: TableColumn[] = [
    { field: 'title', header: 'Title', type: 'text' },
    { field: 'content', header: 'Content', type: 'text' },
    { field: 'photos', header: 'Photos', type: 'image' },
    // { field: 'numberOfLikes', header: 'Number of Likes', type: 'text' },
    { field: 'keyStatus', header: 'Status', type: 'chip' },
  ];

  actions = (post: any): TableAction[] => {
    const status = String(post?.keyStatus || '').toLowerCase();

    if (status === 'published' || status === 'reject') return [];

    if (status === 'in_review') {
      return [
        {
          type: 'button',
          label: 'Accept',
          icon: 'pi pi-check',
          severity: 'success',
          loading: (row) => !!row.__updatingStatus,
          disabled: (row) => !!row.__updatingStatus,
          action: (row) => this.updatePostStatus(row, true),
        },
        {
          type: 'button',
          label: 'Reject',
          icon: 'pi pi-times',
          severity: 'danger',
          loading: (row) => !!row.__updatingStatus,
          disabled: (row) => !!row.__updatingStatus,
          action: (row) => this.updatePostStatus(row, false),
        },
      ];
    }

    return [];
  };

  private updatePostStatus(row: any, accept: boolean) {
    row.__updatingStatus = true;

    this.adminService.acceptOrRejectPost(row.id, accept).pipe(
      finalize(() => (row.__updatingStatus = false))
    ).subscribe({
      next: () => {
        this.toast.success(`Post ${accept ? 'accepted' : 'rejected'} successfully ✅`);

        this.loadPosts(false);
      },
      error: () => {
        this.toast.error('Failed to update post status ❌');
      },
    });
  }

  searchConfig: TableSearchConfig = {
    placeholder: 'Search posts by title, content, status',
    fields: ['title', 'content', 'keyStatus'], 
  };

  filtersConfig: TableFilterConfig[] = [
    {
      field: 'keyStatus',
      label: 'Status',
      placeholder: 'Filter by status',
      type: 'select',
    },
  ];
}
