/**
 * Applies pending SQL migrations from ./drizzle to DATABASE_URL.
 * Usage: npm run db:migrate   (also run by the Docker entrypoint / Fly release command)
 */
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

const url =
  process.env.DATABASE_URL ??
  'postgres://commerce:commerce@127.0.0.1:5432/commerce';
const ssl =
  process.env.DATABASE_SSL === 'true'
    ? { rejectUnauthorized: false }
    : undefined;

const pool = new Pool({ connectionString: url, ssl, max: 1 });

try {
  await migrate(drizzle(pool), { migrationsFolder: 'drizzle' });
  console.log('Migrations applied.');
} finally {
  await pool.end();
}
