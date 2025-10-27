// src/data-collector/data-collector.module.ts
import { Module } from '@nestjs/common';
import { DataCollectorController } from './data-collector.controller';
import { DataCollectorService } from './data-collector.service';
import { ConfigModule } from '@nestjs/config';
import { BasicAuthGuard } from './basic-auth.guard';

@Module({
  imports: [ConfigModule],
  controllers: [DataCollectorController],
  providers: [DataCollectorService, BasicAuthGuard],
})
export class DataCollectorModule {}
