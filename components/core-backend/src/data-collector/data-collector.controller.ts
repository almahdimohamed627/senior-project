import { Controller, Post, UseGuards, UploadedFiles, UseInterceptors, Body, BadRequestException, Req } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { DataCollectorService } from './data-collector.service';
import { BasicAuthGuard } from './basic-auth.guard';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import { ConfigService } from '@nestjs/config';

@Controller('data-collector')
export class DataCollectorController {
  constructor(private service: DataCollectorService, private config: ConfigService) {}

  // الملفات المتوقعة: upperJaw, lowerJaw, fullMouth, smile
  @UseGuards(BasicAuthGuard)
  @UseInterceptors(FileFieldsInterceptor(
    [
      { name: 'upperJaw', maxCount: 1 },
      { name: 'lowerJaw', maxCount: 1 },
      { name: 'fullMouth', maxCount: 1 },
      { name: 'smile', maxCount: 1 },
    ],
    {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const uploadsDir = process.env.UPLOADS_DIR || './uploads';
          cb(null, uploadsDir);
        },
        filename: (req, file, cb) => {
          const ext = path.extname(file.originalname).toLowerCase();
          const fname = `${Date.now()}-${uuidv4()}${ext}`;
          cb(null, fname);
        },
      }),
      limits: {
        fileSize: 10 * 1024 * 1024, // 10 MB per file
      },
      fileFilter: (req, file, cb) => {
        const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (!allowed.includes(ext)) {
          return cb(new BadRequestException('Only images are allowed (.jpg .jpeg .png .webp)'), false);
        }
        cb(null, true);
      },
    }
  ))
  @Post('submit')
  async submit(
    @UploadedFiles() files: { upperJaw?: Express.Multer.File[], lowerJaw?: Express.Multer.File[], fullMouth?: Express.Multer.File[], smile?: Express.Multer.File[] },
    @Body() body: {
      label?: string;
      notes?: string;
      gum?: string | boolean;
      caries?: string | boolean;
      surgery?: string | boolean;
      fixed?: string | boolean;
      animated?: string | boolean;
    },
    @Req() req: any,
  ) {
    // validate presence of all four images
    if (!files?.upperJaw?.[0] || !files?.lowerJaw?.[0] || !files?.fullMouth?.[0] || !files?.smile?.[0]) {
      throw new BadRequestException('All four images (upperJaw, lowerJaw, fullMouth, smile) are required');
    }
    if (!body?.label) {
      throw new BadRequestException('Label is required');
    }

    const uploadsDir = process.env.UPLOADS_DIR || './uploads';
    const upperFile = files.upperJaw[0].filename;
    const lowerFile = files.lowerJaw[0].filename;
    const fullFile = files.fullMouth[0].filename;
    const smileFile = files.smile[0].filename;

    const uploader = req.uploader?.username || 'unknown';

    // helper to parse boolean-like values from form-data (text)
    const parseBool = (v: any): boolean | null => {
      if (v === undefined || v === null || v === '') return null;
      if (typeof v === 'boolean') return v;
      const s = String(v).toLowerCase().trim();
      if (s === 'true' || s === '1') return true;
      if (s === 'false' || s === '0') return false;
      return null; // unknown -> null
    };

    // build relative paths (relative to project cwd), e.g. "uploads/xxxx.jpg"
    const upperRel = path.relative(process.cwd(), path.join(uploadsDir, upperFile));
    const lowerRel = path.relative(process.cwd(), path.join(uploadsDir, lowerFile));
    const fullRel = path.relative(process.cwd(), path.join(uploadsDir, fullFile));
    const smileRel = path.relative(process.cwd(), path.join(uploadsDir, smileFile));

    const gum = parseBool(body.gum);
    const caries = parseBool(body.caries);
    const surgery = parseBool(body.surgery);
    const fixed = parseBool(body.fixed);
    const animated = parseBool(body.animated);

    const saved = await this.service.saveRecord({
      uploaderId: uploader,
      upperJawFile: upperRel,
      lowerJawFile: lowerRel,
      fullMouthFile: fullRel,
      smileFile: smileRel,
      label: body.label,
      notes: body.notes,
      gum,
      caries,
      surgery,
      fixed,
      animated,
    });

    return {
      ok: true,
      id: saved.id,
      files: {
        upper: upperFile,
        lower: lowerFile,
        full: fullFile,
        smile: smileFile,
      },
      flags: {
        gum,
        caries,
        surgery,
        fixed,
        animated,
      },
    };
  }
}
