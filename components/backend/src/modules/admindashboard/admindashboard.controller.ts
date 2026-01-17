import { Controller, Get, Post, Body, Patch, Param, Delete, Query, ParseIntPipe, ParseBoolPipe } from '@nestjs/common';
import { AdmindashboardService } from './admindashboard.service';
import { CreateAdmindashboardDto } from './dto/create-admindashboard.dto';
import { UpdateAdmindashboardDto } from './dto/update-admindashboard.dto';

@Controller('admindashboard')
export class AdmindashboardController {
  constructor(private readonly admindashboardService: AdmindashboardService) {}

  // ... (Create, Accept, Block) ...

  // ✅ الحل: ضع هذا المسار هنا (قبل الـ :id)
  @Get('diagnoses') 
  async returnAllDiagnosis() {
    return await this.admindashboardService.returnDiagnosis();
  }
@Patch('block-user/:userId')
  async blockUser(
    @Param('userId') userId: string,
    @Body('is_active') is_active: boolean // يفضل استخدام ParseBoolPipe لو كنت تبعتها كـ string
  ) {
    return await this.admindashboardService.toggleUserStatus(userId, is_active);
  }

}
