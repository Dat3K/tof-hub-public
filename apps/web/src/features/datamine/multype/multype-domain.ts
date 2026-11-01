import { localized } from '@tof-hub/i18n';
import { type Locale } from '@tof-hub/i18n';
import type {
  MultypeElementFilter,
  MultypeFilterState,
  MultypeMainGroup,
  MultypeSubColumn,
  MultypeSubColumnSurface,
  MultypeValueItem,
  MultypeViewModel,
  MultypeGlobalStats,
} from './multype-types';
import { CATEGORY_LABELS_RU, MULTYPE_COPY } from './multype-copy';
import { resolveEnrichedAiGuess } from './multype-ai-labels';

export const ATTRIBUTE_COLORS: Record<string, string> = {
  Final: 'D3D3D3',
  Phy: 'FFA07A',
  Fire: 'EC5353',
  Ice: 'ADD8E6',
  Thunder: 'DDA0DD',
  Superpower: '90EE90',
  Crit: 'FFFF00',
  Common: 'F5F5DC',
};

export const DEFAULT_NON_ELEMENTAL_COLOR = ATTRIBUTE_COLORS.Final;

export function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  let r = 0;
  let g = 0;
  let b = 0;

  switch (i % 6) {
    case 0:
      r = v;
      g = t;
      b = p;
      break;
    case 1:
      r = q;
      g = v;
      b = p;
      break;
    case 2:
      r = p;
      g = v;
      b = t;
      break;
    case 3:
      r = p;
      g = q;
      b = v;
      break;
    case 4:
      r = t;
      g = p;
      b = v;
      break;
    default:
      r = v;
      g = p;
      b = q;
      break;
  }

  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

export function rgbToHex(rgb: [number, number, number]): string {
  return rgb.map((value) => value.toString(16).padStart(2, '0')).join('').toUpperCase();
}

