'use client';

import { translateUiText } from '@tof-hub/i18n';
import React, { useState, useMemo } from 'react';
import type { SimulacraDatasetItemRaw } from '@tof-hub/contracts';
import type { Locale } from '@tof-hub/i18n';
import { TransparencyCheckerboard } from '@tof-hub/ui';
import type { SimulacraStrings, SimulacraAssetCategory, SimulacraAssetItem } from '../types';
import { getCharacterAssets } from '../utils/character-assets';
import styles from '../simulacra.module.css';

interface SimulacraAssetsSectionProps {
  character: SimulacraDatasetItemRaw;
  locale: Locale;
  strings: SimulacraStrings;
  onOpenLightbox: (src: string, caption?: string, webpSrc?: string) => void;
}

function formatBytes(bytes?: number): string {
  if (!bytes || Number.isNaN(bytes)) return '';
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${Math.round(bytes / 1024)} KB`;
}

export const SimulacraAssetsSection: React.FC<SimulacraAssetsSectionProps> = ({
  character,
  locale,
  strings,
  onOpenLightbox,
}) => {
  const isRu = locale === 'ru';
  const assets = useMemo(() => getCharacterAssets(character, locale), [character, locale]);
  const [selectedCat, setSelectedCat] = useState<SimulacraAssetCategory>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const counts = useMemo(() => {
    return {
      all: assets.length,
      art: assets.filter((a) => a.category === 'art').length,
      avatar: assets.filter((a) => a.category === 'avatar').length,
      weapon: assets.filter((a) => a.category === 'weapon').length,
      skill: assets.filter((a) => a.category === 'skill').length,
      matrix: assets.filter((a) => a.category === 'matrix').length,
      item: assets.filter((a) => a.category === 'item').length,
      dorm: assets.filter((a) => a.category === 'dorm').length,
    };
  }, [assets]);

  const filteredAssets = useMemo(() => {
    if (selectedCat === 'all') return assets;
    return assets.filter((a) => a.category === selectedCat);
  }, [assets, selectedCat]);

  const handleCopy = (id: string, text: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => {
        setCopiedId((cur) => (cur === id ? null : cur));
      }, 1500);
    }
  };

  if (assets.length === 0) return null;

  return (
    <div className={styles.simAssetsSection} id="sim-assets-section">
      <details className={styles.simAssetsCollapsible} id="sim-char-assets">
        <summary className={styles.simAssetsSummary}>
          <div className="flex items-center gap-2">
            <span className={styles.simSectionIcon} aria-hidden="true">
              🎨
            </span>
            <span className="font-semibold text-white">{strings.assetsTitle}</span>
            <span className={styles.simTabCount}>{assets.length}</span>
          </div>
          <span className={styles.simSectionArrow} aria-hidden="true">
            ▾
          </span>
        </summary>

        <div className={styles.simAssetsContent}>
          {/* Disclaimer */}
          <div className={styles.simAssetsDisclaimer}>
            <span className={styles.simDisclaimerIcon} aria-hidden="true">
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="m21 15-5-5L5 21" />
              </svg>
            </span>
            <span className={styles.simDisclaimerText}>{strings.assetsDisclaimer}</span>
          </div>

          {/* Category Filter Chips */}
          <div className={styles.simAssetsFilters} role="tablist" aria-label={translateUiText("Asset categories", locale)}>
            <button
              type="button"
              className={`${styles.simAssetsFilterBtn} ${selectedCat === 'all' ? styles.active : ''}`}
              onClick={() => setSelectedCat('all')}
            >
              <span>{strings.assetsFilterAll}</span>
              <span className={styles.simFilterCount}>{counts.all}</span>
            </button>

            {counts.art > 0 && (
              <button
                type="button"
                className={`${styles.simAssetsFilterBtn} ${selectedCat === 'art' ? styles.active : ''}`}
                onClick={() => setSelectedCat('art')}
              >
                <span>{strings.assetsFilterArt}</span>
                <span className={styles.simFilterCount}>{counts.art}</span>
              </button>
            )}

            {counts.avatar > 0 && (
              <button
                type="button"
                className={`${styles.simAssetsFilterBtn} ${selectedCat === 'avatar' ? styles.active : ''}`}
                onClick={() => setSelectedCat('avatar')}
              >
                <span>{strings.assetsFilterAvatar}</span>
                <span className={styles.simFilterCount}>{counts.avatar}</span>
              </button>
            )}

            {counts.weapon > 0 && (
              <button
                type="button"
                className={`${styles.simAssetsFilterBtn} ${selectedCat === 'weapon' ? styles.active : ''}`}
                onClick={() => setSelectedCat('weapon')}
              >
                <span>{strings.assetsFilterWeapon}</span>
                <span className={styles.simFilterCount}>{counts.weapon}</span>
              </button>
            )}

            {counts.skill > 0 && (
              <button
                type="button"
                className={`${styles.simAssetsFilterBtn} ${selectedCat === 'skill' ? styles.active : ''}`}
                onClick={() => setSelectedCat('skill')}
              >
                <span>{strings.assetsFilterSkill}</span>
                <span className={styles.simFilterCount}>{counts.skill}</span>
              </button>
            )}

            {counts.matrix > 0 && (
              <button
                type="button"
                className={`${styles.simAssetsFilterBtn} ${selectedCat === 'matrix' ? styles.active : ''}`}
                onClick={() => setSelectedCat('matrix')}
              >
                <span>{strings.assetsFilterMatrix}</span>
                <span className={styles.simFilterCount}>{counts.matrix}</span>
              </button>
            )}

            {counts.item > 0 && (
              <button
                type="button"
                className={`${styles.simAssetsFilterBtn} ${selectedCat === 'item' ? styles.active : ''}`}
                onClick={() => setSelectedCat('item')}
              >
                <span>{strings.assetsFilterItem}</span>
                <span className={styles.simFilterCount}>{counts.item}</span>
              </button>
            )}

            {counts.dorm > 0 && (
              <button
                type="button"
                className={`${styles.simAssetsFilterBtn} ${selectedCat === 'dorm' ? styles.active : ''}`}
                onClick={() => setSelectedCat('dorm')}
              >
                <span>{strings.assetsFilterDorm}</span>
                <span className={styles.simFilterCount}>{counts.dorm}</span>
              </button>
            )}
          </div>

          {/* Asset Cards Grid */}
          <div className={styles.simAssetsGrid}>
            {filteredAssets.map((asset) => {
              const title = isRu ? asset.name_ru : asset.name_en;
              const badge = isRu ? asset.badge_ru : asset.badge_en;
              const sizeLabel = formatBytes(asset.sizeBytes);
              const previewSrc = asset.webpUrl || '';

              return (
                <div key={asset.id} className={styles.simAssetCard} data-category={asset.category}>
                  {/* Checkerboard Preview Box */}
                  <div
                    className={styles.simAssetPreviewBox}
                    tabIndex={0}
                    role="button"
                    aria-label={`${title} (${strings.lightboxZoomIn})`}
                    onClick={() => onOpenLightbox(asset.pngUrl || previewSrc, title, asset.webpUrl)}
                  >
                    <TransparencyCheckerboard />
                    {previewSrc && (
                      <img
                        className={styles.simAssetImg}
                        src={previewSrc}
                        alt={title}
                        loading="lazy"
                        decoding="async"
                      />
                    )}
                    {asset.resolution && (
                      <span className={styles.simAssetResBadge} title={translateUiText("Resolution", locale)}>
                        {asset.resolution}
                      </span>
                    )}
                    <span className={styles.simAssetSubBadge} title={badge}>
                      {badge}
                    </span>
                    {sizeLabel && (
                      <span className={styles.simAssetSizeBadge} title={translateUiText("File size", locale)}>
                        {sizeLabel}
                      </span>
                    )}
                  </div>

                  {/* Asset Metadata */}
                  <div className={styles.simAssetMeta}>
                    <div className={styles.simAssetHeader}>
                      <div className={styles.simAssetTitle} title={title}>
                        {title}
                      </div>
                    </div>

                    {asset.unrealPath && (
                      <div className={styles.simAssetPathWrap}>
                        <code className={styles.simAssetPath} title={asset.unrealPath}>
                          {asset.unrealPath}
                        </code>
                        <button
                          type="button"
                          className={styles.simAssetCopyBtn}
                          onClick={() => handleCopy(asset.id, asset.unrealPath)}
                          title={copiedId === asset.id ? strings.assetsCopied : strings.assetsCopyPath}
                          aria-label={strings.assetsCopyPath}
                        >
                          {copiedId === asset.id ? (
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden="true"
                            >
                              <path d="m5 12 4 4L19 6" />
                            </svg>
                          ) : (
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
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
                          )}
                        </button>
                      </div>
                    )}

                    {/* Actions: Download PNG & WebP */}
                    <div className={styles.simAssetActions}>
                      <a
                        href={asset.pngUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        download={asset.file}
                        className={styles.simAssetDownloadBtn}
                        title={`${strings.assetsOpenPng} — ${asset.file}`}
                      >
                        <svg
                          viewBox="0 0 24 24"
                          width="14"
                          height="14"
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
                        <span>{strings.assetsOpenPng}</span>
                      </a>

                      {asset.webpUrl && (
                        <a
                          href={asset.webpUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          download={asset.file.replace(/\.png$/i, '.webp')}
                          className={`${styles.simAssetDownloadBtn} ${styles.simAssetDownloadBtnWebp}`}
                          title={`${strings.assetsOpenWebp}`}
                        >
                          <svg
                            viewBox="0 0 24 24"
                            width="14"
                            height="14"
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
                          <span>{strings.assetsOpenWebp}</span>
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </details>
    </div>
  );
};

SimulacraAssetsSection.displayName = 'SimulacraAssetsSection';
