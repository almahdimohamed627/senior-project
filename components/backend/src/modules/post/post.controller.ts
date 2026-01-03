import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req, BadRequestException, UploadedFiles, UseInterceptors, Logger } from '@nestjs/common';
import { PostService } from './post.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { Roles } from 'src/modules/auth/decorators/role.decorator';
import { Role } from 'src/enums/role.enum';
import { RolesGuard } from 'src/modules/auth/guards/role.guard';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { existsSync, mkdirSync } from 'fs';
import { extname } from 'path';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';

const UPLOADS_FOLDER = 'uploads';
const POSTS_FOLDER = `${UPLOADS_FOLDER}/posts`;



function fileFilter(req: any, file: Express.Multer.File, cb: Function) {
  if (!file.mimetype.match(/\/(jpg|jpeg|png)$/)) {
    return cb(new BadRequestException('Unsupported file type. Only jpg/jpeg/png allowed.'), false);
  }
  cb(null, true);
}

function editFileName(req: any, file: Express.Multer.File, callback: Function) {
  const name = file.originalname.replace(/\.[^/.]+$/, '').replace(/\s+/g, '-').toLowerCase();
  const fileExtName = extname(file.originalname).toLowerCase();
  const timestamp = Date.now();
  const finalName = `${name}-${timestamp}${fileExtName}`;
  callback(null, finalName);
}
@Controller('post')
export class PostController {
    private readonly logger = new Logger(PostController.name);
  constructor(private readonly postService: PostService) {}

   @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DOCTOR)
  @UseInterceptors(
    FilesInterceptor('photos', 8, { // allow up to 8 photos (change as needed)
      storage: diskStorage({
        destination: (req, file, cb) => cb(null, POSTS_FOLDER),
        filename: editFileName,
      }),
      fileFilter,
      limits: { fileSize: 5 * 1024 * 1024 *1024}, // 5 MB per file
    }),
  )
  async create(
    @Req() req: any,
    @Body() dto: CreatePostDto,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    const authorId = req.user?.sub || req.user?.userId;
    console.log(authorId)
    if (!authorId) {
    
      throw new BadRequestException('User not authenticated');
    }

    const payload = { ...dto, authorId };

    // Compute stored file paths array (relative)
    const filePaths: string[] = (files || []).map(f => `${POSTS_FOLDER}/${f.filename}`); // 'uploads/posts/filename.jpg'

    // Call service (service will handle DB insert + rollback file cleanup on failure)
    try {
      const created = await this.postService.createPost(payload, filePaths);
      return created;
    } catch (err) {
      // If service throws, files will already be removed there on rollback.
      this.logger.error('Failed to create post', err?.message || err);
      throw err;
    }
  }

  @Get()
  findAll() {
    return this.postService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.postService.findOne(+id);
  }
  @Get('doctor/:userId')
  findOneByPostOd(@Param('userId') userId: string) {
    return this.postService.findOneByUserId(userId);
  }

  @Post('/like')
  async like(@Body() body: { userId: string; postId: number }){
  return this.postService.addLikeOrDelete(body.userId, body.postId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updatePostDto: UpdatePostDto) {
    return this.postService.update(+id, updatePostDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.postService.remove(+id);
  }
}
