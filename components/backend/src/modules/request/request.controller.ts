import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { RequestService } from './request.service';

@Controller('request')
export class RequestController {
  constructor(private readonly requestService: RequestService) {}

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
      requestId:number
    },
  ) {
    const { accepted, requestId } = body;
    return this.requestService.acceptOrReject(accepted, requestId);
  }

  @Post('cancel')
  async cancelRequest(
    @Body() body: { senderId: string; receiverId: string },
  ) {
    const { senderId, receiverId } = body;
    return this.requestService.cancelRequest(senderId, receiverId);
  }

  @Get('user/:userId/received')
  async getReceivedRequests(@Param('userId') userId: string,@Query('status')status?:'accepted'|'rejected'|'pending'|null) {
   
    return this.requestService.getReceivedRequests(userId,status);
  }

  @Get('user/:userId/sent')
  async getSentRequests(@Param('userId') userId: string) {
    return this.requestService.getSentRequests(userId);
  }

  @Get('user/:userId/accepted')
  async getAcceptedRelations(@Param('userId') userId: string) {
    return this.requestService.getAcceptedRelations(userId);
  }
}
