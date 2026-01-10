import { BadRequestException, Body, Controller, Get, HttpCode, HttpStatus, Inject, Param, Post, Query, Res, StreamableFile, UploadedFile, UseInterceptors } from "@nestjs/common";
import { AiAgentService } from "./ai-agent.service";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import path from "path";
import { AiMessage } from "./ai-msg.dto";
import { DiagnosesPdfService } from "./diagnoses-pdf.service";
import { PassThrough } from "stream";
import { createReadStream } from "fs";
const UPLOADS_FOLDER = 'uploads';


@Controller('ai-agent')
export class AiAgentController{

constructor(@Inject() private aiAgentSercice:AiAgentService,
 @Inject() private diagnosisPdfService:DiagnosesPdfService){}
   


 @UseInterceptors(FileInterceptor('toothPhoto', {
  storage: diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOADS_FOLDER),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, 
  fileFilter: (_req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowed.includes(ext)) {
      return cb(new BadRequestException('Only images are allowed (.jpg .jpeg .png .webp)'), false);
    }
    cb(null, true);
  },
}))
@HttpCode(HttpStatus.OK)
@Post('createChat')
async createchat(
  @Body('userId') userId: string,
    @UploadedFile() file: Express.Multer.File
) {
 if (!file) throw new BadRequestException('Please upload a photo');

  const storedPath = `/uploads/${file.filename}`;
  return await this.aiAgentSercice.createConversationWithAi(userId, storedPath);
}


@Get('conversations/:userId')
async getConversations(@Param('userId') userId: string) {
  return this.aiAgentSercice.returnConversations(userId);
}

@Get('conversation-msgs/:conversationId')
async returnMsgs(@Param('conversationId')conversationId:number){
 return await this.aiAgentSercice.returnMsgsForConversation(conversationId)
}

@Post('save-msg')
async saveMsg(@Body() saveMsgDto:AiMessage){
    return await this.aiAgentSercice.saveMessages(
      saveMsgDto.conversationId,
      saveMsgDto.msg,
      saveMsgDto.AiResponse,
      saveMsgDto.speciality,saveMsgDto.isFinal)
}

@Post('returnPdf/:aiConversationId')
  async returnDiagnosisPdf(
    @Param('aiConversationId') aiConversationId: number,
  ): Promise<StreamableFile> {
    
    const pdfPath = await this.diagnosisPdfService.getPdfPath(Number(aiConversationId));
  console.log(pdfPath)
    const file = createReadStream(pdfPath);

    return new StreamableFile(file, {
      type: 'application/pdf',
      disposition: `attachment; filename="diagnosis_${aiConversationId}.pdf"`,
    });
  }

    
}