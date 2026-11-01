"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Modal, GameBadge as Badge } from "@tof-hub/ui";
import { gameAsset, gameAssetPng, gameAssetWebp } from "@tof-hub/game-assets";
import { getElementLabel, getRoleLabel, normalizeElement, normalizeRole } from "@tof-hub/game-domain";
import {
  MATRIX_SLOT_CONFIGS,
  CANONICAL_CHAR_ID_MAP,
  ELEMENT_FILTER_OPTIONS,
  getDualElementIconPath,
  ROLE_FILTER_OPTIONS,
} from "./constants";
import { RichTextDisplay } from "../common/format-rich-text";
import { InfoLightbox } from "../common/info-lightbox";
import type { MatrixDetailModalProps } from "./types";
import styles from "./matrices.module.css";

export const MatrixDetailModal: React.FC<MatrixDetailModalProps> = ({
  isOpen,
  onClose,
  matrix,
  locale,
  strings,
}) => {
  const [selectedStar, setSelectedStar] = useState<number>(3);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  if (!matrix) return null;

  const isRu = locale === "ru";
  const name = isRu
    ? matrix.name_ru || matrix.name || matrix.name_en || matrix.id
    : matrix.name_en || matrix.name || matrix.id;
  const rawQuality = (matrix.quality || "SSR").toUpperCase();
  const quality = (
    rawQuality === "SR" ? "sr" : rawQuality === "R" ? "r" : rawQuality === "N" ? "n" : "ssr"
  ) as "ssr" | "sr" | "r" | "n";

  // Art paths
  const chipIconPath = matrix.icon || matrix.piece_icon || matrix.icon_thumb;
  const chipIconUrl = chipIconPath ? gameAssetWebp(chipIconPath) : "";
  const chipIconPngUrl = chipIconPath ? gameAssetPng(chipIconPath) : "";
  const suitPortraitPath = matrix.suit_portrait || matrix.suit_portrait_thumb;
  const suitPortraitUrl = suitPortraitPath ? gameAsset(suitPortraitPath) : "";

  // Carrier info
  const carrier0 = matrix.carriers && matrix.carriers.length > 0 ? matrix.carriers[0] : null;
  const weaponName = carrier0
    ? isRu
      ? carrier0.weapon_name_ru || carrier0.weapon_name || carrier0.weapon_name_en || ""
      : carrier0.weapon_name_en || carrier0.weapon_name || ""
    : "";

  const charName = carrier0
    ? isRu
      ? carrier0.char_name_ru || carrier0.name_ru || carrier0.char_name_en || carrier0.name_en || ""
      : carrier0.char_name_en || carrier0.name_en || ""
    : "";

  const carrierWeaponIconUrl =
    carrier0?.icon || carrier0?.icon_thumb
      ? gameAsset(carrier0.icon || carrier0.icon_thumb!)
      : chipIconUrl || null;

  // Resolve carrier character slug for linking to simulacra
  const rawCharId = (carrier0?.char_id || carrier0?.id || "").toLowerCase();
  const rawWeaponId = (carrier0?.weapon_id || "").toLowerCase();
  const charSlug =
    CANONICAL_CHAR_ID_MAP[rawCharId] ||
    CANONICAL_CHAR_ID_MAP[rawWeaponId] ||
    CANONICAL_CHAR_ID_MAP[matrix.id.toLowerCase()] ||
    rawCharId ||
    null;

  // Element and Role
  const elementStr = carrier0?.element || "";
  const elementNorm = elementStr ? normalizeElement(elementStr).toLowerCase() : "";
  const elementVariant = (elementNorm === "physical" ? "phys" : elementNorm) as
    "phys" | "flame" | "frost" | "volt" | "altered" | undefined;
  const elementLabel = [carrier0?.element, carrier0?.element_secondary].filter((value): value is string => Boolean(value)).map(value => getElementLabel(value, locale)).join(" / ");

  const secondaryLabel = carrier0?.element_secondary || elementStr.split(/\s*\/\s*/)[1];
  const secondaryElement = secondaryLabel
    ? (normalizeElement(secondaryLabel).toLowerCase() as typeof elementVariant)
    : undefined;

  const roleStr = carrier0?.role || "";
  const roleNorm = roleStr ? normalizeRole(roleStr).toLowerCase() : "";
  const roleVariant = (
    roleNorm === "benediction" || roleNorm === "tank"
      ? roleNorm
      : roleNorm === "dps"
        ? "dps"
        : undefined
  ) as "dps" | "tank" | "benediction" | undefined;

  const dualElementIconPath = getDualElementIconPath(elementStr, secondaryLabel);
  const elementIcon =
    dualElementIconPath ||
    carrier0?.element_combo_icon ||
    ELEMENT_FILTER_OPTIONS.find((option) => option.id === elementNorm)?.iconPath;
  const roleIcon =
    carrier0?.role_icon || ROLE_FILTER_OPTIONS.find((option) => option.id === roleNorm)?.iconPath;

  return (
    <>
      <Modal
        // The image preview is a full-screen lightbox. Hide the matrix modal
        // while it is open so the preview is never rendered as a modal-on-modal.
        isOpen={isOpen && !isLightboxOpen}
        onClose={onClose}
        size="xl"
        ariaLabel={name}
        className={styles.matrixModal}
        overlayClassName={styles.matrixModalOverlay}
      >
        <Modal.Header className={styles.modalHeaderContainer}>
          <div className={styles.modalHeader}>
            {/* Top Showcase with Suit Backdrop, Chip, and 4 Slot Badges */}
            <div className={styles.artShowcase}>
              {suitPortraitUrl && (
                <div className={styles.suitBackdrop} aria-hidden="true">
                  <img src={suitPortraitUrl} alt="" />
                </div>
              )}

              {/* Central Hero Chip Image (Clickable for Lightbox) */}
              <div
                className={styles.heroChipStage}
                role="button"
                tabIndex={0}
                onClick={() => setIsLightboxOpen(true)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setIsLightboxOpen(true);
                  }
                }}
                title={strings.clickToZoom}
                aria-label={`${strings.clickToZoom}: ${name}`}
              >
                {chipIconUrl && <img src={chipIconUrl} alt={name} className={styles.heroChipImg} />}
              </div>

              {/* 4 Slot Badges around the chip */}
              <div className={styles.slotsAround} aria-label={strings.matrixPieces}>
                {/* Legacy order: Slot 2 (Memory) above Slot 1 (Mind). */}
                <div className={styles.slotsGroup}>
                  {MATRIX_SLOT_CONFIGS.slice(0, 2).reverse().map((cfg) => {
                    const piece = matrix.pieces?.find((p) => Number(p.slot) === cfg.slot);
                    const slotLabel = strings[cfg.labelKey];
                    const pName = piece
                      ? isRu
                        ? piece.name_ru || piece.name_en || piece.name || `${name}: ${slotLabel}`
                        : piece.name_en || piece.name || `${name}: ${slotLabel}`
                      : `${name}: ${slotLabel}`;
                    const description = piece
                      ? isRu
                        ? piece.description_ru || piece.description_en || piece.description
                        : piece.description_en || piece.description_ru || piece.description
                      : undefined;
                    const tooltipId = `matrix-slot-tooltip-${cfg.slot}`;

                    return (
                      <div className={styles.slotBadgeWrap} data-slot={cfg.slot} key={cfg.slot}>
                        <button
                        type="button"
                        className={styles.slotBadge}
                        aria-describedby={tooltipId}
                        title={`${slotLabel} — ${pName}`}
                        aria-label={`${slotLabel} — ${pName}`}
                      >
                        <img src={gameAsset(cfg.iconPath)} alt="" className={styles.slotBadgeImg} />
                        <span className={styles.slotNumberTag} aria-hidden="true">
                          {cfg.slot}
                        </span>
                      </button>
                      <div id={tooltipId} role="tooltip" className={styles.slotTooltip}>
                        <div className={styles.slotTooltipHeader}>
                          <span className={styles.slotTooltipTag}>{slotLabel}</span>
                          <strong className={styles.slotTooltipName}>{pName}</strong>
                        </div>
                        {description && <div className={styles.slotTooltipDesc}>{description}</div>}
                      </div>
                    </div>
                    );
                  })}
                </div>

                {/* Right group: Slot 3 (Belief) & Slot 4 (Emotion) */}
                <div className={styles.slotsGroup}>
                  {MATRIX_SLOT_CONFIGS.slice(2, 4).map((cfg) => {
                    const piece = matrix.pieces?.find((p) => Number(p.slot) === cfg.slot);
                    const slotLabel = strings[cfg.labelKey];
                    const pName = piece
                      ? isRu
                        ? piece.name_ru || piece.name_en || piece.name || `${name}: ${slotLabel}`
                        : piece.name_en || piece.name || `${name}: ${slotLabel}`
                      : `${name}: ${slotLabel}`;
                    const description = piece
                      ? isRu
                        ? piece.description_ru || piece.description_en || piece.description
                        : piece.description_en || piece.description_ru || piece.description
                      : undefined;
                    const tooltipId = `matrix-slot-tooltip-${cfg.slot}`;

                    return (
                      <div className={styles.slotBadgeWrap} data-slot={cfg.slot} key={cfg.slot}>
                        <button
                        type="button"
                        className={styles.slotBadge}
                        aria-describedby={tooltipId}
                        title={`${slotLabel} — ${pName}`}
                        aria-label={`${slotLabel} — ${pName}`}
                      >
                        <img src={gameAsset(cfg.iconPath)} alt="" className={styles.slotBadgeImg} />
                        <span className={styles.slotNumberTag} aria-hidden="true">
                          {cfg.slot}
                        </span>
                      </button>
                      <div id={tooltipId} role="tooltip" className={styles.slotTooltip}>
                        <div className={styles.slotTooltipHeader}>
                          <span className={styles.slotTooltipTag}>{slotLabel}</span>
                          <strong className={styles.slotTooltipName}>{pName}</strong>
                        </div>
                        {description && <div className={styles.slotTooltipDesc}>{description}</div>}
                      </div>
                    </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Badges & Titles */}
            <div className={styles.titleBlock}>
              <div className={styles.badgesRow}>
                <Badge
                  variant={quality}
                  size="sm"
                  className="font-extrabold uppercase tracking-wider"
                >
                  {rawQuality}
                </Badge>
                {elementVariant && (
                  <Badge
                    icon={elementIcon ? <img src={gameAsset(elementIcon)} alt="" /> : undefined}
                    variant={elementVariant}
                    secondaryElement={secondaryElement}
                    size="sm"
                  >
                    {elementLabel}
                  </Badge>
                )}
                {roleVariant && (
                  <Badge
                    icon={roleIcon ? <img src={gameAsset(roleIcon)} alt="" /> : undefined}
                    variant={roleVariant}
                    size="sm"
                  >
                    {carrier0?.role ? getRoleLabel(carrier0.role, locale) : null}
                  </Badge>
                )}
                <span className={styles.matrixId}>{matrix.id}</span>
              </div>

              <Modal.Title className={styles.matrixTitle}>{name}</Modal.Title>
              {carrier0 && (weaponName || charName) && (
                <span className={styles.matrixOwner}>{weaponName || charName}</span>
              )}
            </div>
          </div>
        </Modal.Header>

        <Modal.Body className={styles.modalBody}>
          {/* Star Rank Selector (★0 .. ★3) */}
          <div className={styles.starRankBar} role="tablist" aria-label={strings.starRank}>
            <span className={styles.starRankLabel}>{strings.starRank}</span>
            <div className={styles.starTabs}>
              {[0, 1, 2, 3].map((star) => {
                const isActive = selectedStar === star;
                return (
                  <button
                    key={star}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    className={`${styles.starTab} ${isActive ? styles.starTabActive : ""}`}
                    onClick={() => setSelectedStar(star)}
                  >
                    ★{star}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Set Effects on Top */}
          <div className={styles.effectList}>
            {matrix.effects && matrix.effects.length > 0 ? (
              matrix.effects.map((effect, idx) => {
                // The legacy contract renders the ordered 2-piece and 4-piece
                // effects. Keep the fallback deterministic when older payloads
                // incorrectly repeat the first count on the second effect.
                const pieceCount = idx === 0 ? 2 : effect.piece_count === 2 ? 4 : effect.piece_count || effect.count || 4;
                const effectTitle = strings.pieceSet.replace("{count}", String(pieceCount));

                // Find effect text for current selected star
                let effectText = isRu
                  ? effect.desc_ru || effect.text_ru || effect.desc || effect.name_ru || ""
                  : effect.desc_en || effect.text_en || effect.desc || effect.name_en || "";

                if (Array.isArray(effect.stars) && effect.stars.length > 0) {
                  const starObj =
                    effect.stars.find((s) => s.star === selectedStar) ||
                    effect.stars[effect.stars.length - 1];
                  if (starObj) {
                    effectText = isRu
                      ? starObj.text_ru || starObj.html_ru || starObj.text || effectText
                      : starObj.text_en || starObj.html_en || starObj.text || effectText;
                  }
                }

                return (
                  <div key={idx} className={styles.effectCard}>
                    <div className={styles.effectHeader}>
                      <h4 className={styles.effectTitle}>
                        <span>✦</span> {effectTitle}
                      </h4>
                    </div>
                    <RichTextDisplay
                      links={
                        charSlug
                          ? [weaponName, charName]
                              .filter(Boolean)
                              .map((label) => ({
                                label,
                                href: `/info/simulacra/?server=gacha&char=${encodeURIComponent(charSlug)}`,
                              }))
                          : []
                      }
                      rank={selectedStar}
                      text={effectText}
                      className={styles.effectText}
                    />
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-[#9ca3af] italic py-2">{strings.noMatches}</p>
            )}
          </div>

          {/* Carrier Information */}
          <div className={styles.carrierBlock}>
            <div className={styles.carrierKicker}>
              <span>✦</span> {strings.setCarrierOwner}
            </div>
            {carrier0 ? (
              <div className={styles.carrierMain}>
                {carrierWeaponIconUrl && (
                  <div className={styles.carrierWeaponFrame}>
                    <img
                      src={carrierWeaponIconUrl}
                      alt={weaponName || charName}
                      className={styles.carrierWeaponImg}
                    />
                  </div>
                )}
                <div className={styles.carrierInfo}>
                  <div className={styles.carrierTitleRow}>
                    <h5 className={styles.carrierTitle}>{charName || weaponName}</h5>
                    {charName && weaponName && weaponName !== charName && (
                      <span className={styles.carrierWeaponName}>({weaponName})</span>
                    )}
                    {charSlug && (
                      <Link
                        href={`/info/simulacra?char=${encodeURIComponent(charSlug)}`}
                        className={styles.carrierLink}
                      >
                        <span>{charName ? `${charName} →` : strings.simulacrumLink}</span>
                      </Link>
                    )}
                  </div>
                  <div className={styles.carrierBadges}>
                    {elementVariant && (
                      <Badge
                        icon={elementIcon ? <img src={gameAsset(elementIcon)} alt="" /> : undefined}
                        variant={elementVariant}
                        secondaryElement={secondaryElement}
                        size="sm"
                      >
                        {elementLabel}
                      </Badge>
                    )}
                    {roleVariant && (
                      <Badge
                        icon={roleIcon ? <img src={gameAsset(roleIcon)} alt="" /> : undefined}
                        variant={roleVariant}
                        size="sm"
                      >
                        {getRoleLabel(carrier0.role, locale)}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-[#9ca3af] italic">{strings.noPlayableCarrier}</p>
            )}
          </div>
        </Modal.Body>
      </Modal>

      {/* High-Resolution Artwork Lightbox */}
      <InfoLightbox
        isOpen={isOpen && isLightboxOpen}
        onClose={() => setIsLightboxOpen(false)}
        src={chipIconPngUrl}
        webpSrc={chipIconUrl}
        caption={`${name} — ${strings.matrixPieces}`}
        alt={name}
        isRu={isRu}
      />
    </>
  );
};
