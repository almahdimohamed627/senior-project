import { Injectable, UnauthorizedException, NotFoundException, Logger, BadRequestException, ForbiddenException } from '@nestjs/common';
import { CreateProfileDto } from './dto/create-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { db } from '../auth/client'; // تأكد المسار صحيح
import { doctorProfile, patientProfile } from 'src/db/schema/profiles.schema';
import { appointments } from '../db/schema/appointments';
import { eq } from 'drizzle-orm';
import { ConfigService } from '@nestjs/config';
import { FusionAuthClientWrapper } from 'src/auth/fusion-auth.client';
import pLimit from 'p-limit';
import { unlink } from 'fs/promises';
import { join } from 'path';

interface FusionUser {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
}

type PublicProfile = {
  id: number;
  fusionAuthId: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  city?: string | null;
  specialty?: string | null;
  profilePhoto?: string | null;
};
type UpdateArgs = {
  id: string;                         // profile id (رقمي من جدولك)
  type: 'doctor' | 'patient';
  dto: UpdateProfileDto;
  storedPath?: string;
  fusionAuthId: string;               // من التوكن
};

@Injectable()
export class ProfileService {
  private fusionClient: FusionAuthClientWrapper;
  private readonly logger = new Logger(ProfileService.name);
  // default photo URL (served via static)
  private readonly defaultPhoto = '/uploads/logo.png';

  constructor(private config: ConfigService) {
    const baseUrl = (this.config.get<string>('FUSIONAUTH_BASE_URL') || '').replace(/\/$/, '');
    const apiKey = this.config.get<string>('FUSIONAUTH_API_KEY');
    this.fusionClient = new FusionAuthClientWrapper(baseUrl, apiKey);
  }

  create(createProfileDto: CreateProfileDto) {
    return 'This action adds a new profile';
  }

  async findAll() {
    const profiles = await db.select().from(doctorProfile);

    const limit = pLimit(10);
    const logger = this.logger;

    const tasks = profiles.map((doctor) =>
      limit(async () => {
        let fusionUser: { firstName?: string; lastName?: string; email?: string } | null = null;
        try {
          fusionUser = await this.fusionClient.getUser(doctor.fusionAuthId);
        } catch (err: any) {
          logger.warn(`Failed to fetch fusion user ${doctor.fusionAuthId}: ${err?.message ?? err}`);
        }

        // fallback photo logic: if DB value empty => return default
        const photo = doctor.profilePhoto && String(doctor.profilePhoto).trim() !== ''
          ? doctor.profilePhoto
          : this.defaultPhoto;

        return {
          ...doctor,
          firstName: fusionUser?.firstName ?? null,
          lastName: fusionUser?.lastName ?? null,
          email: fusionUser?.email ?? null,
          profilePhoto: photo,
        };
      }),
    );

    return await Promise.all(tasks);
  }

  async findOne(id: string) {
    // 1) جلب السجل المحلي (نبحث في doctorProfiles أولاً)
    const profiles = await db
      .select()
      .from(doctorProfile)
      .where(eq(doctorProfile.fusionAuthId, id))
      .limit(1);

    let local: any = null;
    let foundIn: 'doctor' | 'patient' | null = null;

    if (profiles && profiles.length > 0) {
      local = profiles[0];
      foundIn = 'doctor';
    } else {
      // try patient
      const patients = await db
        .select()
        .from(patientProfile)
        .where(eq(patientProfile.fusionAuthId, id))
        .limit(1);
      if (patients && patients.length > 0) {
        local = patients[0];
        foundIn = 'patient';
      }
    }

    if (!local) {
      throw new NotFoundException('Profile not found');
    }

    // 2) جلب بيانات FusionAuth
    let fusionUserRaw: any = null;
    try {
      fusionUserRaw = await this.fusionClient.getUser(id);
      if (fusionUserRaw && fusionUserRaw.response && fusionUserRaw.response.user) {
        fusionUserRaw = fusionUserRaw.response.user;
      }
      if (fusionUserRaw && fusionUserRaw.user) {
        fusionUserRaw = fusionUserRaw.user;
      }
    } catch (e) {
      fusionUserRaw = null;
    }

    const firstNameFromFusion = (fusionUserRaw && (fusionUserRaw.firstName ?? fusionUserRaw['first_name'])) ?? null;
    const lastNameFromFusion  = (fusionUserRaw && (fusionUserRaw.lastName  ?? fusionUserRaw['last_name']))  ?? null;
    const emailFromFusion     = (fusionUserRaw && (fusionUserRaw.email     ?? fusionUserRaw['email']))      ?? null;

    // 3) جلب المواعيد المرتبطة
    const availRows = await db
      .select()
      .from(appointments)
      .where(eq(appointments.doctorId, id))
      .orderBy(appointments.dayOfWeek, appointments.startTime);

    // تحويل الرقم إلى اسم اليوم
    const availabilities = availRows.map(r => ({
      id: r.id,
      dayOfWeek: r.dayOfWeek,
      dayName: this.dayNameFromNumber(r.dayOfWeek),
      startTime: r.startTime,
      endTime: r.endTime,
    }));

    // 4) تشكيل الـ profile النهائي — نعطي الأولوية لبيانات FusionAuth إن وُجدت
    const publicProfile: PublicProfile = {
      id: local.id,
      fusionAuthId: local.fusionAuthId,
      firstName: firstNameFromFusion ?? (local as any).firstName ?? null,
      lastName:  lastNameFromFusion  ?? (local as any).lastName  ?? null,
      email:     emailFromFusion     ?? (local as any).email     ?? null,
      city: local.city ?? null,
      specialty: local.specialty ?? null,
      // إذا الحقل فارغ أو null نعيد default
      profilePhoto: local.profilePhoto && String(local.profilePhoto).trim() !== '' ? local.profilePhoto : this.defaultPhoto,
    };

    return {
      profile: publicProfile,
      availabilities,
    };
  }

