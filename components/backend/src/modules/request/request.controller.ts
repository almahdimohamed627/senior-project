import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { RequestService } from './request.service';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiParam, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Request')
@ApiBearerAuth()
@Controller('request')
export class RequestController {
  constructor(private readonly requestService: RequestService) {}

  @Post('send')
  @ApiOperation({ summary: 'Send a request' })
  @ApiBody({ schema: { type: 'object', properties: { senderId: { type: 'string' }, receiverId: { type: 'string' } } } })
  async sendRequest(
    @Body() body: { senderId: string; receiverId: string },
  ) {
    const { senderId, receiverId } = body;
    return this.requestService.sendRequest(senderId, receiverId);
  }





  // قبول أو رفض طلب
  @Post('accept-or-reject')
  @ApiOperation({ summary: 'Accept or reject a request' })
  @ApiBody({ schema: { type: 'object', properties: { accepted: { type: 'boolean' }, requestId: { type: 'number' } } } })
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
  @ApiOperation({ summary: 'Cancel a request' })
  @ApiBody({ schema: { type: 'object', properties: { senderId: { type: 'string' }, receiverId: { type: 'string' } } } })
  async cancelRequest(
    @Body() body: { senderId: string; receiverId: string },
  ) {
    const { senderId, receiverId } = body;
    return this.requestService.cancelRequest(senderId, receiverId);
  }

  @Get('user/:userId/received')
  @ApiOperation({ summary: 'Get received requests' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiQuery({ name: 'status', required: false, enum: ['accepted', 'rejected', 'pending'] })
  async getReceivedRequests(@Param('userId') userId: string,@Query('status')status?:'accepted'|'rejected'|'pending'|'completed'|null) {
   
    return this.requestService.getReceivedRequests(userId,status);
  }

  @Get('user/:userId/sent')
  @ApiOperation({ summary: 'Get sent requests' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  async getSentRequests(@Param('userId') userId: string) {
    return this.requestService.getSentRequests(userId);
  }

  @Get('user/:requestId')
  @ApiOperation({ summary: 'Get request by ID' })
  @ApiParam({ name: 'requestId', description: 'Request ID' })
  async returnRequest(@Param('requestId')requestId:number){
    console.log(requestId)
     return this.requestService.getRequstById(requestId)
  }

  // @Get('order')
  // async returnOrder(@Param('requstId')requstId:number){
  //   return await this.requestService.getOrder(requstId)
  // }
}
