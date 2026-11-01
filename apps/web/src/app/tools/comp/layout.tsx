import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { resolveServerLocale } from '@/lib/i18n/server';
import { getCompStrings } from '@/features/comp/copy';
import { buildMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await resolveServerLocale();
  const strings = getCompStrings(locale);
  return buildMetadata({
    title: 'Team planner',
    description: strings.metaDescription,
    path: '/tools/comp/',
  });
}

export default function CompLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
