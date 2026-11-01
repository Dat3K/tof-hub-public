import type { HubCardConfig } from './types';

/**
 * Authoritative destination targets for the main site hub fallback cards.
 * - Info -> /info/
 * - Datamine -> /datamine/
 * - Tools -> /tools/
 */
export const MAIN_HUB_CARDS: readonly HubCardConfig[] = [
  {
    id: 'info',
    href: '/info/',
  },
  {
    id: 'tools',
    href: '/tools/',
  },
  {
    id: 'datamine',
    href: '/datamine/',
  },
] as const;
