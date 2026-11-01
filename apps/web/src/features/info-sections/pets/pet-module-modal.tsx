'use client';

import React, { useState } from 'react';
import { Modal } from '@tof-hub/ui';
import { gameAsset, gameAssetPng, gameAssetWebp } from '@tof-hub/game-assets';
import { getElementLabel, getRoleLabel } from '@tof-hub/game-domain';
import { RichTextDisplay } from '../common/format-rich-text';
import { InfoLightbox } from '../common/info-lightbox';
import type { PetModuleModalProps } from './types';
import { PET_ELEMENT_FILTER_OPTIONS, normalizePetElement } from './constants';
import { PetModuleLoadTag, PetModuleOwnerTag, type PetModuleOwnerVariant } from './pet-module-tags';
import { buildRankedModuleDescription, getModuleRank } from './pet-module-text';
import styles from './pets.module.css';

export const PetModuleModal: React.FC<PetModuleModalProps> = ({
  isOpen,
  onClose,
  module,
  locale,
  strings,
  onSelectServant,
  servants = [],
}) => {
  const [selectedLevel, setSelectedLevel] = useState<number>(4);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  if (!module) return null;

  const isRu = locale === 'ru';
  const name = isRu ? module.name_ru || module.name || module.name_en || module.id : module.name_en || module.name || module.id;

  const ownerName = isRu
    ? module.owner_ru || module.owner || module.owner_en
    : module.owner_en || module.owner;
  const isExclusive = Boolean(ownerName);

  // Levels
  const levelsList = Array.isArray(module.levels) ? module.levels : [];
  const activeLevel = levelsList.find((lvl) => lvl.level === selectedLevel) || levelsList[levelsList.length - 1] || null;
  const description = buildRankedModuleDescription(levelsList, isRu, selectedLevel);

  // Icon
  const iconPath = activeLevel?.icon || module.icon || module.icon_thumb;
  const iconUrl = iconPath ? gameAssetWebp(iconPath) : '/datamine/favicon.svg';
  const iconPngUrl = iconPath ? gameAssetPng(iconPath) : iconUrl;

  // Find owner servant if exclusive
  const ownerServant = isExclusive
    ? servants.find((s) => {
        const oEn = (module.owner_en || module.owner || '').toLowerCase().trim();
        const oId = (module.owner_id || '').toLowerCase().trim();
        return (
          (s.name_en && s.name_en.toLowerCase().trim() === oEn) ||
          s.id.toLowerCase().trim() === oId ||
          (s.name && s.name.toLowerCase().trim() === oEn)
        );
      })
    : null;

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
  const ownerElementOption = PET_ELEMENT_FILTER_OPTIONS.find((option) => option.id === ownerElement);
  const ownerElementLabel = ownerServant
    ? getElementLabel(ownerElement, locale, 'short')
    : '';
  const ownerRole = (ownerServant?.role_norm || ownerServant?.role || '').toLowerCase();
  const isTank = ownerRole.includes('tank') || ownerRole.includes('def');
  const ownerRoleLabel = getRoleLabel(isTank ? 'tank' : 'dps', locale);
  const ownerRoleIconPath = isTank
    ? 'Hotta/Content/Resources/UI/wuqi/icon_fangyu'
    : 'Hotta/Content/Resources/UI/wuqi/icon_qianggong';

  const loadCost = activeLevel?.need_load ?? module.need_load ?? 5;
  const moduleLevelName = activeLevel ? `${name.toUpperCase()} LV.${activeLevel.level}` : name.toUpperCase();
  const handleOwnerSelect = () => {
    if (ownerServant && onSelectServant) {
      onClose();
      onSelectServant(ownerServant.id);
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen && !isLightboxOpen}
        onClose={onClose}
        size="lg"
        ariaLabel={name}
        className={styles.moduleLegacyModal}
      >
      <div className={styles.moduleLegacyContent}>
        <button type="button" className={styles.moduleLegacyClose} onClick={onClose} aria-label={strings.close}>
          <span aria-hidden="true">×</span>
        </button>

        <button
          type="button"
          className={styles.moduleLegacyHero}
          onClick={() => setIsLightboxOpen(true)}
          aria-label={`${name} — ${strings.petOpenImage}`}
        >
          <img src={iconUrl} alt={name} className={styles.moduleLegacyHeroImage} />
        </button>

        <div className={styles.moduleLegacyIdentity}>
          <PetModuleLoadTag label={strings.petLoadTag} cost={loadCost} placement="modal" />
          <PetModuleOwnerTag
            label={isExclusive ? `${strings.moduleExclusive}: ${ownerName}` : strings.petModuleUniversalSingle}
            variant={ownerBadgeVariant}
            placement="modal"
          />
        </div>

        <h2 className={styles.moduleLegacyTitle}>{name}</h2>

        {levelsList.length > 0 && (
          <div className={styles.moduleLegacyStarBar} role="group" aria-label={strings.petStarRank}>
            <span className={styles.moduleLegacyStarLabel}>{strings.petStarRankLabel}</span>
            <div className={styles.moduleLegacyStarButtons}>
              {levelsList.map((lvl) => (
                <button
                  key={lvl.level}
                  type="button"
                  className={`${styles.moduleLegacyStarButton} ${selectedLevel === lvl.level ? styles.moduleLegacyStarButtonActive : ''}`}
                  onClick={() => setSelectedLevel(lvl.level)}
                  aria-label={`${strings.petStar} ${lvl.level}`}
                  aria-pressed={selectedLevel === lvl.level}
                >
                  ★{lvl.level}
                </button>
              ))}
            </div>
          </div>
        )}

        {activeLevel && (
          <section className={styles.moduleLegacyAbility} aria-labelledby="module-ability-title">
            <h3 id="module-ability-title" className={styles.moduleLegacyAbilityLabel}>
              ✦ {moduleLevelName}
            </h3>
            <div className={styles.moduleLegacyDescription}>
              <RichTextDisplay text={description} rank={getModuleRank(levelsList, selectedLevel)} />
            </div>
          </section>
        )}

        {isExclusive && ownerName && (
          <section
            className={styles.moduleLegacyOwner}
            aria-label={strings.petModuleCarrier}
            role={ownerServant ? 'button' : undefined}
            tabIndex={ownerServant ? 0 : undefined}
            onClick={ownerServant ? handleOwnerSelect : undefined}
            onKeyDown={ownerServant ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                handleOwnerSelect();
              }
            } : undefined}
          >
            <h3 className={styles.moduleLegacyOwnerLabel}>✦ {strings.petCarrierOwner}</h3>
            <div className={styles.moduleLegacyOwnerRow}>
              {ownerServant?.photo && (
                <img src={gameAsset(ownerServant.photo)} alt="" className={styles.moduleLegacyOwnerAvatar} />
              )}
              <div className={styles.moduleLegacyOwnerInfo}>
                <div className={styles.moduleLegacyOwnerNameRow}>
                  <strong>{ownerName}</strong>
                  {ownerServant && <span className={styles.moduleLegacyOwnerLink}>{ownerName} →</span>}
                </div>
                {ownerServant && (
                  <div className={styles.moduleLegacyOwnerTags}>
                    <span className={`${styles.moduleLegacyOwnerTag} ${styles.moduleLegacyOwnerElement}`}>
                      {ownerElementOption?.iconPath && <img src={gameAsset(ownerElementOption.iconPath)} alt="" />}
                      {ownerElementLabel.toUpperCase()}
                    </span>
                    <span className={`${styles.moduleLegacyOwnerTag} ${styles.moduleLegacyOwnerRole}`}>
                      <img src={gameAsset(ownerRoleIconPath)} alt="" />
                      {ownerRoleLabel.toUpperCase()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {!isExclusive && (
          <section className={styles.moduleLegacyUniversal}>
            {strings.universalModuleDesc}
          </section>
        )}
      </div>
      </Modal>
      <InfoLightbox
        isOpen={isOpen && isLightboxOpen}
        onClose={() => setIsLightboxOpen(false)}
        src={iconPngUrl}
        webpSrc={iconUrl}
        caption={`${name} — ${strings.petModuleCaption}`}
        alt={name}
        isRu={isRu}
      />
    </>
  );
};
