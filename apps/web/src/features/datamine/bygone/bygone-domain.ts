import type { BygoneFloorItem, BygonePowercreep } from './bygone-types';
import { gameAsset } from '@tof-hub/game-assets';

/**
 * Formats HP stack values into the community standard 'G' display.
 * 1 million stack points are presented as 1G (e.g. 100,974,450 -> 100.9G).
 * The explicit 'hp' input uses actual health units: 1e6 = M, 1e9 = G.
 */
export function formatHpG(value: number, source: 'stacks' | 'hp' = 'stacks', digits = 1): string {
  const number = Number(value || 0);
  if (source === 'hp') {
    if (Math.abs(number) >= 1e9) return `${(number / 1e9).toFixed(digits)}G`;
    if (Math.abs(number) >= 1e6) return `${(number / 1e6).toFixed(digits)}M`;
  }
  if (source === 'stacks' && Math.abs(number) >= 1e6) {
    const truncated = Math.trunc((number / 1e6) * 10) / 10;
    return `${truncated.toFixed(1)}G`;
  }
  if (Math.abs(number) >= 1e3) {
    return `${(number / 1e3).toFixed(1)}K`;
  }
  return Math.round(number).toLocaleString('en-US');
}

/**
 * Formats powercreep percentage with sign and 2 decimals.
 */
export function formatPowercreep(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '—';
  }
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

/**
 * Calculates floor-to-floor powercreep percentage relative to the previous non-duplicate floor.
 */
export function getFloorPowercreep(
  floors: readonly Pick<BygoneFloorItem, 'floor' | 'hp_buff_stacks' | 'is_duplicate'>[],
  currentFloor: Pick<BygoneFloorItem, 'floor' | 'hp_buff_stacks'>
): BygonePowercreep | null {
  if (!currentFloor || !Array.isArray(floors)) return null;

  const currentHp = Number(currentFloor.hp_buff_stacks);
  if (!Number.isFinite(currentHp)) return null;

  // Find previous non-duplicate floor
  let previous: (typeof floors)[number] | null = null;
  for (let i = floors.length - 1; i >= 0; i--) {
    const f = floors[i];
    if (!f.is_duplicate && f.floor < currentFloor.floor) {
      previous = f;
      break;
    }
  }

  if (!previous) return null;
  const previousHp = Number(previous.hp_buff_stacks);
  if (!Number.isFinite(previousHp) || previousHp <= 0) return null;

  return {
    previousFloor: previous.floor,
    percent: ((currentHp - previousHp) / previousHp) * 100,
  };
}

/**
 * Resolves localized enemy name.
 */
export function getEnemyDisplayName(
  primary: BygoneFloorItem['primary_enemy'],
  isRu: boolean
): string {
  if (!primary) return 'Unknown Monster';
  if (isRu && primary.name_ru) return primary.name_ru;
  return primary.name_en || 'Unknown Monster';
}

export function getMissingBygoneEnemyName(floor: number, isRu: boolean): string {
  if (floor > 500) return '';
  return isRu ? 'Шаблон масштабирования: BigSecret_Boss' : 'Scaling Template: BigSecret_Boss';
}

/**
 * Formats an integer with commas (e.g. 10,800).
 */
export function formatNumber(num: number): string {
  return Number(num || 0).toLocaleString('en-US');
}

/**
 * Returns element icon path from element string.
 */
export function getElemIcon(elem: string): string | null {
  const norm = String(elem || '').toLowerCase();
  if (norm.includes('phys')) return '/datamine/shared/assets/icons/elements/elem_phys.webp';
  if (norm.includes('flame') || norm.includes('fire')) return '/datamine/shared/assets/icons/elements/elem_fire.webp';
  if (norm.includes('frost') || norm.includes('ice')) return '/datamine/shared/assets/icons/elements/elem_frost.webp';
  if (norm.includes('volt') || norm.includes('thunder') || norm.includes('elect')) return '/datamine/shared/assets/icons/elements/elem_volt.webp';
  if (norm.includes('alter') || norm.includes('super')) return '/datamine/shared/assets/icons/elements/elem_altered.webp';
  return null;
}

/** Returns the same elemental icon asset used by the Simulacra presentation. */
export function getWeaknessGameIcon(elem: string): string | null {
  const norm = String(elem || '').trim().toLowerCase();
  let suffix: string | null = null;

  if (norm.includes('phys') || norm.includes('physical') || norm.includes('физ')) suffix = 'wu';
  else if (norm.includes('flame') || norm.includes('fire') || norm.includes('огн')) suffix = 'huo';
  else if (norm.includes('frost') || norm.includes('ice') || norm.includes('лёд') || norm.includes('лед')) suffix = 'bing';
  else if (norm.includes('volt') || norm.includes('thunder') || norm.includes('elect') || norm.includes('элект')) suffix = 'lei';
  else if (norm.includes('alter') || norm.includes('super') || norm.includes('измен')) suffix = 'powers';

  return suffix
    ? gameAsset(`Hotta/Content/Resources/UI/wuqi/icon_element_${suffix}`)
    : null;
}

/**
 * Returns accent color for element tag or dot.
 */
export function getElementColor(elem: string): string {
  const norm = String(elem || '').toLowerCase();
  if (norm.includes('phys')) return '#e5e7eb';
  if (norm.includes('flame') || norm.includes('fire')) return '#f97316';
  if (norm.includes('frost') || norm.includes('ice')) return '#38bdf8';
  if (norm.includes('volt') || norm.includes('thunder') || norm.includes('elect')) return '#c084fc';
  if (norm.includes('alter') || norm.includes('super')) return '#f43f5e';
  return '#94a3b8';
}

/**
 * Interpolates template strings like "Floors {start}–{end} · {count} floors".
 */
export function formatRangeStatus(
  template: string,
  start: number,
  end: number,
  count: number
): string {
  return template
    .replace('{start}', String(start))
    .replace('{end}', String(end))
    .replace('{count}', String(count));
}
