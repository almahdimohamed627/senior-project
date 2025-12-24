import { Controller, Get } from "@nestjs/common";


@Controller('cities')
export class CitiesController{


    @Get('return-cities')
    async getCities(){
        
    }
}