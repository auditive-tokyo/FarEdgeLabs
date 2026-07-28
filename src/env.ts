/**
 * Validated environment variables.
 *
 * `publicEnv` holds `NEXT_PUBLIC_*` values — inlined into the client bundle,
 * safe in the browser.
 *
 * A missing/invalid variable fails fast with a clear zod error rather than
 * surfacing as a confusing runtime bug later.
 *
 * Note: this site is a static export (GitHub Pages), so there is no server
 * runtime to hold secrets. Every value here ends up in the client bundle —
 * never add a secret. Server-side config belongs in the AWS backend
 * (Lambda env vars / Secrets Manager).
 */

import { z } from "zod";

const publicSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.url().optional(),
});

/** Public env — safe to read anywhere. */
export const publicEnv = publicSchema.parse({
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
});
