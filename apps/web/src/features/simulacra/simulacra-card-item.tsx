'use client';

import React from 'react';
import { fillText, localeText } from '@/lib/i18n/text';
import { EntityCard, Badge } from '@tof-hub/ui';
import { gameAsset } from '@tof-hub/game-assets';
import { normalizeElement, normalizeRole } from '@tof-hub/game-domain';
import type { SimulacraCardItemProps } from './types';
import { getDualElementIconPath } from '../info-sections/common/element-icons';
import styles from './simulacra.module.css';

function getElemIconSuffix(norm: string): string {
  switch (norm) {
    case 'physical':
      return 'wu';
    case 'flame':
      return 'huo';
    case 'frost':
      return 'bing';
    case 'volt':
      return 'lei';
    case 'altered':
      return 'powers';
    default:
      return 'powers';
  }
}

function getRoleIconPath(norm: string): string {
  switch (norm) {
    case 'dps':
      return 'Hotta/Content/Resources/UI/wuqi/icon_qianggong';
    case 'tank':
      return 'Hotta/Content/Resources/UI/wuqi/icon_fangyu';
    case 'benediction':
      return 'Hotta/Content/Resources/UI/wuqi/icon_zengyi';
    default:
      return 'Hotta/Content/Resources/UI/wuqi/icon_qianggong';
  }
}

export const SimulacraCardItem: React.FC<SimulacraCardItemProps> = ({
  item,
  locale,
  serverMode,
  strings,
  onSelect,
}) => {
  const name =
    locale === 'ru'
      ? item.name_ru || item.name || item.name_en || item.id
      : item.name_en || item.name || item.id;

  const weaponName =
    locale === 'ru'
      ? item.weapon_name_ru || item.weapon_name || item.weapon_name_en || ''
      : item.weapon_name_en || item.weapon_name || '';

  const rarity = (item.rarity || 'SSR').toUpperCase();
  const rarityNorm = (rarity === 'SR' ? 'sr' : 'ssr') as 'ssr' | 'sr';

  const elementNorm = normalizeElement(item.element).toLowerCase();
  const secondaryElementNorm = normalizeElement(item.element_secondary || '').toLowerCase();
  const elementVariant = (elementNorm === 'physical' ? 'phys' : elementNorm) as
    | 'phys'
    | 'flame'
    | 'frost'
    | 'volt'
    | 'altered';
  const elementPair = [elementNorm, secondaryElementNorm].filter(Boolean).join('-');
  const elementComboClass =
    elementPair === 'physical-flame'
      ? styles.simHeroElementPhysicalFlame
      : elementPair === 'flame-physical'
        ? styles.simHeroElementFlamePhysical
        : elementPair === 'frost-volt'
          ? styles.simHeroElementFrostVolt
          : elementPair === 'volt-frost'
            ? styles.simHeroElementVoltFrost
            : '';

  const roleNorm = normalizeRole(item.role || item.resonance).toLowerCase();
  const roleVariant = (roleNorm === 'benediction' || roleNorm === 'tank' ? roleNorm : 'dps') as
    | 'dps'
    | 'tank'
    | 'benediction';

  const isMmo = serverMode === 'mmo' || item.server_mode === 'mmo' || item.edition === 'mmo';
  const seasonNum =
    typeof item.season === 'number' && item.season > 0
      ? item.season
      : parseInt(String(item.season || item.season_badge || item.season_tag || '').replace(/\D+/g, ''), 10) || 1;

  // Portrait Art URL
  const artPath = item.avatar || item.avatar_thumb || item.card || item.portrait || item.detail_art;
  const portraitUrl = artPath ? gameAsset(artPath) : '/datamine/favicon.svg';

  // Weapon Icon URL
  const weaponIconUrl = item.icon ? gameAsset(item.icon) : null;

  // Element Icon URL (combo icon if available, else standard element icon)
  const dualElementIconPath = getDualElementIconPath(item.element, item.element_secondary);
  const elementIconUrl = dualElementIconPath || item.element_combo_icon
    ? gameAsset(dualElementIconPath || item.element_combo_icon || '')
    : gameAsset(`Hotta/Content/Resources/UI/wuqi/icon_element_${getElemIconSuffix(elementNorm)}`);

  // Role Icon URL
  const roleIconUrl = item.role_icon ? gameAsset(item.role_icon) : gameAsset(getRoleIconPath(roleNorm));

  const handleClick = (e: React.MouseEvent<HTMLElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
      return;
    }
    if (onSelect) {
      e.preventDefault();
      onSelect(item.id);
    }
  };

  return (
    <EntityCard
      id={`sim-card-${item.id}`}
      className={styles.simCard}
      dataId={item.id}
      dataName={name}
      title={name}
      subtitle={weaponName}
      image={portraitUrl}
      imageAlt={name}
      aspectRatio="portrait"
      // Match the legacy catalog card: show the full portrait framing instead
      // of the shared EntityCard's more aggressive default crop.
      artPosition="center"
      artZoom={1}
      rarity={rarityNorm}
      href={`/info/simulacra?char=${encodeURIComponent(item.id)}`}
      onClick={handleClick}
      aria-label={`${strings.viewProfileAria}: ${name}`}
      badges={[
        <Badge
          key="elem"
          variant={elementVariant}
          size="sm"
          title={item.element || ''}
          className={`${styles.simCardBadge} ${elementComboClass}`}
          icon={
            <img
              src={elementIconUrl}
              alt=""
              className={`${styles.badgeIcon} ${styles.simCardBadgeIcon}`}
              loading="lazy"
              onError={(e) => {
                (e.currentTarget as HTMLElement).style.display = 'none';
              }}
            />
          }
        >
          <span className="sr-only">{item.element}</span>
        </Badge>,
        <Badge
          key="role"
          variant={roleVariant}
          size="sm"
          title={item.role || ''}
          className={styles.simCardBadge}
          icon={
            <img
              src={roleIconUrl}
              alt=""
              className={styles.badgeIcon}
              loading="lazy"
              onError={(e) => {
                (e.currentTarget as HTMLElement).style.display = 'none';
              }}
            />
          }
        >
          <span className="sr-only">{item.role}</span>
        </Badge>,
      ]}
      raritySlot={
        <div className="flex items-center gap-1">
          {isMmo && (
            <span
              className={`${styles.seasonBadge} ${
                seasonNum === 1 ? styles.seasonBadge1 : styles.seasonBadge2
              }`}
              title={fillText(localeText(locale)('Season {0}'), [seasonNum])}
            >
              S{seasonNum}
            </span>
          )}
          <Badge
            variant={rarityNorm}
            size="sm"
            className={`${styles.simCardRarityBadge} font-extrabold uppercase tracking-wider`}
          >
            {rarity}
          </Badge>
        </div>
      }
      cornerSlot={
        weaponIconUrl ? (
          <div className={styles.weaponBadgeBox} title={weaponName}>
            <img
              src={weaponIconUrl}
              alt={weaponName}
              loading="lazy"
              onError={(e) => {
                (e.currentTarget as HTMLElement).style.display = 'none';
              }}
            />
          </div>
        ) : null
      }
    />
  );
};

SimulacraCardItem.displayName = 'SimulacraCardItem';
