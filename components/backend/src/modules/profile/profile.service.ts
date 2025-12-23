import { Injectable, UnauthorizedException, NotFoundException, Logger, BadRequestException, ForbiddenException, Inject, InternalServerErrorException } from '@nestjs/common';
import { CreateProfileDto } from './dto/create-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { db } from '../../db/client'; // تأكد المسار صحيح
import { doctorProfile, patientProfile, users } from 'src/db/schema/profiles.schema';
import { appointments } from '../../db/schema/appointments.schema';
import { eq } from 'drizzle-orm';
import { ConfigService } from '@nestjs/config';
import { FusionAuthClientWrapper } from 'src/modules/auth/fusion-auth.client';
import pLimit from 'p-limit';
import { unlink } from 'fs/promises';
import { join } from 'path';
import axios from 'axios';
import {schema} from 'src/db/schema/schema';
import { AuthService } from 'src/modules/auth/auth.service';

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
  city?: number | null;
  specialty?: string | null;
  profilePhoto?: string | null;
};
type publicDoctorProfile={
 
  fusionAuthId: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  city: number | null;
  specialty: string | null;
  univercity: string | null;
  profilePhoto?: string | null;
}
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
  private baseUrl: string = process.env.FUSIONAUTH_BASE_URL || '';
  private apiKey: string = process.env.FUSIONAUTH_API_KEY || '';
  constructor(private config: ConfigService, @Inject() private authService: AuthService) {
    const baseUrl = (this.config.get<string>('FUSIONAUTH_BASE_URL') || 'https://auth.almahdi.cloud').replace(/\/$/, '');
    const apiKey = this.config.get<string>('FUSIONAUTH_API_KEY') || 'aNnC27LYRSW8WBZdni-_kbcsc7O8c00PiMVDRIgcAua4hBD2OpnIMUb9';
    this.fusionClient = new FusionAuthClientWrapper(baseUrl, apiKey);
  }

  // create(createProfileDto: CreateProfileDto) {
  //   return 'This action adds a new profile';
  // }

