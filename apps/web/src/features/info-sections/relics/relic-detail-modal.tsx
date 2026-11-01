"use client";

import { translateUiText } from '@tof-hub/i18n';
import React, { useState } from "react";
import { Modal, GameBadge as Badge } from "@tof-hub/ui";
import { gameAssetPng, gameAssetWebp } from "@tof-hub/game-assets";
import { RichTextDisplay } from "../common/format-rich-text";
import { InfoLightbox } from "../common/info-lightbox";
import { copyText } from "@/lib/clipboard";
import { MmoTag } from "../common/mmo-tag";
import type { RelicDetailModalProps } from "./types";
import { RelicPassiveBadge } from "./relic-passive-badge";
import { RelicPropertyBadge } from "./relic-property-badge";
import styles from "./relics.module.css";

export const RelicDetailModal: React.FC<RelicDetailModalProps> = ({
  isOpen,
  onClose,
  relic,
  locale,
  serverMode,
  passiveStat,
  strings,
}) => {
  const [copied, setCopied] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [lightboxWebpSrc, setLightboxWebpSrc] = useState<string | null>(null);
  const [lightboxCaption, setLightboxCaption] = useState<string>("");

  if (!relic) return null;

  const isRu = locale === "ru";
  const name = isRu
    ? relic.name_ru || relic.name || relic.name_en || relic.id
    : relic.name_en || relic.name || relic.id;
  const desc = isRu
    ? relic.desc_ru || relic.desc || relic.description || relic.desc_en || ""
    : relic.desc_en || relic.desc || "";
  const flavorDesc = isRu
    ? relic.flavor_desc_ru || relic.flavor_desc_en || ""
    : relic.flavor_desc_en || "";

  const rawQuality = (relic.quality || "SSR").toUpperCase();
  const quality = (rawQuality === "SR" ? "sr" : rawQuality === "R" ? "r" : "ssr") as
    "ssr" | "sr" | "r";
  const isMmo = serverMode === "mmo" || relic.server_mode === "mmo" || relic.edition === "mmo";

  const propertyLabel = relic.property || "Attack";

  // Art paths
  const cardImagePath = relic.card_image || relic.item_icon || relic.drawing;
  const heroFullUrl = cardImagePath ? gameAssetWebp(cardImagePath) : "";
  const heroPngUrl = cardImagePath ? gameAssetPng(cardImagePath) : "";

  const attackIconPath = relic.attack_icon || relic.attack_icon_thumb;
  const attackIconUrl = attackIconPath ? gameAssetWebp(attackIconPath) : null;
  const attackIconPngUrl = attackIconPath ? gameAssetPng(attackIconPath) : null;

  const cleanCopyId = relic.canonical_id || relic.id.replace(/[-_]mmo$/, "");

  const handleCopyId = async () => {
    try {
      if (await copyText(cleanCopyId)) {
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      }
    } catch {
      // Ignore clipboard error
    }
  };

  const openZoom = (url: string, captionText: string, webpUrl?: string) => {
    setLightboxSrc(url);
    setLightboxWebpSrc(webpUrl || null);
    setLightboxCaption(captionText);
  };

  const closeLightbox = () => {
    setLightboxSrc(null);
    setLightboxWebpSrc(null);
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        size="xl"
        ariaLabel={name}
        className={styles.relicDetailModal}
        overlayClassName={styles.relicDetailOverlay}
      >
        <Modal.Header className={styles.relicModalHeader}>
          <div className={styles.relicModalHeaderInner}>
            {/* Hero Art Showcase */}
            <div className={styles.modalArtStage}>
              <div
                className={styles.heroRelicStage}
                role="button"
                tabIndex={0}
                onClick={() => openZoom(heroPngUrl, name, heroFullUrl)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openZoom(heroPngUrl, name, heroFullUrl);
                  }
                }}
                title={strings.clickToZoom}
                aria-label={`${strings.clickToZoom}: ${name}`}
              >
                {heroFullUrl && (
                  <img src={heroFullUrl} alt={name} className={styles.heroRelicImg} />
                )}
              </div>
            </div>

            {/* Badges Row */}
            <div className={styles.relicModalTitleWrap}>
              <div className={styles.relicModalBadgesRow}>
              <Badge
                variant={quality}
                size="sm"
                className="font-extrabold uppercase tracking-wider"
              >
                {rawQuality}
              </Badge>

              {isMmo && <MmoTag />}

              <RelicPropertyBadge property={propertyLabel} locale={locale} className={styles.relicPropertyBadge} />

              {passiveStat && (
                <RelicPassiveBadge
                  stat={passiveStat}
                  isRu={isRu}
                  isMmo={isMmo}
                  className={styles.relicPassiveBadge}
                />
              )}

              {typeof relic.cooldown === "number" && relic.cooldown > 0 && (
                <span className={styles.cooldownBadge}>
                  ⏱ {strings.cooldownSec.replace("{cd}", String(relic.cooldown))}
                </span>
              )}

              <button
                type="button"
                onClick={handleCopyId}
                className={`${styles.copyIdBadge} ${copied ? styles.copyIdCopied : ""}`}
                title={strings.clickToCopyId}
                aria-label={`${strings.clickToCopyId}: ${cleanCopyId}`}
              >
                <span>{copied ? strings.copied : cleanCopyId}</span>
              </button>
              </div>

              {/* Title Row with optional Skill Icon */}
              <div className={styles.relicModalNameRow}>
                <Modal.Title className={styles.relicModalName}>{name}</Modal.Title>
                {attackIconUrl && (
                  <div
                    className={styles.skillSlotBox}
                    role="button"
                    tabIndex={0}
                    onClick={() => openZoom(attackIconPngUrl || "", name, attackIconUrl || undefined)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openZoom(attackIconPngUrl || "", name, attackIconUrl || undefined);
                      }
                    }}
                    title={`${strings.abilityIcon}: ${name}`}
                    aria-label={`${strings.abilityIcon}: ${name}`}
                  >
                    <img src={attackIconUrl} alt={strings.abilityIcon} />
                    <span className={styles.relicModalSkillBadge}>{translateUiText("Skill", locale)}</span>
                  </div>
                )}
              </div>

              {flavorDesc && <p className={styles.relicModalFlavor}>{flavorDesc}</p>}
            </div>
          </div>
        </Modal.Header>

        <Modal.Body className={styles.relicModalBody}>
          {/* Base Ability Description */}
          {desc && (
            <div className={styles.sectionCard}>
              <div className={styles.sectionHeader}>
                <h4 className={styles.sectionTitle}>
                  <span>✦</span> {strings.baseDescription}
                </h4>
              </div>
              <RichTextDisplay text={desc} className="text-sm text-[#e5e7eb] leading-relaxed" />
            </div>
          )}

          {/* Star Advancements 1★ to 5★ */}
          {Array.isArray(relic.stars) && relic.stars.length > 0 && (
            <div className={styles.sectionCard}>
              <div className={styles.sectionHeader}>
                <h4 className={styles.sectionTitle}>
                  <span>✦</span> {strings.starAdvancements}
                </h4>
              </div>

              <div className={styles.starsList}>
                {relic.stars.map((starItem) => {
                  const starNum = starItem.star;
                  const isPassiveStar = isMmo ? starNum === 5 : starNum === 4;
                  const starText = isRu
                    ? starItem.desc_ru || starItem.desc || starItem.description || starItem.desc_en || ""
                    : starItem.desc_en || starItem.desc || "";

                  return (
                    <div
                      key={starNum}
                      className={`${styles.starItem} ${isPassiveStar && passiveStat ? styles.starItemPassive : ""}`}
                    >
                      <span className={styles.starTag}>{starNum}★</span>
                      <div className={styles.starText}>
                        {isPassiveStar && passiveStat && (
                          <>
                            <RelicPassiveBadge
                              stat={passiveStat}
                              isRu={isRu}
                              isMmo={isMmo}
                              className={styles.relicPassiveBadge}
                            />{" "}
                          </>
                        )}
                        <RichTextDisplay text={starText} className="inline" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Modal.Body>
      </Modal>

      {/* High-Resolution Artwork Lightbox */}
      <InfoLightbox
        isOpen={Boolean(lightboxSrc)}
        onClose={closeLightbox}
        src={lightboxSrc || ""}
        webpSrc={lightboxWebpSrc || undefined}
        caption={lightboxCaption}
        alt={name}
        isRu={isRu}
      />
    </>
  );
};
