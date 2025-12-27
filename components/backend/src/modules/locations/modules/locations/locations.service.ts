import { Injectable } from '@nestjs/common';
import { db } from 'src/db/client';
import { schema } from 'src/db/schema/schema';

@Injectable()
export class LocationsService {




    async getAllCities(){
        return await db.select().from(schema.cities)
    }
}
