"use client";

import React from "react";
import type { SimulacraDatasetItemRaw } from "@tof-hub/contracts";
import { gameAsset } from "@tof-hub/game-assets";
import type { Locale } from "@tof-hub/i18n";
import type { SimulacraStrings } from "../types";
import { getCleanPassives } from "../utils/skill-scaling";
import { formatRichText } from "../utils/format-rich-text";
import type { SimulacraKeywordMatcher } from "../utils/keyword-links";
import styles from "../simulacra.module.css";

interface SimulacraPassivesSectionProps {
  character: SimulacraDatasetItemRaw;
  locale: Locale;
  strings: SimulacraStrings;
  keywordMatcher?: SimulacraKeywordMatcher | null;
}

export const SimulacraPassivesSection: React.FC<SimulacraPassivesSectionProps> = ({
  character,
  locale,
  strings,
  keywordMatcher,
}) => {
  const isRu = locale === "ru";
  const passives = getCleanPassives(character, locale);

  return (
    <details
      className={`${styles.simSection} ${styles.simPassivesSection}`}
      id="sim-passives-section"
      data-panel-anchor="sim-passives-section"
      open
    >
      <summary className={styles.simSectionSummary}>
        <div className={styles.simSectionTitleLeft}>
          <span className={styles.simSectionTitle}>{strings.passivesTitle}</span>
        </div>
        <span className={styles.simSectionArrow} aria-hidden="true">
          ▾
        </span>
      </summary>

      <div className={styles.simSectionBody}>
        {passives.length > 0 ? (
          <div className={styles.simPassivesList}>
            {passives.map((p: any, idx: number) => {
              const rawName = isRu ? p.name_ru || p.name_en || p.name : p.name_en || p.name;
              const name = String(rawName || "—").replace(/\{[0-9]+\}/g, "—");
              const rawDesc = isRu
                ? p.desc_display_ru || p.desc_ru || p.desc_display_en || p.desc_en || p.description
                : p.desc_display_en || p.desc_en || p.description;
              const desc = rawDesc && rawDesc.trim() !== "" ? rawDesc : "";

              const iconRaw = p.icon_thumb || p.icon;
              const iconSrc = typeof iconRaw === "string" ? gameAsset(iconRaw) : null;

              return (
                <details
                  key={p.id || idx}
                  className={styles.simPassiveItem}
                  id={`passive-${p.id || idx}`}
                  data-panel-anchor={`passive-${p.id || idx}`}
                >
                  <summary className={styles.simPassiveSummary}>
                    <div className={styles.simPassiveTitle}>
                      <span className={styles.simPassiveIndicator}>▸</span>
                      {iconSrc ? (
                        <img
                          className={styles.simPassiveIcon}
                          src={iconSrc}
                          alt=""
                          loading="lazy"
                          onError={(e) => {
                            (e.currentTarget as HTMLElement).style.display = "none";
                          }}
                        />
                      ) : (
                        <span className={styles.simPassiveIconBlank} aria-hidden="true" />
                      )}
                      <span className={styles.simPassiveName}>{name}</span>
                    </div>
                  </summary>

                  <div className={styles.simPassiveBody}>
                    <div
                      className={styles.simPassiveDesc}
                      dangerouslySetInnerHTML={{ __html: formatRichText(desc, keywordMatcher) }}
                    />
                  </div>
                </details>
              );
            })}
          </div>
        ) : (
          <p className={styles.simEmptyNote}>{strings.noPassives}</p>
        )}
      </div>
    </details>
  );
};

SimulacraPassivesSection.displayName = "SimulacraPassivesSection";
