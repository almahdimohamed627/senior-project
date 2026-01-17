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


 type diagnosidInf={
  diagnoses:{
       diagnosisId: number,
    status:  'in_progress'|'specified'|'completed',
    speciality:  'Restorative'|'Endodontics'|'Periodontics'|'Fixed_prosthodontics'|'Removable_prosthodontics'|'Pediatric_dentistry',
    image:string,
    diagnosisPdf:string,
    createdAt: Date,
  }
   
,patientInfo:{
      patientFirstName: string,
    patientLastName: string,
    patientEmail: string,
    patientPhone: string,
}
,doctorInfo:{
      doctorFirstName: string,
    doctorLastName: string,
    doctorEmail: string,
}

}
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

async toggleUserStatus(userId: string, shouldBeActive: boolean) {
    const url = `${this.baseUrl}/api/user/${userId}/?reactivate=true`;

    const headers: Record<string, string> = {
      Authorization: this.apiKey,
      'Content-Type': 'application/json',
    };

    if (this.tenantId) {
      headers['X-FusionAuth-TenantId'] = this.tenantId;
    }

    try {
      if (shouldBeActive) {
        console.log(`Reactivating user: ${userId}`);
        await axios.put(url, { user: { active: true } }, { headers });
      } else {
        console.log(`Soft Deleting (Blocking) user: ${userId}`);
        await axios.delete(url, { headers });
      }

      return {
        success: true,
        msg: shouldBeActive ? 'تم رفع الحظر عن المستخدم ✅' : 'تم حظر المستخدم بنجاح ⛔️',
        currentStatus: shouldBeActive ? 'active' : 'blocked'
      };

    } catch (e: any) {
      console.error(
        'Failed to toggle user status',
        e?.response?.data || e?.message || e,
      );
      throw new InternalServerErrorException('فشلت عملية تغيير حالة المستخدم');
    }
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

  let diagnosisInfo= await db.select({
    // بيانات التشخيص
    diagnosisInfo:{
      diagnosisId: conversationAI.id,
status: conversationAI.status,
speciality:conversationAI.specialityE,
image:conversationAI.image_path,
diagnosisPdf:conversationAI.pdfReportPath,
createdAt: conversationAI.createdAt,},


    // بيانات المريض (من جدول users الأصلي)
patientInfo: {   patientFirstName: users.firstName,
    patientLastName: users.lastName,
    patientEmail: users.email,
    patientPhone: users.phoneNumber,},
   doctorInfo:{
      doctorFirstName: doctorUsers.firstName,
    doctorLastName: doctorUsers.lastName,
    doctorEmail: doctorUsers.email,}
  
  })
  .from(conversationAI)
  
  .innerJoin(users, eq(users.fusionAuthId, conversationAI.userId))
  

  .leftJoin(doctorUsers, eq(doctorUsers.fusionAuthId, conversationAI.doctorId));

return diagnosisInfo
}
}
