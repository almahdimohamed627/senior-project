import { varchar } from "drizzle-orm/pg-core";
import { pgTable, serial } from "drizzle-orm/pg-core";


export const cities =pgTable(
    'cities',{
        id:serial('id').primaryKey().unique(),
        nameA:varchar('nameA'),
        nameE:varchar('nameE'),
        
    }
)