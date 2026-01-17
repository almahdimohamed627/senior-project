import { Injectable, UnauthorizedException, NotFoundException, Logger, BadRequestException, ForbiddenException, Inject, InternalServerErrorException, forwardRef } from '@nestjs/common';
import { CreateProfileDto } from './dto/create-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { db } from '../../db/client'; // تأكد المسار صحيح
import { doctorProfile, patientProfile, users } from 'src/db/schema/profiles.schema';
import { appointments } from '../../db/schema/appointments.schema';
import { and, eq, inArray, SQL, sql } from 'drizzle-orm';
import { ConfigService } from '@nestjs/config';
import { FusionAuthClientWrapper } from 'src/modules/auth/fusion-auth.client';

import axios from 'axios';
import {cities, schema} from 'src/db/schema/schema';
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
  phoneNumber?:string | null,
  specialty?: string | null;
  university?: string | null;
  profilePhoto?: string | null;
};


@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name);
  private readonly defaultPhoto = '/uploads/logo.png';
  
  private baseUrl: string = process.env.FUSIONAUTH_BASE_URL || '';
  private apiKey: string = process.env.FUSIONAUTH_API_KEY || '';
constructor(
private config: ConfigService, 
    
    @Inject(forwardRef(() => AuthService)) 
    private authService: AuthService,
    
    private fusionClient: FusionAuthClientWrapper
  ) {
    this.baseUrl = (this.config.get<string>('FUSIONAUTH_BASE_URL') || 'https://auth.almahdi.cloud').replace(/\/$/, '');
    this.apiKey = this.config.get<string>('FUSIONAUTH_API_KEY') || 'aNnC27LYRSW8WBZdni-_kbcsc7O8c00PiMVDRIgcAua4hBD2OpnIMUb9';
    
  }



