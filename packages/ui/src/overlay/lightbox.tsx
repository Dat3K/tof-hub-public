'use client';

import { translateUiText } from '@tof-hub/i18n';

import React, { useEffect, useRef, useState } from 'react';
import type { LightboxImage, LightboxProps } from '../primitives/types';

const DOWNLOAD_ICON = (
  <svg
    className="sim-lightbox__download-icon"
    viewBox="0 0 24 24"
    width="16"
    height="16"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const COPY_ICON = (
  <svg
    className="sim-lightbox__toolbar-icon"
    viewBox="0 0 24 24"
    width="15"
    height="15"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const ZOOM_ICON = (
  <svg
    className="sim-lightbox__toolbar-icon"
    viewBox="0 0 24 24"
    width="15"
    height="15"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="m16 16 5 5M10.5 7.5v6M7.5 10.5h6" />
  </svg>
);

function downloadFile(src: string, filename: string, onSuccess: () => void) {
  void fetch(src)
    .then((response) => {
      if (!response.ok) throw new Error('Direct fetch failed');
      return response.blob();
    })
    .then((blob) => {
      const blobUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = blobUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
      onSuccess();
    })
    .catch(() => {
      const anchor = document.createElement('a');
      anchor.href = src;
      anchor.download = filename;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    });
}

function safeDownloadName(value: string | undefined, extension: 'png' | 'webp' | 'gif') {
  const base = (value || 'tof-asset')
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[^a-zA-Z0-9_\-\u0400-\u04FF]/g, '_')
    .replace(/^_+|_+$/g, '') || 'tof-asset';
  return `${base}.${extension}`;
}

export const Lightbox: React.FC<LightboxProps> = ({
  variant = 'default',
  locale = 'en',
  isOpen,
  onClose,
  src,
  webpSrc,
  animation,
  showPngDownload = true,
  alt = 'Media preview',
  title,
  caption,
  downloadName,
  downloadPngLabel = 'Download PNG',
  downloadWebpLabel = 'Download WebP',
  images = [],
  currentIndex: controlledIndex,
  onIndexChange,
  zoomable = true,
  resolution,
  resolutionMeta,
  fileSize,
  gameFile,
  copyPathLabel,
  copiedLabel,
  zoomLabel,
  closeLabel,
  resolutionLabel,
  fileSizeLabel,
  gameFileLabel,
}) => {
  const [internalIndex, setInternalIndex] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const [downloadedFormat, setDownloadedFormat] = useState<'png' | 'webp' | 'gif' | null>(null);
  const [playing, setPlaying] = useState(false);
  const [animationFailed, setAnimationFailed] = useState(false);
  const [copiedPath, setCopiedPath] = useState(false);
  const previousActiveElement = useRef<HTMLElement | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const touchStartXRef = useRef<number | null>(null);

  const isGallery = images.length > 0;
  const activeIndex = controlledIndex !== undefined ? controlledIndex : internalIndex;
  const currentImage: LightboxImage = isGallery
    ? images[activeIndex] || { src: '', alt: '' }
    : { src: src || '', webpSrc, animation, alt, title, caption };
  const currentAnimation = currentImage.animation;
  const currentPngSrc = currentImage.src;
  const currentWebpSrc = currentImage.webpSrc || (isGallery ? undefined : webpSrc);
  const currentTitle = currentImage.title || currentImage.caption || title || '';
  const isArtVariant = variant === 'art';
  const uiLabel = (en: string, ru: string) => locale === 'ru' ? ru : translateUiText(en, locale);
  const copyLabel = copyPathLabel || (uiLabel('Copy Path', 'Копировать путь'));
  const zoomButtonLabel = zoomLabel || (uiLabel('Zoom', 'Масштаб'));
  const closeButtonLabel = closeLabel || (uiLabel('Close', 'Закрыть'));
  const metadataResolutionLabel = resolutionLabel || (uiLabel('Resolution', 'Разрешение'));
  const metadataFileSizeLabel = fileSizeLabel || (uiLabel('File Size', 'Размер файла'));
  const metadataGameFileLabel = gameFileLabel || (uiLabel('Game File', 'Файл игры'));

  useEffect(() => {
    setAnimationFailed(false);
    if (!isOpen || !currentAnimation) { setPlaying(false); return; }
    // Opening the viewer is the explicit request to see the animation; Pause returns to the poster.
    setPlaying(true);
  }, [isOpen, activeIndex, currentAnimation?.src]);

  const handlePrev = () => {
    if (!isGallery) return;
    const next = (activeIndex - 1 + images.length) % images.length;
    setInternalIndex(next);
    onIndexChange?.(next);
    setIsZoomed(false);
    setDownloadedFormat(null);
    setCopiedPath(false);
  };

  const handleNext = () => {
    if (!isGallery) return;
    const next = (activeIndex + 1) % images.length;
    setInternalIndex(next);
    onIndexChange?.(next);
    setIsZoomed(false);
    setDownloadedFormat(null);
    setCopiedPath(false);
  };

  const handleTouchStart = (event: React.TouchEvent) => {
    if (!isGallery || event.touches.length !== 1) return;
    touchStartXRef.current = event.touches[0].clientX;
  };

  const handleTouchEnd = (event: React.TouchEvent) => {
    if (!isGallery || touchStartXRef.current === null) return;
    const deltaX = event.changedTouches[0].clientX - touchStartXRef.current;
    touchStartXRef.current = null;
    if (deltaX > 50) handlePrev();
    else if (deltaX < -50) handleNext();
  };

  useEffect(() => {
    if (!isOpen) {
      setIsZoomed(false);
      setDownloadedFormat(null);
      setCopiedPath(false);
      return;
    }

    previousActiveElement.current = document.activeElement as HTMLElement | null;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus({preventScroll: true});

    const handleKeyDown = (event: KeyboardEvent) => {
      if (['Tab', 'Escape', 'ArrowLeft', 'ArrowRight'].includes(event.key)) event.stopPropagation();
      if (event.key === 'Tab') {
        const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex="0"]');
        const first = focusable?.[0];
        const last = focusable?.[focusable.length - 1];
        if (first && last && event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
          event.preventDefault(); last.focus();
        } else if (first && !event.shiftKey && document.activeElement === last) {
          event.preventDefault(); first.focus();
        }
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        handlePrev();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        handleNext();
      }
    };

    // A nested media viewer owns these keys before the parent detail dialog sees them.
    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown, true);
      previousActiveElement.current?.focus?.({preventScroll: true});
    };
  }, [isOpen, activeIndex, images.length, onClose]);

  if (!isOpen || !currentPngSrc) return null;

  const handleDownload = (targetSrc: string | undefined, format: 'png' | 'webp' | 'gif') => {
    if (!targetSrc) return;
    downloadFile(targetSrc, safeDownloadName(downloadName || currentTitle, format), () => {
      setDownloadedFormat(format);
      window.setTimeout(() => setDownloadedFormat(null), 2000);
    });
  };

  const handleCopyPath = () => {
    if (!gameFile || typeof navigator === 'undefined' || !navigator.clipboard) return;
    void navigator.clipboard.writeText(gameFile).then(() => {
      setCopiedPath(true);
      window.setTimeout(() => setCopiedPath(false), 1800);
    });
  };

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={currentTitle || 'Image Preview'}
      className={`sim-lightbox${isArtVariant ? ' sim-lightbox--art' : ''} is-open`}
    >
      <div className="sim-lightbox__backdrop" onClick={onClose} aria-hidden="true" />

      <div className="sim-lightbox__dialog">
        {isArtVariant && (
          <div className="sim-lightbox__toolbar">
            <div className="sim-lightbox__heading">
              <strong>{currentTitle}</strong>
              {resolution && <span className="sim-lightbox__resolution">{resolution}</span>}
            </div>

            <div className="sim-lightbox__toolbar-actions">
              <button
                type="button"
                className={`sim-lightbox__toolbar-btn sim-lightbox__toolbar-btn--download${downloadedFormat === 'png' ? ' is-success' : ''}`}
                onClick={() => handleDownload(currentPngSrc, 'png')}
              >
                {DOWNLOAD_ICON}
                <span>{downloadedFormat === 'png' ? (uiLabel('✓ Downloaded!', '✓ Скачано!')) : translateUiText(downloadPngLabel, locale)}</span>
              </button>
              {gameFile && (
                <button
                  type="button"
                  className="sim-lightbox__toolbar-btn"
                  onClick={handleCopyPath}
                  title={copyLabel}
                >
                  {COPY_ICON}
                  <span>{copiedPath ? (copiedLabel || (uiLabel('Copied', 'Скопировано'))) : copyLabel}</span>
                </button>
              )}
              {zoomable && <button
                type="button"
                className={`sim-lightbox__toolbar-btn${isZoomed ? ' is-active' : ''}`}
                onClick={() => setIsZoomed((previous) => !previous)}
                aria-pressed={isZoomed}
              >
                {ZOOM_ICON}
                <span>{zoomButtonLabel}</span>
              </button>}
              <button
                type="button"
                className="sim-lightbox__close-btn"
                onClick={onClose}
                aria-label={closeButtonLabel}
              >
                ×
              </button>
            </div>
          </div>
        )}

        <button
          type="button"
          className={`sim-lightbox__close-btn${isArtVariant ? ' sim-lightbox__close-btn--hidden' : ''}`}
          onClick={onClose}
          aria-label={closeButtonLabel}
        >
          ×
        </button>

        <div
          className="sim-lightbox__stage"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {isGallery && (
            <button
              type="button"
              className="sim-lightbox__nav sim-lightbox__nav--prev"
              onClick={handlePrev}
              aria-label={uiLabel('Previous image', 'Предыдущее изображение')}
            >
              ‹
            </button>
          )}

          <img
            className={`sim-lightbox__img${zoomable ? '' : ' sim-lightbox__img--static'}${zoomable && isZoomed ? ' sim-lightbox__img--zoomed' : ''}`}
            src={playing && currentAnimation && !animationFailed ? currentAnimation.src : currentPngSrc}
            onError={() => { if (playing && currentAnimation) { setPlaying(false); setAnimationFailed(true); } }}
            alt={currentImage.alt || 'Enlarged preview'}
            loading="eager"
            role={zoomable ? 'button' : undefined}
            tabIndex={zoomable ? 0 : undefined}
            aria-label={zoomable ? (uiLabel('Toggle image zoom', 'Изменить масштаб изображения')) : undefined}
            onKeyDown={zoomable ? event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setIsZoomed(previous => !previous); } } : undefined}
            onClick={zoomable ? () => setIsZoomed((previous) => !previous) : undefined}
          />

          {isGallery && (
            <button
              type="button"
              className="sim-lightbox__nav sim-lightbox__nav--next"
              onClick={handleNext}
              aria-label={uiLabel('Next image', 'Следующее изображение')}
            >
              ›
            </button>
          )}
        </div>

        {!isArtVariant && <div className="sim-lightbox__caption">{currentTitle}</div>}
        {!isArtVariant && currentImage.caption && currentImage.caption !== currentTitle && <p className="sr-only">{currentImage.caption}</p>}

        {!isArtVariant && <div className="sim-lightbox__actions">
          {currentAnimation && !animationFailed && <button type="button" className="sim-lightbox__download-btn"
            aria-pressed={playing} onClick={() => setPlaying(value => !value)}>
            {playing ? uiLabel('Pause animation', 'Остановить анимацию') : uiLabel('Play animation', 'Включить анимацию')}
          </button>}
          {currentAnimation && <button type="button" className="sim-lightbox__download-btn"
            onClick={() => handleDownload(currentAnimation.gifSrc, 'gif')}>
            {DOWNLOAD_ICON}<span>{uiLabel('Download GIF', 'Скачать GIF')}</span>
          </button>}
          {showPngDownload && <button
            type="button"
            className={`sim-lightbox__download-btn${downloadedFormat === 'png' ? ' is-success' : ''}`}
            onClick={() => handleDownload(currentPngSrc, 'png')}
          >
            {DOWNLOAD_ICON}
            <span>{downloadedFormat === 'png' ? (uiLabel('✓ Downloaded!', '✓ Скачано!')) : translateUiText(downloadPngLabel, locale)}</span>
          </button>}

          {currentWebpSrc && (
            <button
              type="button"
              className={`sim-lightbox__download-btn sim-lightbox__download-btn--webp${downloadedFormat === 'webp' ? ' is-success' : ''}`}
              onClick={() => handleDownload(currentWebpSrc, 'webp')}
            >
              {DOWNLOAD_ICON}
              <span>{downloadedFormat === 'webp' ? (uiLabel('✓ Downloaded!', '✓ Скачано!')) : translateUiText(downloadWebpLabel, locale)}</span>
            </button>
          )}
        </div>}

        {isArtVariant && (
          <div className="sim-lightbox__metadata">
            {(resolutionMeta || resolution) && <span><small>{metadataResolutionLabel}:</small> <strong>{resolutionMeta || resolution}</strong></span>}
            {fileSize && <span><small>{metadataFileSizeLabel}:</small> <strong>{fileSize}</strong></span>}
            {gameFile && <span className="sim-lightbox__metadata-file"><small>{metadataGameFileLabel}:</small> <code>{gameFile}</code></span>}
          </div>
        )}
      </div>
    </div>
  );
};

export const MediaLightbox = Lightbox;

Lightbox.displayName = 'Lightbox';
