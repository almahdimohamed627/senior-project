import { CommonModule } from '@angular/common';
import { Component, computed, effect, ElementRef, input, output, signal, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { PaginatorModule } from 'primeng/paginator';
import { ChipModule } from 'primeng/chip';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';

import { environment } from 'environments/environment.development';

export interface TableColumn {
  field: string;
  header: string;
  type?: 'text' | 'image' | 'custom' | 'chip' | 'phone';
  imageUrl?: string;
  customTemplate?: boolean;
  headerClass?: string;
  cellClass?: string | ((row: any) => string);
}

export interface TableAction {
  label?: string;
  icon?: string;

  type?: 'button' | 'toggle';

  // toggle 
  toggleField?: string;
  onToggle?: (checked: boolean, row: any) => void;

  //button 
  action?: (row: any) => void;

  // PrimeNG button severity
  severity?: 'secondary' | 'success' | 'info' | 'warn' | 'danger' | 'help' | 'contrast';

  disabled?: boolean | ((row: any) => boolean);
  loading?: boolean | ((row: any) => boolean);
}


export interface TableSearchConfig {
  placeholder?: string;
  fields?: string[]; 
}

export interface TableFilterConfig {
  field: string; 
  label: string;
  placeholder?: string;
  type?: 'select'; 
  options?: { label: string; value: any }[]; 
}

@Component({
  selector: 'app-table',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    PaginatorModule,
    ChipModule,
    ToggleSwitchModule,
    InputTextModule,
    DropdownModule,
  ],
  templateUrl: './table.component.html',
  styleUrl: './table.component.scss',
})
export class TableComponent {
  data = input.required<any[]>();
  columns = input.required<TableColumn[]>();
  actions = input<TableAction[] | ((row: any) => TableAction[])>([]);
  rowsPerPage = input<number>(10);
  rowsPerPageOptions = input<number[]>([10, 15, 25, 50]);

  loading = input<boolean>(false);
  emptyMessage = input<string>('No data available');

  showToolbar = input<boolean>(true);
  searchConfig = input<TableSearchConfig | null>(null);
  filtersConfig = input<TableFilterConfig[]>([]);

  baseUrl = environment.baseUrl;

  onEdit = output<any>();
  onDelete = output<any>();

  first = signal(0);
  rows = signal(10);

  searchTerm = signal<string>('');
  activeFilters = signal<Record<string, any>>({}); 

  constructor() {
    effect(() => {
      const pageSize = this.rowsPerPage();
      this.rows.set(pageSize);
      this.first.set(0);
    });

    effect(() => {
      this.searchTerm();
      this.activeFilters();
      this.first.set(0);
    });
  }

  getFilterOptions(filter: TableFilterConfig): { label: string; value: any }[] {
    if (filter.options?.length) return filter.options;

    const values = new Set<any>();
    for (const row of this.data() || []) {
      const v = this.getFieldValue(row, filter.field);
      if (v !== null && v !== undefined && v !== '') values.add(v);
    }

    return Array.from(values)
      .sort((a, b) => String(a).localeCompare(String(b)))
      .map((v) => ({ label: String(v), value: v }));
  }

  getFilterValue(field: string): any {
    return this.activeFilters()?.[field] ?? null;
  }

  setFilterValue(field: string, value: any) {
    const next = { ...(this.activeFilters() || {}) };

    if (value === null || value === undefined || value === '') {
      delete next[field];
    } else {
      next[field] = value;
    }

    this.activeFilters.set(next);
  }

  clearAll() {
    this.searchTerm.set('');
    this.activeFilters.set({});
    this.first.set(0);
  }

  activeFilterCount = computed(() => Object.keys(this.activeFilters() || {}).length);

  processedData = computed(() => {
    let list = [...(this.data() || [])];

    const filters = this.activeFilters() || {};
    for (const field of Object.keys(filters)) {
      const filterValue = filters[field];
      list = list.filter((row) => {
        const value = this.getFieldValue(row, field);
        return String(value ?? '') === String(filterValue ?? '');
      });
    }

    // 2) Search
    const cfg = this.searchConfig();
    const term = (this.searchTerm() || '').trim().toLowerCase();

    if (cfg && term) {
      const fields = cfg.fields?.length
        ? cfg.fields
        : this.columns().map((c) => c.field);

      list = list.filter((row) => {
        return fields.some((f) => {
          const value = this.getFieldValue(row, f);
          return String(value ?? '').toLowerCase().includes(term);
        });
      });
    }

    return list;
  });

  paginatedData = computed(() => {
    const start = this.first();
    const end = start + this.rows();
    return this.processedData().slice(start, end);
  });

  totalRecords = computed(() => this.processedData().length);

  onPageChange(event: any) {
    this.first.set(event.first);
    this.rows.set(event.rows);
  }