async findAll(page:number,limit:number) {
   
 const offset = (page - 1) * limit;

  let profiles =await db.select({
    fusionAuthId:users.fusionAuthId,
  firstName:users.firstName,
  lastName:users.lastName,
  email:users.email,
  city:cities,
  gender:users.gender,
  speciality:doctorProfile.specialty,
  university:doctorProfile.university,
  profilePhoto:users.profilePhoto,
  birthYear:users.birthYear,
  phoneNumber:users.phoneNumber,
  role:users.role
  }).from(users).leftJoin(doctorProfile,eq(users.fusionAuthId,doctorProfile.fusionAuthId))
  .leftJoin(patientProfile,eq(users.fusionAuthId,patientProfile.fusionAuthId)).leftJoin(cities,eq(users.city,cities.id)).
  limit(limit).offset(offset)


  return profiles
}

 
 async getAllDoctors(
    specialty?: string | null, 
    city?: number[] | null, 
    gender?: 'male' | 'female' | null,
    page: number = 1,    
    limit: number = 10 
) {
  
  const offset = (page - 1) * limit;

   const conditions:SQL[] = [];
  if (specialty) conditions.push(eq(doctorProfile.specialty, specialty));
  if (city) {
   conditions.push(inArray(users.city, city));
  }
  if (gender) conditions.push(eq(users.gender, gender));

  const data = await db
    .select({
        fusionAuthId: users.fusionAuthId,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        city: cities,
        gender: users.gender,
        specialty: doctorProfile.specialty,
        university: doctorProfile.university,
        profilePhoto: users.profilePhoto,
    })
    .from(doctorProfile)
    .innerJoin(users, eq(doctorProfile.fusionAuthId, users.fusionAuthId)).innerJoin(cities,eq(users.city,cities.id))
    .where(and(...conditions))
    .limit(limit)   
    .offset(offset); 

 
  const [totalResult] = await db
     .select({ count: sql<number>`count(*)` }) 
     .from(doctorProfile)
     .innerJoin(users, eq(doctorProfile.fusionAuthId, users.fusionAuthId))
     .where(and(...conditions)); 

  const totalCount = Number(totalResult.count);

  return {
    doctors: data,
    meta: {
      total: totalCount,
      page: page,
      limit: limit,
      totalPages: Math.ceil(totalCount / limit)
    }
  };
}
  async findOne(id: string) {

    const userRows = await db
      .select()
      .from(users)
      .where(eq(users.fusionAuthId, id))
      .limit(1);

    const baseUser = userRows[0];
    if (!baseUser) {
      throw new NotFoundException('User not found');
    }

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
   console.log((local as any))
    if (!local) {
      throw new NotFoundException('Profile not found');
    }

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

    const availRows = await db
      .select()
      .from(appointments)
      .where(eq(appointments.doctorId, id))
      .orderBy(appointments.dayOfWeek, appointments.startTime);

    const availabilities = availRows.map((r) => ({
      id: r.id,
      dayOfWeek: r.dayOfWeek,
      dayName: this.dayNameFromNumber(r.dayOfWeek),
      startTime: r.startTime,
      endTime: r.endTime,
    }));

    const publicProfile: PublicProfile = {
      id: local.id ?? baseUser.id,
      fusionAuthId: baseUser.fusionAuthId,
      firstName: firstNameFromFusion ?? baseUser.firstName ?? null,
      lastName: lastNameFromFusion ?? baseUser.lastName ?? null,
      email: emailFromFusion ?? null,
      city: userRows[0].city ,
      phoneNumber:userRows[0].phoneNumber,
      specialty: (local as any).specialty ?? null, 
      university: (local as any).university ?? null, 
      
      profilePhoto:
        baseUser.profilePhoto && String(baseUser.profilePhoto).trim() !== ''
          ? baseUser.profilePhoto
          : this.defaultPhoto,
    };
    if(publicProfile.city){
      let city=await db.select().from(cities).where(eq(cities.id,publicProfile.city))
      console.log(city[0])
        return {
      profile: publicProfile,
      availabilities,
      city:city[0]
    };
    }
    
    
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
    const userRows = await db
      .select()
      .from(users)
      .where(eq(users.fusionAuthId, fusionAuthId))
      .limit(1);
    const baseUser = userRows[0];
    if (!baseUser) throw new NotFoundException('user not found');

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

    const userUpdates: Record<string, any> = { updatedAt: new Date() };

    if (dto.profilePhoto) userUpdates.profilePhoto = dto.profilePhoto; 
    if (storedPath) userUpdates.profilePhoto = storedPath; 

    if (dto.city !== undefined) userUpdates.city = dto.city;
    if (dto.gender !== undefined) userUpdates.gender = dto.gender;
    if(dto.firstName!==undefined) userUpdates.firstName=dto.firstName
    if(dto.lastName!==undefined) userUpdates.lastName=dto.lastName
    if(dto.phoneNumber!==undefined) userUpdates.phoneNumber=dto.phoneNumber
    if(dto.birthYear!==undefined) userUpdates.birthYear=dto.birthYear


    if (Object.keys(userUpdates).length > 1) {
      await db
        .update(users)
        .set(userUpdates)
        .where(eq(users.fusionAuthId, fusionAuthId));
    }

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

    let fusionUser: any;
    try {
      fusionUser = await this.authService.getUserById(id);
    } catch (e) {
      throw new NotFoundException('User not found in FusionAuth');
    }

    if (!fusionUser) {
      throw new NotFoundException('User not found in FusionAuth');
    }

    let role: string | undefined;

    if (fusionUser.data && fusionUser.data.role) {
      role = String(fusionUser.data.role);
    }

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

    const deleteUrl = `${this.baseUrl}/api/user/${id}?hardDelete=true`;
    console.log(deleteUrl);
    const headers: Record<string, string> = {
      Authorization: this.apiKey,
    };
    console.log(this.apiKey);
    const tenantId =this.config.get<string>('FUSIONAUTH_TENANT_ID') ||'';
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


    await db
      .delete(schema.users)
      .where(eq(schema.users.fusionAuthId, id));

    if (role === 'doctor') {
      return { message: 'doctor deleted' };
    }

    if (role === 'patient') {
      return { message: 'patient deleted' };
    }

    return {
      message:
        'User deleted from FusionAuth and local DB, but role was: ' +
        role,
    };
  }



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

  private dayNameFromNumber(n: number): string {
    const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    if (typeof n !== 'number' || Number.isNaN(n)) return String(n);
    if (n >= 0 && n <= 6) return names[n];
    if (n >= 1 && n <= 7) return names[n - 1]; 
    return `Day ${n}`;
  }

async createAvailabilities(
  doctorId: string,
  items: { dayOfWeek: number; startTime: string; endTime: string }[],
) {
  const doctorRows = await db
    .select()
    .from(doctorProfile)
    .where(eq(doctorProfile.fusionAuthId, doctorId))
    .limit(1);

  if (doctorRows.length === 0) {
    throw new NotFoundException('Doctor not found');
  }

  const existing = await db
    .select()
    .from(appointments)
    .where(eq(appointments.doctorId, doctorId));

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
      inserted: rowsToInsert,
    };
  }

  const existingSet = new Set(
    existing.map(
      (a) => `${a.dayOfWeek},${a.startTime},${a.endTime}`, 
    ),
  );

  const newAvailabilities = items.filter((i) => {
    const key = `${i.dayOfWeek},${i.startTime},${i.endTime}`;
    return !existingSet.has(key);
  });

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
    inserted: rowsToInsert,

  };
}

 }

