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
 * runtime to hold secrets. **Every value here ends up in the client bundle —
 * never add a secret.** Server-side config belongs in the backend: the GCP
 * functions in `gc_run_functions/`, which read theirs from Secret Manager
 * (`terraform/contact.tf`). Turnstile's *secret* key lives there; only its site
 * key is below, and that one is public by design.
 */

import { z } from "zod";

/**
 * The Turnstile widget's site key when none is configured.
 *
 * Cloudflare's "always passes" test key. It is a safe default rather than a
 * convenience: a test site key only produces the dummy token
 * `XXXX.DUMMY.TOKEN.XXXX`, and **the real secret key rejects dummy tokens**. So
 * forgetting to set this in production does not open a bypass — it breaks the
 * form visibly, which is the failure mode to want. Locally it means the form
 * works with no setup.
 *
 * https://developers.cloudflare.com/turnstile/troubleshooting/testing/
 */
const TEST_TURNSTILE_SITE_KEY = "1x00000000000000000000AA";

/** Where `functions-framework --target submit_contact_form` listens. */
const LOCAL_CONTACT_ENDPOINT = "http://localhost:8080";

const publicSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.url().optional(),
  /**
   * Turnstile's **site** key — public, and inlined into the page on purpose:
   * the widget script reads it in the browser. Not a credential.
   */
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().min(1).optional(),
  /**
   * The contact function's URL.
   *
   * An environment variable, unlike `siteConfig.statsUrl` which is hardcoded —
   * and the reason for the difference is local development. The stats object has
   * one address that works from everywhere; this one has two, because the
   * function runs on `localhost:8080` under the Functions Framework while being
   * written. Baking the deployed URL in would mean no way to exercise the form
   * without deploying it.
   *
   * The value is not a secret. `terraform/outputs.tf` says so plainly: the
   * endpoint is unauthenticated, so knowing the URL is not what protects it —
   * the layers in `main.py` are.
   */
  NEXT_PUBLIC_CONTACT_ENDPOINT: z.url().optional(),
  /**
   * Cloudflare Web Analytics のサイトトークン。
   *
   * ブラウザが読む値なので**秘密ではない** — Turnstile のサイトキーと同じ扱いで、
   * `deploy.yml` にリテラルで置く。repository secret に入れても隠れるのは自分に
   * 対してだけ。
   *
   * **既定値を置かないのが要点。** ここをリテラルにすると `npm run dev` でも
   * ビーコンが飛び、`localhost` のアクセスが本番の計測に混ざる。集めている当の
   * データが静かに汚れるので、既定値の無い任意項目にして「未設定ならビーコンを
   * 出さない」を既定の挙動にしてある。`statsUrl` がリテラルなのと逆の判断で、
   * 逆にしている理由がこれ。
   */
  NEXT_PUBLIC_CF_BEACON_TOKEN: z.string().min(1).optional(),
});

/** Public env — safe to read anywhere. */
export const publicEnv = publicSchema.parse({
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
  NEXT_PUBLIC_CONTACT_ENDPOINT: process.env.NEXT_PUBLIC_CONTACT_ENDPOINT,
  NEXT_PUBLIC_CF_BEACON_TOKEN: process.env.NEXT_PUBLIC_CF_BEACON_TOKEN,
});

export const turnstileSiteKey =
  publicEnv.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? TEST_TURNSTILE_SITE_KEY;

export const contactEndpoint =
  publicEnv.NEXT_PUBLIC_CONTACT_ENDPOINT ?? LOCAL_CONTACT_ENDPOINT;

/**
 * 未設定なら `undefined`。呼び出し側はそのときビーコンを描かない。
 *
 * 他の2つと違って `??` の既定値が無い。動く既定値を与えると開発中のアクセスが
 * 本番の数字に入るので、**未設定は事故ではなく正しい状態**（上の注記）。
 */
export const cfBeaconToken = publicEnv.NEXT_PUBLIC_CF_BEACON_TOKEN;
