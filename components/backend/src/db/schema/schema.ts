export { doctorProfile, patientProfile, users } from './profiles.schema';
export { posts } from './posts.schema';
export { userSessions } from './user_sessions.schema';
export { requests } from './request.schema';
export { conversationAI, messages, conversations, conversationAiMessages } from './chat.schema';
export { appointments } from './appointments.schema';
export { cities } from './cities.schema';
export { role } from './profiles.schema';
export { aiConversationStatus, aiMessageRole, messageType } from './chat.schema';
export { requeststatus } from './request.schema';
// (اختياري) إذا بدك تجمعهم في object لاستخدامه مع drizzle runtime:
import { doctorProfile, patientProfile, role, users } from './profiles.schema';
import { posts } from './posts.schema';
import { userSessions } from './user_sessions.schema';
import { requests, requeststatus } from './request.schema';
import { conversationAI, messages, conversations,conversationAiMessages, aiConversationStatus} from './chat.schema';
import { appointments } from './appointments.schema';
import { cities } from './cities.schema';

export const schema = {
    role:role,
   status:requeststatus,
   aiConversationStatus:aiConversationStatus,
   doctors:doctorProfile,
   patients:patientProfile,
   posts:posts,
   users:users,
   userSessions:userSessions,
  requests:requests,
  conversationAI:conversationAI,
  messages:messages,
  conversations:conversations,
  conversationAiMessages:conversationAiMessages,
  appointments:appointments, 
  cities:cities

};

export type DatabaseSchema = typeof schema;