   async updateMe({ type, dto, storedPath, fusionAuthId }: {
  type: 'doctor' | 'patient';
  dto: UpdateProfileDto;
  storedPath?: string;
  fusionAuthId: string;
}) {
  const table = type === 'doctor' ? doctorProfile : patientProfile;

  // جيب السجل بهذا المستخدم
  const rows = await db.select().from(table).where(eq(table.fusionAuthId, fusionAuthId)).limit(1);
  const current = rows[0];
  if (!current) throw new NotFoundException(`${type} profile not found`);

  // تغييرات FusionAuth؟
  const hasFusionChanges =
    dto.firstName !== undefined ||
    dto.lastName !== undefined ||
    dto.email !== undefined ||
    dto.password !== undefined;

  if (hasFusionChanges) {
    await this.fusionClient.updateUser(current.fusionAuthId, {
      email: dto.email,
      password: dto.password,
      firstName: dto.firstName,
      lastName: dto.lastName,
    });
  }

  // تحديث محلي (صورة وأي محلي ثاني)
  const localUpdates: Record<string, any> = { updatedAt: new Date() };
  if (dto.profilePhoto) localUpdates.profilePhoto = dto.profilePhoto; // رابط
  if (storedPath) localUpdates.profilePhoto = storedPath;            // ملف

  if (Object.keys(localUpdates).length > 1) {
    await db.update(table).set(localUpdates).where(eq(table.fusionAuthId, fusionAuthId));
  }

  const fresh = await db.select().from(table).where(eq(table.fusionAuthId, fusionAuthId));
  return {
    ok: true,
    type,
    profile: fresh[0],
    fusionUpdated: !!hasFusionChanges,
    photoUpdated: !!(storedPath || dto.profilePhoto),
  };
}


  remove(id: number) {
    return `This action removes a #${id} profile`;
  }

  // ---------------------------
  // Availabilities logic
  // ---------------------------

  async getAvailabilities(doctorId: string) {
    const rows = await db.select().from(appointments).where(eq(appointments.doctorId, doctorId)).orderBy(appointments.dayOfWeek);
    return rows.map(r => ({
      id: r.id,
      dayOfWeek: r.dayOfWeek,
      dayName: this.dayNameFromNumber(r.dayOfWeek),
      startTime: r.startTime,
      endTime: r.endTime,
    }));
  }

  async upsertAvailabilities(doctorId: string, items: { dayOfWeek:number, startTime:string, endTime:string }[]) {
    await db.transaction(async (tx) => {
      const doctorExists = await tx.select().from(doctorProfile).where(eq(doctorProfile.fusionAuthId, doctorId)).limit(1);
      if (!doctorExists || doctorExists.length === 0) {
        throw new NotFoundException('Doctor not found');
      }

      await tx.delete(appointments).where(eq(appointments.doctorId, doctorId));
      if (items.length > 0) {
        const rows = items.map(i => ({
          doctorId,
          dayOfWeek: i.dayOfWeek,
          startTime: i.startTime,
          endTime: i.endTime,
        }));
        await tx.insert(appointments).values(rows);
      }
    });

    return { ok: true };
  }

