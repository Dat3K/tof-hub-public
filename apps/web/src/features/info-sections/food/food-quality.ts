import { localeText } from '@/lib/i18n/text';

import type { BadgeVariant } from '@tof-hub/ui';
import styles from './food.module.css';

/** Food has five quality tiers; MMO gold must remain distinct from purple SSR. */
export function foodQuality(rarity: string | undefined, locale: string) {
  const value = (rarity || 'N').toUpperCase();
  const tier = value === 'GOLD' ? 'Gold' : value === 'SSR' ? 'SSR' : value === 'SR' ? 'SR' : value === 'R' ? 'R' : 'N';
  return {
    label: value === 'GOLD' ? (localeText(locale)('Gold')) : value,
    variant: (value === 'GOLD' ? 'warning' : value.toLowerCase()) as BadgeVariant,
    cardClass: styles[`foodCard${tier}`],
    iconClass: styles[`iconBox${tier}`],
  };
}
