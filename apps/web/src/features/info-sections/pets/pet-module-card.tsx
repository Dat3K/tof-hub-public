'use client';

import React, { useState } from 'react';
import { EntityCard } from '@tof-hub/ui';
import { gameAsset } from '@tof-hub/game-assets';
import type { PetModuleCardProps } from './types';
import { normalizePetElement } from './constants';
import { PetModuleLoadTag, PetModuleOwnerTag, type PetModuleOwnerVariant } from './pet-module-tags';
import { buildRankedModuleDescription, getModuleRank } from './pet-module-text';
import { RichTextDisplay } from '../common/format-rich-text';
import styles from './pets.module.css';

export const PetModuleCard: React.FC<PetModuleCardProps> = ({
  item,
  locale,
  strings,
  onSelect,
  servants,
}) => {
  const [selectedLevel, setSelectedLevel] = useState(4);
  const isRu = locale === 'ru';
  const name = isRu ? item.name_ru || item.name || item.name_en || item.id : item.name_en || item.name || item.id;

  // Find owner name
  const ownerName = isRu
    ? item.owner_ru || item.owner || item.owner_en
    : item.owner_en || item.owner;

  const isExclusive = Boolean(ownerName);
  const ownerServant = isExclusive
    ? servants.find((servant) => {
        const ownerEn = (item.owner_en || item.owner || '').toLowerCase().trim();
        const ownerId = (item.owner_id || '').toLowerCase().trim();
        return (
          servant.id.toLowerCase().trim() === ownerId ||
          servant.name_en?.toLowerCase().trim() === ownerEn ||
          servant.name?.toLowerCase().trim() === ownerEn
        );
      })
    : undefined;
  const ownerElement = normalizePetElement(ownerServant?.element_norm || ownerServant?.element);
  const ownerBadgeVariant: PetModuleOwnerVariant =
    ownerElement === 'fire'
      ? 'fire'
      : ownerElement === 'phys'
        ? 'phys'
        : ownerElement === 'frost'
          ? 'frost'
          : ownerElement === 'volt'
            ? 'volt'
            : ownerElement === 'altered'
              ? 'altered'
              : 'universal';

  const levels = Array.isArray(item.levels) ? item.levels : [];
  const activeLevel = levels.find((level) => level.level === selectedLevel) || levels[levels.length - 1];

  // Icon and active level data
  const iconPath = activeLevel?.icon || item.icon || item.icon_thumb || levels[0]?.icon;
  const iconUrl = iconPath ? gameAsset(iconPath) : '/datamine/favicon.svg';
  const loadCost = activeLevel?.need_load ?? item.need_load ?? levels[0]?.need_load ?? 5;
  const description = buildRankedModuleDescription(levels, isRu, selectedLevel);
  const loadLabel = strings.petLoadTag;
  const ownerLabel = isExclusive
    ? `${strings.moduleExclusive}: ${ownerName}`
    : strings.petModuleUniversalSingle;

  return (
    <EntityCard
      id={`module-card-${item.family_id || item.id}`}
      dataId={item.family_id || item.id}
      dataName={name}
      title={name}
      className={styles.moduleCard}
    >
      <article
        className={styles.moduleCardContent}
        role="button"
        tabIndex={0}
        aria-label={name}
        onClick={() => onSelect(item)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onSelect(item);
          }
        }}
      >
        <div className={styles.moduleCardArt}>
          <PetModuleLoadTag
            label={loadLabel}
            cost={loadCost}
            placement="card"
            title={strings.loadCost.replace('{load}', String(loadCost))}
          />

          <PetModuleOwnerTag label={ownerLabel} variant={ownerBadgeVariant} placement="card" />

          <img className={styles.moduleCardImage} src={iconUrl} alt={name} loading="lazy" decoding="async" />
        </div>

        <div className={styles.moduleCardBody}>
          <div className={styles.moduleCardTitleRow}>
            <h3 className={styles.moduleCardTitle}>{name}</h3>
            <div className={styles.moduleStarSelector} role="group" aria-label={strings.petModuleLevel}>
              {[1, 2, 3, 4].map((level) => (
                <button
                  key={level}
                  type="button"
                  className={`${styles.moduleStarButton} ${selectedLevel === level ? styles.moduleStarButtonActive : ''}`}
                  aria-label={`${strings.petLevel} ${level}`}
                  aria-pressed={selectedLevel === level}
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedLevel(level);
                  }}
                >
                  ★{level}
                </button>
              ))}
            </div>
          </div>

          {description ? (
            <RichTextDisplay
              text={description}
              rank={getModuleRank(levels, selectedLevel)}
              className={styles.moduleCardDescription}
            />
          ) : (
            <p className={styles.moduleCardDescription}>—</p>
          )}
        </div>
      </article>
    </EntityCard>
  );
};
