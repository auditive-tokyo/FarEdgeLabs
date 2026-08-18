import type { Metadata } from "next";

import { generateMetadata as buildMetadata } from "@/utils/seo/generate-page-metadata";
import { getCopy } from "@/locales";
import { ContactView } from "@/views/contact";

const LOCALE = "en";
const PATH = "contact";

export const metadata: Metadata = buildMetadata({
  locale: LOCALE,
  path: PATH,
  title: `${getCopy(LOCALE).contact.heading} — FarEdge Labs`,
  description: getCopy(LOCALE).contact.body,
  // No `noindex` — unlike the three placeholders, this page has something to say.
  // It is in `src/app/sitemap.ts` too.
});

export default function ContactEn() {
  return <ContactView locale={LOCALE} />;
}
