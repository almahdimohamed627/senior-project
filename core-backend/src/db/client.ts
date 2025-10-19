// src/db/client.ts
import 'dotenv/config'; // <--- يحمّل .env
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import schema from './schema/schema';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:123456@localhost:5432/senior_project';
const sql = postgres(connectionString, { max: 10 });

export const db = drizzle(sql, { schema });
