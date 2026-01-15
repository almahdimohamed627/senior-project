import { Module } from '@nestjs/common';
import { AdmindashboardService } from './admindashboard.service';
import { AdmindashboardController } from './admindashboard.controller';

@Module({
  controllers: [AdmindashboardController],
  providers: [AdmindashboardService],
})
export class AdmindashboardModule {}
