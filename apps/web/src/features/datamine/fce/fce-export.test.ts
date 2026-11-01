import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect, afterEach } from 'vitest';
import {
  EXPORT_WIDTH,
  EXPORT_HEIGHT,
  buildExportScene,
  destroyExportScene,
} from './fce-export';

// jsdom cannot rasterise backdrop-filter, so the halo regression is guarded
// at the source level: the export scene must neutralise the backdrop blur
// on the MMO level badge.
const exportCss = readFileSync(join(import.meta.dirname, 'fce.module.css'), 'utf8');

describe('FCE DOM export scene', () => {
  afterEach(() => {
    destroyExportScene();
  });

  it('renders a fixed 4K frame independent of the viewer screen', () => {
    expect(EXPORT_WIDTH).toBe(3840);
    expect(EXPORT_HEIGHT).toBe(2160);
  });

  it('clones the live card into a marked offscreen scene', () => {
    const source = document.createElement('article');
    source.innerHTML = '<div class="boss">Chaos Armor</div>';
    document.body.appendChild(source);
    try {
      const root = buildExportScene(source);
      expect(root.getAttribute('data-fce-export-root')).toBe('');
      expect(root.getAttribute('aria-hidden')).toBe('true');
      expect(root.firstElementChild?.textContent).toContain('Chaos Armor');
      expect(root.firstElementChild).not.toBe(source);
    } finally {
      source.remove();
    }
  });

  it('carries ancestor custom properties onto the clone so var() resolves as on screen', () => {
    const page = document.createElement('div');
    const source = document.createElement('article');
    source.innerHTML = '<p class="t">Culton</p>';
    source.style.setProperty('--fce-font-title', 'SourceFont, sans-serif');
    page.appendChild(source);
    page.style.setProperty('--fce-font-copy', 'PageFont, sans-serif');
    document.body.appendChild(page);
    try {
      const root = buildExportScene(source);
      const clone = root.firstElementChild as HTMLElement;
      expect(clone.style.getPropertyValue('--fce-font-title')).toContain('SourceFont');
      expect(clone.style.getPropertyValue('--fce-font-copy')).toContain('PageFont');
    } finally {
      page.remove();
    }
  });

  it('pins the clone transform to none so the export keeps the full card frame', () => {
    const source = document.createElement('article');
    source.style.transform = 'scale(0.45)';
    document.body.appendChild(source);
    try {
      const root = buildExportScene(source);
      const clone = root.firstElementChild as HTMLElement;
      expect(clone.style.transform).toBe('none');
      expect(source.style.transform).toBe('scale(0.45)');
    } finally {
      source.remove();
    }
  });

  it('neutralises the level badge backdrop blur in the export scene', () => {
    const scope = '.fceExportRoot .cardLevelBadgeText';
    expect(exportCss).toContain(scope);
    const block = exportCss.slice(exportCss.indexOf(scope));
    expect(block).toContain('backdrop-filter: none');
    expect(block).toContain('#0c0a14');
  });

  it('removes the export scene on destroy', () => {
    const source = document.createElement('article');
    document.body.appendChild(source);
    try {
      buildExportScene(source);
      expect(document.querySelector('[data-fce-export-root]')).not.toBeNull();
      destroyExportScene();
      expect(document.querySelector('[data-fce-export-root]')).toBeNull();
    } finally {
      source.remove();
    }
  });
});
