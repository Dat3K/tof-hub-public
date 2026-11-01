/** Removes the trailing mentorship variant marker included by player-profile exports. */
export function normalizeCharacterTitle(value: string | null | undefined): string {
  const title = value?.trim() ?? '';
  return /(?:mentor|apprentice|导师|導師|学徒|學徒),0$/i.test(title)
    ? title.slice(0, -2).trimEnd()
    : title;
}
