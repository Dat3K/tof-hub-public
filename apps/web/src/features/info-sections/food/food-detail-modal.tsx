'use client';

import { translateUiText } from '@tof-hub/i18n';
import React, { useEffect, useState } from 'react';
import { Modal, GameBadge as Badge } from '@tof-hub/ui';
import { gameAsset, gameAssetPng, gameAssetWebp } from '@tof-hub/game-assets';
import { RichTextDisplay } from '../common/format-rich-text';
import { InfoLightbox } from '../common/info-lightbox';
import { copyText } from '@/lib/clipboard';
import type { FoodDetailModalProps, FoodDishItem, FoodPotionItem } from './types';
import { getDishCornerBadges } from './constants';
import { localizeEffectLines } from './effect-lines';
import styles from './food.module.css';
import { foodQuality } from './food-quality';

export const FoodDetailModal: React.FC<FoodDetailModalProps> = ({
  isOpen,
  onClose,
  item,
  locale,
  strings,
  onSelectIngredient,
}) => {
  const [copied, setCopied] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setIsLightboxOpen(false);
      setCopied(false);
    }
  }, [isOpen, item?.id]);

  if (!item) return null;

  const isRu = locale === 'ru';
  const name = isRu ? item.name_ru || item.name || item.name_en || item.id : item.name_en || item.name || item.id;
  const secName = isRu ? item.name_en : undefined;
  const quality = foodQuality(item.rarity, locale);
  const rawRarity = quality.label;
  const rarityVariant = quality.variant;

  const iconUrl = item.icon ? gameAssetWebp(item.icon) : '/datamine/favicon.svg';
  const iconPngUrl = item.icon ? gameAssetPng(item.icon) : iconUrl;
  const isPotion = 'subcategory' in item && Boolean(item.subcategory);
  const dishItem = !isPotion ? (item as FoodDishItem) : null;
  const potionItem = isPotion ? (item as FoodPotionItem) : null;

  // Corner badges
  const { tl, tr } = getDishCornerBadges(item, isRu);

  // Formatted effects
  const effectLines = localizeEffectLines(
    (isRu && item.formatted_effects_ru && item.formatted_effects_ru.length > 0
      ? item.formatted_effects_ru
      : item.formatted_effects_en && item.formatted_effects_en.length > 0
      ? item.formatted_effects_en
      : item.formatted_effects) || [],
    locale,
  );

  const effectFallback =
    dishItem && (isRu ? dishItem.effect_text_ru || dishItem.effect_text_en : dishItem.effect_text_en);

  const desc = isRu ? item.description_ru || item.description_en : item.description_en;

  const handleCopyId = async () => {
    try {
      if (await copyText(item.id)) {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      }
    } catch {
      // Ignore clipboard errors; the ID remains visible for manual copying.
    }
  };

  // Type label
  let typeLabel = '';
  if (isPotion && potionItem) {
    const subLabels: Record<string, string> = {
      shots: strings.potionSub_shots,
      mushrooms: strings.potionSub_mushrooms,
      nutripastes: strings.potionSub_nutripastes,
      utility: strings.potionSub_utility,
      drinks: strings.potionSub_drinks,
      pills: strings.potionSub_pills,
      combat_food: strings.potionSub_combatFood,
    };
    typeLabel = (potionItem.subcategory && subLabels[potionItem.subcategory]) || potionItem.subcategory || 'Potion';
  } else if (dishItem && typeof dishItem.cook_level === 'number') {
    typeLabel = `${strings.cookLevel} ${dishItem.cook_level}`;
  } else if (dishItem) {
    typeLabel = isRu
      ? dishItem.type_ru || (dishItem.type === 'Snack' ? 'Закуска' : 'Основное блюдо')
      : dishItem.type || 'Entrée';
  }

  const starCount = Math.max(0, dishItem?.star || 0);

  return (
    <>
      <Modal
        isOpen={isOpen && !isLightboxOpen}
        onClose={onClose}
        size="lg"
        ariaLabel={name}
        className={styles.foodDetailModal}
        overlayClassName={styles.foodDetailOverlay}
      >
        <Modal.Header className={styles.foodModalHeader}>
          <div className={styles.foodModalHeaderInner}>
            <div className={styles.foodModalArtStage}>
              <button
                type="button"
                className={`${styles.foodHeroStage} ${styles.foodPreviewButton} ${
                  quality.iconClass
                }`}
                onClick={() => setIsLightboxOpen(true)}
                aria-label={`${name} — ${isRu ? 'Открыть изображение' : translateUiText('Open image', locale)}`}
              >
                <img src={iconUrl} alt={name} className={styles.foodHeroImage} />

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
              </button>
            </div>

            <div className={styles.foodModalTitleWrap}>
              <div className={styles.foodModalBadgesRow}>
                <Badge variant={rarityVariant} size="sm" className={`${styles.foodRarityBadge} font-extrabold`}>
                  {rawRarity}
                </Badge>
                {typeLabel && <span className={styles.foodTypeBadge}>{typeLabel}</span>}
                {starCount > 0 && <span className={styles.foodStarsBadge}>{'★'.repeat(starCount)}</span>}
                {typeof dishItem?.player_level === 'number' && (
                  <span className={styles.foodTypeBadge}>
                    {strings.requiredLevel}: {dishItem.player_level}
                  </span>
                )}
                {typeof dishItem?.vitality_cost === 'number' && (
                  <span className={styles.foodTypeBadge}>
                    {strings.vitalityCost}: {dishItem.vitality_cost}
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleCopyId}
                  className={`${styles.foodCopyIdBadge} ${copied ? styles.foodCopyIdCopied : ''}`}
                  title={strings.clickToCopyId}
                  aria-label={`${strings.clickToCopyId}: ${item.id}`}
                >
                  <span>{copied ? strings.copied : item.id}</span>
                </button>
              </div>

              <Modal.Title className={styles.foodModalName}>{name}</Modal.Title>
              {secName && secName !== name && <p className={styles.foodModalFlavor}>{secName}</p>}
            </div>
          </div>
        </Modal.Header>

        <Modal.Body className={styles.foodModalBody}>
        {/* Effect Description */}
        <div className={styles.foodModalSectionCard}>
          <div className={styles.foodModalSectionHeader}>
            <h3 className={styles.foodModalSectionTitle}>
              <span>⚡</span> {strings.buffEffects}
            </h3>
          </div>

          <div className={styles.foodModalSectionContent}>
            {effectLines.length > 0 ? (
              effectLines.map((line, idx) => (
                <div key={idx} className={styles.foodModalDescription}>
                  <RichTextDisplay text={line} />
                </div>
              ))
            ) : effectFallback ? (
              <div className={styles.foodModalDescription}>
                <RichTextDisplay text={effectFallback} />
              </div>
            ) : (
              <span className="text-white/40 text-xs italic">—</span>
            )}

            {desc && <div className="text-xs text-white/60 pt-2 border-t border-white/5">{desc}</div>}
          </div>
        </div>

        {/* Recipe Ingredients for Dishes */}
        {dishItem && dishItem.recipe && dishItem.recipe.ingredients && dishItem.recipe.ingredients.length > 0 && (
          <div className={styles.foodModalSectionCard}>
            <div className={styles.foodModalSectionHeader}>
              <h3 className={styles.foodModalSectionTitle}>
                <span>🍳</span> {strings.recipeIngredients}
              </h3>
            </div>

            <div className={styles.foodModalIngredientsGrid}>
              {dishItem.recipe.ingredients.map((ing) => {
                const ingName = isRu ? ing.name_ru || ing.name_en || ing.name : ing.name_en || ing.name;
                const ingIconUrl = ing.icon ? gameAsset(ing.icon) : '/datamine/favicon.svg';
                const sources = isRu ? ing.sources_ru || ing.sources_en || ing.sources || [] : ing.sources_en || ing.sources || [];
                const ingredientRarity = (ing.rarity || 'N').toLowerCase();

                return (
                  <div
                    key={ing.id}
                    className={styles.foodModalIngredientCard}
                    data-rarity={ingredientRarity}
                    onClick={() => {
                      if (onSelectIngredient && ingName) {
                        onClose();
                        onSelectIngredient(ingName);
                      }
                    }}
                  >
                    <div className={styles.ingredientIconStage}>
                      <img src={ingIconUrl} alt="" className={styles.ingredientIcon} />
                      <span className={styles.ingredientCountBadge}>×{ing.count}</span>
                    </div>

                    <div className={styles.foodModalIngredientText}>
                      <span className={styles.foodModalIngredientName}>{ingName}</span>
                      {sources.length > 0 && (
                        <span className="text-[0.6875rem] text-[#38bdf8] truncate">
                          {sources.join(', ')}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Modal.Body>
      </Modal>
      <InfoLightbox
        isOpen={isOpen && isLightboxOpen}
        onClose={() => setIsLightboxOpen(false)}
        src={iconPngUrl}
        webpSrc={iconUrl}
        caption={name}
        alt={name}
        isRu={isRu}
      />
    </>
  );
};
