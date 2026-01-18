import { Controller, Get, Post, Body, Patch, Param, Delete, Query, ParseIntPipe, ParseBoolPipe } from '@nestjs/common';
import { AdmindashboardService } from './admindashboard.service';
import { CreateAdmindashboardDto } from './dto/create-admindashboard.dto';
import { UpdateAdmindashboardDto } from './dto/update-admindashboard.dto';

@Controller('admindashboard')
export class AdmindashboardController {
  constructor(private readonly admindashboardService: AdmindashboardService) {}


  @Get('diagnoses') 
  async returnAllDiagnosis() {
    return await this.admindashboardService.returnDiagnosis();
  }
@Patch('block-user/:userId')
  async blockUser(
    @Param('userId') userId: string,
    @Body('is_active') is_active: boolean 
  ) {
    return await this.admindashboardService.toggleUserStatus(userId, is_active);
  }

  @Get('accept-or-reject-post/:postId/:key')
  async acceptOrReject(@Param('postId',ParseIntPipe)postId:number,@Param('key',ParseBoolPipe)key:boolean){
    return await this.admindashboardService.acceptOrReject(postId,key)
  }

  

}
