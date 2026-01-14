//chat.service.ts
import { Injectable } from '@nestjs/common';
import { desc, eq, or ,and} from 'drizzle-orm';
import { db } from 'src/db/client';
import { conversationAI, conversations, messages } from 'src/db/schema/chat.schema';
import { doctorProfile, patientProfile, users } from 'src/db/schema/profiles.schema';

@Injectable()
export class ChatService {
async getUserConversations(userId: string) {
  // 1. نجلب المستخدم لنعرف الرول
  const userList = await db.select().from(users).where(eq(users.fusionAuthId, userId));
  const currentUser = userList[0];
  const isDoctor = currentUser.role === 'doctor';

  // 2. نجهز الاستعلام بناءً على الرول
  // لاحظ أننا أضفنا orderBy لترتيب الرسائل تنازلياً (الأحدث أولاً)
  const rawData = await db.select()
    .from(conversations)
    .where(eq(isDoctor ? conversations.doctorId : conversations.patientId, userId))
    .leftJoin(users, eq(users.fusionAuthId, isDoctor ? conversations.patientId : conversations.doctorId))
    .leftJoin(messages, eq(messages.conversationId, conversations.id)).
    leftJoin(conversationAI,and(eq(conversationAI.userId,conversations.patientId),eq(conversationAI.status,'completed')))
    .orderBy(desc(messages.createdAt)); 


  // 3. نفلتر النتائج لأخذ أحدث رسالة فقط لكل محادثة
  const uniqueConversations = new Map();
  const infoKey = isDoctor ? 'patientInfo' : 'doctorInfo';

  for (const item of rawData) {
    console.log(item)
    const convId = item.conversations.id;
    // لأننا رتبنا البيانات، أول مرة بتظهر فيها المحادثة بتكون مع أحدث رسالة
    if (!uniqueConversations.has(convId)) {
      uniqueConversations.set(convId, {
        conversation: item.conversations,
        [infoKey]: item.users,
        conversationAi:isDoctor?item.conversation_ai:null,
        lastMessage: item.messages // هذه هي آخر رسالة
      });
    }
  }

  // 4. نرجع القيم كمصفوفة
  return Array.from(uniqueConversations.values());
}

  async getMessages(conversationId: number, limit = 50) {
    return db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(desc(messages.createdAt))
      .limit(limit);
  }

  async saveAudioFileAndGetUrl(file: Express.Multer.File): Promise<string> {

    return `/uploads/voices/${file.filename}`;
  }
  async saveImageFileAndGetUrl(file: Express.Multer.File): Promise<string> {
    return `/uploads/${file.filename}`;
  }

  async createMessage(data: {
    conversationId: number;
    senderId: string;
    type: 'text' | 'audio'|'image';
    text?: string;
    audioUrl?: string;
    imageUrl?: string;
  }) {
    const [created] = await db
      .insert(messages)
      .values({
        conversationId: data.conversationId,
        senderId: data.senderId,
        type: data.type,
        text: data.type === 'text' ? data.text ?? '' : null,
        audioUrl: data.type === 'audio' ? data.audioUrl ?? '' : null,
        imageUrl: data.type === 'image' ? data.imageUrl ?? '' : null,
      })
      .returning();

    return created;
  }

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
  const existing = await db
    .select()
    .from(conversations)
    .where(eq(conversations.requestId, requestId));

  if (existing.length > 0) {
    return existing[0];
  }

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

  let doctorId: string | null = null;
  let patientId: string | null = null;

  if (sender.role === 'doctor' && receiver.role === 'patient') {
    doctorId = sender.fusionAuthId;
    patientId = receiver.fusionAuthId;
  } else if (sender.role === 'patient' && receiver.role === 'doctor') {
    doctorId = receiver.fusionAuthId;
    patientId = sender.fusionAuthId;
  } else {
    throw new Error('Invalid roles for chat conversation');
  }

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
