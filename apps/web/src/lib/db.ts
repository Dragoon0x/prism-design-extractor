import { createDbClient } from '@prism/db';
import { env } from './env.js';

/** Singleton Drizzle client for the web app. Neon serverless driver is stateless. */
export const db = createDbClient({ url: env.DATABASE_URL });
