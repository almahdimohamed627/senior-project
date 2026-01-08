import {
    Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('conversations/:userId')
  getConversations(@Param('userId') userId: string) {
    return this.chatService.getUserConversations(userId);
  }

  @Get('messages/:conversationId')
  getMessages(@Param('conversationId') conversationId: string) {
    return this.chatService.getMessages(Number(conversationId));
  }

  @Post('upload-audio')
  @UseInterceptors(
    FileInterceptor('voice', {
      storage: diskStorage({
        destination: 'uploads/voices',
        filename: (req, file, cb) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          cb(null, uniqueSuffix + ext);
        },
      }),
    }),
  )
  async uploadAudio(@UploadedFile() voice: Express.Multer.File) {
    const audioUrl = await this.chatService.saveAudioFileAndGetUrl(voice);
    return { audioUrl };
  }
    @Post('message')
  async sendMessage(
    @Body()
    body: {
      conversationId: number;
      senderId: string;
      type: 'text' | 'audio';
      text?: string;
      audioUrl?: string;
    },
  ) {
    return this.chatService.createMessage({
      conversationId: body.conversationId,
      senderId: body.senderId,
      type: body.type,
      text: body.text,
      audioUrl: body.audioUrl,
    });
  }
}
