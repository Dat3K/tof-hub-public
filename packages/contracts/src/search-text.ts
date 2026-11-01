/**
 * Text as a search compares it (ranking search, 2026-10-08): nicknames carry characters the game draws invisible
 * (U+200B inside "Ogaw​a", U+200E around "Lilou", only spaces for some players) and decorated letters. Search
 * ignores the invisible ones, folds compatibility forms (NFKC: full-width "Ａｓｔｒｅｙａ" → "astreya") and case. The stored
 * and shown nickname stays exactly as the game sent it.
 */
const INVISIBLE = /[\s\p{Cf}ᅟᅠㅤﾠ⠀]/gu;

export function normalizeSearchText(value: string): string {
  return value.normalize('NFKC').replace(INVISIBLE, '').toLowerCase();
}

/** A nickname the game draws blank: nothing is left once invisible characters are removed. */
export function isBlankText(value: string): boolean {
  return value.replace(INVISIBLE, '') === '';
}
