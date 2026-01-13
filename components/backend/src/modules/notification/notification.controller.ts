import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import { ApiTags, ApiOperation, ApiParam, ApiBody, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Notification')
@ApiBearerAuth()
@Controller('notification')
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
