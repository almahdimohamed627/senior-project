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
import { ApiTags, ApiOperation, ApiBody, ApiConsumes, ApiParam, ApiBearerAuth } from '@nestjs/swagger';

const UPLOADS_FOLDER = 'uploads';

@ApiTags('Chat')
@ApiBearerAuth()
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('conversations/:userId')
  @ApiOperation({ summary: 'Get conversations for user' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  getConversations(@Param('userId') userId: string) {
    return this.chatService.getUserConversations(userId);
  }

  @Get('messages/:conversationId')
  @ApiOperation({ summary: 'Get messages for conversation' })
  @ApiParam({ name: 'conversationId', description: 'Conversation ID' })
  getMessages(@Param('conversationId') conversationId: string) {
    return this.chatService.getMessages(Number(conversationId));
  }

  @Post('upload-audio')
  @ApiOperation({ summary: 'Upload audio file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        voice: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
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
@ApiOperation({ summary: 'Upload image file' })
@ApiConsumes('multipart/form-data')
@ApiBody({
  schema: {
    type: 'object',
    properties: {
      image: {
        type: 'string',
        format: 'binary',
      },
    },
  },
})
@UseInterceptors(FileInterceptor('image', {
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
    @ApiOperation({ summary: 'Send message' })
    @ApiBody({
      schema: {
        type: 'object',
        properties: {
          conversationId: { type: 'number' },
          senderId: { type: 'string' },
          type: { type: 'string', enum: ['text', 'audio'] },
          text: { type: 'string' },
          audioUrl: { type: 'string' },
        },
      },
    })
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
