import { Module } from '@nestjs/common';
import { RequestService } from './request.service';
import { RequestController } from './request.controller';
import { ChatService } from 'src/chat/chat.service';

@Module({
  controllers: [RequestController],
  providers: [RequestService,ChatService],
    exports: [ChatService],
})
export class RequestModule {}
