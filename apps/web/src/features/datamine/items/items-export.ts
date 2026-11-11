import type { ItemRow, ItemsMode, ItemsExportPayload } from './items-types';
import { downloadJson } from '@/lib/download';

/**
 * Downloads items dataset as a JSON file matching legacy export schema.
 */
export function exportItemsJson(
  rows: ItemRow[],
  mode: ItemsMode,
  filename?: string
): void {
  if (typeof window === 'undefined') return;

  const exportPayload: ItemsExportPayload = {
    dataset: mode,
    count: rows.length,
    items: rows.map((row) => {
      const numVal = Number(row.num);
      return {
        num: Number.isFinite(numVal) ? numVal : row.num,
        id: row.id,
        name: row.name,
        original: row.original,
        rename: row.rename,
        ...(row.hasQuality ? { quality: row.quality } : {}),
        ...(row.icon ? { icon: row.icon } : {}),
        ...(row.description_en ? { description_en: row.description_en } : {}),
        ...(row.description_ru ? { description_ru: row.description_ru } : {}),
        ...(mode === 'mmo' && row.trade ? {trade: row.trade} : {}),
      };
    }),
  };

  const name = filename || `tof-items-${mode}.json`;
  downloadJson(exportPayload, name);
}
