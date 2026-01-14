import { BadRequestException, Inject, Injectable, InternalServerErrorException } from "@nestjs/common";
import { db } from "../../db/client";
import { conversationAI, conversationAiMessages } from "src/db/schema/chat.schema";
import { eq } from "drizzle-orm"
import { users } from "src/db/schema/profiles.schema";
import { ok } from "assert";
import { DentistSpecialty } from "./ai-msg.dto";
import * as path from 'path';
import * as QRCode from 'qrcode'; import * as fs from 'fs';
import { DiagnosesPdfService } from "./diagnoses-pdf.service";
import { Exception } from "handlebars";
import { requests } from "src/db/schema/request.schema";

@Injectable()
export class AiAgentService {


  constructor(
    @Inject() private diagnosesPdfService: DiagnosesPdfService
  ) { }
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


  async returnConversations(userId: string) {
    console.log(userId)
    let convs = await db.select().from(conversationAI).where(eq(conversationAI.userId, userId))
    console.log(convs)
    return { convsations: convs }
  }
  async returnMsgsForConversation(convId: number) {
    let msgs = await db.select().from(conversationAiMessages).where(eq(conversationAiMessages.conversationId, convId))

    return { messages: msgs }
  }

  async saveMessages(
    conversationId: number,
    msg: string,
    ai_response: string,
    speciality?: DentistSpecialty, // تأكد من استيراد النوع
    isFinal?: boolean
  ) {
    // 1. التحقق من وجود المحادثة
    const conversation = await db.select().from(conversationAI).where(eq(conversationAI.id, conversationId));

    if (conversation.length === 0) {
      return { msg: 'the user does not have conversation' };
    }

    if (conversation[0].is_final) {
      throw new BadRequestException('already diagnosed');
    }

    let pdfFileName: string | null = null;
    let qrFileName: string | null = null; // متغير لحفظ اسم ملف الـ QR



    // 2. إذا كانت النتيجة نهائية
    if (isFinal && speciality) {

      // تحديث الحالة أولاً
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


        const fullQrPath = await this.generateAndSaveQRCode(conversationId);
        qrFileName = path.basename(fullQrPath);

        await db
          .update(conversationAI)
          .set({
            pdfReportPath: fullPdfPath,
            qrCodePath: fullQrPath
          })
          .where(eq(conversationAI.id, conversationId));

      } catch (error) {
        console.error("Error generating files (PDF/QR):", error);
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
      pdfReport: pdfFileName,
      qrCode: qrFileName
    };
  }

  async returnPdf(aiConversationId: number) {
    let pdf = await db.select().from(conversationAI).where(eq(conversationAI.id, aiConversationId))

  }


  async completeDiagnosis(aiconversationId: number,requestId:number): Promise<boolean> {
    let diagnosischanged = await db.update(conversationAI).set({ status: 'completed' }).where(eq(conversationAI.id, aiconversationId))
    let requestchanged = await db.update(requests).set({ status: 'completed' }).where(eq(requests.id, aiconversationId))
    let StatusChanged = (diagnosischanged &&requestchanged) ? true : false
    return StatusChanged
  }


  async generateAndSaveQRCode(conversationId: number): Promise<string> {
    try {
      // أ. تحديد مجلد الحفظ واسم ملف الـ QR
      const uploadsDir = path.join(process.cwd(), 'uploads');
      // تأكد من وجود المجلد (احتياطاً)
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      const qrFileName = `qr_code_${conversationId}.png`;
      const qrFilePath = path.join(uploadsDir, qrFileName);

      // ب. تجهيز الرابط الذي سيتم تخزينه داخل الـ QR
      // ملاحظة مهمة جداً: هذا الرابط يجب أن يكون عاماً (Public URL) لكي يتمكن الدكتور من فتحه من جواله
      // يجب أن تجلب الدومين الأساسي من متغيرات البيئة (.env)
      // مثال في ملف .env: API_BASE_URL=https://api.mydentalapp.com
      const baseUrl = 'https://app.almahdi.cloud';

      // هذا هو الرابط الذي جربناه على بوستمان
      const pdfDownloadUrl = `${baseUrl}/ai-agent/returnPdf/${conversationId}`;

      console.log('Generating QR for URL:', pdfDownloadUrl);

      // ج. توليد الـ QR Code كـ ملف (Buffer) وحفظه مباشرة في المسار المحدد
      // نستخدم خيارات لضبط الجودة والألوان
      await QRCode.toFile(qrFilePath, pdfDownloadUrl, {
        errorCorrectionLevel: 'H', // أعلى مستوى لتصحيح الأخطاء (يتحمل تشوهات عند المسح)
        type: 'png',
        width: 400, // حجم الصورة (بكسل)
        margin: 2,  // الهوامش البيضاء حول الكود
        color: {
          dark: '#000000',  // لون النقاط (أسود)
          light: '#ffffff'  // لون الخلفية (أبيض)
        }
      });

      console.log(`QR Code saved successfully at: ${qrFilePath}`);

      // د. إرجاع مسار الصورة المحفوظة
      // يمكنك هنا تحديث الداتابيز لحفظ هذا المسار في حقل جديد مثلاً qr_code_path
      return qrFilePath;

    } catch (error) {
      console.error('Error generating QR Code:', error);
      throw new InternalServerErrorException('Failed to generate QR code.');
    }
  }
}