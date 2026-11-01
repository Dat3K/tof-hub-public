import type { BygoneFloorItem, BygoneChartKind } from './bygone-types';
import { getFloorPowercreep } from './bygone-domain';

/**
 * Exports CSV file for Bygone floors within the selected range.
 */
export function exportBygoneCsv(
  floors: BygoneFloorItem[],
  chartKind: BygoneChartKind,
  minFloor: number,
  maxFloor: number,
  showRepeats: boolean
): void {
  if (!Array.isArray(floors) || floors.length === 0) return;

  const fileName = `bygone-${chartKind}-floors-${minFloor}-to-${maxFloor}.csv`;

  const visibleFloors = floors.filter((f) => {
    if (f.floor < minFloor || f.floor > maxFloor) return false;
    if (!showRepeats && f.is_duplicate) return false;
    return true;
  });

  const headers =
    chartKind === 'powercreep'
      ? ['Floor', 'PreviousFloor', 'PowercreepPercent', 'HpBuffStacks', 'Weakness', 'IsDuplicate']
      : [
          'Floor',
          'DisplayedDifficulty',
          'HpBuffStacks',
          'PowercreepPercent',
          'AtkBuffStacks',
          'MonsterLevel',
          'Weakness',
          'IsBoss',
          'IsDuplicate',
        ];

  const rows = visibleFloors.map((f) => {
    const weaknesses = Array.isArray(f.weakness)
      ? f.weakness.map((w) => w.element || w.name_en || '').join(';')
      : '';
    const powercreep = getFloorPowercreep(floors, f);

    if (chartKind === 'powercreep') {
      return [
        f.floor,
        powercreep?.previousFloor ?? '',
        powercreep ? powercreep.percent.toFixed(6) : '',
        f.hp_buff_stacks,
        `"${weaknesses}"`,
        f.is_duplicate ? 1 : 0,
      ].join(',');
    }

    return [
      f.floor,
      f.displayed_difficulty,
      f.hp_buff_stacks,
      powercreep ? powercreep.percent.toFixed(6) : '',
      f.atk_buff_stacks,
      f.monster_level || 70,
      `"${weaknesses}"`,
      f.is_boss_floor ? 1 : 0,
      f.is_duplicate ? 1 : 0,
    ].join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/**
 * Downloads a canvas element as a PNG image.
 */
export async function exportCanvasAsPng(
  canvas: HTMLCanvasElement,
  fileName: string
): Promise<void> {
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/png')
  );
  if (!blob) return;

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
