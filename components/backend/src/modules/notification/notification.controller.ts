import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import { ApiTags, ApiOperation, ApiParam, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { db } from 'src/db/client';
import { users } from 'src/db/schema/profiles.schema';
import { eq } from 'drizzle-orm';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/role.guard';
import { error } from 'console';

@ApiTags('Notification')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Post()
  @ApiOperation({ summary: 'Create notification' })
  @ApiBody({ type: CreateNotificationDto })
  create(@Body() createNotificationDto: CreateNotificationDto) {
  }

  @Get()
  @ApiOperation({ summary: 'Get all notifications' })
  findAll() {
  }


@Post('fcm-token')
@ApiOperation({ summary: 'Update FCM Token' })
@ApiBearerAuth()
@ApiBody({ schema: { type: 'object', properties: { token: { type: 'string' } } } })
  @UseGuards(JwtAuthGuard, RolesGuard)
async updateFcmToken(
  @CurrentUser() user: any, 
  @Body('token') token: string
) {
  console.log(token)
  console.log("hi")
  console.log(user)
 await this.notificationService.saveToken(token,user).catch((err)=>{'canot apdate fcm token'})  

  return { msg: 'Token updated successfully' };
}

@Get('notifications/:userId')
async returnNotifications(@Param('userId')userId:string){
 return await this.notificationService.returnNotifications(userId)
}

  @Get(':id')
  @ApiOperation({ summary: 'Get notification by ID' })
  @ApiParam({ name: 'id', description: 'Notification ID' })
  findOne(@Param('id') id: string) {
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update notification' })
  @ApiParam({ name: 'id', description: 'Notification ID' })
  @ApiBody({ type: UpdateNotificationDto })
  update(@Param('id') id: string, @Body() updateNotificationDto: UpdateNotificationDto) {
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete notification' })
  @ApiParam({ name: 'id', description: 'Notification ID' })
  remove(@Param('id') id: string) {
  }
}
