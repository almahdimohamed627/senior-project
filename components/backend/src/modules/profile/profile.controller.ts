import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  ValidationPipe,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Logger,
  Query,
  ForbiddenException,
  ParseArrayPipe,
} from '@nestjs/common';
import { ProfileService } from './profile.service';
import { CreateProfileDto } from './dto/create-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpsertAvailabilitiesDto } from './dto/availability.dto';
import { AvailabilityItemDto } from './dto/availability.dto';
import { Roles } from 'src/modules/auth/decorators/role.decorator';
import { Role } from 'src/enums/role.enum';
import { RolesGuard } from 'src/modules/auth/guards/role.guard';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import path, { extname, join } from 'path';
import { CurrentUser } from 'src/modules/auth/decorators/current-user.decorator';
import { db } from 'src/db/client';
import { users } from 'src/db/schema/profiles.schema';
import { eq } from 'drizzle-orm';
const UPLOADS_FOLDER = 'uploads';



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

@Controller('profile')
export class ProfileController {
  private readonly logger = new Logger(ProfileController.name);

  constructor(private readonly profileService: ProfileService) {}

  // @Post()
  // create(@Body() createProfileDto: CreateProfileDto) {
  //   return this.profileService.create(createProfileDto);
  // }

  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(Role.PATIENT)
  @Get('profiles')
  async findAll(@Query('page')page:number,@Query('limit')limit:number) {
    return await this.profileService.findAll(page,limit);
  }
@Get('doctorsProfiles')
async getDoctors(
  @Query('specialty') specialty?: string,
  @Query('city',new ParseArrayPipe({items:Number,separator:',',optional:true})) city?: number[],
  @Query('gender') gender?: 'male' | 'female',
  @Query('page') page: string = '1',  
  @Query('limit') limit: string = '10' 
) {
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);

  return await this.profileService.getAllDoctors(specialty, city, gender, pageNum, limitNum);
}
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return await this.profileService.findOne(id);
  }


@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.DOCTOR, Role.PATIENT)
@Patch('updateprofile')
@UseInterceptors(FileInterceptor('profilePhoto', {
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
async updateMe(
  @CurrentUser() user: any,
  @Body() dto: UpdateProfileDto,
  @UploadedFile() file?: Express.Multer.File,
) {
  const fusionAuthId: string | undefined = user?.sub;
  const roles: string[] = Array.isArray(user?.roles) ? user.roles : [];
  if (!fusionAuthId) throw new BadRequestException('Invalid access token (missing sub).');

  let type: 'doctor' | 'patient' | null = null;
  if (roles.includes(Role.DOCTOR)) type = 'doctor';
  else if (roles.includes(Role.PATIENT)) type = 'patient';
  if (!type) throw new ForbiddenException('User role not allowed to update profile.');

  const storedPath = file ? path.join(UPLOADS_FOLDER, file.filename) : undefined;


  return this.profileService.updateMe({
    type,
    dto,
    storedPath,
    fusionAuthId,
  });
}

@UseGuards(JwtAuthGuard)
@Patch('fusionInformation')
async updateFusionInformation(  @CurrentUser() user: any,
  @Body() dto: {firstName ,lastName,email,password}){
     const fusionAuthId: string | undefined = user?.sub;
  const roles: string[] = Array.isArray(user?.roles) ? user.roles : [];
  if (!fusionAuthId) throw new BadRequestException('Invalid access token (missing sub).');
 return this.profileService.updateFusionInformation(fusionAuthId,dto)
}
//delete user
@Delete(":id")
async deleteProfile(@Param('id') id:string){
  await this.profileService.remove(id)
}

  // -----------------------
  // Availabilities endpoints
  // -----------------------

  @Get(':id/availabilities')
  async getAvailabilities(@Param('id') doctorId: string) {
    return await this.profileService.getAvailabilities(doctorId);
  }

// @Post(':id/availabilities')
// @HttpCode(HttpStatus.OK)
// async upsertAvailabilities(
//   @Param('id') doctorId: string, // هذا fusionAuthId
//   @Body(new ValidationPipe({ whitelist: true })) body: UpsertAvailabilitiesDto,
// ) {
//   return this.profileService.upsertAvailabilities(doctorId, body.items || []);
// }

@Post(':id/availabilities')
@HttpCode(HttpStatus.OK)
async createAvailabilities(
  @Param('id') doctorId: string, 
  @Body(new ValidationPipe({ whitelist: true })) body: UpsertAvailabilitiesDto,
) {
  return this.profileService.createAvailabilities(doctorId, body.items || []);
}
  
  @Delete(':id/availabilities/:availabilityId')
  @HttpCode(HttpStatus.OK)
  async deleteAvailability(
    @Param('id') doctorId: string,
    @Param('availabilityId') availabilityId: string,
  ) {
    return await this.profileService.deleteAvailability(doctorId, Number(availabilityId));
  }

  @Patch(':id/availabilities/:availabilityId')
  async updateAvailability(
    @Param('id') doctorId: string,
    @Param('availabilityId') availabilityId: string,
    @Body(new ValidationPipe({ whitelist: true })) items: AvailabilityItemDto,
  ) {
    return await this.profileService.updateAvailability(doctorId, Number(availabilityId), items);
  }
//fcm token
@Patch('fcm-token')
async updateFcmToken(
  @CurrentUser() user: any, 
  @Body('token') token: string
) {
  await db
    .update(users)
    .set({ fcmToken: token })
    .where(eq(users.fusionAuthId, user.fusionAuthId));
    
  return { msg: 'Token updated successfully' };
}


}


