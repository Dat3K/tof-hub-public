'use client';
import {HintLayer} from '@tof-hub/ui';
import {useSiteHeaderInset} from './use-site-header-inset';

/** One `data-hint` layer for the whole site, kept below the responsive header. */
export function SiteHints() {
  return <HintLayer viewportTopInset={useSiteHeaderInset(true)}/>;
}
