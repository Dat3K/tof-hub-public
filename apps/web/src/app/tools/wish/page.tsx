import {generatePageMetadata, type SeoPageProps} from '@/lib/seo/server';
export async function generateMetadata(props: SeoPageProps) { return generatePageMetadata('/tools/wish/', props); }

import React from 'react';
import { WishView } from '@/features/wish';

export default function WishPage() {
  return <WishView />;
}
