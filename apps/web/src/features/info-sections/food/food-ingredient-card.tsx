'use client';

import { translateUiText } from '@tof-hub/i18n';
import React, { useState } from 'react';
import { GameBadge as Badge } from '@tof-hub/ui';
import { gameAsset, gameAssetPng, gameAssetWebp } from '@tof-hub/game-assets';
import { InfoLightbox } from '../common/info-lightbox';
import type { FoodIngredientCardProps } from './types';
import styles from './food.module.css';
import { foodQuality } from './food-quality';

export const FoodIngredientCard: React.FC<FoodIngredientCardProps> = ({
  item,
  locale,
  strings,
  onSelectDish,
}) => {
  const isRu = locale === 'ru';
  const name = isRu ? item.name_ru || item.name || item.name_en || item.id : item.name_en || item.name || item.id;
  const secName = isRu ? item.name_en : undefined;
  const quality = foodQuality(item.rarity, locale);
  const rawRarity = quality.label;
  const rarityVariant = quality.variant;

  const iconUrl = item.icon ? gameAsset(item.icon) : '/datamine/favicon.svg';
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  const sources =
    (isRu && item.sources_ru && item.sources_ru.length > 0
      ? item.sources_ru
      : item.sources_en && item.sources_en.length > 0
      ? item.sources_en
      : item.sources) || [];

  const usedIn = item.used_in || [];

  const cardRarityClass = quality.cardClass;

  const iconBoxRarityClass = quality.iconClass;

  return (
    <article
      className={`${styles.foodCard} ${cardRarityClass}`}
      id={`ingredient-card-${item.id}`}
      data-ingredient-id={item.id}
    >
      {/* Column 1: INGREDIENT */}
      <div className={styles.colItem}>
        <div className={styles.itemStageWrapper}>
          {item.icon ? (
            <button
              type="button"
              className={`${styles.iconBox} ${iconBoxRarityClass} ${styles.iconBoxButton}`}
              onClick={() => setIsLightboxOpen(true)}
              aria-label={`${name} — ${isRu ? 'Открыть изображение' : translateUiText('Open image', locale)}`}
            >
              <img src={iconUrl} alt="" className={styles.dishIcon} loading="lazy" />
            </button>
          ) : (
            <div className={`${styles.iconBox} ${iconBoxRarityClass}`}>
              <img src={iconUrl} alt={name} className={styles.dishIcon} loading="lazy" />
            </div>
          )}

          <div className={styles.itemNameWrapper}>
            <Badge
              variant={rarityVariant}
              size="sm"
              className={`${styles.foodRarityBadge} font-extrabold w-fit`}
            >
              {rawRarity}
            </Badge>

            <h3 className={styles.dishName} title={name}>
              {name}
            </h3>

            {secName && secName !== name && (
              <div className={styles.dishSecName}>{secName}</div>
            )}
          </div>
        </div>
      </div>

      {/* Column 2: SOURCES / WHERE TO FIND */}
      <div className={styles.colEffect}>
        <div className="flex flex-col gap-1.5">
          {sources.length > 0 ? (
            <div className={styles.sourcesBadges}>
              {sources.map((src, idx) => (
                <span key={idx} className={styles.sourceBadge}>
                  <span>📍</span>
                  <span>{src}</span>
                </span>
              ))}
            </div>
          ) : (
            <span className="text-white/40 text-xs italic">—</span>
          )}

        </div>
      </div>

      {/* Column 3: USED IN RECIPES */}
      <div className={styles.colRecipe}>
        {usedIn.length > 0 ? (
          <div className={styles.usedInList}>
            {usedIn.map((d) => {
              const dName = isRu ? d.name_ru || d.name_en : d.name_en;
              const dIconUrl = d.icon ? gameAsset(d.icon) : '/datamine/favicon.svg';

              return (
                <button
                  key={d.id}
                  type="button"
                  className={styles.usedInChip}
                  onClick={() => {
                    if (onSelectDish) onSelectDish(d.id);
                  }}
                  title={dName}
                >
                  <img src={dIconUrl} alt="" className={styles.usedInIcon} loading="lazy" />
                  <span className="truncate max-w-[150px]">{dName}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <span className="text-white/30 text-xs italic">—</span>
        )}
      </div>
      {item.icon && (
        <InfoLightbox
          isOpen={isLightboxOpen}
          onClose={() => setIsLightboxOpen(false)}
          src={gameAssetPng(item.icon)}
          webpSrc={gameAssetWebp(item.icon)}
          caption={name}
          alt={name}
          isRu={isRu}
        />
      )}
    </article>
  );
};
