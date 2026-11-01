"use client";

import React, { useState } from "react";
import type { SimulacraDatasetItemRaw } from "@tof-hub/contracts";
import { translateUiText, type Locale } from "@tof-hub/i18n";
import type { SimulacraStrings } from "../types";
import { formatRichText } from "../utils/format-rich-text";
import type { SimulacraKeywordMatcher } from "../utils/keyword-links";
import styles from "../simulacra.module.css";

interface SimulacraAdvancementsSectionProps {
  character: SimulacraDatasetItemRaw;
  locale: Locale;
  strings: SimulacraStrings;
  keywordMatcher?: SimulacraKeywordMatcher | null;
}

/** MMO stat-only steps (Combat Strength / base growth); the Build MMO card hides them the same way. */
export function isFillerAdvancement(adv: any): boolean {
  const desc = String(
    adv.desc_en || adv.description_en || adv.desc_ru || adv.description || "",
  ).toLowerCase();
  return (
    desc.includes("base atk growth") ||
    desc.includes("base hp growth") ||
    desc.includes("base crit growth") ||
    desc.includes("combat strength") ||
    desc.includes("боевую мощь") ||
    desc.includes("рост базовой атк")
  );
}

export const SimulacraAdvancementsSection: React.FC<SimulacraAdvancementsSectionProps> = ({
  character,
  locale,
  strings,
  keywordMatcher,
}) => {
  const isRu = locale === "ru";
  const isMmo = character.server_mode === "mmo" || character.edition === "mmo";
  const rawAdvancements = Array.isArray(character.advancements)
    ? character.advancements
    : Array.isArray((character.weapon as any)?.advancements)
      ? (character.weapon as any).advancements
      : [];

  const hasFillers = isMmo && rawAdvancements.some(isFillerAdvancement);
  const [showAll, setShowAll] = useState(false);

  return (
    <details
      className={`${styles.simSection} ${styles.simAdvSection}`}
      id="sim-advancements-section"
      data-panel-anchor="sim-advancements-section"
      open
    >
      <summary className={styles.simSectionSummary}>
        <div className={styles.simSectionTitleLeft}>
          <span className={styles.simSectionTitle}>{strings.sectionAdvancements}</span>
        </div>

        <div className="flex items-center gap-3">
          {hasFillers && (
            <button
              type="button"
              className={`${styles.simAdvToggleBtn} ${showAll ? styles.isActive : ""}`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowAll(!showAll);
              }}
              aria-pressed={showAll}
            >
              <span>{showAll ? strings.hideFillerStars : strings.showAllStars}</span>
            </button>
          )}
          <span className={styles.simSectionArrow} aria-hidden="true">
            ▾
          </span>
        </div>
      </summary>

      <div className={styles.simSectionBody}>
        {rawAdvancements.length > 0 ? (
          <div className={styles.simAdvGrid}>
            {rawAdvancements.map((adv: any, idx: number) => {
              const star = adv.star ?? idx + 1;
              const rawName = isRu
                ? adv.name_ru || adv.name || adv.name_en
                : adv.name_en || adv.name;
              let advName = String(rawName || "")
                .replace(/\{[0-9]+\}/g, "—")
                .replace(/^\d+\s*[-–—]?\s*(?:★\s*|\*\s*)?/, "")
                .trim();
              if (!advName) {
                advName = strings.advFallbackName;
              } else if (!isRu && /^[A-Za-z][A-Za-z ]*$/.test(advName)) {
                // Generated English-only labels such as "Star Advancement" go through the phrase table.
                advName = translateUiText(advName, locale);
              }

              const rawDesc = isRu
                ? adv.desc_ru || adv.description_ru || adv.desc || adv.description || adv.desc_en
                : adv.desc_en || adv.description;
              const advDesc = rawDesc && rawDesc.trim() !== "" ? rawDesc : strings.noAdvDesc;

              const isFiller = isFillerAdvancement(adv);
              if (isMmo && isFiller && !showAll && rawAdvancements.length > 6) {
                return null;
              }

              return (
                <details
                  key={star}
                  className={`${styles.simAdvItem} ${isFiller ? styles.simAdvItemFiller : ""}`}
                  id={`advancement-${star}`}
                  data-panel-anchor={`advancement-${star}`}
                  open
                >
                  <summary className={styles.simAdvSummary}>
                    <div className={styles.simAdvHeader}>
                      <div className={styles.simAdvStar} title={`★${star}`}>
                        <span className={styles.simAdvStarIcon}>★</span>
                        <span className={styles.simAdvStarNum}>{star}</span>
                      </div>
                      <span className={styles.simAdvTitle}>{advName}</span>
                    </div>
                    <span className={styles.simAdvArrow} aria-hidden="true">
                      ▸
                    </span>
                  </summary>
                  <div className={styles.simAdvBody}>
                    <div
                      className={styles.simAdvDesc}
                      dangerouslySetInnerHTML={{ __html: formatRichText(advDesc, keywordMatcher) }}
                    />
                  </div>
                </details>
              );
            })}
          </div>
        ) : (
          <p className={styles.simEmptyNote}>{strings.noAdvDesc}</p>
        )}
      </div>
    </details>
  );
};

SimulacraAdvancementsSection.displayName = "SimulacraAdvancementsSection";
