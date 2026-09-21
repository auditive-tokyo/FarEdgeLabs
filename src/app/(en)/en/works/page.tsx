import type { Metadata } from "next";

import { generateMetadata as buildMetadata } from "@/utils/seo/generate-page-metadata";
import { getCopy } from "@/locales";
import { WorksView } from "@/views/works";

const LOCALE = "en";
const PATH = "works";

export const metadata: Metadata = buildMetadata({
  locale: LOCALE,
  path: PATH,
  title: `${getCopy(LOCALE).works.heading} — FarEdge Labs`,
  description: getCopy(LOCALE).works.lead,
  // `noindex` は付けない。中身が入ったので、残るプレースホルダーは
  // `services` と `about` の2枚。`src/app/sitemap.ts` にも入れてある。
});

export default function WorksEn() {
  return <WorksView locale={LOCALE} />;
}
