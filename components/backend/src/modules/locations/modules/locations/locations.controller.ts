import { Controller, Get, Inject } from '@nestjs/common';
import { LocationsService } from './locations.service';

@Controller('locations')
export class LocationsController {
    constructor(@Inject() private locationService:LocationsService){}


    @Get('return-cities')
    async returnCities(){
     return await this.locationService.getAllCities()
    }
}
