'use client';

import { translateUiText } from '@tof-hub/i18n';
import { fillText } from '@/lib/i18n/text';
import React from 'react';
import { GameBadge as Badge } from '@tof-hub/ui';
import { gameAsset } from '@tof-hub/game-assets';
import { RichTextDisplay } from '../common/format-rich-text';
import type { FoodDishCardProps } from './types';
import { getDishCornerBadges } from './constants';
import { localizeEffectLines } from './effect-lines';
import styles from './food.module.css';
import { foodQuality } from './food-quality';

export const FoodDishCard: React.FC<FoodDishCardProps> = ({
  item,
  locale,
  strings,
  onSelect,
  onSelectIngredient,
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

  // Effect text
  const effectLines = localizeEffectLines(
    (isRu && item.formatted_effects_ru && item.formatted_effects_ru.length > 0
      ? item.formatted_effects_ru
      : item.formatted_effects_en && item.formatted_effects_en.length > 0
      ? item.formatted_effects_en
      : item.formatted_effects) || [],
    locale,
  );

  const fallbackEffect = isRu ? item.effect_text_ru || item.effect_text_en : item.effect_text_en;

  const starCount = Math.max(0, item.star || 0);

  // Card rarity class
  const cardRarityClass = quality.cardClass;

  const iconBoxRarityClass = quality.iconClass;

  return (
    <article
      className={`${styles.foodCard} ${cardRarityClass} ${styles.cardInteractive}`}
      onClick={() => onSelect(item)}
      id={`dish-card-${item.id}`}
      data-dish-id={item.id}
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
            <div className="flex items-center gap-1.5 flex-wrap">
              <Badge variant={rarityVariant} size="sm" className={`${styles.foodRarityBadge} font-extrabold`}>
                {rawRarity}
              </Badge>
              {starCount > 0 && (
                <span className={styles.dishStar} title={fillText(translateUiText('{0} Stars', locale), [starCount])}>
                  {'★'.repeat(starCount)}
                </span>
              )}
              {typeof item.cook_level === 'number' && (
                <span className={styles.foodLevelBadge} title={strings.cookLevel}>
                  {strings.cookLevel} {item.cook_level}
                </span>
              )}
            </div>

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
          ) : fallbackEffect ? (
            <div className={styles.effectText}>
              <RichTextDisplay text={fallbackEffect} />
            </div>
          ) : (
            <span className="text-white/40 text-xs italic">—</span>
          )}

          {typeof item.satiety === 'number' && item.satiety > 0 && effectLines.length === 0 && (
            <div className="text-xs text-[#38bdf8] font-semibold mt-0.5">
              +{item.satiety} {translateUiText('Satiety', locale)}
            </div>
          )}
        </div>
      </div>

      {/* Column 3: RECIPE */}
      <div className={styles.colRecipe}>
        {item.recipe && item.recipe.ingredients && item.recipe.ingredients.length > 0 ? (
          <div className={styles.ingredientsList}>
            {item.recipe.ingredients.map((ing) => {
              const ingName = isRu ? ing.name_ru || ing.name_en || ing.name : ing.name_en || ing.name;
              const ingIconUrl = ing.icon ? gameAsset(ing.icon) : '/datamine/favicon.svg';
              const ingredientRarity = (ing.rarity || 'N').toLowerCase();

              return (
                <div
                  key={ing.id}
                  className={styles.ingredientChip}
                  data-rarity={ingredientRarity}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onSelectIngredient && ingName) {
                      onSelectIngredient(ingName);
                    }
                  }}
                  title={`${ingName} ×${ing.count}`}
                >
                  <div className={styles.ingredientIconStage}>
                    <img src={ingIconUrl} alt="" className={styles.ingredientIcon} loading="lazy" />
                    <span className={styles.ingredientCountBadge}>×{ing.count}</span>
                  </div>
                  <span className={styles.ingredientName}>{ingName}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <span className="text-white/30 text-xs italic">{strings.noRecipe}</span>
        )}
      </div>
    </article>
  );
};
