import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { db } from '../../db/client';
import { users } from 'src/db/schema/profiles.schema';
import { desc, eq, or } from 'drizzle-orm';
import axios from 'axios';
import { conversationAI } from 'src/db/schema/chat.schema';




@WebSocketGateway()
export class AiAgentGateway {
  @SubscribeMessage('message')
  handleMessage(client: any, payload: any): string {
    
    return 'Hello world!';
    
  }
  @SubscribeMessage('join-chatboot')
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

  @SubscribeMessage('send_msg_to_ai')
  async handelMsgSending(
    @MessageBody() dto:{msg:string ,conversationId:number,userId:string,age:number},
  @ConnectedSocket() client: Socket,){
   const user = await db
      .select()
      .from(users)
      .where(eq(users.fusionAuthId, dto.userId))
      .limit(1);
  
    if (user.length === 0) {
      
      client.disconnect();
     return { joined: false, reason: 'User not found' };
    }
  if(!db.select().from(conversationAI).where(eq(conversationAI.userId,dto.userId))) {
    return {msg :'there is no conversation'}
  }

  let payload={
    message:dto.msg,       
    age:dto.age,           
    conversationId:dto.conversationId
  }
  let createResponse=await axios.post(process.env.AI_AGENT_URL||'',payload,{
    headers:{'Content-Type': 'application/json'}
  })

  }

}
