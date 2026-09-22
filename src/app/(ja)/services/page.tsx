import type { Metadata } from "next";

import { generateMetadata as buildMetadata } from "@/utils/seo/generate-page-metadata";
import { getCopy } from "@/locales";
import { ServicesView } from "@/views/services";

const LOCALE = "ja";
const PATH = "services";

export const metadata: Metadata = buildMetadata({
  locale: LOCALE,
  path: PATH,
  title: `${getCopy(LOCALE).services.heading} — FarEdge Labs`,
  description: getCopy(LOCALE).services.lead,
  // `noindex` は付けない。残るプレースホルダーは `about` の1枚だけ。
});

export default function Services() {
  return <ServicesView locale={LOCALE} />;
}
