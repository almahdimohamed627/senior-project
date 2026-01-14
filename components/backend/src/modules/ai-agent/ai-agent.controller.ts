import { BadRequestException, Body, Controller, Get, HttpCode, HttpStatus, Inject, Param, Post, Query, Res, StreamableFile, UploadedFile, UseInterceptors } from "@nestjs/common";
import { AiAgentService } from "./ai-agent.service";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import path from "path";
import { AiMessage } from "./ai-msg.dto";
import { DiagnosesPdfService } from "./diagnoses-pdf.service";
import { PassThrough } from "stream";
import { createReadStream } from "fs";
import { ApiTags, ApiOperation, ApiBody, ApiConsumes, ApiParam, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

const UPLOADS_FOLDER = 'uploads';


@ApiTags('AI Agent')
@ApiBearerAuth()
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
@ApiOperation({ summary: 'Create chat with AI agent (upload photo)' })
@ApiConsumes('multipart/form-data')
@ApiBody({
  schema: {
    type: 'object',
    properties: {
      userId: { type: 'string' },
      toothPhoto: {
        type: 'string',
        format: 'binary',
      },
    },
  },
})
async createchat(
  @Body('userId') userId: string,
    @UploadedFile() file: Express.Multer.File
) {
 if (!file) throw new BadRequestException('Please upload a photo');

  const storedPath = `/uploads/${file.filename}`;
  return await this.aiAgentSercice.createConversationWithAi(userId, storedPath);
}


@Get('conversations/:userId')
@ApiOperation({ summary: 'Get conversations for user' })
@ApiParam({ name: 'userId', description: 'User ID' })
async getConversations(@Param('userId') userId: string) {
  return this.aiAgentSercice.returnConversations(userId);
}

@Get('conversation-msgs/:conversationId')
@ApiOperation({ summary: 'Get messages for conversation' })
@ApiParam({ name: 'conversationId', description: 'Conversation ID' })
async returnMsgs(@Param('conversationId')conversationId:number){
 return await this.aiAgentSercice.returnMsgsForConversation(conversationId)
}

@Post('save-msg')
@ApiOperation({ summary: 'Save AI message' })
@ApiBody({ type: AiMessage })
async saveMsg(@Body() saveMsgDto:AiMessage){
    return await this.aiAgentSercice.saveMessages(
      saveMsgDto.conversationId,
      saveMsgDto.msg,
      saveMsgDto.AiResponse,
      saveMsgDto.speciality,saveMsgDto.isFinal)
}

@Post('returnPdf/:aiConversationId')
@ApiOperation({ summary: 'Download diagnosis PDF' })
@ApiParam({ name: 'aiConversationId', description: 'AI Conversation ID' })
@ApiResponse({ status: 200, description: 'PDF file stream' })
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

  @Post("completeDiagnosis")
  async completeDiagnosis(@Body('conversationId')conversationId:number,@Body('requestId')requestId:number){
    let status= await this.aiAgentSercice.completeDiagnosis(conversationId,requestId)
    if(status){
       return {msg:'status changes'}
    }
    else{
    return {msg:'can not changed because the backend is very super hero'}
    }
     
  }
@Get('diagnosesForPatient')
async returnDiagnoses(@Query('patientId')patientId:string){
  return await this.aiAgentSercice.returnDiagnosesForPatient(patientId)
}

@Get('checkUserDiagnosis')
async ensureCase(@Query('patientId')patientId:string){
 let key= await this.aiAgentSercice.ensureCase(patientId)
 return{key}
}

}