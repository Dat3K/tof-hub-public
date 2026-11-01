"use client";

import { translateUiText } from '@tof-hub/i18n';
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SimulacraDatasetItemRaw } from "@tof-hub/contracts";
import { gameAsset } from "@tof-hub/game-assets";
import type { Locale } from "@tof-hub/i18n";
import type { SimulacraStrings, SimulacraSkillCategory } from "../types";
import {
  getCleanSkills,
  getSkillDescriptionForLevel,
  charLevelToSkillParamLevel,
} from "../utils/skill-scaling";
import { resolveSkillIconUrl } from "../utils/character-assets";
import { formatRichText } from "../utils/format-rich-text";
import { localizeComboStep, type ComboWordLabels } from "../utils/labels";
import type { SimulacraKeywordMatcher } from "../utils/keyword-links";
import styles from "../simulacra.module.css";

interface SimulacraSkillsSectionProps {
  character: SimulacraDatasetItemRaw;
  locale: Locale;
  strings: SimulacraStrings;
  onOpenLightbox: (src: string, caption?: string) => void;
  isMmo: boolean;
  level: number;
  onLevelChange: (level: number) => void;
  keywordMatcher?: SimulacraKeywordMatcher | null;
}

function deriveSkillCombo(skill: any): string[] {
  if (!skill) return [];
  if (Array.isArray(skill.combo)) return skill.combo.filter(Boolean).map(String);
  if (typeof skill.combo === "string" && skill.combo.trim()) {
    return skill.combo.split(/\s*(?:->|→|>)\s*/).filter(Boolean);
  }

  const category = String(skill.category || "").toLowerCase();
  const description = String(skill.desc_en || skill.description || "").trim();
  const name = String(skill.name_en || skill.name || "").toLowerCase();
  const id = String(skill.id || skill.action_id || "").toLowerCase();
  if (category !== "normal" && category !== "dodge") return [];

  const wordNumbers: Record<string, number> = {
    first: 1,
    second: 2,
    third: 3,
    fourth: 4,
    fifth: 5,
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
  };
  const countFrom = (value: string) => parseInt(value, 10) || wordNumbers[value.toLowerCase()] || 3;

  const branchMatch =
    description.match(
      /after the (\d+)(?:st|nd|rd|th)?(?: to \d+(?:st|nd|rd|th)?)? normal attack[,\s]+(?:tap and )?hold (?:normal attack|the attack button)/i,
    ) || description.match(/after (?:the )?(\w+)[-\s]stage normal attack[,\s]+(?:tap and )?hold/i);
  if (branchMatch) {
    return [...Array(Math.min(countFrom(branchMatch[1]), 5)).fill("Attack"), "Hold Attack"];
  }

  if (/while airborne|in mid-air|in the air/i.test(description) || id.includes("airattack")) {
    const isHold =
      /hold (?:normal attack|the attack button)/i.test(description) || name.includes("hold");
    if (isHold) return ["Jump", "Hold Attack"];
    const match =
      description.match(/(?:unleash|launch|perform|deal)\s+(\w+|\d+)\s+consecutive/i) ||
      description.match(/attack up to (\w+|\d+) times/i);
    return ["Jump", ...Array(Math.min(match ? countFrom(match[1]) : 3, 5)).fill("Attack")];
  }

  if (
    /hold (?:normal attack|the attack button)/i.test(description) ||
    id.includes("branch") ||
    id.includes("charge")
  ) {
    return ["Hold Attack"];
  }

  if (category === "dodge" || id.includes("evade") || id.includes("dodge")) {
    if (/dodge backward/i.test(description) || id.includes("backattack"))
      return ["Dodge Back", "Attack"];
    if (/dodge forward/i.test(description) || id.includes("forwardattack"))
      return ["Dodge Forward", "Attack"];
    return ["Dodge", "Attack"];
  }

  const match =
    description.match(/(?:launch|perform|unleash|deal)\s+(?:up to\s+)?(\w+|\d+)\s+consecutive/i) ||
    description.match(/attack (\w+|\d+) times in a row/i) ||
    description.match(/(\w+|\d+)[-\s]stage attack/i);
  if (match) return Array(Math.min(countFrom(match[1]), 6)).fill("Attack");
  return category === "normal" ? ["Attack"] : [];
}

