import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { db } from "../../db/client";
import { conversationAI, conversationAiMessages } from "src/db/schema/chat.schema";
import {eq} from "drizzle-orm" 
import { users } from "src/db/schema/profiles.schema";
import { ok } from "assert";
import { DentistSpecialty } from "./ai-msg.dto";
import * as path from 'path'; // 👈 ضروري لاستخراج اسم الملف

// 👇 استيراد سيرفس الـ PDF
import { DiagnosesPdfService } from "./diagnoses-pdf.service";
import { Exception } from "handlebars";

@Injectable()
export class AiAgentService{


constructor(
    @Inject() private diagnosesPdfService: DiagnosesPdfService
  ) {}
async createConversationWithAi(userId: string, storedPath: string) {
  if (!storedPath) {
    throw new BadRequestException('please upload photo');
  }

  const inserted = await db
    .insert(conversationAI)
    .values({
      userId: userId,
      image_path: storedPath,
    })
    .returning(); 

  return {
    msg: 'chat created',
    conversation: inserted[0], 
  };
}


   async returnConversations(userId:string){
    console.log(userId)
    let convs=await db.select().from(conversationAI).where(eq(conversationAI.userId,userId))
    console.log(convs)
    return {convsations:convs}
   }
   async returnMsgsForConversation(convId:number){
     let msgs=await db.select().from(conversationAiMessages).where(eq(conversationAiMessages.conversationId,convId))

     return {messages:msgs}
   }

async saveMessages(
    conversationId: number,
    msg: string,
    ai_response: string,
    speciality?: DentistSpecialty,
    isFinal?: boolean
  ) {
    const conversation = await db.select().from(conversationAI).where(eq(conversationAI.id, conversationId));
    if (conversation.length === 0) {
      return { msg: 'the user does not have conversation' };
    }
         if (conversation[0].is_final) {
    throw new BadRequestException('already diagnosed');
  }

    let pdfFileName:string|null = null; 


    if (isFinal && speciality) {
      

      await db
        .update(conversationAI)
        .set({
          is_final: true,
          specialityE: speciality,
          status: 'specified'
        })
        .where(eq(conversationAI.id, conversationId));

      try {
        const fullPdfPath = await this.diagnosesPdfService.generateDiagnosisPdf(conversationId);
        
        pdfFileName = path.basename(fullPdfPath); 

        await db
          .update(conversationAI)
          .set({
            pdfReportPath: pdfFileName 
          })
          .where(eq(conversationAI.id, conversationId));

      } catch (error) {
        console.error("Error generating PDF:", error);
      }
    }

    let row = await db.insert(conversationAiMessages).values({
      conversationId: conversationId,
      msg: msg,
      ai_response: ai_response
    }).returning();

    return { 
      msg: 'saved', 
      information: row[0],
      pdfReport: pdfFileName 
    };
  }
}