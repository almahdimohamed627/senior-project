import { Controller, Get, Post, Body, Patch, Param, Delete, Query, ParseIntPipe, ParseBoolPipe } from '@nestjs/common';
import { AdmindashboardService } from './admindashboard.service';
import { CreateAdmindashboardDto } from './dto/create-admindashboard.dto';
import { UpdateAdmindashboardDto } from './dto/update-admindashboard.dto';

@Controller('admindashboard')
export class AdmindashboardController {
  constructor(private readonly admindashboardService: AdmindashboardService) {}

  @Post()
  create(@Body() createAdmindashboardDto: CreateAdmindashboardDto) {
    return this.admindashboardService.create(createAdmindashboardDto);
  }

@Get("accept-or-reject-post/:postId/:key") // 1. نحدد المتغيرات في الرابط
acceptOrReject(
  @Param('postId', ParseIntPipe) postId: number, // 2. نستخدم Param مع Pipe للتحويل لرقم
  @Param('key', ParseBoolPipe) key: boolean      // 3. نستخدم Param مع Pipe للتحويل لـ boolean
) {
  return this.admindashboardService.acceptOrReject(postId, key);
}



  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.admindashboardService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateAdmindashboardDto: UpdateAdmindashboardDto) {
    return this.admindashboardService.update(+id, updateAdmindashboardDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.admindashboardService.remove(+id);
  }
}
