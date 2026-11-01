import {formatNumber} from '@/lib/i18n/format';
import type {Locale} from '@/lib/i18n';

/**
 * Top-up as the Build card shows it: the raw `TotalRechargeValue` / 100 in USD (user-confirmed presentation,
 * docs/imports.md). Directory counters arrive as decimal strings.
 */
export function formatTopUp(value:number|string,locale:Locale):string {
  const cents=typeof value==='number'?value:Number(value);
  return `${formatNumber(cents/100,locale,{minimumFractionDigits:2,maximumFractionDigits:2})} USD`;
}
