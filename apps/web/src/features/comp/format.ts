/**
 * Advancement stars and relic ranks of a squad slot (slot badges, quick popovers, PNG export). A value is a number or
 * the custom text a player typed: digits get the `★` / `R` prefix, any other text is shown as typed. An empty value
 * shows the fallback, or nothing without one.
 */
type SlotValue = number | string | null | undefined;

function badge(value: SlotValue, prefix: string, fallback: number | undefined): string {
  const text = value === undefined || value === null ? '' : String(value).trim();
  if (!text) return fallback === undefined ? '' : `${prefix}${fallback}`;
  return /^\d+$/.test(text) ? `${prefix}${text}` : text;
}

export function formatStars(value: SlotValue, fallback?: number): string {
  return badge(value, '★', fallback);
}

export function formatRelicRank(value: SlotValue, fallback?: number): string {
  return badge(value, 'R', fallback);
}

/** The number of a star or rank value; null for custom text. */
export function parseSlotNumber(value: SlotValue): number | null {
  if (typeof value === 'number') return value;
  const text = value === undefined || value === null ? '' : String(value).trim();
  return /^\d+$/.test(text) ? parseInt(text, 10) : null;
}
