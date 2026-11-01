import type { SupportedLocale } from './types';

/**
 * Deterministically sorts an array of records by their stable 'id' property.
 */
export function sortById<T extends { id?: string | number }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const idA = String(a.id ?? '');
    const idB = String(b.id ?? '');
    return idA.localeCompare(idB);
  });
}

/**
 * Deep clones an object safely without retaining references.
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Helper to extract localized text from raw values supporting either
 * `{ en: string, ru: string }` or `*_en / *_ru` field conventions.
 */
export function extractLocalizedStrings(
  raw: Record<string, any>,
  fieldBase: string
): { en: string; ru: string } {
  const directObj = raw[fieldBase];
  if (directObj && typeof directObj === 'object') {
    return {
      en: String(directObj.en || ''),
      ru: String(directObj.ru || directObj.en || ''),
    };
  }

  const enVal = raw[`${fieldBase}_en`] ?? raw[fieldBase] ?? '';
  const ruVal = raw[`${fieldBase}_ru`] ?? enVal;

  return {
    en: String(enVal),
    ru: String(ruVal),
  };
}

/**
 * Merges a language-independent core object with a localized overlay object.
 * Overlay values overwrite undefined / empty core values while preserving core structure.
 */
export function mergeCoreAndOverlay<C extends Record<string, any>, O extends Record<string, any>>(
  core: C,
  overlay: O
): C & O {
  const result = { ...core, ...overlay };
  return result;
}

/**
 * Merges core array and localized overlay array matching by record 'id'.
 */
export function mergeEntityList<C extends { id: string }, O extends { id: string }>(
  coreList: C[],
  overlayList: O[]
): Array<C & O> {
  const overlayMap = new Map<string, O>();
  for (const item of overlayList) {
    overlayMap.set(item.id, item);
  }

  return sortById(
    coreList.map((core) => {
      const overlay = overlayMap.get(core.id) || ({} as O);
      return mergeCoreAndOverlay(core, overlay);
    })
  );
}
