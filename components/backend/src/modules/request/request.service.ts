import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, inArray, or } from 'drizzle-orm';
import { db } from 'src/db/client';
import { ChatService } from 'src/modules/chat/chat.service';
import { patientProfile, users } from 'src/db/schema/profiles.schema';
import { requests } from 'src/db/schema/request.schema';
import { conversationAI, conversations } from 'src/db/schema/chat.schema';
import { cities } from 'src/db/schema/cities.schema';

 type PatientProfile={
   request:{
                 id: number,
            senderId: string,
            receiverId: string,
            status: 'accepted'|'rejected'|'pending',
            createdAt:Date,
            updatedAt: Date

   }
  patientInformation:{
      fusionAuthId: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  gender:string|null,
  city?: object | null;
  phoneNumber?:string | null,
  specialty?: string | null;
  diagnosisPhoto?:string|null;
  profilePhoto?: string | null;
} 

  }

@Injectable()
export class RequestService {
  constructor( private chatService: ChatService) {}

  async getReceivedRequests(
  userId: string,
  status?: 'accepted' | 'rejected' | 'pending' | null,
) {
  let userRequests;

  if (status) {
    userRequests = await db
      .select()
      .from(requests)
      .where(
        and(
          eq(requests.receiverId, userId),
          eq(requests.status, status),
        ),
      );
  } else {
    userRequests = await db
      .select()
      .from(requests)
      .where(eq(requests.receiverId, userId));
  }

  const rows: PatientProfile[] = await Promise.all(
    userRequests.map(async (req) => {
      const [patient] = await db
        .select({
          fusionAuthId:users.fusionAuthId,
          firstName:users.firstName,
          lastName:users.lastName,
          gender:users.gender,
          city:cities,
         email: users.email,
          phoneNumber:users.phoneNumber,
          profilePhoto:users.profilePhoto
        })
        .from(users)
        .where(eq(users.fusionAuthId, req.senderId)).innerJoin(cities,eq(users.city,cities.id))
        ;

      if (!patient) return null;

      const [speciality] = await db
        .select()
        .from(conversationAI)
        .where(eq(conversationAI.userId, req.senderId));
        

      const row: PatientProfile = {
        request: {
          id: req.id,
          senderId: req.senderId,
          receiverId: req.receiverId,
          status: req.status,
          createdAt: req.createdAt,
          updatedAt: req.updatedAt,
        },
        patientInformation:{
                fusionAuthId: patient.fusionAuthId,
        firstName: patient.firstName,
        lastName: patient.lastName,
        email: patient.email,
        gender:patient.gender,
        phoneNumber: patient.phoneNumber,
        specialty: speciality?.specialityE ?? null,
        diagnosisPhoto:speciality?.image_path??null,
        city: patient.city,
        profilePhoto: patient.profilePhoto,
        },
    
  
      };

      return row;
    }),
  ).then(r => r.filter(Boolean) as PatientProfile[]);

  return rows;
}

  async getRequstById(requestId:number){
    let request=await db.select().from(requests).where(eq(requests.id,requestId))
    let patient=await db.select().from(users).where(eq(users.fusionAuthId,request[0].senderId))
    console.log(patient[0])
    let diagnosisInfo=await db.select().from(conversationAI).where(eq(conversationAI.userId,request[0].senderId))
    
   let city=await db.select().from(cities).where(eq(cities.id,Number(patient[0].city)))
    if(request[0].status==='accepted'&&request){
      let conver=await db.select().from(conversations).where(eq(conversations.requestId,requestId))
     return{
       request:request[0],
       conversation:conver[0],
       patientInfo:{...patient[0],city:city[0]},
   
       diagnosisInfo:diagnosisInfo[0]

     }
    }
    return {
      request:request[0],
      diagnosisInfo:diagnosisInfo[0],
      patientInfo:patient[0],
    }
  }


