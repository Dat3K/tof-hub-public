export interface RankedModuleLevel { level:number; desc_en?:string; desc_ru?:string }

const NUMBER_TOKEN = /\d+(?:[.,]\d+)?%?/g;

function comparableDescription(description: string): string {
  return description
    .replace(NUMBER_TOKEN, '#')
    // Level one often uses singular units ("1 second"), while later levels
    // use the plural form. The unit itself is not a rank-specific value.
    .replace(/#\s+([a-z]+)/gi, (_, unit: string) => `# ${unit.replace(/s$/i, '')}`);
}

function normalizeRankUnits(descriptions: string[]): string[] {
  const units = ['second', 'minute', 'hour', 'time', 'slot', 'stack'];
  return descriptions.map((description) =>
    units.reduce((result, unit) => {
      const plural = new RegExp(`\\b${unit}s\\b`, 'i').test(descriptions.join(' '));
      return plural ? result.replace(new RegExp(`\\b${unit}\\b`, 'gi'), `${unit}s`) : result;
    }, description),
  );
}

function localizedDescription(level: RankedModuleLevel, isRu: boolean): string | undefined {
  return isRu ? level.desc_ru || level.desc_en : level.desc_en || level.desc_ru;
}

/**
 * Builds the slash-separated value format understood by GameRichText.
 * Module data stores one concrete description per level, while the shared
 * renderer expects a single description containing all rank values.
 */
export function buildRankedModuleDescription(
  levels: RankedModuleLevel[],
  isRu: boolean,
  selectedLevel?: number,
): string | undefined {
  const sortedLevels = levels
    .slice()
    .sort((a, b) => a.level - b.level)
    .map((level) => ({ level, description: localizedDescription(level, isRu) }))
    .filter((entry): entry is { level: RankedModuleLevel; description: string } => Boolean(entry.description));
  const descriptions = normalizeRankUnits(sortedLevels.map((entry) => entry.description));

  if (!descriptions[0] || descriptions.length < 2) return descriptions[0];

  const selectedIndexCandidate = sortedLevels.findIndex((entry) => entry.level.level === selectedLevel);
  const selectedIndex = selectedIndexCandidate >= 0 ? selectedIndexCandidate : descriptions.length - 1;
  const selectedDescription = descriptions[selectedIndex] || descriptions[descriptions.length - 1];

  // A few legacy descriptions change their wording on the final level
  // ("is increased by" → "increase ... by") while keeping the same value
  // slots. Use the most common wording as the template and still merge all
  // level values into it.
  const templates = new Map<string, { description: string; count: number }>();
  descriptions.forEach((description) => {
    const key = comparableDescription(description);
    const entry = templates.get(key);
    templates.set(key, entry ? { ...entry, count: entry.count + 1 } : { description, count: 1 });
  });
  const template = [...templates.values()].sort((a, b) => b.count - a.count)[0].description;

  const templateMatches = [...template.matchAll(NUMBER_TOKEN)];
  const levelMatches = descriptions.map((description) => [...description.matchAll(NUMBER_TOKEN)]);

  // Some modules add a separate bonus only at the final rank (for example,
  // "+1 Field Energy Captor level"). It must not prevent the shared values
  // from being rendered as a rank gradient.
  if (levelMatches.some((matches) => matches.length < templateMatches.length)) {
    return template;
  }

  let result = '';
  let offset = 0;

  templateMatches.forEach((match, index) => {
    const start = match.index ?? offset;
    result += template.slice(offset, start);

    const values = levelMatches.map((matches) => matches[index][0]);
    result += values.every((value) => value === values[0]) ? values[0] : values.join(' / ');
    offset = start + match[0].length;
  });

  const commonValueCount = templateMatches.length;
  const templateLastMatch = templateMatches[commonValueCount - 1];
  const templateTail = template.slice(
    (templateLastMatch?.index ?? template.length) + (templateLastMatch?.[0].length ?? 0),
  );
  const selectedMatches = [...selectedDescription.matchAll(NUMBER_TOKEN)];
  const selectedLastCommonMatch = selectedMatches[commonValueCount - 1];
  const selectedTail = selectedDescription.slice(
    (selectedLastCommonMatch?.index ?? selectedDescription.length) +
      (selectedLastCommonMatch?.[0].length ?? 0),
  );
  const extraTail = selectedTail.startsWith(templateTail)
    ? selectedTail.slice(templateTail.length).trim()
    : selectedTail.trim() !== templateTail.trim()
      ? selectedTail.trim()
      : '';

  return result + template.slice(offset) + (extraTail ? ` ${extraTail}` : '');
}

export function getModuleRank(levels: RankedModuleLevel[], selectedLevel: number): number {
  const sortedLevels = levels.slice().sort((a, b) => a.level - b.level);
  const selectedIndex = sortedLevels.findIndex((level) => level.level === selectedLevel);
  return selectedIndex >= 0 ? selectedIndex : Math.max(0, sortedLevels.length - 1);
}
