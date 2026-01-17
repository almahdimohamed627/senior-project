import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { db } from 'src/db/client';
import { users } from 'src/db/schema/profiles.schema';
import { desc, eq, or } from 'drizzle-orm';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { NotificationService } from '../notification/notification.service';
import { Inject } from '@nestjs/common';



@WebSocketGateway({
  cors: {
    origin: '*', 
  },
})
export class ChatGateway {
  @WebSocketServer()
  server: Server;

  constructor(private readonly chatService: ChatService,@Inject() private notificationService:NotificationService) {}

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
    
    client.disconnect();
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
      type: 'text' | 'audio'|'image';
      text?: string;
      audioUrl?: string;
      imageUrl?: string;
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
      return { error: 'sender is not part of this conversation' }
    }

    let sender=await db.select().from(users).where(eq(users.fusionAuthId,data.senderId))
    let receiver= sender[0].role==='doctor'?
    await db.select().from(users).where(eq(users.fusionAuthId,conversation.patientId))
    :await db.select().from(users).where(eq(users.fusionAuthId,conversation.doctorId))


    const message = await this.chatService.createMessage(data);
   if(receiver[0].fcmToken){
    await this.notificationService.sendAndSave(
      receiver[0].fusionAuthId , 
      receiver[0].role==='doctor'?`you have new message from doctor ${sender[0].firstName}`
      :`you have new message from pateint ${sender[0].firstName}`,
        data.text? data.text:'',
       'sending msg',
       {screen:'ChatList'}
    ).catch(err => console.error("Notification failed", err));
   }
    

    this.server
      .to(`user:${conversation.doctorId}`)
      .to(`user:${conversation.patientId}`)
      .emit('new_message', message);

    return message;
  }
}
