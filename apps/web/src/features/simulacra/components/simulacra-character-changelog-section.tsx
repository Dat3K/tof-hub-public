"use client";

import React, { useMemo } from "react";
import type { SimulacraDatasetItemRaw } from "@tof-hub/contracts";
import { gameAsset } from "@tof-hub/game-assets";
import { translateUiText } from '@tof-hub/i18n';
import type { SimulacraStrings } from "../types";
import type { Locale } from "@tof-hub/i18n";
import { formatDiffHtml } from "../utils/diff";
import styles from "../simulacra.module.css";

type ChangelogChange = {
  type?: string;
  path?: string;
  old?: string | number;
  new?: string | number;
  skill_id?: string;
  action_id?: string;
  passive_id?: string;
};

type ChangelogEntry = {
  patch?: string;
  client?: string;
  clientRu?: string;
  date?: string;
  changes?: ChangelogChange[];
};

type ChangelogSectionKey = "traits" | "advancements" | "skills" | "passives" | "matrices" | "other";

type ChangelogEntityPresentation = {
  name: string;
  icon?: string;
  category?: string;
  affinity?: number | null;
};

function isTestChangelogEntry(entry: ChangelogEntry): boolean {
  return [entry.patch, entry.client, entry.clientRu]
    .filter(Boolean)
    .some((value) => /(^|[-_\s])test($|[-_\s])/i.test(String(value)));
}

interface SimulacraCharacterChangelogSectionProps {
  character: SimulacraDatasetItemRaw;
  locale: Locale;
  strings: SimulacraStrings;
}

function flattenSkills(character: SimulacraDatasetItemRaw): any[] {
  const skills = (character.weapon as any)?.skills;
  if (Array.isArray(skills)) return skills;
  if (!skills || typeof skills !== "object") return [];
  return Object.values(skills).flatMap((bucket: any) => (Array.isArray(bucket) ? bucket : []));
}

function resolveChangeName(
  character: SimulacraDatasetItemRaw,
  change: ChangelogChange,
  locale: Locale,
  strings: SimulacraStrings,
): string {
  const path = String(change.path || "");
  const parts = path.split(".");
  const root = parts[0];
  const isRu = locale === "ru";

  if (root === "traits" || change.type === "Trait") {
    const trait = (character.traits as any[] | undefined)?.[Number(parts[1])];
    return (
      trait?.[isRu ? "name_ru" : "name_en"] ||
      trait?.name ||
      strings.changelogTypeTrait
    );
  }
  if (root === "advancements" || change.type === "Advancement") {
    const advancement = (character.advancements as any[] | undefined)?.[Number(parts[1])];
    return (
      advancement?.[isRu ? "name_ru" : "name_en"] ||
      advancement?.name ||
      strings.changelogTypeAdv
    );
  }
  if (root === "matrix" || root === "matrices" || change.type === "Matrix") {
    const isSet4 = String(parts[1] || "").includes("4");
    return isSet4 ? strings.pieceSet4 : strings.pieceSet2;
  }
  if (
    root === "skills" ||
    root === "skill" ||
    (root === "weapon" && (parts[1] === "skills" || parts[1] === "skill")) ||
    ["Skill", "Normal", "Dodge", "Discharge"].includes(String(change.type))
  ) {
    const id = change.skill_id || change.action_id || (root === "weapon" ? parts[2] : parts[1]);
    const skill = flattenSkills(character).find((item) => item.id === id || item.action_id === id);
    return (
      skill?.[isRu ? "name_ru" : "name_en"] ||
      skill?.name ||
      strings.changelogTypeSkill
    );
  }
  if (
    root === "passives" ||
    (root === "weapon" && parts[1] === "passives") ||
    change.type === "Passive"
  ) {
    const id = change.passive_id || change.action_id || parts[2] || parts[1];
    const passive = flattenSkills(character).find(
      (item) => item.id === id || item.action_id === id,
    );
    return (
      passive?.[isRu ? "name_ru" : "name_en"] ||
      passive?.name ||
      strings.changelogTypePassive
    );
  }
  return String(change.type || change.path || strings.changelogTypeOther);
}

function getChangeSection(change: ChangelogChange): ChangelogSectionKey {
  const root = String(change.path || "")
    .split(".")[0]
    .toLowerCase();
  const type = String(change.type || "").toLowerCase();
  if (root === "traits" || type === "trait") return "traits";
  if (root === "advancements" || type === "advancement") return "advancements";
  if (root === "matrix" || root === "matrices" || type === "matrix") return "matrices";
  if (root === "passives" || type === "passive") return "passives";
  if (
    root === "skills" ||
    root === "skill" ||
    (root === "weapon" && ["skills", "skill"].includes(String(change.path || "").split(".")[1])) ||
    ["skill", "normal", "dodge", "discharge"].includes(type)
  ) {
    return "skills";
  }
  return "other";
}

