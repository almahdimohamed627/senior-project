import { Module } from '@nestjs/common';
import { AiAgentController } from './ai-agent.controller';
import { AiAgentService } from './ai-agent.service';
import { DiagnosesPdfService } from './diagnoses-pdf.service';

@Module({
  controllers:[AiAgentController],
  providers: [AiAgentService,DiagnosesPdfService]
})
export class AiAgentModule {}
