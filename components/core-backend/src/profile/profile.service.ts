// src/profile/profile.service.ts
import { Injectable, UnauthorizedException, NotFoundException, Logger } from '@nestjs/common';
import { CreateProfileDto } from './dto/create-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { db } from '../auth/client'; // تأكد المسار صحيح
import { doctorProfile } from 'src/db/schema/profiles.schema';
import { appointments } from '../db/schema/appointments';
import { eq, inArray } from 'drizzle-orm';
import { ConfigService } from '@nestjs/config';
import { FusionAuthClientWrapper } from 'src/auth/fusion-auth.client';
import pLimit from 'p-limit';

interface FusionUser {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  // أي حقول أخرى تحتاجها...
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
  // أضف حقولاً أخرى حسب الحاجة
};
@Injectable()
export class ProfileService {

    private fusionClient: FusionAuthClientWrapper;
   private readonly logger = new Logger(ProfileService.name);

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
    const logger = this.logger; // <<< خزن المرجع هنا

    const tasks = profiles.map((doctor) =>
      limit(async () => {
        let fusionUser: { firstName?: string; lastName?: string; email?: string } | null = null;
        try {
          fusionUser = await this.fusionClient.getUser(doctor.fusionAuthId);
        } catch (err: any) {
          // استخدم المتغير المحفوظ بدل this.logger
          logger.warn(`Failed to fetch fusion user ${doctor.fusionAuthId}: ${err?.message ?? err}`);
        }
    
        return await {
          ...doctor,
          firstName: fusionUser?.firstName ?? null,
          lastName: fusionUser?.lastName ?? null,
          email: fusionUser?.email ?? null,
        };
      }),
    );

    return await Promise.all(tasks);
  }

  async findOne(id: string) {
    // 1) جلب السجل المحلي
    const profiles = await db
      .select()
      .from(doctorProfile)
      .where(eq(doctorProfile.fusionAuthId, id))
      .limit(1);

    if (!profiles || profiles.length === 0) {
      throw new NotFoundException('Profile not found');
    }
    const local = profiles[0]; // نوعه محدد بحسب schema (لا يحتوي firstName/lastName/email)

    // 2) جلب بيانات FusionAuth — نحاول عدة احتمالات في البنية لمعالجة أي wrapper
    let fusionUserRaw: any = null;
    try {
      // fusionClient.getUser قد يرجع النتيجة مباشرة أو obj.response.user حسب wrapper
      fusionUserRaw = await this.fusionClient.getUser(id);
      // بعض Wrappers تُرجع resp.response.user
      if (fusionUserRaw && fusionUserRaw.response && fusionUserRaw.response.user) {
        fusionUserRaw = fusionUserRaw.response.user;
      }
      // بعض واجهات قد تُرجع كائن مباشر داخل property "user"
      if (fusionUserRaw && fusionUserRaw.user) {
        fusionUserRaw = fusionUserRaw.user;
      }
    } catch (e) {
      // لو فشل الاتصال بالفيوجن، نكمل مع البيانات المحلية فقط
      fusionUserRaw = null;
    }

    // 3) استخراج الحقول من fusionUserRaw بشكل آمن (تفادي errors بسبب typing)
    const firstNameFromFusion = (fusionUserRaw && (fusionUserRaw.firstName ?? fusionUserRaw['first_name'])) ?? null;
    const lastNameFromFusion  = (fusionUserRaw && (fusionUserRaw.lastName  ?? fusionUserRaw['last_name']))  ?? null;
    const emailFromFusion     = (fusionUserRaw && (fusionUserRaw.email     ?? fusionUserRaw['email']))      ?? null;

    // 4) جلب المواعيد المرتبطة
    const availRows = await db
      .select()
      .from(appointments)
      .where(eq(appointments.doctorId, id))
      .orderBy(appointments.dayOfWeek, appointments.startTime);

    const availabilities = availRows.map(r => ({
      id: r.id,
      dayOfWeek: r.dayOfWeek,
      startTime: r.startTime,
      endTime: r.endTime,
    }));

    // 5) تشكيل الـ profile النهائي — نعطي الأولوية لبيانات FusionAuth إن وُجدت
    const publicProfile: PublicProfile = {
      id: local.id,
      fusionAuthId: local.fusionAuthId,
      firstName: firstNameFromFusion ?? (local as any).firstName ?? null,
      lastName:  lastNameFromFusion  ?? (local as any).lastName  ?? null,
      email:     emailFromFusion     ?? (local as any).email     ?? null,
      city: local.city ?? null,
      specialty: local.specialty ?? null,
      profilePhoto: local.profilePhoto ?? null,
    };

    return {
      profile: publicProfile,
      availabilities,
    };
  }

  update(id: number, updateProfileDto: UpdateProfileDto) {
    return `This action updates a #${id} profile`;
  }

  remove(id: number) {
    return `This action removes a #${id} profile`;
  }

  // ---------------------------
  // Availabilities logic
  // ---------------------------

  // استرجاع الدوامات
  async getAvailabilities(doctorId: string) {
    const rows = await db.select().from(appointments).where(eq(appointments.doctorId, doctorId)).orderBy(appointments.dayOfWeek);
    return rows.map(r => ({
      id: r.id,
      dayOfWeek: r.dayOfWeek,
      startTime: r.startTime,
      endTime: r.endTime,
    }));
  }

  // استبدال كل الدوامات (حذف القديم + إدخال الجديد) — transactional
  async upsertAvailabilities(doctorId: string, items: { dayOfWeek:number, startTime:string, endTime:string }[]) {
    await db.transaction(async (tx) => {
      // optional: تحقق أن doctorId موجود في doctorProfile
      const doctorExists = await tx.select().from(doctorProfile).where(eq(doctorProfile.fusionAuthId, doctorId)).limit(1);
      if (!doctorExists || doctorExists.length === 0) {
        throw new NotFoundException('Doctor not found');
      }

      // delete old
      await tx.delete(appointments).where(eq(appointments.doctorId, doctorId));
      // insert new (bulk)
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

  // حذف دوام معين
  async deleteAvailability(doctorId: string, availabilityId: number) {
    // optional: التحقق أن الصف ينتمي للدكتور
    const deleted = await db.delete(appointments).where(eq(appointments.id, availabilityId)).returning();
    if (!deleted || (Array.isArray(deleted) && deleted.length === 0)) {
      throw new NotFoundException('Availability not found');
    }
    // تأكد ملكيته (لو بدك)
    if (deleted[0].doctorId !== doctorId) {
      // لو غير مطابق، ارجع خطأ صلاحية
      throw new UnauthorizedException('Not allowed to delete this availability');
    }
    return { ok: true };
  }

  // تحديث دوام واحد
  async updateAvailability(doctorId: string, availabilityId: number, item: { dayOfWeek:number, startTime:string, endTime:string }) {
    // تحقق وجود الوسيط
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
      startTime: rows[0].startTime,
      endTime: rows[0].endTime,
    };
  }
}
