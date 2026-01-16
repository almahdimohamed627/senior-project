import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { CreateAdmindashboardDto } from './dto/create-admindashboard.dto';
import { UpdateAdmindashboardDto } from './dto/update-admindashboard.dto';
import { posts } from 'src/db/schema/posts.schema';
import { db } from 'src/db/client';
import { eq } from 'drizzle-orm';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { conversationAI } from 'src/db/schema/chat.schema';
import { doctorProfile, users } from 'src/db/schema/profiles.schema';
import { requests } from 'src/db/schema/request.schema';
import { alias } from 'drizzle-orm/pg-core';

@Injectable()
export class AdmindashboardService {

    private baseUrl:string
    private apiKey:string
    private tenantId:string
    private clientId:string

constructor(private config: ConfigService,)
{   
   this.baseUrl=this.config.get<string>('FUSIONAUTH_BASE_URL') ||'' ;
   this.apiKey=this.config.get<string>('FUSIONAUTH_API_KEY') ||'' ;
   this.tenantId=this.config.get<string>('FUSIONAUTH_TENANT_ID') ||'' ;
   this.clientId=this.config.get<string>('FUSIONAUTH_CLIENT_ID') ||'' ;
}
  create(createAdmindashboardDto: CreateAdmindashboardDto) {
    return 'This action adds a new admindashboard';
  }

  async acceptOrReject(postId:number,key:boolean) {
  if(key){
    await db.update(posts).set({keyStatus:'published'}).where(eq(posts.id,postId))
    return {msg:"post published"}
  }
  else{
    await db.update(posts).set({keyStatus:'rejected'}).where(eq(posts.id,postId))
    return {msg:"post rejected"}
  }
  }

async blockUser(userId: string, isActive: boolean) {
  const url = `${this.baseUrl}/api/user/${userId}`;

  const headers: Record<string, string> = {
    Authorization: this.apiKey,
    'Content-Type': 'application/json',
    'X-FusionAuth-TenantId': this.tenantId,
  };

  const payload = {
    registration: {
      active: isActive,
    },
  };

  const response = await axios.patch(url, payload, { headers });

  return {
    success: true,
    msg: isActive ? 'User unblocked' : 'User blocked',
    data: response.data,
  };
}
  findOne(id: number) {
    return `This action returns a #${id} admindashboard`;
  }

  update(id: number, updateAdmindashboardDto: UpdateAdmindashboardDto) {
    return `This action updates a #${id} admindashboard`;
  }

  remove(id: number) {
    return `This action removes a #${id} admindashboard`;
  }

async returnDiagnosis() {
  // 1. ننشئ نسخة وهمية من جدول المستخدمين خاصة بالدكتور
  const doctorUsers = alias(users, 'doctor_users');

  return await db.select({
    // بيانات التشخيص
    diagnosisId: conversationAI.id,
    status: conversationAI.status,
    createdAt: conversationAI.createdAt,

    // بيانات المريض (من جدول users الأصلي)
    patientFirstName: users.firstName,
    patientLastName: users.lastName,
    patientEmail: users.email,
    patientPhone: users.phoneNumber,

    // بيانات الدكتور (من الجدول المستعار doctorUsers)
    doctorFirstName: doctorUsers.firstName,
    doctorLastName: doctorUsers.lastName,
    doctorEmail: doctorUsers.email,
  })
  .from(conversationAI)
  
  // 2. ربط المريض: نربط conversationAI.userId مع جدول users الأساسي
  .innerJoin(users, eq(users.fusionAuthId, conversationAI.userId))
  
  // 3. ربط الدكتور: نربط conversationAI.doctorId مع جدول doctorUsers المستعار
  // ملاحظة: نستخدم fusionAuthId لأن doctorId في جدول المحادثة هو نفسه fusionAuthId
  .leftJoin(doctorUsers, eq(doctorUsers.fusionAuthId, conversationAI.doctorId));
}
}
