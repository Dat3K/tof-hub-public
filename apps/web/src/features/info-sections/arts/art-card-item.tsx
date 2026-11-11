'use client';

import React, { useState } from 'react';
import { gameAsset } from '@tof-hub/game-assets';
import { TransparencyCheckerboard } from '@tof-hub/ui';
import type { ArtCardItemProps } from './types';
import { cleanArtTitle, formatFileSize, getArtCategoryBadge } from './constants';
import styles from './arts.module.css';

export const ArtCardItem: React.FC<ArtCardItemProps> = ({
  artwork,
  strings,
  isRu,
  locale,
  index,
  onClick,
}) => {
  const [copied, setCopied] = useState(false);
  const title = cleanArtTitle(artwork.title, isRu, locale);
  const isChar = artwork.category === 'characters';
  const badgeInfo = getArtCategoryBadge(artwork, strings);
  const sizeText = formatFileSize(artwork.pngSizeBytes || artwork.sizeBytes);

  const imgSrc = artwork.thumbUrl || artwork.webpUrl || artwork.url || '';
  const resolvedImg = imgSrc ? gameAsset(imgSrc, 'webp') : '';

  const downloadSrc = artwork.pngUrl || artwork.url || '';
  const resolvedDownload = downloadSrc ? gameAsset(downloadSrc, 'png') : '';

  const displayPath = (artwork.sourcePath || artwork.originalFileName || '').replace(
    /\.(?:png|webp|jpg|jpeg)$/i,
    ''
  );

  const handleCopyPath = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(displayPath).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick(index);
    }
  };

  return (
    <article
      className={`${styles.artCard} ${isChar ? styles['artCard--char'] : ''}`}
      tabIndex={0}
      role="button"
      aria-label={title || strings.itemFallback}
      onClick={() => onClick(index)}
      onKeyDown={handleKeyDown}
    >
      {/* Preview with checkerboard background */}
      <div className={styles.previewBox}>
        <TransparencyCheckerboard />
        {resolvedImg ? (
          <img
            src={resolvedImg}
            alt={title || ''}
            className={styles.artImg}
            loading="lazy"
            decoding="async"
          />
        ) : null}

        {/* Top-left: Resolution Badge */}
        {artwork.width && artwork.height ? (
          <span className={styles.resBadge}>
            {artwork.width}×{artwork.height}
          </span>
        ) : null}

        {/* Top-right: Category Badge */}
        <span className={`${styles.catBadge} ${styles[`catBadge--${badgeInfo.variant}`] || ''}`}>
          {artwork.isNew ? `${strings.tabNew} · ${badgeInfo.text}` : badgeInfo.text}
        </span>

        {/* Bottom-right: File Size Badge */}
        {sizeText && <span className={styles.sizeBadge}>{sizeText}</span>}
      </div>

      {/* Meta Box */}
      <div className={styles.metaBox}>
        <h3 className={styles.artTitle} title={title}>
          {title}
        </h3>

        {displayPath && (
          <div className={styles.pathRow}>
            <code className={styles.pathCode} title={displayPath}>
              {displayPath}
            </code>
            <button
              type="button"
              className={styles.copyPathBtn}
              onClick={handleCopyPath}
              title={strings.copyPath}
            >
              {copied ? (
                <svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="m4.5 10 3.25 3.25L15.5 5.5" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              )}
            </button>
          </div>
        )}

        {resolvedDownload && (
          <a
            href={resolvedDownload}
            download={artwork.originalFileName || `${artwork.id}.png`}
            className={styles.downloadLink}
            onClick={(e) => e.stopPropagation()}
            title={`${strings.download} — ${artwork.originalFileName || artwork.id}`}
          >
            <svg
              className={styles.downloadIcon}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"
              />
            </svg>
            <span>{strings.download}</span>
          </a>
        )}
      </div>
    </article>
  );
};
