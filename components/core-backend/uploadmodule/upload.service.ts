// src/upload/upload.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import * as fs from 'fs';

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);

  // إعدادات التخزين العامة
  getDiskStorage(folder: string) {
    const uploadPath = join(process.cwd(), 'uploads', folder);

    // تأكد أن المجلد موجود
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }

    return diskStorage({
      destination: uploadPath,
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const fileExt = extname(file.originalname);
        cb(null, `${file.fieldname}-${uniqueSuffix}${fileExt}`);
      },
    });
  }

  // اختياري: حفظ الملف info في DB أو تعديل المسار قبل الرد
  processFile(file: Express.Multer.File) {
    return {
      filename: file.filename,
      path: file.path,
      originalName: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
    };
  }
}
