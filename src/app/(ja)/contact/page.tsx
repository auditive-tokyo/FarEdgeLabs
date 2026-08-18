import type { Metadata } from "next";

import { generateMetadata as buildMetadata } from "@/utils/seo/generate-page-metadata";
import { getCopy } from "@/locales";
import { ContactView } from "@/views/contact";

const LOCALE = "ja";
const PATH = "contact";

export const metadata: Metadata = buildMetadata({
  locale: LOCALE,
  path: PATH,
  title: `${getCopy(LOCALE).contact.heading} — FarEdge Labs`,
  description: getCopy(LOCALE).contact.body,
  // `noindex` は付けない。プレースホルダー3枚と違って中身があり、検索から直接来て
  // ほしい唯一の下層ページ。`src/app/sitemap.ts` にも入れてある。
});

export default function Contact() {
  return <ContactView locale={LOCALE} />;
}
