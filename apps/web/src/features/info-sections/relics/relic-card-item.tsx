"use client";

import React from "react";
import { EntityCard, GameBadge as Badge } from "@tof-hub/ui";
import { gameAsset } from "@tof-hub/game-assets";
import type { RelicCardItemProps } from "./types";
import { RelicPassiveBadge } from "./relic-passive-badge";
import { RelicPropertyBadge } from "./relic-property-badge";
import { MmoTag } from "../common/mmo-tag";
import styles from "./relics.module.css";

export const RelicCardItem: React.FC<RelicCardItemProps> = ({
  item,
  locale,
  serverMode,
  passiveStat,
  onSelect,
}) => {
  const isRu = locale === "ru";
  const name = isRu
    ? item.name_ru || item.name || item.name_en || item.id
    : item.name_en || item.name || item.id;
  const rawQuality = (item.quality || "SSR").toUpperCase();
  const quality = (rawQuality === "SR" ? "sr" : rawQuality === "R" ? "r" : "ssr") as
    "ssr" | "sr" | "r";
  const isMmo = serverMode === "mmo" || item.server_mode === "mmo" || item.edition === "mmo";

  const propertyLabel = item.property || "Attack";

  // Card Image URL
  const cardImagePath = item.card_image || item.item_icon || item.drawing;
  const cardImageUrl = cardImagePath ? gameAsset(cardImagePath) : "/datamine/favicon.svg";

  const handleClick = (e: React.MouseEvent<HTMLElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
      return;
    }
    e.preventDefault();
    onSelect(item.id);
  };

  const badges: React.ReactNode[] = [
    <RelicPropertyBadge key="prop" property={propertyLabel} locale={locale} className={styles.relicPropertyBadge} />,
  ];

  return (
    <EntityCard
      id={`relic-card-${item.id}`}
      className={styles.relicCard}
      dataId={item.id}
      dataName={name}
      title={name}
      image={cardImageUrl}
      imageAlt={name}
      aspectRatio="portrait"
      showTransparencyCheckerboard={false}
      artPosition="center"
      artZoom={0.62}
      rarity={quality}
      href={`/info/relics?server=${serverMode}&relic=${encodeURIComponent(item.id)}`}
      onClick={handleClick}
      aria-label={`${name} (${rawQuality})`}
      badges={badges}
      artBottomLeftSlot={
        passiveStat ? (
          <RelicPassiveBadge
            stat={passiveStat}
            isRu={isRu}
            isMmo={isMmo}
            presentation="label"
            className={styles.relicPassiveBadge}
          />
        ) : undefined
      }
      raritySlot={
        <div className="flex items-center gap-1">
          {isMmo && <MmoTag />}
          <Badge variant={quality} size="sm" className="font-extrabold uppercase tracking-wider">
            {rawQuality}
          </Badge>
        </div>
      }
    />
  );
};
