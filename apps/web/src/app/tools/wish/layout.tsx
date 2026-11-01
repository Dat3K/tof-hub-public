import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { buildMetadata } from '@/lib/seo';

export const metadata: Metadata = buildMetadata({
  title: 'Wish Tracker',
  description:
    'Tower of Fantasy Special Orders pull tracker, 50/50 Markov chain streak telemetry, pull history audit, and simulation for Yanmiao banner.',
  path: '/tools/wish/',
  ogTitle: 'TOF Special Orders Pull Tracker & Simulator',
  ogDescription:
    'Track 80/40 non-resetting hard pity, 50/50 win-loss streaks, duplicate cashbacks, and simulate worst-case paths.',
});

export default function WishLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
