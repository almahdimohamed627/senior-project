import { PartialType } from '@nestjs/swagger';
import { CreateAdmindashboardDto } from './create-admindashboard.dto';

export class UpdateAdmindashboardDto extends PartialType(CreateAdmindashboardDto) {}