// In-game combo key art (equiptips/Skill); the hold/dodge-hold plates are localized textures.
const COMBO_SPRITES = {
  holdEn: "Hotta/Content/L10N/en/Resources/UI/equiptips/Skill/jinengzhaoshu_zhaoshu_changan_L10N",
  holdRu: "Hotta/Content/L10N/ru/Resources/UI/equiptips/Skill/jinengzhaoshu_zhaoshu_changan_L10N",
  dodgeEn: "Hotta/Content/L10N/en/Resources/UI/equiptips/Skill/jinengzhaoshu_zhaoshu_shanbichangan",
  dodgeRu: "Hotta/Content/L10N/ru/Resources/UI/equiptips/Skill/jinengzhaoshu_zhaoshu_shanbichangan",
  jump: "Hotta/Content/Resources/UI/equiptips/Skill/jinengzhaoshu_zhaoshu_tiaoyue",
  attack: "Hotta/Content/Resources/UI/equiptips/Skill/jinengzhaoshu_zhaoshu_gongji",
} as const;

function getComboSpriteInfo(step: string, locale: Locale, words: ComboWordLabels) {
  const value = step.toLowerCase();
  const isRu = locale === "ru";

  if (value.includes("hold")) {
    return {
      webp: gameAsset(isRu ? COMBO_SPRITES.holdRu : COMBO_SPRITES.holdEn),
      label: words.comboWordHold,
      width: 46,
      height: 20,
    };
  }
  if (value.includes("jump") || value.includes("air")) {
    return {
      webp: gameAsset(COMBO_SPRITES.jump),
      label: words.comboWordJump,
      width: 20,
      height: 20,
    };
  }
  if (value.includes("dodge")) {
    return {
      webp: gameAsset(isRu ? COMBO_SPRITES.dodgeRu : COMBO_SPRITES.dodgeEn),
      label: words.comboWordDodge,
      width: 46,
      height: 20,
    };
  }
  return {
    webp: gameAsset(COMBO_SPRITES.attack),
    label: words.comboWordAttack,
    width: 20,
    height: 20,
  };
}

