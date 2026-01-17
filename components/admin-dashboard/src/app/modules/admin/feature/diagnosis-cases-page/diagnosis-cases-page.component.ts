import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { AdminService } from '@modules/admin/data/admin.service';
import { HotToastService } from '@ngxpert/hot-toast';
import {
  TableAction,
  TableColumn,
  TableFilterConfig,
  TableSearchConfig,
  TableComponent,
} from '@shared/components/ui/table/table.component';
import { environment } from 'environments/environment.development';
import { catchError, finalize, map, of } from 'rxjs';

import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';

export interface DiagnosisModel {
  diagnosisInfo: DiagnosisInfo;
  patientInfo: PatientInfo;
  doctorInfo: DoctorInfo;
}

export interface DiagnosisInfo {
  diagnosisId: number;
  status: string;
  speciality: string;
  image: string;
  diagnosisPdf: string;
  createdAt: string;
  diagnosisQrCode: string;
}

export interface PatientInfo {
  patientFirstName: string;
  patientLastName: string;
  patientEmail: string;
  patientPhone: string;
}

export interface DoctorInfo {
  firstName: string;
  lastName: string;
  email: string;
}

@Component({
  selector: 'app-diagnosis-cases-page',
  standalone: true,
  imports: [CommonModule, TableComponent, DialogModule, ButtonModule],
  templateUrl: './diagnosis-cases-page.component.html',
  styleUrl: './diagnosis-cases-page.component.scss',
})
export class DiagnosisCasesPageComponent {
  private adminService = inject(AdminService);
  private toast = inject(HotToastService);

  loading = signal<boolean>(true);
  diagnosis = signal<DiagnosisModel[]>([]);

  baseUrl = environment.baseUrl;

  qrDialogVisible = signal(false);
  selectedQrUrl = signal<string | null>(null);
  selectedQrTitle = signal<string>('Diagnosis QR Code');

  constructor() {
    this.loadDiagnosis();
  }

  loadDiagnosis() {
    this.loading.set(true);

    this.adminService
      .loadDiagnosis()
      .pipe(
        map((res: any) => {
          if (res && Array.isArray(res)) return res as DiagnosisModel[];
          return [];
        }),
        catchError((err) => {
          this.toast.error('Failed to load diagnosis cases');
          console.error('Error loading diagnosis:', err);
          return of([]);
        }),
        finalize(() => this.loading.set(false))
      )
      .subscribe({
        next: (diagnosis: any) => {
          this.diagnosis.set(diagnosis);
        },
      });
  }

  columns: TableColumn[] = [
    { field: 'patientInfo.patientFirstName', header: 'Patient First Name', type: 'text' },
    { field: 'patientInfo.patientLastName', header: 'Patient Last Name', type: 'text' },
    { field: 'doctorInfo.firstName', header: 'Doctor First Name', type: 'text' },
    { field: 'doctorInfo.lastName', header: 'Doctor Last Name', type: 'text' },
    { field: 'diagnosisInfo.speciality', header: 'Speciality', type: 'chip' },
    { field: 'diagnosisInfo.status', header: 'Diagnosis Status', type: 'chip' },
  ];

  searchConfig: TableSearchConfig = {
    placeholder: 'Search diagnosis by speciality, status, doctorName , patientName',
    fields: [
      'diagnosisInfo.speciality',
      'diagnosisInfo.status',
      'doctorInfo.firstName',
      'doctorInfo.lastName',
      'patientInfo.patientFirstName',
      'patientInfo.patientLastName',
    ],
  };

  filtersConfig: TableFilterConfig[] = [
    {
      field: 'diagnosisInfo.status',
      label: 'Diagnosis Status',
      placeholder: 'Filter by diagnosis status',
      type: 'select',
    },
    {
      field: 'diagnosisInfo.speciality',
      label: 'Diagnosis Speciality',
      placeholder: 'Filter by speciality',
      type: 'select',
    },
  ];

  actions = (diagnosis: DiagnosisModel): TableAction[] => {
    const actions: TableAction[] = [];
    const qrPath = diagnosis?.diagnosisInfo?.diagnosisQrCode;

    //  QR
    if (this.hasValue(qrPath)) {
      actions.push({
        type: 'button',
        label: 'QR',
        icon: 'pi pi-qrcode',
        severity: 'info',
        loading: (row) => !!row.__openingQr,
        disabled: (row) => !!row.__openingQr,
        action: (row) => this.openQrModal(row),
      });
    }

    return actions;
  };

  openQrModal(row: DiagnosisModel & any) {
    try {
      row.__openingQr = true;

      const qrPath = row?.diagnosisInfo?.diagnosisQrCode;
      if (!this.hasValue(qrPath)) return;

      const qrUrl = this.buildFileUrl(qrPath);

      this.selectedQrTitle.set(`Diagnosis #${row?.diagnosisInfo?.diagnosisId} QR Code`);
      this.selectedQrUrl.set(qrUrl);
      this.qrDialogVisible.set(true);
    } finally {
      row.__openingQr = false;
    }
  }

  closeQrModal() {
    this.qrDialogVisible.set(false);
    this.selectedQrUrl.set(null);
  }

  private hasValue(value: any): boolean {
    return value !== null && value !== undefined && String(value).trim() !== '';
  }

  private buildFileUrl(path: string): string {
    if (!path) return '';

    // already absolute
    if (path.startsWith('http://') || path.startsWith('https://')) return path;

    const base = (this.baseUrl || '').replace(/\/+$/, '');
    const cleanPath = String(path).startsWith('/') ? path : `/${path}`;

    return `${base}${cleanPath}`;
  }
}
