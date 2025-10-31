import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  ValidationPipe,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ProfileService } from './profile.service';
import { CreateProfileDto } from './dto/create-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpsertAvailabilitiesDto } from './dto/availability.dto';
import { AvailabilityItemDto } from './dto/availability.dto';
import { Roles } from 'src/auth/decorators/role.decorator';
import { Role } from 'src/enums/role.enum';
import { RolesGuard } from 'src/auth/guards/role.guard';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';

const UPLOADS_FOLDER = 'uploads';

// ensure uploads folder exists
if (!existsSync(UPLOADS_FOLDER)) {
  mkdirSync(UPLOADS_FOLDER, { recursive: true });
}

function fileFilter(req: any, file: Express.Multer.File, cb: Function) {
  if (!file.mimetype.match(/\/(jpg|jpeg|png)$/)) {
    return cb(new BadRequestException('Unsupported file type. Only jpg/jpeg/png allowed.'), false);
  }
  cb(null, true);
}

function editFileName(req: any, file: Express.Multer.File, callback: Function) {
  const name = file.originalname.replace(/\.[^/.]+$/, '').replace(/\s+/g, '-').toLowerCase();
  const fileExtName = extname(file.originalname).toLowerCase();
  const timestamp = Date.now();
  const finalName = `${name}-${timestamp}${fileExtName}`;
  callback(null, finalName);
}

@Controller('profile')
export class ProfileController {
  private readonly logger = new Logger(ProfileController.name);

  constructor(private readonly profileService: ProfileService) {}

  @Post()
  create(@Body() createProfileDto: CreateProfileDto) {
    return this.profileService.create(createProfileDto);
  }

  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(Role.PATIENT)
  @Get()
  async findAll() {
    return await this.profileService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return await this.profileService.findOne(id);
  }
  @Get('Doctor/:id')
  async findOneByUserId(@Param('id') id: string) {
    return await this.profileService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateProfileDto: UpdateProfileDto) {
    return this.profileService.update(+id, updateProfileDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.profileService.remove(+id);
  }

  // -----------------------
  // Availabilities endpoints
  // -----------------------

  // استرجاع الدوامات (المريض / أي زائر) — الآن يُرجع اسم اليوم dayName
  @Get(':id/availabilities')
  async getAvailabilities(@Param('id') doctorId: string) {
    return await this.profileService.getAvailabilities(doctorId);
  }

  // استبدال كل الدوامات للطبيب (Doctor only) - upsert
  @Post(':id/availabilities')
  @HttpCode(HttpStatus.OK)
  async upsertAvailabilities(
    @Param('id') doctorId: string,
    @Body(new ValidationPipe({ whitelist: true })) body: UpsertAvailabilitiesDto,
  ) {
    return await this.profileService.upsertAvailabilities(doctorId, body.items || []);
  }

  // حذف دوام واحد
  @Delete(':id/availabilities/:availabilityId')
  @HttpCode(HttpStatus.OK)
  async deleteAvailability(
    @Param('id') doctorId: string,
    @Param('availabilityId') availabilityId: string,
  ) {
    return await this.profileService.deleteAvailability(doctorId, Number(availabilityId));
  }

  // تحديث دوام واحد (اختياري)
  @Patch(':id/availabilities/:availabilityId')
  async updateAvailability(
    @Param('id') doctorId: string,
    @Param('availabilityId') availabilityId: string,
    @Body(new ValidationPipe({ whitelist: true })) item: AvailabilityItemDto,
  ) {
    return await this.profileService.updateAvailability(doctorId, Number(availabilityId), item);
  }

  // -----------------------
  // Update profile photo (current user) - authenticated
  // -----------------------
  // Endpoint: POST /profile/me/photo
  // Form field: profilePhoto (file)
  @UseGuards(JwtAuthGuard)
  @Post('me/photo')
  @UseInterceptors(
    FileInterceptor('profilePhoto', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          cb(null, UPLOADS_FOLDER);
        },
        filename: editFileName,
      }),
      fileFilter,
      limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
    }),
  )
  async updateMyPhoto(@Req() req: any, @UploadedFile() file?: Express.Multer.File) {
    const userId = req.user?.sub;
    if (!userId) {
      // should not happen if JwtAuthGuard worked, but just in case
      throw new BadRequestException('User not authenticated');
    }

    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    // build stored path like 'uploads/filename.ext' (no leading slash)
    const storedPath = `${UPLOADS_FOLDER}/${file.filename}`;

    try {
      const updated = await this.profileService.updateProfilePhoto(userId, storedPath);
      return { ok: true, profilePhoto: updated };
    } catch (err: any) {
      // on error, attempt to remove uploaded file to avoid orphaning
      try {
        const { unlink } = await import('fs/promises');
        const { join } = await import('path');
        await unlink(join(process.cwd(), storedPath)).catch(() => null);
      } catch (e) {
        this.logger.warn('Failed to cleanup uploaded file after service error', e?.message || e);
      }
      throw err;
    }
  }
}
