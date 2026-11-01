import type { FceBossItem, FceMode } from './fce-types';
import styles from './fce.module.css';
import {
  carryOverInheritedCustomProperties,
  loadDomSnapshot,
  waitForDomSnapshotAssets,
} from '@/lib/dom-snapshot';
import { downloadPng } from '@/lib/download';

// Fixed 4K frame, independent of the viewer's screen.
export const EXPORT_WIDTH = 3840;
export const EXPORT_HEIGHT = 2160;
const SCENE_WIDTH = 1920;
const SCENE_HEIGHT = 1080;
const EXPORT_PIXEL_RATIO = 2;

/**
 * The snapshot library serialises only the card subtree (plus document
 * stylesheets) into an isolated SVG, so anything the live card inherits
 * from uncloned ancestors — page-level custom properties like the FCE
 * fonts — would resolve differently there. Copy the live custom property
 * values onto the clone root so every var() inside the export resolves
 * exactly as on screen.
 */
export { carryOverInheritedCustomProperties } from '@/lib/dom-snapshot';

/**
 * Clones the live card into a fixed offscreen scene. The clone reuses the
 * same DOM and stylesheets, so the download matches the visible card 1:1.
 */
export function buildExportScene(sourceCard: HTMLElement, rootClassName: string = styles.fceExportRoot): HTMLElement {
  document.querySelector('[data-fce-export-root]')?.remove();
  const exportRoot = document.createElement('div');
  exportRoot.className = rootClassName;
  exportRoot.setAttribute('data-fce-export-root', '');
  exportRoot.setAttribute('aria-hidden', 'true');
  const exportCard = sourceCard.cloneNode(true) as HTMLElement;
  carryOverInheritedCustomProperties(sourceCard, exportCard);
  // Pin the unscaled card frame: an inline transform wins over any scale
  // the snapshot library may carry over from the live card.
  exportCard.style.transform = 'none';
  // The PNG is a full rectangle: do not clip the live card's rounded corners.
  exportCard.style.borderRadius = '0';
  exportRoot.appendChild(exportCard);
  document.body.appendChild(exportRoot);
  return exportRoot;
}

export function destroyExportScene(): void {
  document.querySelector('[data-fce-export-root]')?.remove();
}

/**
 * Renders a live 1920×1080 card into a 3840×2160 PNG download. Other encounter
 * cards (Raids) reuse it with their own export-root class that freezes their
 * animations and removes the rounded frame.
 */
export async function exportCardPng(
  sourceCard: HTMLElement,
  fileName: string,
  {rootClassName = styles.fceExportRoot, backgroundColor = '#dfe5f5'}: {rootClassName?: string; backgroundColor?: string} = {},
): Promise<void> {
  const snapshot = await loadDomSnapshot();
  const exportRoot = buildExportScene(sourceCard, rootClassName);
  try {
    await waitForDomSnapshotAssets(exportRoot);
    const exportCard = exportRoot.firstElementChild as HTMLElement | null;
    if (!exportCard) throw new Error('Card is not rendered yet');
    // Browser-native rendering (SVG foreignObject): every modern CSS
    // feature paints exactly as on screen, at print pixel ratio.
    const dataUrl = await snapshot.toPng(exportCard, {
      backgroundColor,
      width: SCENE_WIDTH,
      height: SCENE_HEIGHT,
      pixelRatio: EXPORT_PIXEL_RATIO,
      cacheBust: true,
    });
    const probe = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => reject(new Error('Export rendered an unreadable image'));
      img.src = dataUrl;
    });
    if (probe.width !== EXPORT_WIDTH || probe.height !== EXPORT_HEIGHT) {
      throw new Error('Export rendered at an unexpected size');
    }
    downloadPng(dataUrl, fileName);
  } finally {
    destroyExportScene();
  }
}

export async function exportFceBossCard(
  boss: FceBossItem,
  locale: string,
  onProgress?: (rendering: boolean) => void,
  mode: FceMode = 'standard',
  sourceNode?: HTMLElement | null
): Promise<void> {
  void mode;
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  onProgress?.(true);
  try {
    const scope = sourceNode ?? document;
    const sourceCard = scope.querySelector('article');
    if (!sourceCard) throw new Error('Boss card is not rendered yet');
    await exportCardPng(sourceCard as HTMLElement, `fce-${boss.slug}-${locale}.png`);
  } finally {
    onProgress?.(false);
  }
}
