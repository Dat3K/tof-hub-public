export interface LocalizedText {
  en: string;
  ru: string;
  [locale: string]: string | undefined;
}

/** Domain values accept culture tags; the application validates its supported list. */
export type SupportedLocale = string;

function toTextString(val: unknown): string {
  if (val === null || val === undefined) return '';
  if (Array.isArray(val)) return val.map(toTextString).filter(Boolean).join('\n');
  if (typeof val === 'string') return val.trim();
  return String(val).trim();
}

export function createLocalizedText(
  en: unknown,
  ru: unknown,
  translations: Record<string, unknown> = {},
): LocalizedText {
  const enVal = toTextString(en);
  const ruVal = toTextString(ru);
  return {
    ...Object.fromEntries(Object.entries(translations).map(([locale, value]) => [locale, toTextString(value)])),
    en: enVal || ruVal,
    ru: ruVal || enVal,
  };
}

/** Preserve additional cultures when adapting materialized *_en/*_ru fields. */
export function getLocalizedFields(raw: unknown, field: string): Record<string, unknown> {
  if (!raw || typeof raw !== 'object') return {};
  const record = raw as Record<string, unknown>;
  const direct = record[field];
  const values: Record<string, unknown> = direct && typeof direct === 'object' && !Array.isArray(direct) ? { ...direct } : {};
  for (const [key, value] of Object.entries(record)) {
    if (key.startsWith(`${field}_`) && typeof value === 'string') values[key.slice(field.length + 1)] = value;
  }
  return values;
}

export function getLocalizedValue(
  text: LocalizedText | string | null | undefined,
  locale: SupportedLocale = 'en'
): string {
  if (!text) return '';
  if (typeof text === 'string') return text;
  return text[locale] || text.en || text.ru || '';
}