function getChangeSectionLabel(
  key: ChangelogSectionKey,
  locale: Locale,
  strings: SimulacraStrings,
) {
  if (key === "traits") return strings.sectionTraits;
  if (key === "advancements") return strings.sectionAdvancements;
  if (key === "skills") return strings.sectionSkills;
  if (key === "passives") return strings.passivesTitle;
  if (key === "matrices") return strings.sectionMatrix;
  return strings.sectionOther;
}

function getAdvancementStar(change: ChangelogChange): string {
  const pathParts = String(change.path || "").split(".");
  const rawIndex = Number(pathParts[1]);
  return Number.isFinite(rawIndex) ? String(rawIndex + 1) : "0";
}

function localizedChangelogTarget(
  character: SimulacraDatasetItemRaw,
  change: ChangelogChange,
): any | null {
  const pathParts = String(change.path || "").split(".");
  const root = pathParts[0];

  if (root === "traits") {
    return (character.traits as any[] | undefined)?.[Number(pathParts[1])] || null;
  }

  if (root === "advancements") {
    return (character.advancements as any[] | undefined)?.[Number(pathParts[1])] || null;
  }

  if (root === "weapon" && (change.skill_id || change.action_id || change.passive_id)) {
    const id = change.skill_id || change.action_id || change.passive_id;
    return flattenSkills(character).find((item) => item.id === id || item.action_id === id) || null;
  }

  if (root === "matrix" || root === "matrices") {
    const matrix = character.matrix as any;
    return matrix?.[pathParts[1]] || null;
  }

  return null;
}

function localizeChangelogDiff(
  character: SimulacraDatasetItemRaw,
  change: ChangelogChange,
  locale: Locale,
): { oldValue: string | number; newValue: string | number } | null {
  if (locale !== "ru") return null;

  const field = String(String(change.path || "").split(".").at(-1) || "").toLowerCase();
  if (!field.includes("desc") && !field.includes("description")) return null;

  const target = localizedChangelogTarget(character, change);
  const localizedNew = String(
    target?.desc_display_ru ||
      target?.desc_ru ||
      target?.description_ru ||
      target?.description ||
      target?.desc ||
      "",
  ).trim();
  if (!localizedNew || !/[А-Яа-яЁё]/.test(localizedNew)) return null;

  const oldText = String(change.old ?? "");
  const newText = String(change.new ?? "");
  if (oldText === newText) return { oldValue: localizedNew, newValue: localizedNew };

  // Changelog exports currently store the English old/new values, while the
  // localized record contains the current Russian sentence. Preserve the
  // localized sentence and carry over numeric balance changes (36% -> 34%,
  // 1.5s -> 2s, etc.) so the diff remains useful without leaking English.
  const oldNumbers = oldText.match(/\d+(?:[.,]\d+)?%?(?:s|сек)?/gi) || [];
  const newNumbers = newText.match(/\d+(?:[.,]\d+)?%?(?:s|сек)?/gi) || [];
  let localizedOld = localizedNew;
  let replacements = 0;
  let searchFrom = 0;

  for (let index = 0; index < Math.min(oldNumbers.length, newNumbers.length); index += 1) {
    const oldNumber = oldNumbers[index];
    const newNumber = newNumbers[index];
    if (oldNumber === newNumber) continue;

    const position = localizedOld.indexOf(newNumber, searchFrom);
    if (position < 0) continue;
    localizedOld =
      localizedOld.slice(0, position) + oldNumber + localizedOld.slice(position + newNumber.length);
    searchFrom = position + oldNumber.length;
    replacements += 1;
  }

  return {
    oldValue: replacements > 0 ? localizedOld : localizedNew,
    newValue: localizedNew,
  };
}

