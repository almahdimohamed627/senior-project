import { Injectable } from '@nestjs/common';
import { desc, eq, or } from 'drizzle-orm';
import { db } from 'src/modules/auth/client';
import { conversations, messages } from 'src/db/schema/chat.schema';
import { users } from 'src/db/schema/profiles.schema';

@Injectable()
export class ChatService {
  // كل المحادثات التي يكون فيها المستخدم دكتور أو مريض
  async getUserConversations(userId: string) {
    return db
      .select()
      .from(conversations)
      .where(
        or(
          eq(conversations.doctorId, userId),
          eq(conversations.patientId, userId),
        ),
      );
  }

  // الرسائل الخاصة بمحادثة معينة (آخر 50 مثلاً)
  async getMessages(conversationId: number, limit = 50) {
    return db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(desc(messages.createdAt))
      .limit(limit);
  }

  // بناء رابط الصوت اعتماداً على مكان التخزين
  async saveAudioFileAndGetUrl(file: Express.Multer.File): Promise<string> {
    // بما أنك عامل static على /uploads، أي ملف في uploads/voices
    // رح يصير متاح على /uploads/voices/<filename>
    return `/uploads/voices/${file.filename}`;
  }

  // إنشاء رسالة جديدة (نصية أو صوتية)
  async createMessage(data: {
    conversationId: number;
    senderId: string;
    type: 'text' | 'audio';
    text?: string;
    audioUrl?: string;
  }) {
    const [created] = await db
      .insert(messages)
      .values({
        conversationId: data.conversationId,
        senderId: data.senderId,
        type: data.type,
        text: data.type === 'text' ? data.text ?? '' : null,
        audioUrl: data.type === 'audio' ? data.audioUrl ?? '' : null,
      })
      .returning();

    return created;
  }

  // جلب محادثة واحدة (مفيد للشات أو الجيتواي)
  async getConversationById(id: number) {
    const [conv] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, id));

    return conv;
  }
  async ensureConversationForRequest(
  requestId: number,
  senderId: string,
  receiverId: string,
) {
  // 1) شوف إذا في محادثة أصلاً لهذا الـ request
  const existing = await db
    .select()
    .from(conversations)
    .where(eq(conversations.requestId, requestId));

  if (existing.length > 0) {
    return existing[0];
  }

  // 2) جيب بيانات المستخدمين (وخصوصاً الـ role)
  const [sender] = await db
    .select({
      fusionAuthId: users.fusionAuthId,
      role: users.role,
    })
    .from(users)
    .where(eq(users.fusionAuthId, senderId));

  const [receiver] = await db
    .select({
      fusionAuthId: users.fusionAuthId,
      role: users.role,
    })
    .from(users)
    .where(eq(users.fusionAuthId, receiverId));

  if (!sender || !receiver) {
    throw new Error('Sender or receiver not found');
  }

  // 3) حدّد مين الدكتور ومين المريض بناءً على role
  let doctorId: string | null = null;
  let patientId: string | null = null;

  if (sender.role === 'doctor' && receiver.role === 'patient') {
    doctorId = sender.fusionAuthId;
    patientId = receiver.fusionAuthId;
  } else if (sender.role === 'patient' && receiver.role === 'doctor') {
    doctorId = receiver.fusionAuthId;
    patientId = sender.fusionAuthId;
  } else {
    // يعني الأدوار ما بتناسب منطق المنصّة
    throw new Error('Invalid roles for chat conversation');
  }

  // 4) أنشئ محادثة جديدة
  const [created] = await db
    .insert(conversations)
    .values({
      requestId,
      doctorId,
      patientId,
    })
    .returning();

  return created;
}
  
}
