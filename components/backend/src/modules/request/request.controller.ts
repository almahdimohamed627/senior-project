import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { RequestService } from './request.service';

@Controller('request')
export class RequestController {
  constructor(private readonly requestService: RequestService) {}

  // إرسال طلب جديد بين مستخدمين (طالب/مريض)
  @Post('send')
  async sendRequest(
    @Body() body: { senderId: string; receiverId: string },
  ) {
    const { senderId, receiverId } = body;
    return this.requestService.sendRequest(senderId, receiverId);
  }

  // قبول أو رفض طلب
  @Post('accept-or-reject')
  async acceptOrRejectRequest(
    @Body()
    body: {
      accepted: boolean;
      senderId: string;
      receiverId: string;
    },
  ) {
    const { accepted, senderId, receiverId } = body;
    return this.requestService.acceptOrReject(accepted, senderId, receiverId);
  }

  // إلغاء طلب (قبل ما ينقبل)
  @Post('cancel')
  async cancelRequest(
    @Body() body: { senderId: string; receiverId: string },
  ) {
    const { senderId, receiverId } = body;
    return this.requestService.cancelRequest(senderId, receiverId);
  }

  // كل الطلبات الواردة للمستخدم (receiver) – تقدر تستخدمها كـ "Inbox"
  @Get('user/:userId/received')
  async getReceivedRequests(@Param('userId') userId: string) {
    return this.requestService.getReceivedRequests(userId);
  }

  // كل الطلبات اللي أرسلها المستخدم (sender)
  @Get('user/:userId/sent')
  async getSentRequests(@Param('userId') userId: string) {
    return this.requestService.getSentRequests(userId);
  }

  // كل العلاقات المقبولة (accepted) للمستخدم (سواء كان sender أو receiver)
  @Get('user/:userId/accepted')
  async getAcceptedRelations(@Param('userId') userId: string) {
    return this.requestService.getAcceptedRelations(userId);
  }
}