function resolveChangePresentation(
  character: SimulacraDatasetItemRaw,
  change: ChangelogChange,
  locale: Locale,
  strings: SimulacraStrings,
): ChangelogEntityPresentation {
  const name = resolveChangeName(character, change, locale, strings);
  const pathParts = String(change.path || "").split(".");
  const root = pathParts[0];

  if (root === "traits" || change.type === "Trait") {
    const trait = (character.traits as any[] | undefined)?.[Number(pathParts[1])];
    return { name, affinity: trait?.affinity ?? null };
  }

  const skills = flattenSkills(character);
  if (
    root === "skills" ||
    root === "skill" ||
    (root === "weapon" && ["skills", "skill"].includes(pathParts[1])) ||
    ["Skill", "Normal", "Dodge", "Discharge"].includes(String(change.type))
  ) {
    const id = change.skill_id || change.action_id || (root === "weapon" ? pathParts[2] : pathParts[1]);
    const skill = skills.find((item) => item.id === id || item.action_id === id);
    return {
      name,
      icon: skill?.icon_thumb || skill?.icon,
      category: skill?.category || change.type || "Skill",
    };
  }

  if (
    root === "passives" ||
    (root === "weapon" && pathParts[1] === "passives") ||
    change.type === "Passive"
  ) {
    const id = change.passive_id || change.action_id || pathParts[2] || pathParts[1];
    const passive = skills.find((item) => item.id === id || item.action_id === id);
    return { name, icon: passive?.icon_thumb || passive?.icon };
  }

  return { name, category: strings.changelogTypeOther };
}

interface ChangelogChangeItemProps {
  character: SimulacraDatasetItemRaw;
  change: ChangelogChange;
  locale: Locale;
  section: ChangelogSectionKey;
  diffHtml: string;
  strings: SimulacraStrings;
}

const ChangelogChangeItem: React.FC<ChangelogChangeItemProps> = ({
  character,
  change,
  locale,
  section,
  diffHtml,
  strings,
}) => {
  const presentation = resolveChangePresentation(character, change, locale, strings);
  const name = presentation.name;

  if (section === "advancements") {
    const star = getAdvancementStar(change);
    return (
      <details className={styles.simAdvItem} open>
        <summary className={styles.simAdvSummary}>
          <div className={styles.simAdvHeader}>
            <div className={styles.simAdvStar} title={name}>
              <span className={styles.simAdvStarIcon}>★</span>
              <span className={styles.simAdvStarNum}>{star}</span>
            </div>
            <span className={styles.simAdvTitle}>{name}</span>
          </div>
          <span className={styles.simAdvArrow} aria-hidden="true">
            ▸
          </span>
        </summary>
        <div className={styles.simAdvBody}>
          <div className={styles.simAdvDesc} dangerouslySetInnerHTML={{ __html: diffHtml }} />
        </div>
      </details>
    );
  }

  if (section === "passives") {
    const passiveIconSrc = presentation.icon ? gameAsset(presentation.icon) : "";
    return (
      <details className={styles.simPassiveItem} open>
        <summary className={styles.simPassiveSummary}>
          <span className={styles.simPassiveTitle}>
            <span className={styles.simPassiveIndicator}>▸</span>
            {passiveIconSrc ? (
              <img className={styles.simPassiveIcon} src={passiveIconSrc} alt="" loading="lazy" />
            ) : (
              <span className={styles.simPassiveIconBlank} aria-hidden="true" />
            )}
            <span className={styles.simPassiveName}>{name}</span>
          </span>
        </summary>
        <div className={styles.simPassiveBody}>
          <div className={styles.simPassiveDesc} dangerouslySetInnerHTML={{ __html: diffHtml }} />
        </div>
      </details>
    );
  }

  if (section === "matrices") {
    return (
      <div className={styles.simMatrixCard}>
        <div className={styles.simMatrixCardHeader}>
          <span className={styles.simMatrixCardBadge}>{name}</span>
        </div>
        <div className={styles.simMatrixCardDesc} dangerouslySetInnerHTML={{ __html: diffHtml }} />
      </div>
    );
  }

  if (section === "skills") {
    const category = String(presentation.category || change.type || "Skill").toLowerCase();
    const categoryLabels: Record<string, string> = {
      normal: strings.catNormal,
      dodge: strings.catDodge,
      skill: strings.catSkill,
      discharge: strings.catDischarge,
      passive: strings.catPassive,
    };
    const skillIconSrc = presentation.icon ? gameAsset(presentation.icon) : "";
    return (
      <div className={styles.simChangelogSkillCard}>
        <div className={styles.simChangelogSkillMedia}>
          {skillIconSrc ? (
            <img className={styles.simChangelogSkillIcon} src={skillIconSrc} alt={name} loading="lazy" />
          ) : (
            <span className={`${styles.simChangelogSkillIconPlaceholder} ${styles[`simChangelogSkillIconPlaceholder${category}`] || ""}`}>
              {category.slice(0, 1).toUpperCase()}
            </span>
          )}
        </div>
        <div className={styles.simChangelogSkillContent}>
          <div className={styles.simChangelogSkillHeaderLine}>
            <h4 className={styles.simChangelogSkillName}>{name}</h4>
            <span className={`${styles.simChangelogSkillBadge} ${styles[`simChangelogSkillBadge${category}`] || ""}`}>
              {categoryLabels[category] || presentation.category || change.type || translateUiText('Skill', locale)}
            </span>
          </div>
          <div className={styles.simChangelogSkillDesc} dangerouslySetInnerHTML={{ __html: diffHtml }} />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.simTraitCard}>
      <div className={styles.simTraitCardTop}>
        <span className={styles.simTraitName}>{name}</span>
        {presentation.affinity != null ? (
          <span className={styles.simTraitAffinity}>
            <span className={styles.simAffinityHeart}>♥</span> {presentation.affinity}{" "}
            {strings.pointsAffinity}
          </span>
        ) : (
          change.type && <span className={styles.simChangelogType}>{change.type}</span>
        )}
      </div>
      <div className={styles.simTraitBody}>
        <p className={styles.simTraitDesc} dangerouslySetInnerHTML={{ __html: diffHtml }} />
      </div>
    </div>
  );
};

