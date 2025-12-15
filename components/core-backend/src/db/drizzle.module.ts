// import { Module } from '@nestjs/common';
// import { ConfigService } from '@nestjs/config';
// import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
// import { Pool } from 'pg';
// //import * as schema from './schema/schema';
// import schema from './schema/schema'

// export const DRIZZLE = Symbol("drizzle-connection");

// @Module({
//   providers: [{
//     provide: DRIZZLE,
//     inject: [ConfigService],
//     useFactory: async (configService: ConfigService) => {
//       const dataBaseUrl = configService.get<string>("DATABASE_URL");

//       const pool = new Pool({
//         connectionString: dataBaseUrl,
//         // ssl: {
//         //   rejectUnauthorized: true // Required for Supabase
//         // }
//       });
//       // Test connection
//       try {
//         const client = await pool.connect();
//         console.log(' Database connected successfully to Supabase');
//         client.release();
//       } catch (error) {
//         console.error(' Database connection failed:', error);
//         throw error;
//       }

//       return drizzle(pool, { schema }) as NodePgDatabase<typeof schema>;
//     }
//   }],
//   exports: [DRIZZLE],
// })
// export class DrizzleModule {}
