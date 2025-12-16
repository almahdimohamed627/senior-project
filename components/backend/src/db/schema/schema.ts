export { doctorProfile, patientProfile, users } from './profiles.schema';
export { posts } from './posts.schema';
export { userSessions } from './user_sessions.schema';
export { requests } from './request.schema';
export { conversationAI, messages, conversations, conversationAiMessages } from './chat.schema';

// (اختياري) إذا بدك تجمعهم في object لاستخدامه مع drizzle runtime:
import { doctorProfile, patientProfile, users } from './profiles.schema';
import { posts } from './posts.schema';
import { userSessions } from './user_sessions.schema';
import { requests } from './request.schema';
import { conversationAI, messages, conversations, conversationAiMessages } from './chat.schema';

export const schema = {
  doctorProfile,
  patientProfile,
  posts,
  users,
  userSessions,
  requests,
  conversationAI,
  messages,
  conversations,
  conversationAiMessages,
};

export type DatabaseSchema = typeof schema;
