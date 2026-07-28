import type { NextConfig } from "next";

/**
 * Sub-path prefix for GitHub Pages project sites.
 *
 * Served from `https://<org>.github.io/<repo>/`, every asset URL needs the
 * `/<repo>` prefix. Set `NEXT_PUBLIC_BASE_PATH=/FarEdgeLabs` in the deploy
 * workflow for that case; leave it empty when the site is served from a domain
 * root (custom domain / CNAME). Unlike Vite's `base: "./"`, Next.js has no
 * relative-path mode — the prefix must be known at build time.
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  // Static HTML export — GitHub Pages serves files only, there is no Node
  // runtime. This disables Route Handlers, middleware, ISR, and on-demand
  // image optimisation by design; the backend is AWS (API Gateway + Lambda).
  output: "export",

  basePath: basePath || undefined,
  assetPrefix: basePath || undefined,

  // Emit `about/index.html` instead of `about.html` so GitHub Pages resolves
  // nested paths (and their relative assets) without a redirect.
  trailingSlash: true,

  images: {
    // The optimizer is a server feature and cannot run on Pages. Without this
    // the build fails as soon as a `next/image` is exported. Images ship at
    // their source resolution, so keep the files in `public/` small — there is
    // no automatic AVIF/WebP conversion or srcset generation anymore.
    unoptimized: true,
  },

  // Hide the dev-tools badge. It defaults to the bottom-left corner, which is
  // where this design puts the request form — so it sits on top of the UI it is
  // meant to help build, and turns red over warnings that are not the page's.
  // Dev-only either way; it never shipped.
  devIndicators: false,

  compiler: {
    // Strip `console.*` from production bundles, keeping error/warn for
    // monitoring. Left on in dev so logs stay available.
    removeConsole:
      process.env.NODE_ENV === "production"
        ? { exclude: ["error", "warn"] }
        : false,
  },

  // React Compiler (automatic memoisation) is an opt-in performance win.
  // It requires the `babel-plugin-react-compiler` dev dependency and routes
  // the build through Babel — enable once installed:
  // reactCompiler: true,
};

export default nextConfig;
