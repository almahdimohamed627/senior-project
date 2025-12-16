import { Body, Controller, Inject, Post } from "@nestjs/common";
import { AiAgentService } from "./ai-agent.service";



@Controller('ai-agent')
export class AiAgentController{

constructor(@Inject() private aiAgentSercice:AiAgentService ){}

    @Post('createChat')
    async createchat(@Body() userId:string){
     return this.aiAgentSercice.createConversationWithAi(userId)
    }

    
}