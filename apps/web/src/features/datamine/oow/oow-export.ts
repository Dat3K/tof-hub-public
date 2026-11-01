import { downloadPng } from '@/lib/download';

export async function downloadSvgAsPng(
  svgElement: SVGSVGElement,
  filename: string,
  title?: string
): Promise<void> {
  if (typeof window === 'undefined') return;

  const svgData = new XMLSerializer().serializeToString(svgElement);
  const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Failed to load SVG into image for export'));
    img.src = url;
  });

  const canvas = document.createElement('canvas');
  // 4x SVG viewBox scaling gives these 920x300 charts a 2x logical export.
  const scale = 4;
  const width = (svgElement.viewBox.baseVal.width || 920) * scale;
  const height = (svgElement.viewBox.baseVal.height || 300) * scale;
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.drawImage(img, 0, 0, width, height);
  URL.revokeObjectURL(url);

  downloadPng(canvas.toDataURL('image/png'), filename);
}

export function downloadCsv(rows: string[][], filename: string): void {
  if (typeof window === 'undefined') return;

  const csvContent = rows
    .map((row) =>
      row
        .map((val) => {
          const s = String(val ?? '');
          if (s.includes(',') || s.includes('"') || s.includes('\n')) {
            return `"${s.replace(/"/g, '""')}"`;
          }
          return s;
        })
        .join(',')
    )
    .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
