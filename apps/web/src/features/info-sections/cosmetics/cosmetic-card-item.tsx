"use client";

import React from "react";
import { GameBadge, type RarityVariant } from "@tof-hub/ui";
import { gameAsset } from "@tof-hub/game-assets";
import type { CosmeticCardItemProps } from "./types";
import { getCosmeticCategoryTone, getItemCategory, normalizeQuality } from "./constants";
import styles from "./cosmetics.module.css";

export const CosmeticCardItem: React.FC<CosmeticCardItemProps> = ({
  item,
  strings,
  isRu,
  onClick,
}) => {
  // Free chat stickers have no item name; their localized chat-panel group is the only game label.
  const name = (isRu ? item.name_ru || item.name_en || item.name : item.name_en || item.name) || item.sub_type;
  const category = getItemCategory(item);
  const categoryTone = getCosmeticCategoryTone(category);
  const quality = normalizeQuality(item.quality || item.rarity);
  const qClass = quality.toLowerCase();

  const isPet = category === "CutePet";
  const isMount = category === "Mount";
  const isFrame = category === "AvatarFrame";
  const isTitle = category === "Title";
  const isChat = category === "ChatBubble" || category === "ChatBox";
  const isHc = category === "SimulacrumHauteCouture";
  const isNewMediaCategory = category === 'ChatSticker' || category === 'Badge';
  const showQuality = !isNewMediaCategory || Boolean(item.quality || item.rarity);

  // Fallback emoji
  const fallbackEmoji = isPet
    ? item.pet_type === "fish"
      ? "🐟"
      : "🐾"
    : isMount
      ? "🏎️"
      : category === "Avatar"
        ? "👤"
        : isFrame
          ? "🖼️"
          : isTitle || category === 'Badge'
            ? "🎖️"
            : isChat || category === 'ChatSticker'
              ? "💬"
              : isHc
                ? "✨"
                : "👗";

  const typeLabelMap: Record<string, string> = {
    SimulacrumHauteCouture: strings.typeHauteCouture,
    Dress: strings.typeDress,
    Headwear: strings.typeHeadwear,
    Glider: strings.typeGlider,
    GuideNPC: strings.typeServant,
    Medal: strings.typeMedal,
    CutePet: strings.typeCutePet,
    Mount: strings.typeMount,
    Enemies: strings.typeEnemies,
    Title: strings.typeTitle,
    Avatar: strings.typeAvatar,
    AvatarFrame: strings.typeAvatarFrame,
    ChatBubble: strings.typeChatBubble,
    ChatBox: strings.typeChatBox,
    ChatSticker: strings.typeChatSticker,
    Badge: strings.typeBadge,
  };
  const typeLabel = typeLabelMap[category] || strings.typeDress;

  const imgSrc = item.photo || item.icon || "";
  const resolvedImg = imgSrc ? gameAsset(imgSrc) : "";

  const isUnderwater = item.movement_type === "underwater" || item.movement === "underwater";
  const mountTypeLabel = isMount
    ? isUnderwater
      ? strings.mountUnderwater
      : strings.mountGround
    : "";

  const petTypeLabel =
    isPet && item.pet_type
      ? item.pet_type === "fish"
        ? strings.petTypeFish
        : strings.petTypeCommon
      : "";

  const sourceText = isRu
    ? item.source_ru || item.unlock_ru || item.source || item.active_source
    : item.source_en || item.unlock_en || item.source || item.active_source;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick(item);
    }
  };

  return (
    <article
      className={`${styles.cosmeticCard} ${styles[`cosmeticCard--${qClass}`] || ""} ${styles[`cosmeticCard--category-${categoryTone}`] || ""}`}
      tabIndex={0}
      role="button"
      aria-label={name || strings.itemFallback}
      onClick={() => onClick(item)}
      onKeyDown={handleKeyDown}
    >
      <div className={styles.previewWrap}>
        {/* Badges Overlay */}
        <div className={styles.badgesOverlay}>
          <span className={`${styles.typeTag} ${styles[`typeTag--${categoryTone}`]}`}>
            {typeLabel}
          </span>
          <div className={styles.badgesRight}>
            {item.animation && <span className={styles.petTypeChip}>{item.animation.status === "ready" ? "GIF" : item.animation.kind === 'dynamic-emoji' ? strings.animated : strings.mediaEffect}</span>}
            {petTypeLabel && <span className={styles.petTypeChip}>{petTypeLabel}</span>}
            {showQuality && <GameBadge variant={qClass as RarityVariant}>{quality}</GameBadge>}
          </div>
        </div>

        {/* Thumbnail Preview Area */}
        {isFrame ? (
          <div className={styles.frameStage}>
            {resolvedImg ? (
              <img
                src={resolvedImg}
                alt={name || ""}
                className={styles.frameImg}
                loading="lazy"
                decoding="async"
              />
            ) : (
              <span className={styles.fallbackEmoji}>{fallbackEmoji}</span>
            )}
          </div>
        ) : isTitle ? (
          <div className={styles.titlePlate}>
            {resolvedImg ? (
              <img
                src={resolvedImg}
                alt={name || ""}
                className={styles.titleBadgeImg}
                loading="lazy"
                decoding="async"
              />
            ) : (
              <span className={styles.titleTextFallback}>« {name} »</span>
            )}
          </div>
        ) : isChat ? (
          resolvedImg ? (
            <img
              src={resolvedImg}
              alt={name || ""}
              className={styles.chatImg}
              loading="lazy"
              decoding="async"
            />
          ) : (
            <span className={styles.fallbackEmoji}>{fallbackEmoji}</span>
          )
        ) : resolvedImg ? (
          <img
            src={resolvedImg}
            alt={name || ""}
            className={styles.previewImg}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <span className={styles.fallbackEmoji} role="img" aria-label={strings.imageUnavailable}>{fallbackEmoji}</span>
        )}

        {/* Mount movement chip */}
        {isMount && mountTypeLabel && (
          <span
            className={`${styles.mountChip} ${
              isUnderwater ? styles["mountChip--underwater"] : styles["mountChip--ground"]
            }`}
          >
            {mountTypeLabel}
          </span>
        )}
      </div>

      {/* Card Info Body */}
      <div className={styles.cardBody}>
        <h3 className={styles.cardName} title={name}>
          {name}
        </h3>
        {sourceText && (
          <div className={styles.cardSource} title={sourceText}>
            <span className={styles.sourceIcon} aria-hidden="true">
              ✦
            </span>
            <span className={styles.sourceText}>{sourceText}</span>
          </div>
        )}
      </div>
    </article>
  );
};
