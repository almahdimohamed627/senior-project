import { doctorProfile, patientProfile, DoctorProfile, PatientProfile, NewDoctorProfile, NewPatientProfile ,users} from "./profiles.schema";
import {posts} from './posts.schema'
import { userSessions } from "./user_sessions.schema";


export const schema = {
  doctors: doctorProfile,
  patients: patientProfile,
  posts:posts,
  userSessions:userSessions,
  users:users
};

export type DatabaseSchema = typeof schema;
export default schema;
