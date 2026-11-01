'use client';

import { translateUiText } from '@tof-hub/i18n';
import React from 'react';
import { EntityCard, GameBadge as Badge } from '@tof-hub/ui';
import type { ElementVariant, RoleVariant } from '@tof-hub/ui';
import { gameAsset } from '@tof-hub/game-assets';
import type { PetServantCardProps } from './types';
import { normalizePetElement } from './constants';
import { MmoTag } from '../common/mmo-tag';
import styles from './pets.module.css';

export const PetServantCard: React.FC<PetServantCardProps> = ({
  item,
  locale,
  strings,
  onSelect,
}) => {
  const isRu = locale === 'ru';
  const name = isRu ? item.name_ru || item.name || item.name_en || item.id : item.name_en || item.name || item.id;
  const quality = (item.quality?.toLowerCase() === 'sr' ? 'sr' : 'ssr') as 'ssr' | 'sr';

  // Art paths
  const artPath = item.photo || item.photo_thumb || item.icon || item.icon_thumb || item.token_icon;
  const artUrl = artPath ? gameAsset(artPath) : '/datamine/favicon.svg';
  const tokenArtPath = item.token_icon || item.token_icon_thumb;
  const tokenArtUrl = tokenArtPath ? gameAsset(tokenArtPath) : null;

  // Element
  const elemId = normalizePetElement(item.element_norm || item.element);
  const elementVariant: ElementVariant | undefined =
    elemId === 'phys'
      ? 'phys'
      : elemId === 'fire'
      ? 'flame'
      : elemId === 'frost'
      ? 'frost'
      : elemId === 'volt'
      ? 'volt'
      : elemId === 'altered'
      ? 'altered'
      : undefined;

  const elementIconSuffix =
    elemId === 'phys' ? 'wu' : elemId === 'fire' ? 'huo' : elemId === 'frost' ? 'bing' : elemId === 'volt' ? 'lei' : 'powers';
  const elementIconUrl = gameAsset(`Hotta/Content/Resources/UI/wuqi/icon_element_${elementIconSuffix}`);

  // Role
  const isDps = (item.role_norm || item.role || '').toLowerCase().includes('atk') || (item.role_norm || item.role || '').toLowerCase().includes('dps');
  const roleVariant: RoleVariant = isDps ? 'dps' : 'tank';
  const roleIconUrl = gameAsset('Hotta/Content/Resources/UI/wuqi/icon_qianggong');

  // Server Edition
  const isMmo = item.source_edition === 'mmo' || item.id.toLowerCase().startsWith('mmo_');

  const badges: React.ReactNode[] = [];
  if (elementVariant) {
    badges.push(
      <Badge presentation="icon"
        key="element"
        variant={elementVariant}
        size="sm"
        className={styles.petCardBadge}
        icon={
          <img
            src={elementIconUrl}
            alt=""
            className={styles.badgeIcon}
            loading="lazy"
          />
        }
      >
        {strings[
          elementVariant === 'phys'
            ? 'elemPhys'
            : elementVariant === 'flame'
            ? 'elemFlame'
            : elementVariant === 'frost'
            ? 'elemFrost'
            : elementVariant === 'volt'
            ? 'elemVolt'
            : 'elemAltered'
        ]}
      </Badge>
    );
  }

  badges.push(
    <Badge presentation="icon"
      key="role"
      variant={roleVariant}
      size="sm"
      className={styles.petCardBadge}
      icon={
        <img
          src={roleIconUrl}
          alt=""
          className={styles.badgeIcon}
          loading="lazy"
        />
      }
    >
      {translateUiText('DPS', locale)}
    </Badge>
  );

  return (
    <EntityCard
      id={`pet-card-${item.id}`}
      className={styles.petCard}
      dataId={item.id}
      dataName={name}
      title={name}
      image={artUrl}
      imageAlt={name}
      rarity={quality}
      aspectRatio="portrait"
      artPosition="center"
      artZoom={0.8}
      showTransparencyCheckerboard={false}
      cornerSlot={
        tokenArtUrl ? (
          <span className={styles.petTokenArt} title={translateUiText("Token Art", locale)}>
            <img src={tokenArtUrl} alt={translateUiText("Token Art", locale)} loading="lazy" />
          </span>
        ) : undefined
      }
      onClick={(e) => {
        e.preventDefault();
        onSelect(item);
      }}
      raritySlot={
        <div className="flex items-center gap-1">
          {isMmo && <MmoTag />}
          <Badge
            variant={quality}
            size="sm"
            className={`${styles.petCardRarityBadge} font-extrabold uppercase tracking-wider`}
          >
            {item.quality || 'SSR'}
          </Badge>
        </div>
      }
      badges={badges}
    />
  );
};
