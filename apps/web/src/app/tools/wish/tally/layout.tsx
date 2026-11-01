import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { buildMetadata } from '@/lib/seo';

export const metadata: Metadata = buildMetadata({
  title: 'Wish Tally',
  description:
    'Tower of Fantasy global wish tally and community statistics: 80/40 pity distribution chart, 50/50 win-rate analysis, and pull rates across all banners.',
  path: '/tools/wish/tally/',
  ogTitle: 'Tower of Fantasy Global Wish Tally & Pity Analytics',
  ogDescription:
    'Comprehensive community aggregated Special Orders stats: 5★ drop histogram (1..80), 50/50 win rates, and weapon/matrix breakdown.',
});

export default function WishTallyLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
