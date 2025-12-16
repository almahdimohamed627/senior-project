export { doctorProfile, patientProfile, users } from './profiles.schema';
export { posts } from './posts.schema';
export { userSessions } from './user_sessions.schema';
export { requests,requeststatus } from './request.schema';
export { conversationAI, messages, conversations, conversationAiMessages } from './chat.schema';

// (اختياري) إذا بدك تجمعهم في object لاستخدامه مع drizzle runtime:
import { doctorProfile, patientProfile, role, users } from './profiles.schema';
import { posts } from './posts.schema';
import { userSessions } from './user_sessions.schema';
import { requests, requeststatus } from './request.schema';
import { conversationAI, messages, conversations,conversationAiMessages, aiConversationStatus} from './chat.schema';

export const schema = {
  doctors:doctorProfile,
  patients:patientProfile,
  posts,
  users,
  userSessions,
  requests,
  conversationAI,
  messages,
  conversations,
  conversationAiMessages,
  role:role,
  status:requeststatus,
aiConversationStatus:aiConversationStatus,

};

export type DatabaseSchema = typeof schema;
