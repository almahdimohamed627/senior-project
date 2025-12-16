import { Module } from '@nestjs/common';
import { AiAgentGateway } from './ai-agent.gateway';

@Module({
  providers: [AiAgentGateway]
})
export class AiAgentModule {}
