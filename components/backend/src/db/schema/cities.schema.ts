import { varchar } from "drizzle-orm/pg-core";
import { pgTable, serial } from "drizzle-orm/pg-core";


export const cities =pgTable(
    'cities',{
<<<<<<< HEAD
        id:serial('id').primaryKey().unique(),
=======
        id:serial('id').primaryKey()
        ,
>>>>>>> 1fd9d049f194e78d82dab626df17aa68bc83b9ae
        nameA:varchar('nameA'),
        nameE:varchar('nameE'),
        
    }
)