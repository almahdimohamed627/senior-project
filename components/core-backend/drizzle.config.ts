// drizzle.config.ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema',     // مسار ملفات السكيمات
  out: './drizzle',              // مجلد المايغريشن الناتج
  dialect: 'postgresql',         // نوع قاعدة البيانات
  dbCredentials: {
    url: process.env.DATABASE_URL!, // من ملف .env
  },
});
