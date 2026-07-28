import type { MetadataRoute } from "next";

import { siteConfig } from "@/lib/site";

/**
 * Generates `/sitemap.xml`. Currently lists only the home route — add an entry
 * per public route as the site grows (ideally derived from a routes manifest).
 */

// Required by `output: "export"` — metadata routes have no server to run on,
// so they must be rendered to a file at build time. `lastModified` is therefore
// the build time, not the request time.
export const dynamic = "force-static";
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: siteConfig.url,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
}