export function hexToRgb(hexColor: string): [number, number, number] {
  const clean = String(hexColor || '').replace(/^#/, '');
  return [
    parseInt(clean.slice(0, 2), 16) || 0,
    parseInt(clean.slice(2, 4), 16) || 0,
    parseInt(clean.slice(4, 6), 16) || 0,
  ];
}

export function blendHex(hexColor: string, targetHex: string, ratio: number): string {
  const source = hexToRgb(hexColor);
  const target = hexToRgb(targetHex);
  const blended: [number, number, number] = [
    Math.round(source[0] * (1 - ratio) + target[0] * ratio),
    Math.round(source[1] * (1 - ratio) + target[1] * ratio),
    Math.round(source[2] * (1 - ratio) + target[2] * ratio),
  ];
  return rgbToHex(blended);
}

export function hexToRgba(hexColor: string, alpha: number): string {
  const rgb = hexToRgb(hexColor);
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}

export function generateRainbowColors(count: number): string[] {
  const colors: string[] = [];
  for (let index = 0; index < count; index += 1) {
    const hue = count > 0 ? index / count : 0;
    colors.push(rgbToHex(hsvToRgb(hue, 1, 1)));
  }
  return colors;
}

export function createMainSurfacePalette(hexColor: string, palette: 'light' | 'dark' = 'dark') {
  const clean = String(hexColor || '').replace(/^#/, '') || '888888';
  const isDark = palette === 'dark';
  return {
    accent: `#${clean}`,
    accentSoft: hexToRgba(clean, isDark ? 0.12 : 0.08),
    accentLine: hexToRgba(clean, isDark ? 0.28 : 0.32),
    accentWash: hexToRgba(clean, 0.06),
    accentPanel: hexToRgba(clean, isDark ? 0.16 : 0.14),
    accentInk: isDark ? '#f5f5f7' : '#241f28',
  };
}

export function createSubSurfacePalette(
  hexColor: string,
  isDarkened: boolean,
  palette: 'light' | 'dark' = 'light'
): MultypeSubColumnSurface {
  const clean = String(hexColor || '').replace(/^#/, '') || 'B8B8B8';
  const isDark = palette === 'dark';

  if (isDark) {
    const bodyHex = blendHex(clean, '18141D', isDarkened ? 0.32 : 0.14);
    const headerHex = blendHex(clean, '211B28', isDarkened ? 0.44 : 0.12);
    const borderHex = blendHex(clean, 'A99AB8', isDarkened ? 0.32 : 0.14);

    return {
      accent: `#${clean}`,
      accentSoft: hexToRgba(bodyHex, 0.86),
      accentLine: hexToRgba(borderHex, 0.34),
      accentWash: hexToRgba(bodyHex, 0.78),
      accentPanel: hexToRgba(headerHex, 0.92),
      accentInk: '#f4f0f6',
    };
  }

  // Light Palette: direct legacy parity
  // In legacy datamine-multype-core.js:
  // bodyHex = blendHex(clean, "FFFFFF", isDarkened ? 0.44 : 0.62)
  // headerHex = blendHex(clean, "FFFFFF", isDarkened ? 0.32 : 0.50)
  // borderHex = blendHex(clean, "7A7A7A", isDarkened ? 0.08 : 0.04)
  const bodyHex = blendHex(clean, 'FFFFFF', isDarkened ? 0.44 : 0.62);
  const headerHex = blendHex(clean, 'FFFFFF', isDarkened ? 0.32 : 0.50);
  const borderHex = blendHex(clean, '7A7A7A', isDarkened ? 0.08 : 0.04);

  return {
    accent: `#${clean}`,
    accentSoft: hexToRgba(bodyHex, 0.98),
    accentLine: hexToRgba(borderHex, 0.42),
    accentWash: hexToRgba(bodyHex, 0.92),
    accentPanel: hexToRgba(headerHex, 0.98),
    accentInk: '#1f1a1d',
  };
}

export function getAttributeColorMeta(attributeName: string): { hex: string; isDarkened: boolean } | null {
  const name = String(attributeName || '');

  if (name.includes('Crit')) {
    return {
      hex: ATTRIBUTE_COLORS.Crit,
      isDarkened: false,
    };
  }

  let baseColor = '';
  for (const key of Object.keys(ATTRIBUTE_COLORS)) {
    if (name.startsWith(key)) {
      baseColor = ATTRIBUTE_COLORS[key];
      break;
    }
  }

  if (!baseColor) {
    return null;
  }

  return {
    hex: baseColor,
    isDarkened: name.includes('Def'),
  };
}

export function stripJsonExtension(valueKey: string): string {
  return String(valueKey || '').replace(/\.json$/i, '');
}

export function canonicalizeValueBaseKey(valueBaseKey: string): string {
  return String(valueBaseKey || '')
    .replace(/_(Level|Lvl|Lv)0*\d+(?=_|$)/gi, '')
    .replace(/__+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function composeSubRenameKey(mainKey: string, subKey: string): string {
  return `${mainKey}::${subKey}`;
}

export function composeValueRenameKey(mainKey: string, subKey: string, valueKey: string): string {
  return `${mainKey}::${subKey}::${valueKey}`;
}

export function composeGroupRenameKey(mainKey: string, subKey: string, canonicalValueBaseKey: string): string {
  return `${mainKey}::${subKey}::${canonicalValueBaseKey}`;
}

export interface RenamesDict {
  mainRenames?: Record<string, string>;
  subRenames?: Record<string, string>;
  valueRenames?: Record<string, string>;
  groupRenames?: Record<string, string>;
}

export function resolveValueRename(
  renames: RenamesDict,
  mainKey: string,
  subKey: string,
  valueKey: string
): { rename: string; renameSource: 'exact' | 'group' | '' } {
  const cleanValueKey = valueKey.trim();
  const valueRenameKey = composeValueRenameKey(mainKey, subKey, cleanValueKey);
  const valueBaseKey = stripJsonExtension(cleanValueKey);
  const canonicalBaseKey = canonicalizeValueBaseKey(valueBaseKey);
  const groupRenameKey = composeGroupRenameKey(mainKey, subKey, canonicalBaseKey);

  const contextualExact = renames.valueRenames?.[valueRenameKey] || '';
  const globalExact = renames.valueRenames?.[cleanValueKey] || '';
  const exact = contextualExact || globalExact;

  if (exact) {
    return { rename: exact, renameSource: 'exact' };
  }

  const group = renames.groupRenames?.[groupRenameKey] || '';
  if (group) {
    return { rename: group, renameSource: 'group' };
  }

  return { rename: '', renameSource: '' };
}

export function matchesSingleElementFilter(
  subKey: string,
  subRename: string,
  filter: MultypeElementFilter
): boolean {
  if (!filter || filter === 'all') return true;
  const keyLower = String(subKey || '').toLowerCase();
  const renameLower = String(subRename || '').toLowerCase();

  switch (filter) {
    case 'final':
      return keyLower.includes('final') || renameLower.includes('final') || renameLower.includes('финал');
    case 'fire':
      return (
        keyLower.includes('fire') ||
        renameLower.includes('fire') ||
        renameLower.includes('огонь') ||
        renameLower.includes('пламя')
      );
    case 'ice':
      return (
        keyLower.includes('ice') ||
        keyLower.includes('frost') ||
        renameLower.includes('ice') ||
        renameLower.includes('frost') ||
        renameLower.includes('лед') ||
        renameLower.includes('лёд') ||
        renameLower.includes('мороз')
      );
    case 'volt':
      return (
        keyLower.includes('thunder') ||
        keyLower.includes('volt') ||
        renameLower.includes('thunder') ||
        renameLower.includes('volt') ||
        renameLower.includes('электро') ||
        renameLower.includes('гром') ||
        renameLower.includes('молния')
      );
    case 'phys':
      return keyLower.includes('phy') || renameLower.includes('phys') || renameLower.includes('физ');
    case 'super':
      return (
        keyLower.includes('super') ||
        keyLower.includes('alter') ||
        renameLower.includes('super') ||
        renameLower.includes('alter') ||
        renameLower.includes('альтер') ||
        renameLower.includes('супер')
      );
    default:
      return true;
  }
}

export function buildMultypeViewModel(
  rawMapping: Record<string, Record<string, string[]>>,
  renames: RenamesDict,
  filterState: MultypeFilterState,
  locale: Locale = 'en',
  aiGuesses: Record<string, {
    sourceKey: string;
    candidates: Array<{
      label: string;
      labelRu?: string;
      confidence: number;
      evidence: string[];
    }>;
  }> = {}
): MultypeViewModel {
  const isRu = locale === 'ru';
  const copy = localized(MULTYPE_COPY, locale) || MULTYPE_COPY.en;
  const query = filterState.search.trim().toLocaleLowerCase();

  const mainEntries = Object.entries(rawMapping || {}).filter(
    ([, subMap]) => subMap && typeof subMap === 'object' && !Array.isArray(subMap)
  );

  // Keep NoModule at the beginning
  mainEntries.sort(([leftKey], [rightKey]) => {
    if (leftKey === 'NoModule') return -1;
    if (rightKey === 'NoModule') return 1;
    return leftKey.localeCompare(rightKey);
  });

  const rainbowColors = generateRainbowColors(mainEntries.length);
  const groups: MultypeMainGroup[] = [];
  const mainOptions: string[] = [];
  const subOptionsSet = new Set<string>();

  let totalVisibleSubs = 0;
  let totalVisibleValues = 0;

  mainEntries.forEach(([mainKey, subMap], mainIndex) => {
    mainOptions.push(mainKey);
    const mainPalette = createMainSurfacePalette(
      rainbowColors[mainIndex] || '888888',
      filterState.palette
    );

    if (filterState.mainFilter && filterState.mainFilter !== 'all' && mainKey !== filterState.mainFilter) {
      return;
    }

    const mainRenameDefault = renames.mainRenames?.[mainKey] || mainKey;
    const mainDisplayLabel = isRu
      ? CATEGORY_LABELS_RU[mainKey] || mainRenameDefault
      : mainRenameDefault;

    const mainMatchesQuery =
      !query ||
      mainKey.toLowerCase().includes(query) ||
      mainDisplayLabel.toLowerCase().includes(query);

    const subColumns: MultypeSubColumn[] = [];

    Object.entries(subMap).forEach(([subKey, fileList]) => {
      subOptionsSet.add(subKey);

      if (filterState.subFilter && filterState.subFilter !== 'all' && subKey !== filterState.subFilter) {
        return;
      }

      const subRenameKey = composeSubRenameKey(mainKey, subKey);
      const subRename = renames.subRenames?.[subRenameKey] || '';

      if (filterState.elementFilter && filterState.elementFilter !== 'all') {
        if (!matchesSingleElementFilter(subKey, subRename, filterState.elementFilter)) {
          return;
        }
      }

      const subDisplayLabel =
        filterState.mode === 'datamined' ? subKey : subRename || subKey;

      const subMatchesQuery =
        !query ||
        mainMatchesQuery ||
        subKey.toLowerCase().includes(query) ||
        subDisplayLabel.toLowerCase().includes(query);

      const colorMeta = getAttributeColorMeta(subKey);
      const surface = colorMeta
        ? createSubSurfacePalette(colorMeta.hex, colorMeta.isDarkened, filterState.palette)
        : createSubSurfacePalette(DEFAULT_NON_ELEMENTAL_COLOR, false, filterState.palette);

      const candidateValues: MultypeValueItem[] = [];

      (fileList || []).forEach((cleanValueKey) => {
        const valueBaseKey = stripJsonExtension(cleanValueKey);
        const canonicalBaseKey = canonicalizeValueBaseKey(valueBaseKey);
        const renameResult = resolveValueRename(renames, mainKey, subKey, cleanValueKey);
        const hasRename = Boolean(renameResult.rename);
        const guess = aiGuesses[cleanValueKey] || aiGuesses[valueBaseKey];
        const bestGuess = guess?.candidates?.[0];
        const rawAiGuessLabel = bestGuess
          ? (isRu ? bestGuess.labelRu || bestGuess.label : bestGuess.label)
          : '';
        const enriched = resolveEnrichedAiGuess(
          cleanValueKey,
          bestGuess?.label,
          bestGuess?.labelRu,
          isRu,
          locale
        );
        const aiGuessLabel = enriched.label || rawAiGuessLabel;
        const aiGuessSuitName = enriched.suitName;
        const hasDisplayedRename = hasRename || (
          filterState.mode === 'ai-guess' && Boolean(aiGuessLabel)
        );
        const aiGuessConfidence = bestGuess?.confidence ?? (enriched.matchedType !== 'generic' ? 0.98 : null);
        const aiMatchKind = aiGuessConfidence === null
          ? ''
          : aiGuessConfidence >= 0.97
            ? copy.aiMatchExact
            : aiGuessConfidence >= 0.88
              ? copy.aiMatchStrong
              : copy.aiMatchPartial;

        if (filterState.mode === 'renamed' && !hasRename) {
          return;
        }

        // AI-guess mode shows only renamed content: manual renames and AI
        // guesses (explicit candidates or knowledge-base matches). Fully
        // unrenamed datamine keys stay hidden unless the rename filter
        // explicitly asks for them. Note: hasDisplayedRename is true even
        // for raw keys via the generic enriched fallback, so check the AI
        // content explicitly here.
        const hasAiContent = Boolean(bestGuess) || enriched.matchedType !== 'generic';
        if (
          filterState.mode === 'ai-guess' &&
          filterState.renameFilter !== 'unrenamed' &&
          !hasRename &&
          !hasAiContent
        ) {
          return;
        }

        if (filterState.renameFilter === 'renamed' && !hasDisplayedRename) {
          return;
        }

        if (filterState.renameFilter === 'unrenamed' && hasDisplayedRename) {
          return;
        }

        const displayLabel =
          filterState.mode === 'datamined'
            ? valueBaseKey
            : filterState.mode === 'ai-guess'
              ? aiGuessLabel || renameResult.rename || valueBaseKey
            : renameResult.rename || valueBaseKey;

        const valueMatchesQuery =
          subMatchesQuery ||
          cleanValueKey.toLowerCase().includes(query) ||
          valueBaseKey.toLowerCase().includes(query) ||
          canonicalBaseKey.toLowerCase().includes(query) ||
          renameResult.rename.toLowerCase().includes(query) ||
          displayLabel.toLowerCase().includes(query) ||
          Boolean(aiGuessSuitName && aiGuessSuitName.toLowerCase().includes(query));

        if (!valueMatchesQuery) {
          return;
        }

        candidateValues.push({
          primaryValueKey: cleanValueKey,
          allValueKeys: [cleanValueKey],
          valueBaseKey,
          canonicalValueBaseKey: canonicalBaseKey,
          hasRename,
          displayLabel,
          originalLabel: valueBaseKey,
          renameLabel: renameResult.rename,
          manualRenameLabels: renameResult.rename ? [renameResult.rename] : [],
          renameSource: renameResult.renameSource,
          tooltipTitle: displayLabel,
          tooltipLines: filterState.mode === 'ai-guess'
            ? [
                aiGuessConfidence !== null ? `${Math.round(aiGuessConfidence * 100)}% · ${aiMatchKind}` : '',
                copy.aiSourceFiles,
                valueBaseKey,
              ]
            : hasRename ? [valueBaseKey] : [],
          isDeduped: false,
          aiGuessLabel,
          aiGuessConfidence,
          aiGuessEvidence: bestGuess?.evidence || (enriched.matchedType !== 'generic' ? [cleanValueKey] : []),
          aiGuessSuitName,
        });
      });

      if (!candidateValues.length) {
        return;
      }

      // Human and AI labels both represent the same entity-level grouping.
      // Collapse identical labels inside a subcolumn while preserving every
      // original buff key for copy/tooltip inspection.
      let valuesToRender: MultypeValueItem[] = candidateValues;

      if (filterState.mode === 'renamed' || filterState.mode === 'ai-guess') {
        const byDisplay = new Map<string, MultypeValueItem>();

        candidateValues.forEach((entry) => {
          const existing = byDisplay.get(entry.displayLabel);
          if (existing) {
            existing.allValueKeys.push(entry.primaryValueKey);
            existing.tooltipLines.push(entry.originalLabel);
            entry.manualRenameLabels.forEach((label) => {
              if (!existing.manualRenameLabels.includes(label)) {
                existing.manualRenameLabels.push(label);
              }
            });
            existing.hasRename = existing.hasRename || entry.hasRename;
            existing.isDeduped = true;
            if (!existing.aiGuessSuitName && entry.aiGuessSuitName) {
              existing.aiGuessSuitName = entry.aiGuessSuitName;
            }
            return;
          }

          byDisplay.set(entry.displayLabel, {
            ...entry,
            allValueKeys: [...entry.allValueKeys],
            tooltipLines: [...entry.tooltipLines],
            manualRenameLabels: [...entry.manualRenameLabels],
          });
        });

        valuesToRender = Array.from(byDisplay.values());
      }

      totalVisibleSubs += 1;
      totalVisibleValues += valuesToRender.length;

      subColumns.push({
        subKey,
        subRenameKey,
        displayLabel: subDisplayLabel,
        surface,
        values: valuesToRender,
      });
    });

    if (subColumns.length > 0) {
      groups.push({
        mainKey,
        displayLabel: mainDisplayLabel,
        accent: mainPalette.accent,
        accentSoft: mainPalette.accentSoft,
        accentLine: mainPalette.accentLine,
        accentWash: mainPalette.accentWash,
        accentPanel: mainPalette.accentPanel,
        accentInk: mainPalette.accentInk,
        subColumns,
      });
    }
  });

  return {
    groups,
    totalGroups: groups.length,
    totalVisibleSubs,
    totalVisibleValues,
    mainOptions,
    subOptions: Array.from(subOptionsSet).sort(),
  };
}

export function buildGlobalStats(
  rawMapping: Record<string, Record<string, string[]>>,
  renames: RenamesDict
): MultypeGlobalStats {
  let totalCategories = 0;
  let totalSubcategories = 0;
  let totalBuffs = 0;
  let renamedMainCount = 0;
  let renamedSubCount = 0;
  let renamedValueCount = 0;

  for (const [mainKey, subMap] of Object.entries(rawMapping || {})) {
    totalCategories += 1;
    if (renames.mainRenames?.[mainKey]) {
      renamedMainCount += 1;
    }

    for (const [subKey, fileList] of Object.entries(subMap || {})) {
      totalSubcategories += 1;
      const subRenameKey = composeSubRenameKey(mainKey, subKey);
      if (renames.subRenames?.[subRenameKey]) {
        renamedSubCount += 1;
      }

      for (const fileKey of fileList || []) {
        totalBuffs += 1;
        const res = resolveValueRename(renames, mainKey, subKey, fileKey);
        if (res.rename) {
          renamedValueCount += 1;
        }
      }
    }
  }

  return {
    totalCategories,
    totalSubcategories,
    totalBuffs,
    renamedMainCount,
    renamedSubCount,
    renamedValueCount,
  };
}
