import {
  BadRequestException,
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
import path, { extname } from 'path';
const UPLOADS_FOLDER = 'uploads';

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
@Post('uploadImage')
@UseInterceptors(FileInterceptor('photo', {
  storage: diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOADS_FOLDER),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowed.includes(ext)) {
      return cb(new BadRequestException('Only images are allowed (.jpg .jpeg .png .webp)'), false);
    }
    cb(null, true);
  },
}))
 async uploadImage(@UploadedFile() image: Express.Multer.File){
  let imageUrl=await this.chatService.saveImageFileAndGetUrl(image)
  return {imageUrl}
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