export const SimulacraSkillsSection: React.FC<SimulacraSkillsSectionProps> = ({
  character,
  locale,
  strings,
  onOpenLightbox,
  isMmo,
  level,
  onLevelChange,
  keywordMatcher,
}) => {
  const isRu = locale === "ru";
  const allSkills = useMemo(() => getCleanSkills(character), [character]);

  const categoryOrder: SimulacraSkillCategory[] = [
    "normal",
    "dodge",
    "skill",
    "discharge",
    "other",
  ];

  // Active categories present in character skills
  const activeCategories = useMemo(() => {
    return categoryOrder.filter((cat) =>
      allSkills.some((s) => (s.category || "").toLowerCase() === cat.toLowerCase()),
    );
  }, [allSkills]);

  const [selectedCat, setSelectedCat] = useState<string>(() => {
    return activeCategories.length > 0 ? activeCategories[0] : "normal";
  });

  // Filter skills by selected category
  const filteredSkills = useMemo(() => {
    return allSkills.filter((s) => (s.category || "").toLowerCase() === selectedCat.toLowerCase());
  }, [allSkills, selectedCat]);

  // Check if character has combo guide
  const comboGuide = (character as any).combo_guide || null;
  const comboGuideSrc = comboGuide
    ? gameAsset(comboGuide.url || comboGuide.webpUrl || comboGuide.pngUrl)
    : null;

  const paramLevel = isMmo ? null : charLevelToSkillParamLevel(level);
  const [hashVersion, setHashVersion] = useState(0);
  const pendingHashRef = useRef<string | null>(
    typeof window !== "undefined" ? window.location.hash : null,
  );
  const pendingAnimationRef = useRef<number | null>(null);

  const updateSkillHash = useCallback((anchor: string) => {
    if (typeof window === "undefined") return;

    const encodedAnchor = encodeURIComponent(anchor);
    const currentPath = window.location.pathname + window.location.search;
    if (window.location.hash !== `#${encodedAnchor}`) {
      window.history.replaceState(null, "", `${currentPath}#${encodedAnchor}`);
    }
  }, []);

  const syncSkillAnchor = useCallback((anchor: string, target?: HTMLElement | null) => {
    if (typeof window === "undefined") return;

    updateSkillHash(anchor);

    const targetElement = target || document.getElementById(anchor);
    if (!targetElement) return;

    targetElement.scrollIntoView({ behavior: "smooth", block: "center" });
    targetElement.classList.remove(styles.simSkillCardHighlight);
    void targetElement.offsetWidth;
    targetElement.classList.add(styles.simSkillCardHighlight);
    window.setTimeout(() => targetElement.classList.remove(styles.simSkillCardHighlight), 2500);
  }, [updateSkillHash]);

  useEffect(() => {
    const handleHashChange = () => {
      pendingHashRef.current = window.location.hash;
      setHashVersion((value) => value + 1);
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  // Legacy deep-link behavior: select the proper category, open the section,
  // then smoothly scroll and pulse the requested skill card after it exists.
  useEffect(() => {
    if (typeof window === "undefined" || !pendingHashRef.current || allSkills.length === 0) return;

    const rawAnchor = decodeURIComponent(pendingHashRef.current.slice(1));
    const requestedId = rawAnchor.toLowerCase().startsWith("skill-")
      ? rawAnchor.slice("skill-".length)
      : rawAnchor;
    const normalizedRequestedId = requestedId.toLowerCase();
    const normalizedName = requestedId.replace(/[_-]/g, " ").trim().toLowerCase();
    const match = allSkills.find((skill: any) => {
      const skillId = String(skill.id || skill.action_id || "").toLowerCase();
      const nameEn = String(skill.name_en || skill.name || "").toLowerCase();
      const nameRu = String(skill.name_ru || "").toLowerCase();
      return (
        skillId === normalizedRequestedId ||
        nameEn === normalizedName ||
        nameRu === normalizedName ||
        nameEn.replace(/\s+/g, "_") === normalizedRequestedId
      );
    });
    if (!match) return;

    const matchId = String(match.id || match.action_id || allSkills.indexOf(match));
    const matchCategory = String(match.category || "other").toLowerCase();
    if (selectedCat.toLowerCase() !== matchCategory) {
      setSelectedCat(matchCategory);
      return;
    }

    const targetId = `skill-${matchId}`;
    const target = document.getElementById(targetId);
    if (!target) return;

    pendingHashRef.current = null;

    if (pendingAnimationRef.current !== null) {
      window.cancelAnimationFrame(pendingAnimationRef.current);
    }
    pendingAnimationRef.current = window.requestAnimationFrame(() => {
      syncSkillAnchor(targetId, target);
      pendingAnimationRef.current = null;
    });

    return () => {
      if (pendingAnimationRef.current !== null) {
        window.cancelAnimationFrame(pendingAnimationRef.current);
        pendingAnimationRef.current = null;
      }
    };
  }, [allSkills, hashVersion, selectedCat, syncSkillAnchor]);

  return (
    <details
      className={`${styles.simSection} ${styles.simSkillsSection}`}
      id="sim-skills-section"
      open
    >
      <summary className={styles.simSectionSummary}>
        <div className={styles.simSectionTitleLeft}>
          <span className={styles.simSectionTitle}>{strings.sectionSkills}</span>
        </div>
        <span className={styles.simSectionArrow} aria-hidden="true">
          ▾
        </span>
      </summary>

      <div className={styles.simSectionBody}>
        {/* Toolbar: Category Tabs & Level Slider */}
        <div className={styles.simSkillsToolbar}>
          {/* Category Tabs */}
          <div className={styles.simSkillTabs} role="tablist" aria-label={translateUiText("Skill Categories", locale)}>
            {activeCategories.map((cat) => {
              const count = allSkills.filter(
                (s) => (s.category || "").toLowerCase() === cat.toLowerCase(),
              ).length;
              const labelKey =
                cat === "normal"
                  ? "catNormal"
                  : cat === "dodge"
                    ? "catDodge"
                    : cat === "skill"
                      ? "catSkill"
                      : cat === "discharge"
                        ? "catDischarge"
                        : "catOther";
              const label = strings[labelKey];
              const isActive = selectedCat.toLowerCase() === cat.toLowerCase();

              return (
                <button
                  key={cat}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className={`${styles.simSkillTab} ${isActive ? styles.active : ""}`}
                  onClick={() => setSelectedCat(cat)}
                >
                  <span>{label}</span>
                  <span className={styles.simTabCount}>{count}</span>
                </button>
              );
            })}
          </div>

          {/* Controls: Level Slider + MAX button + Combo Guide */}
          <div className="flex items-center gap-4 flex-wrap">
            {comboGuideSrc && (
              <button
                type="button"
                className={styles.simComboGuideBtn}
                onClick={() =>
                  onOpenLightbox(comboGuideSrc, `${character.name_en || ""} ${strings.comboGuide}`)
                }
              >
                <span>{strings.comboGuide}</span>
              </button>
            )}

            {!isMmo && (
              <div className={styles.simLevelSliderWrap} aria-label={translateUiText("Character Weapon Level", locale)}>
                <span className={styles.simLevelSliderLabel}>{strings.level}</span>
                <input
                  type="range"
                  className={styles.simLevelSlider}
                  id="sim-skill-level-slider"
                  min={1}
                  max={200}
                  value={level}
                  step={1}
                  onChange={(e) => onLevelChange(parseInt(e.target.value, 10))}
                  aria-label={strings.level}
                />
                <span className={styles.simLevelSliderValue}>
                  {strings.levelShort} {level}
                </span>
                <button
                  type="button"
                  className={`${styles.simLevelMaxBtn} ${level === 200 ? styles.isActive : ""}`}
                  onClick={() => onLevelChange(200)}
                >
                  {strings.maxBtn}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Skill Cards */}
        {filteredSkills.length > 0 ? (
          <div className={styles.simSkillCards}>
            {filteredSkills.map((skill: any, idx: number) => {
              const sId = skill.id || skill.action_id || idx;
              const skillAnchor = `skill-${String(sId)}`;
              const rawName = isRu
                ? skill.name_ru || skill.name_en || skill.name
                : skill.name_en || skill.name;
              const sName = String(rawName || "—").replace(/\{[0-9]+\}/g, "—");

              const iconSrc = resolveSkillIconUrl(character, skill) || null;

              const desc = getSkillDescriptionForLevel(skill, isMmo ? 200 : level, locale);
              const category = String(skill.category || "Other").toLowerCase();
              const comboSteps = deriveSkillCombo(skill);

              return (
                <div
                  key={sId}
                  id={skillAnchor}
                  className={styles.simSkillCard}
                  data-skill-id={String(sId)}
                  data-panel-anchor={skillAnchor}
                  role="link"
                  tabIndex={0}
                  onClick={(event) => {
                    if ((event.target as HTMLElement).closest("a, button")) return;
                    updateSkillHash(skillAnchor);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      if ((event.target as HTMLElement).closest("a, button")) return;
                      event.preventDefault();
                      updateSkillHash(skillAnchor);
                    }
                  }}
                >
                  <div className={styles.simSkillCardMedia}>
                    {iconSrc ? (
                      <>
                        <img
                          className={styles.simSkillCardIcon}
                          src={iconSrc}
                          alt={sName}
                          loading="lazy"
                          onError={(e) => {
                            const image = e.currentTarget;
                            if (!image.dataset.triedPng && image.src.includes(".webp")) {
                              image.dataset.triedPng = "1";
                              image.src = image.src.replace(/\.webp(?:$|\?)/i, ".png");
                              return;
                            }
                            image.style.display = "none";
                            const fallback = image.nextElementSibling;
                            if (fallback instanceof HTMLElement) fallback.style.display = "flex";
                          }}
                        />
                        <div
                          className={styles.simSkillCardIconPlaceholder}
                          style={{ display: "none" }}
                          aria-hidden="true"
                        >
                          ⚔
                        </div>
                      </>
                    ) : (
                      <div className={styles.simSkillCardIconPlaceholder}>⚔</div>
                    )}
                  </div>

                  <div className={styles.simSkillCardContent}>
                    <div className={styles.simSkillCardHeaderLine}>
                      <div className={styles.simSkillCardTitleGroup}>
                        <h4 className={styles.simSkillCardName}>{sName}</h4>
                        {!isMmo && (
                          <span className={styles.simSkillCardLevel}>
                            {strings.levelShort} {paramLevel}
                          </span>
                        )}
                        <span className={styles.simSkillCardCategory} data-category={category}>
                          {
                            strings[
                              category === "normal"
                                ? "catNormal"
                                : category === "dodge"
                                  ? "catDodge"
                                  : category === "skill"
                                    ? "catSkill"
                                    : category === "discharge"
                                      ? "catDischarge"
                                      : "catOther"
                            ]
                          }
                        </span>
                      </div>
                    </div>

                    {comboSteps.length > 0 && (
                      <div className={styles.simSkillCombo} aria-label={translateUiText("Combo sequence", locale)}>
                        {comboSteps.map((step: string, stepIndex: number) => (
                          <React.Fragment key={`${step}-${stepIndex}`}>
                            <span className={styles.simComboChip} title={step}>
                              <span className={styles.simComboGlyph} aria-hidden="true">
                                {(() => {
                                  const sprite = getComboSpriteInfo(step, locale, strings);
                                  return (
                                    <img
                                      className={styles.simComboSprite}
                                      src={sprite.webp}
                                      alt={sprite.label}
                                      width={sprite.width}
                                      height={sprite.height}
                                      loading="lazy"
                                      onError={(event) => {
                                        const image = event.currentTarget;
                                        if (!image.dataset.triedPng) {
                                          image.dataset.triedPng = "1";
                                          image.src = image.src.replace(/\.webp(?:$|\?)/i, ".png");
                                        }
                                      }}
                                    />
                                  );
                                })()}
                              </span>
                              <span className={styles.simComboStepLabel}>
                                {localizeComboStep(step, locale, strings)}
                              </span>
                            </span>
                            {stepIndex < comboSteps.length - 1 && (
                              <span className={styles.simComboArrow} aria-hidden="true">
                                <img
                                  className={styles.simComboArrowImg}
                                  src="/info/simulacra/assets/combo/arrow.webp"
                                  alt="→"
                                  width={14}
                                  height={19}
                                  loading="lazy"
                                  onError={(event) => {
                                    const image = event.currentTarget;
                                    if (!image.dataset.triedPng) {
                                      image.dataset.triedPng = "1";
                                      image.src = image.src.replace(/\.webp(?:$|\?)/i, ".png");
                                    }
                                  }}
                                />
                              </span>
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                    )}

                    <div
                      className={styles.simSkillCardDesc}
                      dangerouslySetInnerHTML={{ __html: formatRichText(desc, keywordMatcher) }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className={styles.simEmptyNote}>{strings.noSkills}</p>
        )}
      </div>
    </details>
  );
};

SimulacraSkillsSection.displayName = "SimulacraSkillsSection";
