"use client";

import React, { useState } from "react";
import { fillText, localeText } from '@/lib/i18n/text';
import {MatrixSetBadge} from '@tof-hub/ui';
import type { SimulacraDatasetItemRaw } from "@tof-hub/contracts";
import { gameAsset } from "@tof-hub/game-assets";
import type { Locale } from "@tof-hub/i18n";
import type { SimulacraStrings } from "../types";
import { MATRIX_SLOTS_DEF } from "../constants";
import { formatMatrixEffectHtml } from "../utils/format-rich-text";
import type { SimulacraKeywordMatcher } from "../utils/keyword-links";
import styles from "../simulacra.module.css";

interface SimulacraMatrixSectionProps {
  character: SimulacraDatasetItemRaw;
  locale: Locale;
  strings: SimulacraStrings;
  onOpenLightbox: (src: string, caption?: string, webpSrc?: string) => void;
  keywordMatcher?: SimulacraKeywordMatcher | null;
}

export const SimulacraMatrixSection: React.FC<SimulacraMatrixSectionProps> = ({
  character,
  locale,
  strings,
  onOpenLightbox,
  keywordMatcher,
}) => {
  const isRu = locale === "ru";
  const matrixObj = (character.matrix || {}) as any;
  const suitId = character.matrix_suit_id || matrixObj.suit_id;
  const matrixName = isRu
    ? matrixObj.suit_name_ru || matrixObj.name_ru || matrixObj.suit_name_en || matrixObj.name_en
    : matrixObj.suit_name_en || matrixObj.name_en;

  const [activeStars, setActiveStars] = useState<{ set2: number; set4: number }>({
    set2: 3,
    set4: 3,
  });

  if (!suitId && !character.has_matrices && !matrixObj.pieces && !matrixObj.set2) {
    return null;
  }

  // Backdrop and Chip visuals
  const chipVisualPath = matrixObj.chip_icon || matrixObj.icon || null;
  const chipVisualSrc = chipVisualPath ? gameAsset(chipVisualPath, "webp") : null;
  const chipVisualPngSrc = chipVisualPath ? gameAsset(chipVisualPath, "png") : null;

  const matrixMedia = (character.media as any)?.matrix_icon;
  const suitBackdropSrc =
    matrixMedia?.fullUrl || matrixMedia?.thumbUrl || matrixObj.suit_portrait
      ? gameAsset(matrixMedia?.fullUrl || matrixMedia?.thumbUrl || matrixObj.suit_portrait)
      : character.portrait
        ? gameAsset(character.portrait)
        : null;

  const pieces = Array.isArray(matrixObj.pieces) ? matrixObj.pieces : [];

  return (
    <details
      className={`${styles.simSection} ${styles.simMatrixSection}`}
      id="sim-matrix-section"
      data-panel-anchor="sim-matrix-section"
      open
    >
      <summary className={styles.simSectionSummary}>
        <div className={styles.simSectionTitleLeft}>
          <span className={styles.simSectionTitle}>
            {strings.sectionMatrix}
            {matrixName ? ` — ${matrixName}` : ""}
          </span>
        </div>
        <span className={styles.simSectionArrow} aria-hidden="true">
          ▾
        </span>
      </summary>

      <div className={styles.simSectionBody}>
        <div
          className={styles.simMatrixChipBox}
          id="matrix-set"
          data-panel-anchor="matrix-set"
        >
          {/* Chip Stage */}
          <div
            className={styles.simMatrixChipStage}
            tabIndex={0}
            role="button"
            aria-label={`${matrixName || strings.matrixSet} (${strings.lightboxZoomIn})`}
            onClick={() => {
              if (chipVisualSrc) {
                onOpenLightbox(
                  chipVisualPngSrc || chipVisualSrc,
                  matrixName || strings.matrixSet,
                  chipVisualSrc,
                );
              }
            }}
          >
            {suitBackdropSrc && (
              <div className={styles.simMatrixSuitBackdrop} aria-hidden="true">
                <img
                  src={suitBackdropSrc}
                  alt=""
                  className={styles.simMatrixSuitBackdropImg}
                  loading="lazy"
                />
              </div>
            )}

            <div className={styles.simMatrixChipFrame}>
              {chipVisualSrc ? (
                <img
                  className={styles.simMatrixChipImg}
                  src={chipVisualSrc}
                  alt={matrixName || strings.matrixSet}
                  loading="lazy"
                />
              ) : (
                <div className={styles.simMatrixChipFallback}>⬡</div>
              )}
            </div>
          </div>

          {/* 4 Corner Slots */}
          <div className={styles.simMatrixCornerSlots} aria-label={strings.matrixSlotsLabel}>
            {MATRIX_SLOTS_DEF.map((cfg) => {
              const piece = pieces.find((p: any) => p.slot === cfg.num) || null;
              const slotLabel = isRu
                ? piece?.slot_name_ru || cfg.name_ru
                : piece?.slot_name_en || cfg.name_en;
              const pName = piece
                ? isRu
                  ? piece.name_ru || piece.name_en
                  : piece.name_en
                : `${matrixName || "Matrix"}: ${slotLabel}`;
              const pDesc = piece
                ? isRu
                  ? piece.description_ru || piece.desc_ru || piece.description_en || piece.desc_en
                  : piece.description_en || piece.desc_en
                : "";

              const slotIcon = gameAsset(cfg.icon || '');

              return (
                <div
                  key={cfg.num}
                  className={`${styles.simMatrixCornerSlot} ${styles[`simMatrixCornerSlot${cfg.num}`]}`}
                  tabIndex={0}
                  role="group"
                  aria-label={`${slotLabel}: ${pName}`}
                >
                  <img
                    src={slotIcon}
                    alt={slotLabel}
                    className={styles.simMatrixCornerSlotIcon}
                    loading="lazy"
                  />
                  <div className={styles.matrixSlotTooltip} role="tooltip">
                    <div className={styles.matrixSlotTooltipHeader}>
                      <span className={styles.matrixSlotTooltipTag}>{slotLabel}</span>
                      <strong className={styles.matrixSlotTooltipName}>{pName}</strong>
                    </div>
                    {pDesc && <div className={styles.matrixSlotTooltipDesc}>{pDesc}</div>}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Chip Footer */}
          <div className={styles.simMatrixChipFooter}>
            <div className={styles.simMatrixChipName}>{matrixName || strings.matrixSet}</div>
            <div className={styles.simMatrixChipType}>{strings.matrixSet}</div>
          </div>
        </div>

        {/* 2-Piece & 4-Piece Set Effect Cards */}
        <div className={styles.simMatrixCards}>
          {(["set2", "set4"] as const).map((pieceKey) => {
            const piece = matrixObj[pieceKey];
            if (!piece) return null;

            const pieceTitle = pieceKey === "set2" ? strings.pieceSet2 : strings.pieceSet4;
            const activeStar = activeStars[pieceKey];

            // Resolve effect description for activeStar
            let starDesc = "";
            if (Array.isArray(piece.stars)) {
              const starObj =
                piece.stars.find((s: any) => s.star === activeStar) ||
                piece.stars[3] ||
                piece.stars[0];
              starDesc = isRu
                ? starObj?.html_ru ||
                  starObj?.html_en ||
                  starObj?.desc_ru ||
                  starObj?.description_ru ||
                  starObj?.desc_en ||
                  starObj?.description
                : starObj?.html_en || starObj?.desc_en || starObj?.description;
            } else {
              starDesc = isRu
                ? piece.desc_ru || piece.description_ru || piece.desc_en || piece.description
                : piece.desc_en || piece.description;
            }

            return (
              <div
                key={pieceKey}
                className={styles.simMatrixCard}
                id={`matrix-${pieceKey}`}
                data-panel-anchor={`matrix-${pieceKey}`}
              >
                <div className={styles.simMatrixCardHeader}>
                  <MatrixSetBadge className={styles.simMatrixCardBadge}>{pieceTitle}</MatrixSetBadge>

                  <div
                    className={styles.simMatrixStarSelector}
                    role="group"
                    aria-label={fillText(localeText(locale)('{0} star tier'), [pieceTitle])}
                  >
                    {[0, 1, 2, 3].map((st) => (
                      <button
                        key={st}
                        type="button"
                        className={`${styles.simMatrixStarBtn} ${
                          activeStar === st ? styles.simMatrixStarBtnActive : ""
                        }`}
                        onClick={() => setActiveStars((prev) => ({ ...prev, [pieceKey]: st }))}
                      >
                        ★{st}
                      </button>
                    ))}
                  </div>
                </div>

                <div
                  className={styles.simMatrixCardDesc}
                  dangerouslySetInnerHTML={{
                    __html: formatMatrixEffectHtml(starDesc, activeStar, keywordMatcher),
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>
    </details>
  );
};

SimulacraMatrixSection.displayName = "SimulacraMatrixSection";