  async deleteAvailability(doctorId: string, availabilityId: number) {
    const deleted = await db.delete(appointments).where(eq(appointments.id, availabilityId)).returning();
    if (!deleted || (Array.isArray(deleted) && deleted.length === 0)) {
      throw new NotFoundException('Availability not found');
    }
    if (deleted[0].doctorId !== doctorId) {
      throw new UnauthorizedException('Not allowed to delete this availability');
    }
    return { ok: true };
  }

  async updateAvailability(doctorId: string, availabilityId: number, item: { dayOfWeek:number, startTime:string, endTime:string }) {
    const rows = await db.update(appointments).set({
      dayOfWeek: item.dayOfWeek,
      startTime: item.startTime,
      endTime: item.endTime,
      updatedAt: new Date(),
    }).where(eq(appointments.id, availabilityId)).returning();

    if (!rows || (Array.isArray(rows) && rows.length === 0)) {
      throw new NotFoundException('Availability not found');
    }
    if (rows[0].doctorId !== doctorId) {
      throw new UnauthorizedException('Not allowed to update this availability');
    }
    return {
      id: rows[0].id,
      dayOfWeek: rows[0].dayOfWeek,
      dayName: this.dayNameFromNumber(rows[0].dayOfWeek),
      startTime: rows[0].startTime,
      endTime: rows[0].endTime,
    };
  }

  // ---------------------------
  // Profile photo update logic
  // ---------------------------
  /**
   * Update profile photo for a user identified by fusionAuthId.
   * - finds profile in doctors or patients
   * - deletes previous file if it was in uploads/ and not default logo
   * - updates DB and returns the new profilePhoto (string)
   */
  async updateProfilePhoto(fusionAuthId: string, newPath: string): Promise<string> {
    if (!newPath || typeof newPath !== 'string') {
      throw new BadRequestException('Invalid newPath');
    }
    // Ensure path looks like 'uploads/...' (no leading slash) or '/uploads/...'
    const normalized = newPath.replace(/\\/g, '/');
    const trimmed = normalized.startsWith('/') ? normalized.slice(1) : normalized;
    if (!trimmed.startsWith('uploads/')) {
      throw new BadRequestException('Invalid upload path');
    }

    // Try update doctor first
    const doctorRows = await db.select().from(doctorProfile).where(eq(doctorProfile.fusionAuthId, fusionAuthId)).limit(1);
    if (doctorRows && doctorRows.length > 0) {
      const prev = doctorRows[0].profilePhoto || null;
      // Update DB
      await db.update(doctorProfile).set({ profilePhoto: trimmed }).where(eq(doctorProfile.fusionAuthId, fusionAuthId));
      // remove previous file if safe and not default
      await this.safeDeleteOldFile(prev);
      return `/${trimmed}`; // return with leading slash to match existing API convention
    }

    // Else try patient
    const patientRows = await db.select().from(patientProfile).where(eq(patientProfile.fusionAuthId, fusionAuthId)).limit(1);
    if (patientRows && patientRows.length > 0) {
      const prev = patientRows[0].profilePhoto || null;
      await db.update(patientProfile).set({ profilePhoto: trimmed }).where(eq(patientProfile.fusionAuthId, fusionAuthId));
      await this.safeDeleteOldFile(prev);
      return `/${trimmed}`;
    }

    throw new NotFoundException('Profile not found');
  }

  // safe delete only inside uploads and not the default logo
  private async safeDeleteOldFile(maybePath?: string | null) {
    if (!maybePath) return;
    try {
      const normalized = maybePath.replace(/\\/g, '/');
      const trimmed = normalized.startsWith('/') ? normalized.slice(1) : normalized;
      if (!trimmed.startsWith('uploads/')) return;
      if (trimmed === 'uploads/logo.png') return; // do not delete default
      const fullPath = join(process.cwd(), trimmed);
      await unlink(fullPath).catch(() => null);
      this.logger.log(`Deleted old profile photo: ${fullPath}`);
    } catch (e) {
      this.logger.warn('Failed to delete old profile photo', e?.message || e);
    }
  }

  // Helper: return day name from number
  private dayNameFromNumber(n: number): string {
    // Accept common representations: 0..6 (Sun..Sat) or 1..7 (Mon..Sun)
    const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    if (typeof n !== 'number' || Number.isNaN(n)) return String(n);
    if (n >= 0 && n <= 6) return names[n];
    if (n >= 1 && n <= 7) return names[n - 1]; // treat 1->Monday
    return `Day ${n}`;
  }
}