async findAll() {
  const profiles = await db.select().from(users);

  const limit = pLimit(10);
  const logger = this.logger;

  const tasks = profiles.map((user) =>
    limit(async () => {
      let fusionUser: { firstName?: string; lastName?: string; email?: string } | null = null;
      try {
        fusionUser = await this.fusionClient.getUser(user.fusionAuthId);
      } catch (err: any) {
        logger.warn(`Failed to fetch fusion user ${user.fusionAuthId}: ${err?.message ?? err}`);
      }

      // fallback photo logic: if DB value empty => return default
      const photo =
        user.profilePhoto && String(user.profilePhoto).trim() !== ''
          ? user.profilePhoto
          : this.defaultPhoto;

      // لو كان دكتور، جيب بيانات الدكتور من doctorProfile
      let doctorRow: typeof doctorProfile.$inferSelect | null = null;
      if (user.role === 'doctor') {
        const doctorRows = await db
          .select()
          .from(doctorProfile)
          .where(eq(doctorProfile.fusionAuthId, user.fusionAuthId))
          .limit(1);

        doctorRow = doctorRows[0] ?? null;
      }

      return {
        ...user,
        // لو في سجل دكتور، نضيف حقوله بشكل مرتب (بدون ما نكسر id تبع users)
        ...(doctorRow
          ? {
              doctorProfileId: doctorRow.id,
              university: doctorRow.university,
              specialty: doctorRow.specialty,
            }
          : {}),

        // نعطي الأولوية لبيانات FusionAuth ثم بيانات users المحلية
        firstName: fusionUser?.firstName ?? user.firstName ?? null,
        lastName: fusionUser?.lastName ?? user.lastName ?? null,
        email: fusionUser?.email ?? null,
        profilePhoto: photo,
      };
    }),
  );

  return await Promise.all(tasks);
}

 
  async getAllDoctors(){
    let doctors= await db.select().from(doctorProfile)
    let publicProfile:publicDoctorProfile[]=await Promise.all(
      doctors.map(async(doctor)=>{
       const [user]=await db.select().from(users).where(eq(users.fusionAuthId,doctor.fusionAuthId))
           const publicProfile: publicDoctorProfile = {
         
                fusionAuthId: user.fusionAuthId,
                firstName: user.firstName  ,
                lastName: user.lastName ,
                email: user.email ,
                city: user.city,
                specialty: doctor.specialty,
                univercity:doctor.university,
                profilePhoto: user.profilePhoto, // لو عندك هيك حقل
    };
   return publicProfile;
      })
    )
    
    return publicProfile

   
    
    
   
  }
  async findOne(id: string) {
    // id هنا هو fusionAuthId

    // 0) جلب السجل الأساسي من جدول users (لأنه يحتوي city, profilePhoto, ...الخ)
    const userRows = await db
      .select()
      .from(users)
      .where(eq(users.fusionAuthId, id))
      .limit(1);

    const baseUser = userRows[0];
    if (!baseUser) {
      throw new NotFoundException('User not found');
    }

    // 1) جلب السجل المحلي (نبحث في doctorProfiles أولاً)
    const doctorRows = await db
      .select()
      .from(doctorProfile)
      .where(eq(doctorProfile.fusionAuthId, id))
      .limit(1);

    let local: any = null;
    let foundIn: 'doctor' | 'patient' | null = null;

    if (doctorRows && doctorRows.length > 0) {
      local = doctorRows[0];
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

    const firstNameFromFusion =
      (fusionUserRaw && (fusionUserRaw.firstName ?? fusionUserRaw['first_name'])) ?? null;
    const lastNameFromFusion =
      (fusionUserRaw && (fusionUserRaw.lastName ?? fusionUserRaw['last_name'])) ?? null;
    const emailFromFusion =
      (fusionUserRaw && (fusionUserRaw.email ?? fusionUserRaw['email'])) ?? null;

    // 3) جلب المواعيد المرتبطة
    const availRows = await db
      .select()
      .from(appointments)
      .where(eq(appointments.doctorId, id))
      .orderBy(appointments.dayOfWeek, appointments.startTime);

    // تحويل الرقم إلى اسم اليوم
    const availabilities = availRows.map((r) => ({
      id: r.id,
      dayOfWeek: r.dayOfWeek,
      dayName: this.dayNameFromNumber(r.dayOfWeek),
      startTime: r.startTime,
      endTime: r.endTime,
    }));

    // 4) تشكيل الـ profile النهائي — نعطي الأولوية لبيانات FusionAuth إن وُجدت
    const publicProfile: PublicProfile = {
      // نستخدم id من doctorProfile/patientProfile إن وجد، وإلا من users
      id: local.id ?? baseUser.id,
      fusionAuthId: baseUser.fusionAuthId,
      firstName: firstNameFromFusion ?? baseUser.firstName ?? null,
      lastName: lastNameFromFusion ?? baseUser.lastName ?? null,
      email: emailFromFusion ?? null,
      city: baseUser.city ?? null,
      specialty: (local as any).specialty ?? null, // موجودة فقط في doctorProfile
      // إذا الحقل فارغ أو null نعيد default
      profilePhoto:
        baseUser.profilePhoto && String(baseUser.profilePhoto).trim() !== ''
          ? baseUser.profilePhoto
          : this.defaultPhoto,
    };

    return {
      profile: publicProfile,
      availabilities,
    };
  }

  async updateFusionInformation(fusionAuthId:string,dto:{firstName ,lastName,email,password}){
       const userRows = await db
      .select()
      .from(users)
      .where(eq(users.fusionAuthId, fusionAuthId))
      .limit(1);
    const baseUser = userRows[0];
    if (!baseUser) throw new NotFoundException('user not found');
    return this.fusionClient.updateUser(baseUser.fusionAuthId, {
        email: dto.email,
        password: dto.password,
        firstName: dto.firstName,
        lastName: dto.lastName,
      })
  }

  async updateMe({
    type,
    dto,
    storedPath,
    fusionAuthId,
  }: {
    type: 'doctor' | 'patient';
    dto: UpdateProfileDto;
    storedPath?: string;
    fusionAuthId: string;
  }) {
    // أولاً نتأكد أن الـ user موجود في جدول users
    const userRows = await db
      .select()
      .from(users)
      .where(eq(users.fusionAuthId, fusionAuthId))
      .limit(1);
    const baseUser = userRows[0];
    if (!baseUser) throw new NotFoundException('user not found');

    // ثم نتأكد أن الـ profile الخاص بالدور موجود
    if (type === 'doctor') {
      const d = await db
        .select()
        .from(doctorProfile)
        .where(eq(doctorProfile.fusionAuthId, fusionAuthId))
        .limit(1);
      if (!d[0]) throw new NotFoundException('doctor profile not found');
    } else {
      const p = await db
        .select()
        .from(patientProfile)
        .where(eq(patientProfile.fusionAuthId, fusionAuthId))
        .limit(1);
      if (!p[0]) throw new NotFoundException('patient profile not found');
    }

    // تغييرات FusionAuth؟
    const hasFusionChanges =
      dto.firstName !== undefined ||
      dto.lastName !== undefined ||
      dto.email !== undefined ||
      dto.password !== undefined;

    if (hasFusionChanges) {
      await this.fusionClient.updateUser(baseUser.fusionAuthId, {
        email: dto.email,
        password: dto.password,
        firstName: dto.firstName,
        lastName: dto.lastName,
      });
    }

    // تحديث محلي (صورة وأي حقول عامة في جدول users)
    const userUpdates: Record<string, any> = { updatedAt: new Date() };

    if (dto.profilePhoto) userUpdates.profilePhoto = dto.profilePhoto; // رابط
    if (storedPath) userUpdates.profilePhoto = storedPath; // ملف

    // لو حابب تسمح بتعديل city / gender مثلاً
    if (dto.city !== undefined) userUpdates.city = dto.city;
    if (dto.gender !== undefined) userUpdates.gender = dto.gender;
    if(dto.firstName!==undefined) userUpdates.firstName=dto.firstName
    if(dto.lastName!==undefined) userUpdates.lastName=dto.lastName


    if (Object.keys(userUpdates).length > 1) {
      await db
        .update(users)
        .set(userUpdates)
        .where(eq(users.fusionAuthId, fusionAuthId));
    }

    // نرجع النسخة المحدثة من users + بروفايل الدور
    const freshUserRows = await db
      .select()
      .from(users)
      .where(eq(users.fusionAuthId, fusionAuthId));
    const freshUser = freshUserRows[0];

    if(type==="doctor"){
      const doctorUpdates: Record<string, any> = { updatedAt: new Date() };
      console.log(dto.specialty)
          if(dto.specialty!==undefined) doctorUpdates.specialty=dto.specialty
         if(dto.university!==undefined) doctorUpdates.university=dto.university
        if (Object.keys(doctorUpdates).length > 1) {
      await db
        .update(doctorProfile)
        .set(doctorUpdates)
        .where(eq(doctorProfile.fusionAuthId, fusionAuthId));
    }

    }
    let extraProfile: any = null;
    if (type === 'doctor') {
      const d = await db
        .select()
        .from(doctorProfile)
        .where(eq(doctorProfile.fusionAuthId, fusionAuthId))
        .limit(1);
      extraProfile = d[0] || null;
    } else {
      const p = await db
        .select()
        .from(patientProfile)
        .where(eq(patientProfile.fusionAuthId, fusionAuthId))
        .limit(1);
      extraProfile = p[0] || null;
    }

    return {
      ok: true,
      type,
      profile: {
        ...freshUser,
        ...extraProfile,
      },
      fusionUpdated: !!hasFusionChanges,
      photoUpdated: !!(storedPath || dto.profilePhoto),
    };
  }

  async remove(id: string) {
    // id = fusionAuth userId

    // 1) جب المستخدم من FusionAuth
    let fusionUser: any;
    try {
      fusionUser = await this.authService.getUserById(id);
    } catch (e) {
      throw new NotFoundException('User not found in FusionAuth');
    }

    if (!fusionUser) {
      throw new NotFoundException('User not found in FusionAuth');
    }

    // 2) استخرج الدور (doctor / patient)
    let role: string | undefined;

    // لو كنت مخزّن role في data.role مستقبلاً
    if (fusionUser.data && fusionUser.data.role) {
      role = String(fusionUser.data.role);
    }

    // أو من registrations[].roles
    if (!role && Array.isArray(fusionUser.registrations)) {
      for (const reg of fusionUser.registrations) {
        if (Array.isArray(reg.roles) && reg.roles.length > 0) {
          role = String(reg.roles[0]);
          break;
        }
      }
    }

    if (!role) {
      throw new BadRequestException('Cannot determine user role (doctor / patient)');
    }

    // 3) احذف المستخدم من FusionAuth (hard delete)
    const deleteUrl = `${this.baseUrl}/api/user/${id}?hardDelete=true`;
    console.log(deleteUrl);
    const headers: Record<string, string> = {
      Authorization: this.apiKey,
    };
    console.log(this.apiKey);
    const tenantId =
      this.config.get<string>('FUSIONAUTH_TENANT_ID') ||
      '5ba05e07-b2d6-4f53-f424-a986bd483e4d';
    if (tenantId) {
      headers['X-FusionAuth-TenantId'] = tenantId;
    }

    try {
      await axios.delete(deleteUrl, {
        headers,
        timeout: 10000,
      });
    } catch (e: any) {
      console.error(
        'Failed to delete user from FusionAuth',
        e?.response?.data || e?.message || e,
      );
      throw new InternalServerErrorException('Failed to delete user from FusionAuth');
    }

    // 4) احذف المستخدم من الداتا بيز المحلية
    // بسبب ON DELETE CASCADE على doctor_profiles و patient_profiles
    // حذف السطر من users سيحذف البروفايل المرتبط تلقائياً
    await db
      .delete(schema.users)
      .where(eq(schema.users.fusionAuthId, id));

    if (role === 'doctor') {
      return { message: 'doctor deleted' };
    }

    if (role === 'patient') {
      return { message: 'patient deleted' };
    }

    // لو لقيت دور غريب
    return {
      message:
        'User deleted from FusionAuth and local DB, but role was: ' +
        role,
    };
  }

  // ---------------------------
  // Availabilities logic
  // ---------------------------

  async getAvailabilities(doctorId: string) {
    const rows = await db
      .select()
      .from(appointments)
      .where(eq(appointments.doctorId, doctorId))
      .orderBy(appointments.dayOfWeek);
    return rows.map((r) => ({
      id: r.id,
      dayOfWeek: r.dayOfWeek,
      dayName: this.dayNameFromNumber(r.dayOfWeek),
      startTime: r.startTime,
      endTime: r.endTime,
    }));
  }

  async upsertAvailabilities(
    fusionAuthId: string,
    items: { dayOfWeek: number; startTime: string; endTime: string }[],
  ) {
    await db.transaction(async (tx) => {
      // 1) جيب الدكتور عن طريق fusionAuthId
      const doctors = await tx
        .select()
        .from(doctorProfile)
        .where(eq(doctorProfile.fusionAuthId, fusionAuthId))
        .limit(1);

      if (!doctors || doctors.length === 0) {
        throw new NotFoundException('Doctor not found');
      }

      const doctor = doctors[0];
      const doctorPk = doctor.fusionAuthId; // 👈 هذا اللي بدنا نستخدمه مع جدول appointments

      // 2) احذف كل المواعيد القديمة لهذا الدكتور
      await tx.delete(appointments).where(eq(appointments.doctorId, doctorPk));

      // 3) أضف المواعيد الجديدة
      if (items.length > 0) {
        const rows = items.map((i) => ({
          doctorId: doctorPk, // 👈 اربطها بالـ PK (هنا fusionAuthId حسب تصميمك)
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
    const deleted = await db
      .delete(appointments)
      .where(eq(appointments.id, availabilityId))
      .returning();
    if (!deleted || (Array.isArray(deleted) && deleted.length === 0)) {
      throw new NotFoundException('Availability not found');
    }
    if (deleted[0].doctorId !== doctorId) {
      throw new UnauthorizedException('Not allowed to delete this availability');
    }
    return { ok: true };
  }

  async updateAvailability(
    doctorId: string,
    availabilityId: number,
    item: { dayOfWeek: number; startTime: string; endTime: string },
  ) {
    const rows = await db
      .update(appointments)
      .set({
        dayOfWeek: item.dayOfWeek,
        startTime: item.startTime,
        endTime: item.endTime,
        updatedAt: new Date(),
      })
      .where(eq(appointments.id, availabilityId))
      .returning();

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
  // async updateProfilePhoto(fusionAuthId: string, newPath: string): Promise<string> {
  //   if (!newPath || typeof newPath !== 'string') {
  //     throw new BadRequestException('Invalid newPath');
  //   }
  //   // Ensure path looks like 'uploads/...' (no leading slash) or '/uploads/...'
  //   const normalized = newPath.replace(/\\/g, '/');
  //   const trimmed = normalized.startsWith('/') ? normalized.slice(1) : normalized;
  //   if (!trimmed.startsWith('uploads/')) {
  //     throw new BadRequestException('Invalid upload path');
  //   }

  //   // Try update doctor first
  //   const doctorRows = await db.select().from(doctorProfile).where(eq(doctorProfile.fusionAuthId, fusionAuthId)).limit(1);
  //   if (doctorRows && doctorRows.length > 0) {
  //     const prev = doctorRows[0].profilePhoto || null;
  //     // Update DB
  //     await db.update(doctorProfile).set({ profilePhoto: trimmed }).where(eq(doctorProfile.fusionAuthId, fusionAuthId));
  //     // remove previous file if safe and not default
  //     await this.safeDeleteOldFile(prev);
  //     return `/${trimmed}`; // return with leading slash to match existing API convention
  //   }

  //   // Else try patient
  //   const patientRows = await db.select().from(patientProfile).where(eq(patientProfile.fusionAuthId, fusionAuthId)).limit(1);
  //   if (patientRows && patientRows.length > 0) {
  //     const prev = patientRows[0].profilePhoto || null;
  //     await db.update(patientProfile).set({ profilePhoto: trimmed }).where(eq(patientProfile.fusionAuthId, fusionAuthId));
  //     await this.safeDeleteOldFile(prev);
  //     return `/${trimmed}`;
  //   }

  //   throw new NotFoundException('Profile not found');
  // }

  // safe delete only inside uploads and not the default logo
  // private async safeDeleteOldFile(maybePath?: string | null) {
  //   if (!maybePath) return;
  //   try {
  //     const normalized = maybePath.replace(/\\/g, '/');
  //     const trimmed = normalized.startsWith('/') ? normalized.slice(1) : normalized;
  //     if (!trimmed.startsWith('uploads/')) return;
  //     if (trimmed === 'uploads/logo.png') return; // do not delete default
  //     const fullPath = join(process.cwd(), trimmed);
  //     await unlink(fullPath).catch(() => null);
  //     this.logger.log(`Deleted old profile photo: ${fullPath}`);
  //   } catch (e) {
  //     this.logger.warn('Failed to delete old profile photo', e?.message || e);
  //   }
  // }

  // Helper: return day name from number
  private dayNameFromNumber(n: number): string {
    // Accept common representations: 0..6 (Sun..Sat) or 1..7 (Mon..Sun)
    const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    if (typeof n !== 'number' || Number.isNaN(n)) return String(n);
    if (n >= 0 && n <= 6) return names[n];
    if (n >= 1 && n <= 7) return names[n - 1]; // treat 1->Monday
    return `Day ${n}`;
  }

async createAvailabilities(
  doctorId: string,
  items: { dayOfWeek: number; startTime: string; endTime: string }[],
) {
  // 1) تأكد أن الدكتور موجود
  const doctorRows = await db
    .select()
    .from(doctorProfile)
    .where(eq(doctorProfile.fusionAuthId, doctorId))
    .limit(1);

  if (doctorRows.length === 0) {
    throw new NotFoundException('Doctor not found');
  }

  // 2) جيب المواعيد القديمة
  const existing = await db
    .select()
    .from(appointments)
    .where(eq(appointments.doctorId, doctorId));

  // لو ما في ولا موعد قديم → أدخل الكل
  if (existing.length === 0) {
    const rowsToInsert = items.map((i) => ({
      doctorId: doctorId,
      dayOfWeek: i.dayOfWeek,
      startTime: i.startTime,
      endTime: i.endTime,
    }));

    if (rowsToInsert.length > 0) {
      await db.insert(appointments).values(rowsToInsert);
    }

    return {
      inserted: rowsToInsert.length,
      skipped: 0,
      message: 'All availabilities inserted (no previous data).',
    };
  }

  // 3) في مواعيد قديمة → نبني Set للمقارنة السريعة
  const existingSet = new Set(
    existing.map(
      (a) => `${a.dayOfWeek}|${a.startTime}|${a.endTime}`, // مفتاح فريد لكل موعد
    ),
  );

  // 4) نفلتر الـ items: نخلي بس المواعيد الجديدة (اللي مو موجودة في existingSet)
  const newAvailabilities = items.filter((i) => {
    const key = `${i.dayOfWeek}|${i.startTime}|${i.endTime}`;
    return !existingSet.has(key);
  });

  // نجهز صفوف الإدخال
  const rowsToInsert = newAvailabilities.map((i) => ({
    doctorId: doctorId,
    dayOfWeek: i.dayOfWeek,
    startTime: i.startTime,
    endTime: i.endTime,
  }));

  if (rowsToInsert.length > 0) {
    await db.insert(appointments).values(rowsToInsert);
  }

  return {
    inserted: rowsToInsert.length,
    skipped: items.length - rowsToInsert.length,
    message:
      rowsToInsert.length === 0
        ? 'All availabilities already exist.'
        : 'New availabilities inserted; duplicates were skipped.',
  };
}

   }

