// src/upload/upload.interceptor.ts
import { FileFieldsInterceptor, FilesInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { Injectable, Type } from '@nestjs/common';
import { UploadService } from './upload.service';

export function UploadFields(fields: { name: string; maxCount: number }[], folder = 'general') {
  return FileFieldsInterceptor(
    fields,
    {
      storage: new UploadService().getDiskStorage(folder), // أو inject service بطريقة أخرى
      limits: { fileSize: 5 * 1024 * 1024 }, // الحد الأقصى 5MB لكل ملف
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png)$/)) {
          return cb(new Error('Only image files are allowed!'), false);
        }
        cb(null, true);
      },
    },
  );
}

// لملف واحد
export function UploadSingle(fieldName: string, folder = 'general') {
  return FileInterceptor(fieldName, {
    storage: new UploadService().getDiskStorage(folder),
    limits: { fileSize: 5 * 1024 * 1024 },
  });
}

// لعدة ملفات بنفس الحقل
export function UploadMultiple(fieldName: string, maxCount = 10, folder = 'general') {
  return FilesInterceptor(fieldName, maxCount, {
    storage: new UploadService().getDiskStorage(folder),
    limits: { fileSize: 5 * 1024 * 1024 },
  });
}
