import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { db } from 'src/modules/auth/client';
import { users } from 'src/db/schema/profiles.schema';
import { desc, eq, or } from 'drizzle-orm';
import { conversations } from 'src/db/schema/chat.schema';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/modules/auth/guards/role.guard';
import { Roles } from 'src/modules/auth/decorators/role.decorator';
import { Role } from 'src/enums/role.enum';

@WebSocketGateway({
  cors: {
    origin: '*', 
  },
})
export class ChatGateway {
  @WebSocketServer()
  server: Server;

  constructor(private readonly chatService: ChatService) {}

//   @UseGuards(JwtAuthGuard, RolesGuard)
//   @Roles(Role.DOCTOR, Role.PATIENT)
@SubscribeMessage('join')
async handleJoin(
  @MessageBody() data: { userId: string },
  @ConnectedSocket() client: Socket,
) {
  const user = await db
    .select()
    .from(users)
    .where(eq(users.fusionAuthId, data.userId))
    .limit(1);

  if (user.length === 0) {
    
    client.disconnected;
   return { joined: false, reason: 'User not found' };
  }

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
