'use client';

import React from 'react';
import { translateUiText } from '@tof-hub/i18n';
import { GameBadge as Badge } from '@tof-hub/ui';
import { gameAsset } from '@tof-hub/game-assets';
import { RichTextDisplay } from '../common/format-rich-text';
import type { FoodPotionCardProps } from './types';
import { getDishCornerBadges } from './constants';
import styles from './food.module.css';
import { foodQuality } from './food-quality';

export const FoodPotionCard: React.FC<FoodPotionCardProps> = ({
  item,
  locale,
  strings,
  onSelect,
}) => {
  const isRu = locale === 'ru';
  const name = isRu ? item.name_ru || item.name || item.name_en || item.id : item.name_en || item.name || item.id;
  const secName = isRu ? item.name_en : undefined;
  const quality = foodQuality(item.rarity, locale);
  const rawRarity = quality.label;
  const rarityVariant = quality.variant;

  const iconUrl = item.icon ? gameAsset(item.icon) : '/datamine/favicon.svg';

  // Corner badges
  const { tl, tr } = getDishCornerBadges(item, isRu);

  const effectLines =
    (isRu && item.formatted_effects_ru && item.formatted_effects_ru.length > 0
      ? item.formatted_effects_ru
      : item.formatted_effects_en && item.formatted_effects_en.length > 0
      ? item.formatted_effects_en
      : item.formatted_effects) || [];

  const durationText = isRu ? item.duration_text_ru || item.duration_text_en || item.duration_text : item.duration_text_en || item.duration_text;

  const subLabels: Record<string, string> = {
    shots: strings.potionSub_shots,
    mushrooms: strings.potionSub_mushrooms,
    nutripastes: strings.potionSub_nutripastes,
    utility: strings.potionSub_utility,
    drinks: strings.potionSub_drinks,
    pills: strings.potionSub_pills,
    combat_food: strings.potionSub_combatFood,
  };
  const subcategoryLabel = (item.subcategory && subLabels[item.subcategory]) || item.subcategory || 'Potion';

  const cardRarityClass = quality.cardClass;

  const iconBoxRarityClass = quality.iconClass;

  return (
    <article
      className={`${styles.foodCard} ${cardRarityClass} ${styles.cardInteractive}`}
      onClick={() => onSelect(item)}
      id={`potion-card-${item.id}`}
      data-potion-id={item.id}
    >
      {/* Column 1: ITEM */}
      <div className={styles.colItem}>
        <div className={styles.itemStageWrapper}>
          <div className={`${styles.iconBox} ${iconBoxRarityClass}`}>
            <img src={iconUrl} alt={name} className={styles.dishIcon} loading="lazy" />

            {tl && (
              <span className={styles.cornerBadgeTL} title={tl.title}>
                <img src={gameAsset(tl.icon)} alt="" className={styles.cornerBadgeIcon} />
              </span>
            )}

            {tr && (
              <span
                className={`${styles.cornerBadgeTR} ${tr.isHeal ? styles.cornerBadgeHeal : ''}`}
                title={tr.title}
              >
                <img src={gameAsset(tr.icon)} alt="" className={styles.cornerBadgeIcon} />
              </span>
            )}
          </div>

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

      {/* Column 2: EFFECT */}
      <div className={styles.colEffect}>
        <div className="flex flex-col gap-1">
          {effectLines.length > 0 ? (
            effectLines.map((line, idx) => (
              <div key={idx} className={styles.effectText}>
                <RichTextDisplay text={line} />
              </div>
            ))
          ) : (
            <span className="text-white/40 text-xs italic">—</span>
          )}

        </div>
      </div>

      {/* Column 3: TYPE & DURATION */}
      <div className={styles.colRecipe}>
        <div className={styles.potionMetaBox}>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs px-2 py-0.5 rounded bg-white/10 text-white/90 font-medium">
              {translateUiText(subcategoryLabel, locale)}
            </span>

            {durationText && (
              <span className={styles.potionDurationBadge} title={strings.durationLabel}>
                <span>⏱️</span>
                <span>{durationText}</span>
              </span>
            )}
          </div>

        </div>
      </div>
    </article>
  );
};
