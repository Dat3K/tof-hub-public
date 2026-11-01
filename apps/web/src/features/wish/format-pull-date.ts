import { formatDate } from '@/lib/i18n/format';
import type { WishLocale } from './wish-i18n';

/**
 * Wish dates in the page language. Pull and banner times are game timestamps shown as recorded (UTC), so the history
 * day groups, their labels, pull tooltips and banner periods always name the same day.
 */
export function formatPullDate(timestamp: string, locale: WishLocale): string {
  return formatDate(timestamp, locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: 'UTC',
  });
}

/** A banner's start or end date (banner card period, community tally). */
export function formatBannerDate(timestamp: string, locale: WishLocale): string {
  return formatDate(timestamp, locale, { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/** Heading of a history day group: the UTC date the group's records share. */
export function formatPullDay(timestamp: string, locale: WishLocale): string {
  return formatDate(timestamp, locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}
