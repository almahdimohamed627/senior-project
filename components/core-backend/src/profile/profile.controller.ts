// src/profile/profile.controller.ts
import { Controller, Get, Post, Body, Patch, Param, Delete,UseGuards, Req, ValidationPipe, HttpCode, HttpStatus } from '@nestjs/common';
import { ProfileService } from './profile.service';
import { CreateProfileDto } from './dto/create-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpsertAvailabilitiesDto } from './dto/availability.dto';
import { AvailabilityItemDto } from './dto/availability.dto';
// import { Roles } from 'src/auth/decorators/role.decorator';
// import { Role } from 'src/enums/role.enum';
// import { RolesGuard } from 'src/auth/guards/role.guard';
// import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Post()
  create(@Body() createProfileDto: CreateProfileDto) {
    return this.profileService.create(createProfileDto);
  }

  @Get()
 async findAll() {
    return await this.profileService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.profileService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateProfileDto: UpdateProfileDto) {
    return this.profileService.update(+id, updateProfileDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.profileService.remove(+id);
  }

  // -----------------------
  // Availability endpoints
  // -----------------------

  // استرجاع الدوامات (المريض / أي زائر)
  @Get(':id/availabilities')
  async getAvailabilities(@Param('id') doctorId: string) {
    return await this.profileService.getAvailabilities(doctorId);
  }

  // استبدال كل الدوامات للطبيب (Doctor only) - upsert
  // لاحقًا ضَع UseGuards(JwtAuthGuard, RolesGuard) و تأكد doctorId مطابق للمستخدم
  @Post(':id/availabilities')
  @HttpCode(HttpStatus.OK)
  async upsertAvailabilities(
    @Param('id') doctorId: string,
    @Body(new ValidationPipe({ whitelist: true })) body: UpsertAvailabilitiesDto,
  ) {
    return await this.profileService.upsertAvailabilities(doctorId, body.items || []);
  }

  // حذف دوام واحد
  // لاحقًا ضَع UseGuards(JwtAuthGuard, RolesGuard)
  @Delete(':id/availabilities/:availabilityId')
  @HttpCode(HttpStatus.OK)
  async deleteAvailability(
    @Param('id') doctorId: string,
    @Param('availabilityId') availabilityId: string,
  ) {
    return await this.profileService.deleteAvailability(doctorId, Number(availabilityId));
  }

  // تحديث دوام واحد (اختياري)
  @Patch(':id/availabilities/:availabilityId')
  async updateAvailability(
    @Param('id') doctorId: string,
    @Param('availabilityId') availabilityId: string,
    @Body(new ValidationPipe({ whitelist: true })) item: AvailabilityItemDto,
  ) {
    return await this.profileService.updateAvailability(doctorId, Number(availabilityId), item);
  }
}
