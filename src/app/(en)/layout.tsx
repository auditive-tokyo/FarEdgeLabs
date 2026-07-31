import type { Metadata, Viewport } from "next";

import { LayoutShell } from "@/app/layout-shell";
import {
  generateMetadata,
  generateViewport,
} from "@/utils/seo/generate-page-metadata";

/**
 * Root layout for English, served from `/en/`.
 *
 * The second of two root layouts — see `(ja)/layout.tsx` and `layout-shell.tsx`.
 * The `en` segment lives inside this group rather than the group being named
 * `en`: a route group's name is stripped from the URL, so the directory that
 * produces the `/en/` path has to be a real segment.
 */
export const metadata: Metadata = generateMetadata({ locale: "en" });
export const viewport: Viewport = generateViewport();

export default function EnRootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <LayoutShell locale="en">{children}</LayoutShell>;
}
