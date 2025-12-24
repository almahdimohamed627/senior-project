// seed.ts
import "dotenv/config";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { cities } from "./src/db/schema/schema";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool);

const syrianCities = [
  { nameA: "دمشق", nameE: "Damascus" },
  { nameA: "ريف دمشق", nameE: "Rif Dimashq" },
  { nameA: "حلب", nameE: "Aleppo" },
  { nameA: "حمص", nameE: "Homs" },
  { nameA: "حماة", nameE: "Hama" },
  { nameA: "اللاذقية", nameE: "Latakia" },
  { nameA: "طرطوس", nameE: "Tartus" },
  { nameA: "إدلب", nameE: "Idlib" },
  { nameA: "دير الزور", nameE: "Deir ez-Zor" },
  { nameA: "الرقة", nameE: "Raqqa" },
  { nameA: "الحسكة", nameE: "Al-Hasakah" },
  { nameA: "درعا", nameE: "Daraa" },
  { nameA: "السويداء", nameE: "As-Suwayda" },
  { nameA: "القنيطرة", nameE: "Quneitra" },
];

async function main() {
  await db.transaction(async (tx) => {
    // Option A: wipe & re-seed each time
    await tx.delete(cities);

    // Insert seed rows
    await tx.insert(cities).values(syrianCities);
  });

  await pool.end();
}

main().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});
