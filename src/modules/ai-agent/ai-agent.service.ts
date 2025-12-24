import { Injectable } from "@nestjs/common";
import { db } from "../../db/client";
import { conversationAI, conversationAiMessages } from "src/db/schema/chat.schema";
import {eq} from "drizzle-orm" 
import { users } from "src/db/schema/profiles.schema";



@Injectable()
export class AiAgentService{



    async createConversationWithAi(userId:string){
      
        let row=await db.select().from(conversationAI).where(eq(conversationAI.userId,userId))

        if(row.length>0){
            return row[0]
        }
      
      let inserted=await  db.insert(conversationAI).values({userId:userId})
      console.log(inserted)

    }

  async saveMessages(
  userId: string,
  conversationId: number,
  msg: string,
  age: number,
  role: 'human'|'ai',   
) {
  const user = await db
    .select()
    .from(users)
    .where(eq(users.fusionAuthId, userId));

  if (user.length === 0) {
    return { msg: 'user not found' };
  }

  await db.insert(conversationAiMessages).values({
    conversationId,
    role,      // هلق نوعه مضبوط: 'human' | 'ai'
    text: msg,
  });

  return { msg: 'saved' };
}
}