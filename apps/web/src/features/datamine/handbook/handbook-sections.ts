import type { HandbookMode, HandbookSectionId } from '../contracts/handbook';

export interface HandbookSectionDefinition {
  id: HandbookSectionId;
  /** Generated file under game-data/handbook/, or null when the section reads another dataset. */
  file: string | null;
  /**
   * `both`: Gacha and MMO data; `gacha` / `mmo`: mode-only data;
   * `shared`: the same content in both modes.
   */
  modes: 'both' | 'gacha' | 'mmo' | 'shared';
}

/** Page order and anchors (docs/game-data/README.md). */
export const HANDBOOK_SECTIONS: readonly HandbookSectionDefinition[] = [
  { id: 'random-stats', file: 'random-stats', modes: 'both' },
  { id: 'expansion', file: 'mmo-expansion', modes: 'mmo' },
  { id: 'brainfield', file: 'mmo-brainfield', modes: 'mmo' },
  { id: 'titan', file: 'titan', modes: 'gacha' },
  { id: 'cs', file: 'cs', modes: 'gacha' },
  { id: 'supercomputer', file: 'supercomputer', modes: 'gacha' },
  { id: 'space-support', file: 'space-support', modes: 'gacha' },
  { id: 'enhancement', file: 'enhancement', modes: 'gacha' },
  { id: 'suppressor', file: 'suppressor', modes: 'both' },
  { id: 'combat-formulas', file: 'combat-formulas', modes: 'gacha' },
  { id: 'servers', file: null, modes: 'shared' },
];

export const HANDBOOK_PATH = '/datamine/handbook/';

/** Preserve bookmarked MMO pages after moving encounters out of the systems handbook. */
export function legacyHandbookDestination(hash: string): string | null {
  const [section, sub] = hash.replace(/^#/, '').split('/');
  if (section === 'bygone-phantasm') return '/datamine/bygone/?mode=mmo';
  if (section === 'mmo-raids') return '/datamine/raids/';
  if (section === 'biochemical-collapse') return `/datamine/seq/?mode=mmo${sub ? `&pod=${encodeURIComponent(sub)}` : ''}`;
  return null;
}

/** `?server=mmo` selects MMO; anything else is Gacha. */
export function parseHandbookMode(value: string | string[] | null | undefined): HandbookMode {
  const first = Array.isArray(value) ? value[0] : value;
  return first?.toLowerCase() === 'mmo' ? 'mmo' : 'gacha';
}

export function isSectionVisible(section: HandbookSectionDefinition, mode: HandbookMode): boolean {
  if (section.modes === 'gacha' || section.modes === 'mmo') return section.modes === mode;
  return true;
}

export function visibleHandbookSections(mode: HandbookMode): HandbookSectionDefinition[] {
  return HANDBOOK_SECTIONS.filter((section) => isSectionVisible(section, mode));
}

/** Section addressed by a location hash (`#titan`), or null for an empty or unknown hash. */
/** `#section` or `#section/sub`: the section tab and, optionally, one of its sub-tabs. */
export function parseHandbookHash(hash: string): { section: HandbookSectionDefinition; sub: string | null } | null {
  const [id = '', sub = ''] = decodeURIComponent(hash.replace(/^#/, '')).split('/');
  const section = HANDBOOK_SECTIONS.find((candidate) => candidate.id === id);
  return section ? { section, sub: sub || null } : null;
}

export function handbookSectionFromHash(hash: string): HandbookSectionDefinition | null {
  return parseHandbookHash(hash)?.section ?? null;
}

export function handbookHash(id: HandbookSectionId, sub?: string | null): string {
  return `#${id}${sub ? `/${sub}` : ''}`;
}

/** Page URL for a mode, keeping the hash only when its section stays visible in that mode. */
export function handbookHref(mode: HandbookMode, hash = ''): string {
  const parsed = parseHandbookHash(hash);
  const keepHash = parsed && isSectionVisible(parsed.section, mode) ? handbookHash(parsed.section.id, parsed.sub) : '';
  return `${HANDBOOK_PATH}${mode === 'mmo' ? '?server=mmo' : ''}${keepHash}`;
}
