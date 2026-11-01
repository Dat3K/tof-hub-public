import type { SeqStageItem, SeqChartKey } from './seq-types';

/**
 * Generates and downloads a CSV export for Sequential stages.
 */
export interface SeqRequiredDamageExport {
  /** Required cactus damage by stage number; missing stages export empty cells. */
  requiredDamage: Map<number, number>;
  resistIgnore: number;
  damageBonus: number;
  supportLevel: number;
  baseDamagePercent: number;
}

export function exportSeqCsv(
  stages: SeqStageItem[],
  chartKey: SeqChartKey,
  stageLimit: number = 35,
  required?: SeqRequiredDamageExport
): void {
  if (!Array.isArray(stages) || stages.length === 0) return;

  const fileName = `${chartKey}-sequential-stage-1-to-${stageLimit}.csv`;
  let headers: string[] = [];
  let rows: string[] = [];

  if (chartKey === 'effective') {
    const percent = (value: number | undefined) =>
      value === undefined ? '' : `${Math.round(value * 100)}%`;
    headers = [
      'Stage',
      'Codename',
      'MaxHealth',
      'Def',
      'ResistIgnore',
      'SpaceSupportSequentialLevel',
      'SequentialDamageBonus',
      'BaseDamagePercent',
      'RequiredCactusDamage150s',
    ];
    rows = stages.map((s) => {
      const value = required?.requiredDamage.get(s.stage);
      return [
        s.stage,
        `"${s.enemyNameEn || s.codename}"`,
        s.maxHealth,
        s.def ?? '',
        percent(required?.resistIgnore),
        required?.supportLevel ?? '',
        percent(required?.damageBonus),
        percent(required?.baseDamagePercent),
        value === undefined ? '' : Math.round(value),
      ].join(',');
    });
  } else if (chartKey === 'pure') {
    headers = ['Stage', 'Codename', 'MaxHealth', 'Atk', 'Def', 'CritResist', 'Powercreep'];
    rows = stages.map((s) =>
      [
        s.stage,
        `"${s.enemyNameEn || s.codename}"`,
        s.maxHealth,
        s.atk ?? '',
        s.def ?? '',
        s.critResist,
        s.powercreep.toFixed(2) + '%',
      ].join(',')
    );
  } else {
    // powercreep
    headers = ['Stage', 'Codename', 'EffectiveHp', 'PowercreepPercent', 'MechanicsNote'];
    rows = stages.map((s) =>
      [
        s.stage,
        `"${s.enemyNameEn || s.codename}"`,
        s.effectiveHp,
        s.powercreep.toFixed(2) + '%',
        `"${s.mechanicsNote}"`,
      ].join(',')
    );
  }

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
 * Rasterizes an SVG element to a high-DPI PNG and triggers client download.
 */
export async function exportSvgAsPng(
  svgElement: SVGSVGElement,
  fileName: string,
  scale: number = 2
): Promise<void> {
  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(svgElement);
  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const blobUrl = URL.createObjectURL(svgBlob);

  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = blobUrl;
  });

  const width = (svgElement.viewBox.baseVal.width || 1800) * scale;
  const height = (svgElement.viewBox.baseVal.height || 760) * scale;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    URL.revokeObjectURL(blobUrl);
    return;
  }

  ctx.drawImage(img, 0, 0, width, height);
  URL.revokeObjectURL(blobUrl);

  const pngBlob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/png')
  );
  if (!pngBlob) return;

  const url = URL.createObjectURL(pngBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
