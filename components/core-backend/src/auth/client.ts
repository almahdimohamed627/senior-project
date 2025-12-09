// src/db/client.ts
import 'dotenv/config'; // <--- يحمّل .env
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import schema from '../db/schema/schema';
import { ConfigService } from '@nestjs/config';

let config=new ConfigService
const connectionString = config.get<string>('DATABASE_URL');
const sql = postgres(connectionString, { max: 10 });

export const db = drizzle(sql, { schema });
