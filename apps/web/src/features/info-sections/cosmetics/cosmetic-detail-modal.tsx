"use client";

import React, { useEffect, useState } from "react";
import { GameBadge, GameRichText, type RarityVariant } from "@tof-hub/ui";
import { gameAsset, gameAssetSources } from "@tof-hub/game-assets";
import type { CosmeticDetailModalProps } from "./types";
import {
  getCosmeticCategoryTone,
  getItemCategory,
  normalizeQuality,
  normalizeUnrealPath,
} from "./constants";
import styles from "./cosmetics.module.css";

export const CosmeticDetailModal: React.FC<CosmeticDetailModalProps> = ({
  isOpen,
  item,
  onClose,
  isRu,
  strings,
  onOpenLightbox,
}) => {
  const [copiedPath, setCopiedPath] = useState(false);
  // Opening the details plays a ready animation; closed cards and the list load only the static poster.
  const animatedSrc = isOpen && item?.animation?.status === "ready" ? item.animation.webp : null;
  const [playAnimation, setPlayAnimation] = useState(true);
  useEffect(() => setPlayAnimation(true), [animatedSrc]);

  if (!isOpen || !item) return null;

  // Free chat stickers have no item name; their localized chat-panel group is the only game label.
  const name = (isRu ? item.name_ru || item.name_en || item.name : item.name_en || item.name) || item.sub_type;
  const desc = isRu ? item.desc_ru || item.description : item.desc_en || item.description;
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
  const showQuality = !['ChatSticker', 'Badge'].includes(category) || Boolean(item.quality || item.rarity);

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

  const imgSrc = item.painting || item.photo || item.icon || "";
  const resolvedImg = imgSrc ? gameAsset(imgSrc) : "";
  const previewImg = playAnimation && animatedSrc ? animatedSrc : resolvedImg;
  const stopAnimation = () => setPlayAnimation(false);
  const lightboxSources = item.animation?.status === 'ready'
    ? {png: item.animation.posterPng, webp: item.animation.posterWebp}
    : imgSrc ? gameAssetSources(imgSrc) : null;

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

  const activeSource = isRu
    ? item.source_ru || item.unlock_ru || item.active_source || item.source
    : item.source_en || item.unlock_en || item.active_source || item.source;

  // A rendered animation's poster is a generated file; its game asset is the source material.
  const gameReference = item.animation?.status === 'ready' && item.animation.source ? item.animation.source : item.icon || item.photo || item.id;
  const assetPath = normalizeUnrealPath(gameReference) || item.id;

  const handleCopyPath = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(assetPath).then(() => {
        setCopiedPath(true);
        setTimeout(() => setCopiedPath(false), 1800);
      });
    }
  };

  const parts = Array.isArray(item.parts) && item.parts.length > 0 ? item.parts : null;

  return (
    <div className={styles.legacyModalOverlay} role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <div className={styles.legacyModalDialog} role="dialog" aria-modal="true" aria-labelledby="modal-cosmetic-title">
        <button type="button" className={styles.legacyModalClose} onClick={onClose} aria-label={strings.close}>
          ×
        </button>
        <div className={styles.legacyModalBody}>
        {/* Preview Stage (Click to Lightbox) */}
        <div
          className={styles.modalPreviewStage}
          role="button"
          aria-disabled={!resolvedImg}
          tabIndex={0}
          title={name || strings.preview}
          onClick={() => {
            if (resolvedImg) {
              onOpenLightbox(lightboxSources?.png || resolvedImg, name || "", lightboxSources?.webp, item.animation);
            }
          }}
          onKeyDown={(e) => {
            if ((e.key === "Enter" || e.key === " ") && resolvedImg) {
              e.preventDefault();
              onOpenLightbox(lightboxSources?.png || resolvedImg, name || "", lightboxSources?.webp, item.animation);
            }
          }}
        >
          {isFrame ? (
            <div className={styles.frameStage}>
              {resolvedImg ? (
                <img src={resolvedImg} alt={name || ""} className={styles.frameImg} />
              ) : (
                <span className={styles.fallbackEmoji}>🖼️</span>
              )}
            </div>
          ) : isTitle ? (
            <div className={styles.titlePlate}>
              {resolvedImg ? (
                <img src={resolvedImg} alt={name || ""} className={styles.titleBadgeImg} />
              ) : (
                <span className={styles.titleTextFallback}>« {name} »</span>
              )}
            </div>
          ) : isChat ? (
            resolvedImg ? (
              <img src={previewImg} alt={name || ""} className={styles.chatImg} onError={previewImg !== resolvedImg ? stopAnimation : undefined} />
            ) : (
              <span className={styles.fallbackEmoji}>💬</span>
            )
          ) : resolvedImg ? (
            <img src={previewImg} alt={name || ""} className={styles.modalPreviewImg} onError={previewImg !== resolvedImg ? stopAnimation : undefined} />
          ) : (
            <span className={styles.fallbackEmoji} role="img" aria-label={strings.imageUnavailable}>—</span>
          )}
        </div>

        <div className={styles.modalHeaderRow}>
          <h2 className={styles.modalTitle} id="modal-cosmetic-title">{name}</h2>
          <div className={styles.modalBadges}>
            {showQuality && <GameBadge variant={qClass as RarityVariant}>{quality}</GameBadge>}
            <span className={`${styles.typeTag} ${styles[`typeTag--${categoryTone}`]}`}>{typeLabel}</span>
            <span className={styles.idBadge}>{item.id}</span>
          </div>
        </div>

        {activeSource && (
          <div className={styles.acquisitionBanner}>
            <span className={styles.acquisitionLabel}>{strings.infoSource}</span>
            <span className={styles.acquisitionValue}>{activeSource}</span>
          </div>
        )}

        {item.animation?.status === "unresolved" && <p className={styles.descBox}>{strings.animationUnavailable}</p>}
        {item.animation?.status === "ready" && item.animation.timing === "inferred" && <p className={styles.descBox}>{strings.animationTimingInferred}</p>}

        {desc && <GameRichText className={styles.descBox} text={desc} />}

        {/* Mount Crafting Components Breakdown */}
        {parts && (
          <div className={styles.componentsSection}>
            <div className={styles.componentsHeader}>
              <span aria-hidden="true">✦</span>
              <span>{strings.mountCraftingParts}</span>
            </div>
            <div className={styles.componentsList}>
              {parts.map((part) => {
                const partName = isRu
                  ? part.name_ru || part.name_en || part.title || part.name
                  : part.name_en || part.name || part.title;
                const partIcon = part.icon ? gameAsset(part.icon) : "";
                const partSource = isRu
                  ? part.source_ru || part.location_ru || part.source_en
                  : part.source_en || part.location_en || part.source;
                const partLore = isRu ? part.lore_ru || part.lore_en : part.lore_en || part.lore;
                const pQuality = normalizeQuality(part.quality || part.rarity);

                return (
                  <div key={part.id} className={styles.partCard}>
                    <div className={styles.partHeader}>
                      <div className={styles.partIconBox}>
                        {partIcon ? (
                          <img src={partIcon} alt={partName || ""} className={styles.partIcon} />
                        ) : (
                          <span>⚙️</span>
                        )}
                        <span className={styles.partCount}>×{part.count || 1}</span>
                      </div>
                      <div className={styles.partInfo}>
                        <div className={styles.partTitleRow}>
                          <strong className={styles.partTitle}>{partName}</strong>
                          {part.drop_rate && (
                            <span className={styles.dropRateBadge}>
                              {strings.mountDropRate} {part.drop_rate}
                            </span>
                          )}
                        </div>
                        {partSource && <div className={styles.partLocation}>{partSource}</div>}
                      </div>
                    </div>
                    {partLore && <div className={styles.partLore}>{partLore}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Meta Info Grid */}
        <div className={styles.infoGrid}>
          {item.owner_simulacrum_id && (
            <div className={styles.infoItem}>
              <span className={styles.infoItemLabel}>{strings.infoOwner}</span>
              <span className={styles.infoItemVal}>{item.owner_simulacrum_id}</span>
            </div>
          )}

          {petTypeLabel && (
            <div className={styles.infoItem}>
              <span className={styles.infoItemLabel}>{strings.infoPetType}</span>
              <span className={styles.infoItemVal} style={{ color: "#6ee7b7" }}>
                {petTypeLabel}
              </span>
            </div>
          )}

          {isMount && mountTypeLabel && (
            <div className={styles.infoItem}>
              <span className={styles.infoItemLabel}>{strings.mountMovement}</span>
              <span
                className={styles.infoItemVal}
                style={{ color: isUnderwater ? "#7dd3fc" : "#fdba74" }}
              >
                {mountTypeLabel}
              </span>
            </div>
          )}

          <div className={styles.infoItem}>
            <div className={styles.assetPathRow}>
              <span className={styles.infoItemLabel}>{strings.infoAsset}</span>
              <button
                type="button"
                className={styles.copyButton}
                onClick={handleCopyPath}
                title={strings.copyPath}
              >
                {copiedPath ? strings.copied : "📋 " + strings.copyPath}
              </button>
            </div>
            <code className={styles.assetPathCode} title={assetPath}>
              {assetPath}
            </code>
          </div>
        </div>

        {lightboxSources && (
          <div className={styles.modalDownloadActions}>
            <a
              className={`${styles.modalDownloadButton} ${styles.modalDownloadButtonPng}`}
              href={lightboxSources.png}
              download={`${item.id}.png`}
            >
              <span aria-hidden="true">↓</span>
              {strings.downloadPng}
            </a>
            <a
              className={`${styles.modalDownloadButton} ${styles.modalDownloadButtonWebp}`}
              href={lightboxSources.webp}
              download={`${item.id}.webp`}
            >
              <span aria-hidden="true">↓</span>
              {strings.downloadWebp}
            </a>
            {item.animation?.status === "ready" && (
              <a
                className={`${styles.modalDownloadButton} ${styles.modalDownloadButtonPng}`}
                href={item.animation.gif}
                download={`${item.id}.gif`}
              >
                <span aria-hidden="true">↓</span>
                {strings.downloadGif}
              </a>
            )}
          </div>
        )}
        </div>
      </div>
    </div>
  );
};
