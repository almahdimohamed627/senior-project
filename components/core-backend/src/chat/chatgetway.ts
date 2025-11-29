import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { db } from 'src/auth/client';
import { users } from 'src/db/schema/profiles.schema';
import { desc, eq, or } from 'drizzle-orm';

@WebSocketGateway({
  cors: {
    origin: '*', 
  },
})
export class ChatGateway {
  @WebSocketServer()
  server: Server;

  constructor(private readonly chatService: ChatService) {}

  @SubscribeMessage('join')
  async handleJoin(
    @MessageBody() data: { userId: string },
    @ConnectedSocket() client: Socket,
  ) {
    
    db.select().from(users).where(eq(users.fusionAuthId,data.userId))
    client.join(`user:${data.userId}`);
    return { joined: true };
  }

  @SubscribeMessage('send_message')
  async handleSendMessage(
    @MessageBody()
    data: {
      conversationId: number;
      senderId: string;
      type: 'text' | 'audio';
      text?: string;
      audioUrl?: string;
    },
  ) {
    const conversation =
      await this.chatService.getConversationById(data.conversationId);

    if (!conversation) {
      return { error: 'conversation not found' };
    }

    if (
      conversation.doctorId !== data.senderId &&
      conversation.patientId !== data.senderId
    ) {
      return { error: 'sender is not part of this conversation' };
    }

    const message = await this.chatService.createMessage(data);

    this.server
      .to(`user:${conversation.doctorId}`)
      .to(`user:${conversation.patientId}`)
      .emit('new_message', message);

    return message;
  }
}
