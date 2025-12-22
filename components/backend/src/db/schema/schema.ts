export { doctorProfile, patientProfile, users } from './profiles.schema';
export { posts } from './posts.schema';
export { userSessions } from './user_sessions.schema';
export { requests,requeststatus } from './request.schema';
export { conversationAI, messages, conversations, conversationAiMessages } from './chat.schema';
export { appointments } from './appointments.schema';
// (اختياري) إذا بدك تجمعهم في object لاستخدامه مع drizzle runtime:
import { doctorProfile, patientProfile, role, users } from './profiles.schema';
import { posts } from './posts.schema';
import { userSessions } from './user_sessions.schema';
import { requests, requeststatus } from './request.schema';
import { conversationAI, messages, conversations,conversationAiMessages, aiConversationStatus} from './chat.schema';
import { appointments } from './appointments.schema';

export const schema = {
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
  role:role,
  status:requeststatus,
aiConversationStatus:aiConversationStatus,

};

export type DatabaseSchema = typeof schema;
