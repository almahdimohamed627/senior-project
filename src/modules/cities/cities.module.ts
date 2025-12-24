import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CitiesController } from './cities.controller';
import { CitiesService } from './cities.service';



@Module({
    imports:[AuthModule],
    controllers:[CitiesController],
    providers:[CitiesService]
})
export class CitiesModule{

}