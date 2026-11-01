import type { MultypeViewModel } from './multype-types';
import { downloadJson } from '@/lib/download';

/**
 * Downloads filtered multype dataset as a JSON file.
 */
export function exportMultypeJson(
  viewModel: MultypeViewModel,
  mode: string,
  filename = 'tof-multype-dataset.json'
): void {
  if (typeof window === 'undefined') return;

  const exportData = {
    exportedAt: new Date().toISOString(),
    mode,
    totalGroups: viewModel.totalGroups,
    totalVisibleSubs: viewModel.totalVisibleSubs,
    totalVisibleValues: viewModel.totalVisibleValues,
    groups: viewModel.groups.map((group) => ({
      mainKey: group.mainKey,
      label: group.displayLabel,
      subColumns: group.subColumns.map((sub) => ({
        subKey: sub.subKey,
        label: sub.displayLabel,
        values: sub.values.map((val) => ({
          label: val.displayLabel,
          primaryKey: val.primaryValueKey,
          allKeys: val.allValueKeys,
          hasRename: val.hasRename,
        })),
      })),
    })),
  };

  downloadJson(exportData, filename);
}

/**
 * Native Canvas-based table rasterizer for PNG export.
 */
export async function exportMultypeTableToPng(
  viewModel: MultypeViewModel,
  palette: 'light' | 'dark' = 'dark',
  filename = 'tof-multype-table.png'
): Promise<void> {
  if (typeof window === 'undefined') return;

  // Measure columns and required canvas dimensions
  const colWidth = 200;
  const colGap = 8;
  const padding = 24;
  const headerHeight = 84;
  const cellHeight = 32;
  const cellGap = 4;

  let totalCols = 0;
  let maxRows = 0;

  for (const group of viewModel.groups) {
    totalCols += group.subColumns.length;
    for (const sub of group.subColumns) {
      if (sub.values.length > maxRows) {
        maxRows = sub.values.length;
      }
    }
  }

  if (totalCols === 0 || maxRows === 0) {
    return;
  }

  const canvasWidth = padding * 2 + totalCols * colWidth + (totalCols - 1) * colGap;
  const canvasHeight = padding * 2 + headerHeight + maxRows * (cellHeight + cellGap);

  const exportScale = 2;
  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth * exportScale;
  canvas.height = canvasHeight * exportScale;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.scale(exportScale, exportScale);

  const isDark = palette === 'dark';
  const bgColor = '#0d0a14';
  const cardBg = isDark ? '#16121f' : '#ffffff';
  const textColor = isDark ? '#f4f0f6' : '#1a1622';
  const mutedTextColor = isDark ? '#a498b0' : '#645870';
  const borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';

  // Fill background
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // Draw title banner
  ctx.font = 'bold 16px sans-serif';
  ctx.fillStyle = textColor;
  ctx.fillText('Tower of Fantasy — Multype Multipliers Table', padding, padding);

  let currentX = padding;

  for (const group of viewModel.groups) {
    const groupWidth = group.subColumns.length * colWidth + (group.subColumns.length - 1) * colGap;

    // Main group header
    ctx.fillStyle = isDark
      ? (group.accentSoft || 'rgba(255,255,255,0.05)')
      : 'rgba(16, 13, 20, 0.92)';
    ctx.strokeStyle = group.accent || borderColor;
    ctx.lineWidth = 1.5;
    const mainHeaderY = padding + 16;
    ctx.beginPath();
    ctx.roundRect(currentX, mainHeaderY, groupWidth, 32, 4);
    ctx.fill();
    ctx.stroke();

    ctx.font = 'bold 13px sans-serif';
    ctx.fillStyle = isDark ? '#ffffff' : group.accent || '#f4f0f6';
    ctx.textAlign = 'center';
    ctx.fillText(group.displayLabel, currentX + groupWidth / 2, mainHeaderY + 20);

    // Render each sub column
    for (const sub of group.subColumns) {
      const subHeaderY = mainHeaderY + 36;
      const subColumnHeight = 28 + 6 + sub.values.length * (cellHeight + cellGap);

      // In light mode, draw pastel subcolumn container
      if (!isDark && sub.surface.accentSoft) {
        ctx.fillStyle = sub.surface.accentSoft;
        ctx.strokeStyle = sub.surface.accentLine || borderColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(currentX, subHeaderY, colWidth, subColumnHeight, 6);
        ctx.fill();
        ctx.stroke();
      }

      // Sub header
      ctx.fillStyle = sub.surface.accentPanel || cardBg;
      ctx.strokeStyle = sub.surface.accentLine || borderColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(currentX, subHeaderY, colWidth, 28, 4);
      ctx.fill();
      ctx.stroke();

      ctx.font = '600 11.5px sans-serif';
      ctx.fillStyle = sub.surface.accentInk || textColor;
      ctx.textAlign = 'center';
      ctx.fillText(`${sub.displayLabel} (${sub.values.length})`, currentX + colWidth / 2, subHeaderY + 18);

      // Render cells
      let currentY = subHeaderY + 34;
      ctx.textAlign = 'left';

      for (const val of sub.values) {
        ctx.fillStyle = isDark ? cardBg : (val.hasRename ? 'rgba(255, 255, 255, 0.55)' : 'rgba(255, 255, 255, 0.35)');
        ctx.strokeStyle = val.hasRename
          ? (isDark ? 'rgba(245, 217, 122, 0.4)' : 'rgba(0, 0, 0, 0.12)')
          : borderColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        const cellX = isDark ? currentX : currentX + 6;
        const cellW = isDark ? colWidth : colWidth - 12;
        ctx.roundRect(cellX, currentY, cellW, cellHeight, 4);
        ctx.fill();
        ctx.stroke();

        ctx.font = val.hasRename ? '600 11px sans-serif' : '400 10.5px sans-serif';
        ctx.fillStyle = val.hasRename ? (isDark ? '#fff4cc' : '#15101a') : (isDark ? mutedTextColor : '#2b2333');

        // Truncate text if needed
        const maxTextWidth = colWidth - 16;
        let text = val.displayLabel;
        if (ctx.measureText(text).width > maxTextWidth) {
          while (text.length > 3 && ctx.measureText(text + '…').width > maxTextWidth) {
            text = text.slice(0, -1);
          }
          text = text + '…';
        }

        ctx.fillText(text, currentX + 8, currentY + 20);

        if (val.allValueKeys.length > 1) {
          const badge = `x${val.allValueKeys.length}`;
          ctx.font = 'bold 9.5px sans-serif';
          ctx.fillStyle = isDark ? '#f5d97a' : '#8c6000';
          const badgeWidth = ctx.measureText(badge).width;
          ctx.fillText(badge, currentX + colWidth - badgeWidth - 8, currentY + 20);
        }

        currentY += cellHeight + cellGap;
      }

      currentX += colWidth + colGap;
    }
  }

  // Trigger download
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 'image/png');
}
