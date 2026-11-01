import { isValidLocale, localizeUiCopy, type Locale } from '@tof-hub/i18n';

/**
 * Inline copy for pages without a dictionary: `const t = localeText(locale); t('Save')`.
 * The English source text is the key; every culture, Russian included, resolves it through the shared
 * phrase table (`packages/i18n/src/locales/extra`). An explicit second argument stays supported as a
 * Russian override for text the table does not hold. Pages with many strings keep their own dictionary
 * (Wish `wish-i18n.ts`, Comp `copy.ts`).
 */
export function localeText(locale: Locale | string): <T>(en: T, ru?: T) => T {
  const culture: Locale = isValidLocale(locale) ? locale : 'en';
  return (en, ru) => (culture === 'ru' && ru !== undefined ? ru : localizeUiCopy(en, culture));
}

/** Fills `{0}`, `{1}` … of a translated template; used where the English template is the phrase-table key. */
export function fillText(template: string, values: readonly unknown[]): string {
  return template.replace(/\{(\d+)\}/g, (match, index) => (Number(index) < values.length ? String(values[Number(index)]) : match));
}
