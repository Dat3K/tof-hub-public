import {
  getLocalizedValue,
  type LocalizedText,
  type SupportedLocale,
} from './localization';

export type Element = 'Volt' | 'Flame' | 'Frost' | 'Physical' | 'Altered';

export const ELEMENTS: readonly Element[] = [
  'Volt',
  'Flame',
  'Frost',
  'Physical',
  'Altered',
] as const;

export function isElement(value: unknown): value is Element {
  return typeof value === 'string' && ELEMENTS.includes(value as Element);
}

export type ElementLabelForm = 'full' | 'short';

export const ELEMENT_LABELS: Record<Element, LocalizedText> = {
  Physical: { en: 'Physical', ru: 'Физический', de: 'Physisch', es: 'Físico', fr: 'Physique', id: 'Fisik', ja: '物理', ko: '물리', pt: 'Físico', th: 'กายภาพ', 'zh-CN': '物理', 'zh-Hans': '物理', 'zh-Hans-SG': '物理' },
  Flame: { en: 'Flame', ru: 'Огненный', de: 'Flamme', es: 'Fuego', fr: 'Flamme', id: 'Api', ja: '炎', ko: '화염', pt: 'Chama', th: 'ไฟ', 'zh-CN': '火焰', 'zh-Hans': '火焰', 'zh-Hans-SG': '火焰' },
  Frost: { en: 'Frost', ru: 'Ледяной', de: 'Frost', es: 'Hielo', fr: 'Givre', id: 'Es', ja: '氷', ko: '얼음', pt: 'Gelo', th: 'น้ำแข็ง', 'zh-CN': '寒冰', 'zh-Hans': '寒冰', 'zh-Hans-SG': '寒冰' },
  Volt: { en: 'Volt', ru: 'Электрический', de: 'Elektro', es: 'Rayo', fr: 'Foudre', id: 'Listrik', ja: '雷', ko: '번개', pt: 'Elétrico', th: 'สายฟ้า', 'zh-CN': '雷电', 'zh-Hans': '雷电', 'zh-Hans-SG': '雷电' },
  Altered: { en: 'Altered', ru: 'Аберрация', de: 'Verändert', es: 'Alterado', fr: 'Altéré', id: 'Altered', ja: '異能', ko: '이능', pt: 'Alterado', th: 'แปรสภาพ', 'zh-CN': '异能', 'zh-Hans': '异能', 'zh-Hans-SG': '异能' },
};

/** Short names: the Info element filters and every Tools label, chip and badge. */
export const ELEMENT_SHORT_LABELS: Record<Element, LocalizedText> = {
  Physical: { en: 'Physical', ru: 'Физ.', de: 'Physisch', es: 'Físico', fr: 'Physique', id: 'Fisik', ja: '物理', ko: '물리', pt: 'Físico', th: 'กายภาพ', 'zh-CN': '物理', 'zh-Hans': '物理', 'zh-Hans-SG': '物理' },
  Flame: { en: 'Flame', ru: 'Огонь', de: 'Flamme', es: 'Fuego', fr: 'Flamme', id: 'Api', ja: '炎', ko: '화염', pt: 'Chama', th: 'ไฟ', 'zh-CN': '火焰', 'zh-Hans': '火焰', 'zh-Hans-SG': '火焰' },
  Frost: { en: 'Frost', ru: 'Лед', de: 'Frost', es: 'Hielo', fr: 'Givre', id: 'Es', ja: '氷', ko: '얼음', pt: 'Gelo', th: 'น้ำแข็ง', 'zh-CN': '寒冰', 'zh-Hans': '寒冰', 'zh-Hans-SG': '寒冰' },
  Volt: { en: 'Volt', ru: 'Электро', de: 'Elektro', es: 'Rayo', fr: 'Foudre', id: 'Listrik', ja: '雷', ko: '번개', pt: 'Elétrico', th: 'สายฟ้า', 'zh-CN': '雷电', 'zh-Hans': '雷电', 'zh-Hans-SG': '雷电' },
  Altered: { en: 'Altered', ru: 'Аберрация', de: 'Verändert', es: 'Alterado', fr: 'Altéré', id: 'Altered', ja: '異能', ko: '이능', pt: 'Alterado', th: 'แปรสภาพ', 'zh-CN': '异能', 'zh-Hans': '异能', 'zh-Hans-SG': '异能' },
};

/** Short element name of an element id in any case (`Frost`, `frost`); any other value is returned as given. */
export function getElementShortLabel(value: string, locale: SupportedLocale = 'en'): string {
  const element = ELEMENTS.find((item) => item.toLowerCase() === value.trim().toLowerCase());
  return element ? getLocalizedValue(ELEMENT_SHORT_LABELS[element], locale) : value;
}

export function getElementLabel(
  element: unknown,
  locale: SupportedLocale = 'en',
  form: ElementLabelForm = 'full',
): string {
  const normalized = normalizeElement(
    typeof element === 'string' ? element : '',
  );
  const table = form === 'short' ? ELEMENT_SHORT_LABELS : ELEMENT_LABELS;
  const label = table[normalized];
  if (!label) return typeof element === 'string' ? element : '';
  return getLocalizedValue(label, locale);
}

export function normalizeElement(raw: string | null | undefined): Element {
  if (!raw) return 'Altered';
  const norm = raw.trim().toLowerCase();
  switch (norm) {
    case 'volt':
    case 'thunder':
      return 'Volt';
    case 'flame':
    case 'fire':
      return 'Flame';
    case 'frost':
    case 'ice':
      return 'Frost';
    case 'physical':
    case 'physics':
    case 'phys':
      return 'Physical';
    case 'altered':
    case 'superpower':
      return 'Altered';
    default:
      return 'Altered';
  }
}

/** Element filters classify a weapon by its primary element; the secondary element is display metadata. */
export function matchesPrimaryElement(
  primary: string | null | undefined,
  selected: Iterable<string>,
): boolean {
  if (!primary) return false;
  const normalizedPrimary = normalizeElement(primary);
  for (const element of selected) {
    if (element && normalizeElement(element) === normalizedPrimary) return true;
  }
  return false;
}