export const SimulacraCharacterChangelogSection: React.FC<
  SimulacraCharacterChangelogSectionProps
> = ({ character, locale, strings }) => {
  const changelogs = useMemo(
    () =>
      (((character as any).changelogs || []) as ChangelogEntry[]).filter(
        (entry) => !isTestChangelogEntry(entry),
      ),
    [character],
  );

  if (changelogs.length === 0) return null;

  return (
    <div className={styles.simChangelogSection} id="sim-changelog-section">
      <details className={styles.simDevDetails} id="sim-changelog-data">
        <summary className={styles.simDevSummary}>
          <span className={styles.simChangelogSummaryTitle}>
            <span className={styles.simChangelogSummaryIcon} aria-hidden="true">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
            </span>
            <span>{strings.changelogSectionTitle}</span>
            <span className={styles.simTabCount}>{changelogs.length}</span>
          </span>
          <span className={styles.simSectionArrow} aria-hidden="true">
            ▾
          </span>
        </summary>

        <div className={styles.simDevContent}>
          <div className={styles.simDevDisclaimer}>
            <span className={styles.simDisclaimerIcon} aria-hidden="true">
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
            </span>
            <span className={styles.simDisclaimerText}>
              {strings.changelogDisclaimer}
            </span>
          </div>
          <div className={styles.simChangelogList}>
            {changelogs.map((entry, entryIndex) => {
              const changes = (entry.changes || []).filter(
                (change) => String(change.old ?? "").trim() && String(change.new ?? "").trim(),
              );

              if (changes.length === 0) return null;

              const grouped = changes.reduce<Record<ChangelogSectionKey, ChangelogChange[]>>(
                (result, change) => {
                  result[getChangeSection(change)].push(change);
                  return result;
                },
                { traits: [], advancements: [], skills: [], passives: [], matrices: [], other: [] },
              );

              return (
                <div className={styles.simChangelogPatch} key={`${entry.patch}-${entryIndex}`}>
                  <div className={styles.simChangelogPatchHeader}>
                    <span className={styles.simChangelogPatchVersion}>
                      v{entry.patch || translateUiText('Patch', locale)}
                    </span>
                  </div>
                  <div className={styles.simChangelogSections}>
                    {(
                      [
                        "traits",
                        "advancements",
                        "skills",
                        "passives",
                        "matrices",
                        "other",
                      ] as ChangelogSectionKey[]
                    ).map((section) => {
                      const sectionChanges = grouped[section];
                      if (sectionChanges.length === 0) return null;
                      return (
                        <details className={styles.simChangelogGroup} key={section} open>
                          <summary className={styles.simChangelogGroupSummary}>
                            <span>{getChangeSectionLabel(section, locale, strings)}</span>
                            <span className={styles.simChangelogGroupArrow} aria-hidden="true">
                              ▸
                            </span>
                          </summary>
                          <div className={styles.simChangelogGroupBody}>
                            {sectionChanges.map((change, changeIndex) => {
                              const localizedDiff = localizeChangelogDiff(character, change, locale);
                              return (
                                <ChangelogChangeItem
                                  key={`${change.path}-${changeIndex}`}
                                  character={character}
                                  change={change}
                                  locale={locale}
                                  section={section}
                                  diffHtml={formatDiffHtml(
                                    localizedDiff?.oldValue ?? change.old,
                                    localizedDiff?.newValue ?? change.new,
                                  )}
                                  strings={strings}
                                />
                              );
                            })}
                          </div>
                        </details>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </details>
    </div>
  );
};

SimulacraCharacterChangelogSection.displayName = "SimulacraCharacterChangelogSection";
