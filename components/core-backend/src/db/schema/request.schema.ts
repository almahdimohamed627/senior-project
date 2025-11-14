import { pgTable, serial, varchar, text, integer, timestamp } from 'drizzle-orm/pg-core';
import { doctorProfile, patientProfile } from './profiles.schema';


export const requests=pgTable('requests',{
    id:serial('is').primaryKey(),
    senderId:text("senderId").references(()=>doctorProfile.fusionAuthId),
    receiverId:text("receiverId").references(()=>patientProfile.fusionAuthId),
    status:text("")
})