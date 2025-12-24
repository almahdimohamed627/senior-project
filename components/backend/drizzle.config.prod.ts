import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
<<<<<<< HEAD
  schema: '/app/dist/src/db/schema/*.schema.js',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL! },
});
=======
  schema: './dist/db/schema/*.schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL! },
});
>>>>>>> 1fd9d049f194e78d82dab626df17aa68bc83b9ae
