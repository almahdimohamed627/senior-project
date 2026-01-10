//chat.service.ts
import { Injectable } from '@nestjs/common';
import { desc, eq, or } from 'drizzle-orm';
import { db } from 'src/db/client';
import { conversations, messages } from 'src/db/schema/chat.schema';
import { users } from 'src/db/schema/profiles.schema';

@Injectable()
export class ChatService {
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
