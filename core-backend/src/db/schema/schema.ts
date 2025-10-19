// src/db/schema/schema.ts  (ملاحظة: سمّيه schema.ts لتعكس الغرض)
import { doctorProfile, patientProfile, DoctorProfile, PatientProfile, NewDoctorProfile, NewPatientProfile } from "./profiles.schema";
import {posts} from './posts.schema'
import { userSessions } from "./user_sessions.schema";


export const schema = {
  doctors: doctorProfile,
  patients: patientProfile,
  posts:posts,
  userSessions:userSessions
};

export type DatabaseSchema = typeof schema;
export default schema;
