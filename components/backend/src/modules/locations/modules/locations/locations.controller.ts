import { Controller, Get, Inject } from '@nestjs/common';
import { LocationsService } from './locations.service';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Locations')
@ApiBearerAuth()
@Controller('locations')
export class LocationsController {
    constructor(@Inject() private locationService:LocationsService){}


    @Get('return-cities')
    @ApiOperation({ summary: 'Get all cities' })
    async returnCities(){
     return await this.locationService.getAllCities()
    }
}