  handleAction(action: TableAction, row: any) {
    const label = (action.label || '').toLowerCase();

    if (label === 'edit') {
      this.onEdit.emit(row);
      return;
    }

    if (label === 'delete') {
      this.onDelete.emit(row);
      return;
    }

    action.action?.(row);
  }

  getActions(row: any): TableAction[] {
    const a = this.actions();
    return typeof a === 'function' ? a(row) : a;
  }

  private normalizePhotos(value: any): string[] {
    if (!value) return [];

    // already array
    if (Array.isArray(value)) return value.filter(Boolean);

    // JSON array as string
    if (typeof value === 'string') {
      const trimmed = value.trim();

      // looks like JSON array string
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) return parsed.filter(Boolean);
        } catch {
          // ignore
        }
      }

      // normal single string path
      return [trimmed].filter(Boolean);
    }

    return [];
  }

  private joinUrl(base: string, path: string): string {
    const cleanBase = String(base || '').replace(/\/+$/, ''); // remove trailing /
    const cleanPath = String(path || '').replace(/^\/+/, ''); // remove starting /
    return `${cleanBase}/${cleanPath}`;
  }

  private buildImageUrl(rawPath: any): string {
    if (!rawPath) return '';

    const path = String(rawPath).trim();

    // If already full URL or data URI
    if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
      return path;
    }

    // remove leading /
    return this.joinUrl(this.baseUrl, path);
  }

  getImageUrl(row: any, column: TableColumn): string {
    const fieldPath = column.imageUrl || column.field;
    const raw = this.getFieldValue(row, fieldPath);

    const photos = this.normalizePhotos(raw);
    const first = photos?.[0];

    return this.buildImageUrl(first);
  }

  getFieldValue(row: any, field: string): any {
    if (!row || !field) return null;

    return field.split('.').reduce((acc, key) => {
      return acc && acc[key] !== undefined ? acc[key] : null;
    }, row);
  }

  resolveCellClass(column: TableColumn, row: any): string {
    const base = '!py-4 !px-6 !border-b !border-slate-100';

    if (!column.cellClass) return base;

    if (typeof column.cellClass === 'function') {
      return `${base} ${column.cellClass(row)}`;
    }

    return `${base} ${column.cellClass}`;
  }

  resolveChipStyle(value: any): string {
    const v = String(value || '').toLowerCase();

    // ✅ post statuses
    if (v.includes('published')) return '!bg-emerald-50 !text-emerald-700 !border !border-emerald-200';
    if (v.includes('in_review')) return '!bg-amber-50 !text-amber-700 !border !border-amber-200';
    if (v.includes('reject')) return '!bg-rose-50 !text-rose-700 !border !border-rose-200';

    // ✅ roles (existing)
    if (v.includes('admin')) return '!bg-indigo-50 !text-indigo-700 !border !border-indigo-200';
    if (v.includes('doctor')) return '!bg-emerald-50 !text-emerald-700 !border !border-emerald-200';
    if (v.includes('patient')) return '!bg-sky-50 !text-sky-700 !border !border-sky-200';


    // Speciality
    if (v.includes('restorative')) return '!bg-cyan-50 !text-cyan-700 !border !border-cyan-200'; // ترميمية
    if (v.includes('endodontics')) return '!bg-purple-50 !text-purple-700 !border !border-purple-200'; // لبية
    if (v.includes('periodontics')) return '!bg-lime-50 !text-lime-700 !border !border-lime-200'; // لثوية
    if (v.includes('fixed_prosthodontics')) return '!bg-blue-50 !text-blue-700 !border !border-blue-200'; // تعويضات ثابتة
    if (v.includes('removable_prosthodontics')) return '!bg-fuchsia-50 !text-fuchsia-700 !border !border-fuchsia-200'; // تعويضات متحركة
    if (v.includes('pediatric_dentistry')) return '!bg-orange-50 !text-orange-700 !border !border-orange-200'; //

    // Diagnosis Status
    if (v.includes('specified')) return '!bg-emerald-50 !text-emerald-700 !border !border-emerald-200';
    if (v.includes('completed')) return '!bg-amber-50 !text-amber-700 !border !border-amber-200';

    return '!bg-slate-100 !text-slate-700 !border !border-slate-200';
  }


  formatPhoneNumber(value: string | number): string {
    if (!value) return '';
    const phone = value.toString().replace(/\D/g, '');

    if (phone.length === 10) return `(${phone.slice(0, 3)}) ${phone.slice(3, 6)}-${phone.slice(6)}`;
    if (phone.length === 11) return `+${phone[0]} (${phone.slice(1, 4)}) ${phone.slice(4, 7)}-${phone.slice(7)}`;

    return value.toString();
  }

  resolveActionLoading(action: TableAction, row: any): boolean {
    const v = action.loading;
    return typeof v === 'function' ? v(row) : !!v;
  }

  resolveActionDisabled(action: TableAction, row: any): boolean {
    const v = action.disabled;
    return typeof v === 'function' ? v(row) : !!v;
  }

}
