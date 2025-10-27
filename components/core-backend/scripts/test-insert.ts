// scripts/test-insert.ts
import { db } from '../src/auth/client';
import { schema } from '../src/db/schema/schema';

async function run() {
  const test = {
    fusionAuthId: 'TEST-SCRIPT-UUID-923',
    gender: 'male',
    university: 'Damascus University',
    specialty: 'Cardiology',
    profilePhoto: null,
    city: 'Damascus',
    birthYear: 1980,
    phoneNumber: '0933123456',
  };

  try {
    console.log('Attempting Drizzle insert (script) with payload:', test);
    const res = await db.insert(schema.doctors).values(test).returning();
    console.log('Insert result (script):', res);
    process.exit(0);
  } catch (err: any) {
    console.error('Script DB error raw:', err);
    // dump all props
    for (const p of Object.getOwnPropertyNames(err)) {
      console.error(p, ' => ', (err as any)[p]);
    }
    process.exit(1);
  }
}

run();
