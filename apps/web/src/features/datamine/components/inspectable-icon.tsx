'use client';
import { localeText } from '@/lib/i18n/text';

import { useCallback, useState } from 'react';
import { Lightbox } from '@tof-hub/ui';
import { useI18n } from '@/lib/i18n';
import styles from './inspectable-icon.module.css';

export interface IconAction { label: string; onOpen: () => void }

/** Only loaded thumbnails are interactive; missing images keep their original slot. */
export function InspectableIcon({ src, action, imageClass, gapClass, element }: {
  src?: string | null; action: IconAction; imageClass?: string; gapClass?: string; element?: string;
}) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  const checkCachedImage = useCallback((image: HTMLImageElement | null) => {
    if (image?.complete) setStatus(image.naturalWidth > 0 ? 'ready' : 'failed');
  }, []);
  if (!src || status === 'failed') return <span className={gapClass} aria-hidden="true" />;
  return <button type="button" className={styles.action} aria-label={action.label} title={action.label}
    disabled={status !== 'ready'} onClick={action.onOpen}>
    <img ref={checkCachedImage} src={src} className={imageClass} data-resistance-element={element} alt="" loading="lazy" decoding="async"
      onLoad={() => setStatus('ready')} onError={() => setStatus('failed')} />
  </button>;
}

/** Encounter icons use the same fitted image viewer as Info media. */
export function useEncounterIconPreview() {
  const { locale } = useI18n();
  const [preview, setPreview] = useState<{src: string; title: string} | null>(null);
  const action = (src: string | null | undefined, title: string): IconAction => ({
    label: `${localeText(locale)('View icon', 'Открыть иконку')}: ${title}`,
    onOpen: () => { if (src) setPreview({src, title}); },
  });
  const lightbox = preview && <Lightbox isOpen onClose={() => setPreview(null)} src={preview.src} webpSrc={preview.src}
    alt={preview.title} caption={preview.title} locale={locale} zoomable={false} showPngDownload={false}
    downloadWebpLabel={localeText(locale)('Download WebP', 'Скачать WebP')} />;
  return { action, lightbox };
}
