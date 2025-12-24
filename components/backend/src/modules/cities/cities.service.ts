import { Injectable } from "@nestjs/common";
import { db } from "src/db/client";
import { schema } from "src/db/schema/schema";



@Injectable()
export class CitiesService{



    async returnCities(){
       return await db.select().from(schema.cities)
    }
}