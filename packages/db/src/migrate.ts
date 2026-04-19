/**
 * Migration runner. Invoked via `pnpm db:migrate`.
 *
 * Uses the Neon serverless driver — same as the runtime client, so migrations
 * run against the same connection profile we deploy with. For Postgres targets
 * that aren't Neon (local dev), point DATABASE_URL at any Postgres 16 instance;
 * the Neon driver speaks plain Postgres wire protocol.
 */
import { drizzle } from 'drizzle-orm/neon-http';
import { migrate } from 'drizzle-orm/neon-http/migrator';
import { neon } from '@neondatabase/serverless';

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }
  const sql = neon(url);
  await migrate(drizzle(sql), { migrationsFolder: './drizzle' });
  console.log('[db] migrations applied');
}

void main().catch((err) => {
  console.error('[db] migration failed', err);
  process.exit(1);
});
