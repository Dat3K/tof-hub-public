"use client";

import React from "react";
import type { SimulacraDatasetItemRaw } from "@tof-hub/contracts";
import type { Locale } from "@tof-hub/i18n";
import type { SimulacraStrings } from "../types";
import { formatRichText } from "../utils/format-rich-text";
import type { SimulacraKeywordMatcher } from "../utils/keyword-links";
import styles from "../simulacra.module.css";

interface SimulacraTraitsSectionProps {
  character: SimulacraDatasetItemRaw;
  locale: Locale;
  strings: SimulacraStrings;
  keywordMatcher?: SimulacraKeywordMatcher | null;
}

export const SimulacraTraitsSection: React.FC<SimulacraTraitsSectionProps> = ({
  character,
  locale,
  strings,
  keywordMatcher,
}) => {
  const isRu = locale === "ru";
  const traits = Array.isArray(character.traits) ? character.traits : [];

  return (
    <details
      className={`${styles.simSection} ${styles.simTraitsSection}`}
      id="sim-traits-section"
      data-panel-anchor="sim-traits-section"
      open
    >
      <summary className={styles.simSectionSummary}>
        <div className={styles.simSectionTitleLeft}>
          <span className={styles.simSectionTitle}>{strings.sectionTraits}</span>
        </div>
        <span className={styles.simSectionArrow} aria-hidden="true">
          ▾
        </span>
      </summary>

      <div className={styles.simSectionBody}>
        {traits.length > 0 ? (
          <div className={styles.simTraitsGrid}>
            {traits.map((trait: any, idx: number) => {
              const affinity = trait.affinity ?? (idx === 0 ? 1200 : 4000);
              const rawName = isRu
                ? trait.name_ru || trait.name || trait.name_en
                : trait.name_en || trait.name;
              const name = String(rawName || "—").replace(/\{[0-9]+\}/g, "—");
              const rawDesc = isRu
                ? trait.desc_ru || trait.description_ru || trait.desc || trait.description || trait.desc_en
                : trait.desc_en || trait.description;
              const desc = rawDesc && rawDesc.trim() !== "" ? rawDesc : strings.noTraitDesc;

              return (
                <div
                  key={affinity}
                  className={styles.simTraitCard}
                  id={`trait-${affinity}`}
                  data-panel-anchor={`trait-${affinity}`}
                  role="link"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      window.history.replaceState(
                        null,
                        "",
                        `${window.location.pathname}${window.location.search}#trait-${affinity}`,
                      );
                    }
                  }}
                >
                  <div className={styles.simTraitCardTop}>
                    <span className={styles.simTraitName}>{name}</span>
                    <span className={styles.simTraitAffinity}>
                      <span className={styles.simAffinityHeart} aria-hidden="true">
                        ♥
                      </span>{" "}
                      {affinity} {strings.pointsAffinity}
                    </span>
                  </div>
                  <div
                    className={styles.simTraitDesc}
                    dangerouslySetInnerHTML={{ __html: formatRichText(desc, keywordMatcher) }}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <p className={styles.simEmptyNote}>{strings.noTraitDesc}</p>
        )}
      </div>
    </details>
  );
};

SimulacraTraitsSection.displayName = "SimulacraTraitsSection";
