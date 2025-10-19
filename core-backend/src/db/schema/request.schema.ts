import { pgTable, serial, varchar, text, integer, timestamp } from 'drizzle-orm/pg-core';


export const requests=pgTable('requests',{
    id:serial('is').primaryKey(),
    
})