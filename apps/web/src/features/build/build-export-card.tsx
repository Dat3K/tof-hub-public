import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import type { ComponentProps, ReactElement } from 'react';
import { carryOverInheritedCustomProperties } from '@/lib/dom-snapshot';
import { BuildCard } from './build-card';
import { BUILD_CARD_WIDTH } from './layout';
import styles from './build.module.css';

type ExportCardProps = Pick<ComponentProps<typeof BuildCard>, 'draft' | 'catalog' | 'locale' | 'customArt' | 'backpack' | 'ranking' | 'rankingEdited'>;

/** Render from the exact model checked for this export; the editable page DOM is never a data source. */
export function createBuildExportCard(props: ExportCardProps): HTMLElement {
  return createBuildExportNode(<BuildCard {...props}/>);
}

/** Both Build variants render an immutable model with the same snapshot lifecycle. */
export function createBuildExportNode(content: ReactElement): HTMLElement {
  const host = document.createElement('div');
  host.className = styles.preview;
  host.style.cssText = `position:fixed;left:-20000px;top:0;width:${BUILD_CARD_WIDTH}px;pointer-events:none;`;
  host.setAttribute('aria-hidden', 'true');
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
    flushSync(() => root.render(content));
    const rendered = host.querySelector<HTMLElement>('article.card');
    if (!rendered) throw new Error('Build export card did not render');
    // Snapshot only this fresh React tree, then dispose its hooks/listeners before rasterization.
    const card = rendered.cloneNode(true) as HTMLElement;
    carryOverInheritedCustomProperties(rendered, card);
    return card;
  } finally {
    root.unmount();
    host.remove();
  }
}
