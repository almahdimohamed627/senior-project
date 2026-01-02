import { Module } from '@nestjs/common';
import { AiAgentController } from './ai-agent.controller';
import { AiAgentService } from './ai-agent.service';

@Module({
  controllers:[AiAgentController],
  providers: [AiAgentService]
})
export class AiAgentModule {}