  async getSentRequests(userId: string) {
    return db
      .select()
      .from(requests)
      .where(eq(requests.senderId, userId));
  }

  async getAcceptedRelations(userId: string) {
    const asSender = await db
      .select()
      .from(requests)
      .where(
        and(
          eq(requests.senderId, userId),
          eq(requests.status, 'accepted'),
        ),
      );

    const asReceiver = await db
      .select()
      .from(requests)
      .where(
        and(
          eq(requests.receiverId, userId),
          eq(requests.status, 'accepted'),
        ),
      );

    return {
      asSender,
      asReceiver,
    };
  }

 async sendRequest(senderId: string, receiverId: string) {
  if (senderId === receiverId) {
    throw new BadRequestException('cannot send request to yourself');
  }

  return db.transaction(async (tx) => {
    const [sender] = await tx
      .select({
        id: users.fusionAuthId,
        role: users.role,
      })
      .from(users)
      .where(eq(users.fusionAuthId, senderId));

    const [receiver] = await tx
      .select({
        id: users.fusionAuthId,
        role: users.role,
      })
      .from(users)
      .where(eq(users.fusionAuthId, receiverId));

    if (!sender || !receiver) {
      throw new NotFoundException('sender or receiver not found');
    }

    const isDoctorPatientPair =
      (sender.role === 'doctor' && receiver.role === 'patient') ||
      (sender.role === 'patient' && receiver.role === 'doctor');

    if (!isDoctorPatientPair) {
      throw new BadRequestException(
        'invalid request: roles not compatible',
      );
    }

    const pairCondition = this.buildPairCondition(senderId, receiverId);

    const existing = await tx
      .select({ id: requests.id })
      .from(requests)
      .where(
        and(
          pairCondition,
          inArray(requests.status, ['pending', 'accepted']),
        ),
      );

    if (existing.length > 0) {
      throw new ConflictException(
        'request already exists or already accepted',
      );
    }

    const [created] = await tx
      .insert(requests)
      .values({
        senderId,
        receiverId,
      })
      .returning();

    return created;
  });
}

  async acceptOrReject(accepted: boolean, requestId:number) {
    const newStatus = accepted ? 'accepted' : 'rejected';
     
   
    if (newStatus === 'accepted') {
      await db.update(requests).set({status:'accepted'}).where(eq(requests.id,requestId))
       let request=await db.select().from(requests).where(eq(requests.id,requestId))
      let conversation=await this.chatService.ensureConversationForRequest(
        request[0].id,
        request[0].senderId,
        request[0].receiverId,
      );
      return {request,conversation:conversation}
    }else{
      await db.update(requests).set({status:'rejected'}).where(eq(requests.id,requestId))
      return {msg:'request rejected'}
    }


   // return {request};
  }

  async cancelRequest(senderId: string, receiverId: string) {
    const deleted = await db
      .delete(requests)
      .where(
        and(
          eq(requests.senderId, senderId),
          eq(requests.receiverId, receiverId),
          eq(requests.status, 'pending'),
        ),
      )
      .returning({ id: requests.id });

    if (!deleted.length) {
      return 'no pending request to cancel';
    }

    return 'request cancelled';
  }

  async getOrder(requestId:number){
   let request=await db.select().from(requests).where(eq(requests.id,requestId))
   let diagnosisInfo=await db.select().from(conversationAI).where(eq(conversationAI.userId,request[0].senderId))
   let patient=await db.select().from(users).where(eq(users.fusionAuthId,request[0].senderId))
   
   return{
      patientInfo:patient[0],
      diagnosisInfo:diagnosisInfo[0],
      requestInfo:request[0]

   }
  }

  private buildPairCondition(userA: string, userB: string) {
    return or(
      and(eq(requests.senderId, userA), eq(requests.receiverId, userB)),
      and(eq(requests.senderId, userB), eq(requests.receiverId, userA)),
    );
  }
}
