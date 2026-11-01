import type { Metadata } from "next";
import { resolveServerLocale } from "@/lib/i18n/server";
import { buildMetadata } from "@/lib/seo";
import { GUIDE_COPY } from "@/features/datamine/multype/guide/guide-copy";
import { MultypeGuideView } from "@/features/datamine/multype/guide/multype-guide-view";

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await resolveServerLocale();
  const t = GUIDE_COPY[locale];
  return buildMetadata({
    title: 'Damage type guide',
    description: t.metaDesc,
    path: "/datamine/multype/guide/",
  });
}

export default async function MultypeGuidePage() {
  const { locale } = await resolveServerLocale();
  return <MultypeGuideView initialLocale={locale} />;
}
