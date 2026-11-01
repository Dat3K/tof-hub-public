/** Difficulty is already shown separately on raid pages and is omitted from catalog titles. */
const DIFFICULTY_SUFFIX = /\s*(?:[-–—:]\s*|\(\s*)(?:heroic|challenging|challenge|героический|героическая|героическое|герой|вызов|испытание)\s*\)?$/iu;

export function withoutRaidDifficulty(title: string): string {
  return title.replace(DIFFICULTY_SUFFIX, '');
}
