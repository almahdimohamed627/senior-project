// drizzle.config.ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema', // مسار السكيمات
  out: './drizzle', // مجلد الإخراج للهجرات
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!, // من .env
  },
});
