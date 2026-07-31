import type { Metadata } from "next";

import { generateMetadata as buildMetadata } from "@/utils/seo/generate-page-metadata";
import { UnderConstructionView } from "@/views/under-construction";
import { placeholderTitle } from "@/views/under-construction/pages";

const LOCALE = "ja";
const PATH = "services";

export const metadata: Metadata = buildMetadata({
  locale: LOCALE,
  path: PATH,
  title: `${placeholderTitle(LOCALE, PATH)} — FarEdge Labs`,
  // Nothing to index yet. See `noindex` in the metadata generator.
  noindex: true,
});

export default function Services() {
  return (
    <UnderConstructionView
      locale={LOCALE}
      path={PATH}
      title={placeholderTitle(LOCALE, PATH)}
    />
  );
}
