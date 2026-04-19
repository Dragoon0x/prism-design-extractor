/**
 * Server-side env, lazily parsed on first property access.
 *
 * Next.js's build-time static analysis imports every route module to collect
 * page data. If we parse env at module-load, every build fails when
 * `.env.local` isn't set (CI, Vercel's build step before prod vars resolve).
 * The Proxy below defers `loadEnv()` until something actually reads a field.
 */
import { loadEnv, type Env } from '@prism/shared/env';

let cached: Env | undefined;

function resolved(): Env {
  if (!cached) cached = loadEnv();
  return cached;
}

export const env = new Proxy({} as Env, {
  get(_target, prop) {
    return resolved()[prop as keyof Env];
  },
  has(_target, prop) {
    return prop in resolved();
  },
  ownKeys() {
    return Reflect.ownKeys(resolved() as object);
  },
  getOwnPropertyDescriptor(_target, prop) {
    return Object.getOwnPropertyDescriptor(resolved(), prop);
  },
});
