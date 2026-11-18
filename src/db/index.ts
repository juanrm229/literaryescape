import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const globalForDb = globalThis as unknown as { pmPool?: Pool };

const pool = globalForDb.pmPool ?? new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  ssl: process.env.DATABASE_URL?.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined,
});
if (process.env.NODE_ENV !== 'production') globalForDb.pmPool = pool;

export const db = drizzle(pool, { schema });
export { schema };
