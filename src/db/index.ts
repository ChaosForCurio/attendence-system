import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
import * as schema from './schema';

dotenv.config();

let dbInstance: any = null;

export function getDb() {
  if (dbInstance) return dbInstance;

  const connectionString = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_QmhFlg5TB0Sj@ep-autumn-paper-axv0bznd-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require';

  const sql = neon(connectionString);
  dbInstance = drizzle(sql, { schema });
  return dbInstance;
}

export const db = getDb();
export { schema };
