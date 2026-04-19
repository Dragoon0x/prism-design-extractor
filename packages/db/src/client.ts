/**
 * Drizzle client factory using Neon's serverless driver.
 *
 * Neon's `@neondatabase/serverless` uses HTTP (not TCP) in short-lived envs,
 * which matches Vercel function lifecycles. Each invocation gets its own
 * connection; no pool to leak.
 */
import { neon } from '@neondatabase/serverless';
import { drizzle, type NeonHttpDatabase } from 'drizzle-orm/neon-http';
import * as schema from './schema/index.js';

export type DbClient = NeonHttpDatabase<typeof schema>;

export interface CreateClientOptions {
  url: string;
}

let cached: DbClient | undefined;

/**
 * Returns a singleton DB client. Safe to reuse within a single function
 * invocation; the underlying Neon client is stateless.
 */
export function createDbClient(opts: CreateClientOptions): DbClient {
  if (cached) return cached;
  const sql = neon(opts.url);
  cached = drizzle(sql, { schema, logger: false });
  return cached;
}
