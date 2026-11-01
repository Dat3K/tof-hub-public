"use client";

import React, { useMemo, useState } from "react";
import type { SimulacraDatasetItemRaw } from "@tof-hub/contracts";
import { translateUiText, type Locale } from "@tof-hub/i18n";
import type { SimulacraStrings } from "../types";
import styles from "../simulacra.module.css";

interface SimulacraDevSectionProps {
  character: SimulacraDatasetItemRaw;
  locale: Locale;
  strings: SimulacraStrings;
  devData?: SimulacraDevData;
  hideRawJson?: boolean;
}

export interface SimulacraDevSource {
  path: string;
  label_en: string;
  label_ru: string;
}

export interface SimulacraDevField {
  label: string;
  value: string | number;
}

export interface SimulacraDevData {
  kind: "pet";
  identifiers: SimulacraDevField[];
  stats: SimulacraDevField[];
  advancements: Array<{ star: number; fields: SimulacraDevField[] }>;
  skills: Array<{ name: string; action: string; source: string }>;
  modules: SimulacraDevField[];
  assets: SimulacraDevField[];
  rawJson: unknown;
  sources: {
    identifiers: readonly SimulacraDevSource[];
    stats: readonly SimulacraDevSource[];
    advancements: readonly SimulacraDevSource[];
    skills: readonly SimulacraDevSource[];
    modules: readonly SimulacraDevSource[];
    assets: readonly SimulacraDevSource[];
  };
}

type DevCategory =
  | "all"
  | "identifiers"
  | "base_stats"
  | "matrix"
  | "traits"
  | "coefficients"
  | "advancements"
  | "curves"
  | "skills";

function flattenSkills(character: SimulacraDatasetItemRaw): any[] {
  const skills = (character.weapon as any)?.skills;
  if (Array.isArray(skills)) return skills;
  if (!skills || typeof skills !== "object") return [];
  return Object.values(skills).flatMap((bucket: any) => (Array.isArray(bucket) ? bucket : []));
}

function displayName(value: any, locale: Locale, fallback: string): string {
  if (!value) return fallback;
  return value[locale === "ru" ? "name_ru" : "name_en"] || value.name || fallback;
}

function scalarEntries(value: unknown): Array<[string, unknown]> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.entries(value as Record<string, unknown>);
}

function sourceEntries(character: SimulacraDatasetItemRaw, category: string, locale: Locale) {
  const sources = (character.sources as any)?.[category];
  if (!Array.isArray(sources)) return [];
  return sources.map((source: any) => ({
    path: String(source.path || source),
    label: source[locale === "ru" ? "label_ru" : "label_en"] || source.label_en || "",
  }));
}

function DataWarningBanner({
  character,
  locale,
  strings,
}: {
  character: SimulacraDatasetItemRaw;
  locale: Locale;
  strings: SimulacraStrings;
}) {
  const warnings = character.data_warnings || [];
  if (warnings.length === 0) return null;

  return (
    <div className={styles.simDevWarning} role="alert">
      <span className={styles.simDevWarningStripe} aria-hidden="true" />
      <div className={styles.simDevWarningBody}>
        {warnings.map((warning) => (
          <div key={warning.id}>
            <strong className={styles.simDevWarningTitle}>
              {locale === "ru" ? warning.title_ru : warning.title_en}
            </strong>
            <p className={styles.simDevWarningText}>
              {locale === "ru" ? warning.message_ru : warning.message_en}
            </p>
            {Array.isArray(warning.paths) && warning.paths.length > 0 && (
              <div className={styles.simDevWarningPaths}>
                <span>
                  {strings.devSourcePathsExample}
                </span>
                <div className={styles.simDevWarningPathList}>
                  {warning.paths.map((path) => (
                    <code key={path}>{path}</code>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function SourceList({
  entries,
  strings,
}: {
  entries: Array<{ path: string; label: string }>;
  strings: SimulacraStrings;
}) {
  if (entries.length === 0) return null;
  return (
    <div className={styles.simDevSourcesCard}>
      <div className={styles.simDevSourcesHeader}>
        <span className={styles.simDevSourcesTag}>{strings.devSourcePathsTag}</span>
        <span className={styles.simDevSourcesCount}>{entries.length}</span>
      </div>
      <div className={styles.simDevSourcesList}>
        {entries.map((entry, index) => (
          <div className={styles.simDevSourcesItem} key={`${entry.path}-${index}`}>
            <div className={styles.simDevSourcesInfo}>
              <code className={styles.simDevSourcesPath}>{entry.path}</code>
              {entry.label && <span className={styles.simDevSourcesLabel}>{entry.label}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const PetDevDataSection: React.FC<{
  data: SimulacraDevData;
  locale: Locale;
  strings: SimulacraStrings;
  hideRawJson?: boolean;
}> = ({ data, locale, strings, hideRawJson }) => {
  type Category = "all" | "identifiers" | "stats" | "advancements" | "skills" | "modules" | "assets" | "raw_json";
  const [selectedCategory, setSelectedCategory] = useState<Category>("all");
  const counts: Record<Category, number> = {
    all: data.identifiers.length + data.stats.length + data.advancements.length + data.skills.length + data.modules.length + data.assets.length + (hideRawJson ? 0 : 1),
    identifiers: data.identifiers.length,
    stats: data.stats.length,
    advancements: data.advancements.length,
    skills: data.skills.length,
    modules: data.modules.length,
    assets: data.assets.length,
    raw_json: 1,
  };
  const labels: Record<Category, string> = {
    all: strings.devCatAll,
    identifiers: strings.devCatIdentifiers,
    stats: strings.devCatStats,
    advancements: strings.devCatStars,
    skills: strings.devCatSkills,
    modules: strings.devCatModules,
    assets: strings.devCatAssets,
    raw_json: strings.devCatRawJson,
  };
  const visible = (category: Category) => selectedCategory === "all" || selectedCategory === category;
  const source = (category: keyof SimulacraDevData["sources"]) => (
    <SourceList
      strings={strings}
      entries={data.sources[category].map((item) => ({
        path: item.path,
        label: locale === "ru" ? item.label_ru : item.label_en,
      }))}
    />
  );
  const cards = (fields: SimulacraDevField[]) => (
    <div className={styles.simDevGrid}>
      {fields.map((field) => (
        <div className={styles.simDevCard} key={field.label}>
          <span className={styles.simDevLabel}>{field.label}</span>
          <code className={styles.simDevVal}>{String(field.value)}</code>
        </div>
      ))}
    </div>
  );

  return (
    <div className={styles.simDevSection} id="sim-dev-section">
      <details className={styles.simDevDetails} id="sim-dev-details">
        <summary className={styles.simDevSummary}>
          <div className="flex items-center gap-2"><span className={styles.simSectionIcon} aria-hidden="true">⚙️</span><span className="font-semibold text-white">{strings.devDataTitle}</span></div>
          <span className={styles.simSectionArrow} aria-hidden="true">▾</span>
        </summary>
        <div className={styles.simDevContent}>
          <div className={styles.simDevDisclaimer}><span className={styles.simDisclaimerIcon} aria-hidden="true">ⓘ</span><span className={styles.simDisclaimerText}>{strings.devDataDisclaimer}</span></div>
          <div className={styles.simDevFilters} role="tablist" aria-label={strings.devCategoriesAria}>
            {(Object.keys(labels) as Category[]).filter((category) => !(hideRawJson && category === "raw_json")).map((category) => (
              <button type="button" key={category} className={`${styles.simDevFilterBtn} ${selectedCategory === category ? styles.simDevFilterBtnActive : ""}`} onClick={() => setSelectedCategory(category)}>
                {labels[category]} <span className={styles.simFilterCount}>{counts[category]}</span>
              </button>
            ))}
          </div>

          <div className={styles.simDevGroup} hidden={!visible("identifiers")}>
            <h4 className={styles.simDevGroupTitle}>{strings.devGroupIdentifiers}</h4>
            {source("identifiers")}{cards(data.identifiers)}
          </div>
          <div className={styles.simDevGroup} hidden={!visible("stats")}>
            <h4 className={styles.simDevGroupTitle}>{strings.devGroupBaseStats}</h4>
            {source("stats")}{cards(data.stats)}
          </div>
          <div className={styles.simDevGroup} hidden={!visible("advancements")}>
            <h4 className={styles.simDevGroupTitle}>{strings.devGroupAdvMult}</h4>
            {source("advancements")}
            <div className={styles.simDevList}>{data.advancements.map((advancement) => <div className={styles.simDevAdvItem} key={advancement.star}><div className={styles.simDevAdvStar}>★{advancement.star}</div><div className={styles.simDevMultiplierList}>{advancement.fields.map((field) => <span className={styles.simDevMultiplierTag} key={field.label}><code>{field.label}</code><span>{String(field.value)}</span></span>)}</div></div>)}</div>
          </div>
          <div className={styles.simDevGroup} hidden={!visible("skills")}>
            <h4 className={styles.simDevGroupTitle}>{strings.devGroupSkillProv}</h4>
            {source("skills")}
            <div className={styles.simDevProvenanceWrap}><table className={styles.simDevProvenanceTable}><thead><tr><th>{strings.devColSkill}</th><th>{translateUiText('Action ID', locale)}</th><th>{strings.devColSource}</th></tr></thead><tbody>{data.skills.map((skill) => <tr key={skill.name}><td className={styles.simDevProvName}>{skill.name}</td><td className={styles.simDevProvAction}><code>{skill.action}</code></td><td className={styles.simDevProvKey}><code>{skill.source}</code></td></tr>)}</tbody></table></div>
          </div>
          <div className={styles.simDevGroup} hidden={!visible("modules")}>
            <h4 className={styles.simDevGroupTitle}>{strings.devGroupModuleFam}</h4>
            {source("modules")}{cards(data.modules)}
          </div>
          <div className={styles.simDevGroup} hidden={!visible("assets")}>
            <h4 className={styles.simDevGroupTitle}>{strings.devGroupAssetPaths}</h4>
            {source("assets")}{cards(data.assets)}
          </div>
          {!hideRawJson && (
          <div className={styles.simDevGroup} hidden={!visible("raw_json")}>
            <h4 className={styles.simDevGroupTitle}>{translateUiText('Raw JSON', locale)}</h4><pre className={styles.simDevRawJson}>{JSON.stringify(data.rawJson, null, 2)}</pre>
          </div>
          )}
        </div>
      </details>
    </div>
  );
};

export const SimulacraDevSection: React.FC<SimulacraDevSectionProps> = ({
  character,
  locale,
  strings,
  devData,
  hideRawJson,
}) => {
  if (devData) return <PetDevDataSection data={devData} locale={locale} strings={strings} hideRawJson={hideRawJson} />;
  const isMmo = character.server_mode === "mmo" || character.edition === "mmo";
  const baseStats = character.base_stats as any;
  const matrixObj = (character.matrix || {}) as any;
  const [selectedCategory, setSelectedCategory] = useState<DevCategory>("all");

  const skills = useMemo(() => flattenSkills(character), [character]);
  const skillsWithParams = skills.filter(
    (skill) => Array.isArray(skill.parameters) && skill.parameters.length > 0,
  );
  const advancementMultipliers = (character.advancements || []).filter(
    (adv: any) => adv.multipliers && Object.keys(adv.multipliers).length > 0,
  );
  const traitDevData = (character.traits || []).filter(
    (trait: any) =>
      trait.driver_en ||
      trait.driver_ru ||
      (Array.isArray(trait.affinity_ladder) && trait.affinity_ladder.length > 0) ||
      (Array.isArray(character.affinity_ladder) && character.affinity_ladder.length > 0),
  );
  const coefficientEntries = scalarEntries(character.coefficients);
  const matrixSets = [matrixObj.set2, matrixObj.set4].filter(Boolean);
  const skillSources = sourceEntries(character, "skills", locale);

  const rawIdentCards = isMmo
    ? [
        { label: strings.devServerMode, val: "MMO" },
        {
          label: strings.devSeason,
          val:
            character.season_badge ||
            character.season_tag ||
            (character.season ? `S${character.season}` : "S1"),
        },
        { label: strings.devCanonicalId, val: character.id.replace(/-mmo$/i, "") },
        { label: strings.devCharId, val: character.id },
        { label: strings.devAvatarId, val: character.avatar_id },
        { label: strings.devImitationId, val: character.imitation_id },
        { label: strings.devWeaponId, val: character.weapon?.id },
      ].filter((item) => item.val)
    : [
        { label: strings.devCharId, val: character.id },
        { label: strings.devAvatarId, val: character.avatar_id },
        { label: strings.devImitationId, val: character.imitation_id },
        { label: strings.devWeaponId, val: character.weapon?.id },
        { label: strings.devMatrixSuitId, val: character.matrix_suit_id || matrixObj?.suit_id },
        { label: strings.devMatrixSuitName, val: matrixObj?.suit_name_en },
      ].filter((item) => item.val);

  const hasBaseDef = baseStats?.resistance !== undefined || baseStats?.def !== undefined;
  const rawBaseStatsCards = [
    { label: strings.devBaseAtk, val: baseStats?.attack ?? "—" },
    { label: strings.devBaseHp, val: baseStats?.hp ?? "—" },
    ...(hasBaseDef
      ? [{ label: strings.devBaseDef, val: baseStats?.resistance ?? baseStats?.def }]
      : []),
    ...(baseStats?.crit !== undefined && !hasBaseDef
      ? [{ label: strings.devBaseCrit, val: baseStats?.crit }]
      : []),
    { label: strings.devBaseShatter, val: baseStats?.shatter ?? "—" },
    { label: strings.devBaseCharge, val: baseStats?.charge ?? "—" },
  ];

  const devCounts: Record<DevCategory, number> = {
    all: 0,
    identifiers: rawIdentCards.length,
    base_stats: rawBaseStatsCards.length,
    matrix: isMmo ? 0 : matrixSets.length,
    traits: isMmo ? 0 : traitDevData.length,
    coefficients: coefficientEntries.length,
    advancements: advancementMultipliers.length,
    curves: skillsWithParams.length,
    skills: skills.length,
  };
  devCounts.all = Object.entries(devCounts)
    .filter(([key]) => key !== "all")
    .reduce((sum, [, value]) => sum + value, 0);

  const isVisible = (category: DevCategory) =>
    selectedCategory === "all" || selectedCategory === category;

  const devCategories: Array<[DevCategory, string]> = [
    ["identifiers", strings.devCatIdentifiers],
    ["base_stats", strings.devCatBaseStats],
    ["matrix", strings.devCatMatrix],
    ["traits", strings.devCatTraits],
    ["coefficients", strings.devCatCoefficients],
    ["advancements", strings.devCatAdvancements],
    ["curves", strings.devCatCurves],
    ["skills", strings.devCatSkills],
  ];

  return (
    <div className={styles.simDevSection} id="sim-dev-section">
      <details className={styles.simDevDetails} id="sim-dev-details">
        <summary className={styles.simDevSummary}>
          <div className="flex items-center gap-2">
            <span className={styles.simSectionIcon} aria-hidden="true">
              ⚙️
            </span>
            <span className="font-semibold text-white">{strings.devDataTitle}</span>
          </div>
          <span className={styles.simSectionArrow} aria-hidden="true">
            ▾
          </span>
        </summary>

        <div className={styles.simDevContent}>
          <DataWarningBanner character={character} locale={locale} strings={strings} />
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
            <span className={styles.simDisclaimerText}>{strings.devDataDisclaimer}</span>
          </div>

          <div
            className={styles.simDevFilters}
            role="tablist"
            aria-label={strings.devCategoriesAria}
          >
            {[
              ["all", strings.devCatAll] as [DevCategory, string],
              ...devCategories.filter(([category]) => devCounts[category] > 0),
            ].map(([category, label]) => (
              <button
                type="button"
                key={category}
                className={`${styles.simDevFilterBtn} ${selectedCategory === category ? styles.simDevFilterBtnActive : ""}`}
                onClick={() => setSelectedCategory(category)}
              >
                {label} <span className={styles.simFilterCount}>{devCounts[category]}</span>
              </button>
            ))}
          </div>

          {/* Raw Identifiers */}
          <div className={styles.simDevGroup} hidden={!isVisible("identifiers")}>
            <h4 className={styles.simDevGroupTitle}>
              {strings.devGroupTechIdentifiers}
            </h4>
            <SourceList strings={strings} entries={sourceEntries(character, "identifiers", locale)} />
            <div className={styles.simDevGrid}>
              {rawIdentCards.map((card, idx) => (
                <div key={idx} className={styles.simDevCard}>
                  <span className={styles.simDevLabel}>{card.label}</span>
                  <code className={styles.simDevVal}>{String(card.val)}</code>
                </div>
              ))}
            </div>
          </div>

          {/* Raw Base Stats (Lv. 1) */}
          <div className={styles.simDevGroup} hidden={!isVisible("base_stats")}>
            <h4 className={styles.simDevGroupTitle}>{strings.devBaseStatsTitle}</h4>
            <SourceList strings={strings} entries={sourceEntries(character, "base_stats", locale)} />
            <div className={styles.simDevGrid}>
              {rawBaseStatsCards.map((card, idx) => (
                <div key={idx} className={styles.simDevCard}>
                  <span className={styles.simDevLabel}>{card.label}</span>
                  <code className={styles.simDevVal}>{String(card.val)}</code>
                </div>
              ))}
            </div>
          </div>

          {!isMmo && matrixSets.length > 0 && (
            <div className={styles.simDevGroup} hidden={!isVisible("matrix")}>
              <h4 className={styles.simDevGroupTitle}>
                {locale === "ru"
                  ? "Данные комплекта матриц и buff IDs"
                  : "Matrix Set Data & Buff IDs"}
              </h4>
              <SourceList strings={strings} entries={sourceEntries(character, "matrix", locale)} />
              <div className={styles.simDevGrid}>
                {[
                  [strings.devMatrixSuitId, matrixObj.suit_id || character.matrix_suit_id],
                  [
                    strings.devMatrixSuitName,
                    locale === "ru"
                      ? matrixObj.suit_name_ru || matrixObj.suit_name_en
                      : matrixObj.suit_name_en,
                  ],
                  [strings.devQuality, matrixObj.quality || character.rarity],
                ]
                  .filter(([, value]) => value)
                  .map(([label, value]) => (
                    <div className={styles.simDevCard} key={String(label)}>
                      <span className={styles.simDevLabel}>{label}</span>
                      <code className={styles.simDevVal}>{String(value)}</code>
                    </div>
                  ))}
              </div>
              <div className={styles.simDevMatrixList}>
                {matrixSets.map((set: any, index) => (
                  (() => {
                    const setTemplate = String(
                      locale === "ru"
                        ? set.template_ru || set.template_en || set.desc_ru || set.desc_en || ""
                        : set.template_en || set.template_ru || set.desc_en || set.desc_ru || "",
                    ).trim();
                    return (
                      <div className={styles.simDevMatrixCard} key={index}>
                        <div className={styles.simDevMatrixHeader}>
                          <strong>{translateUiText(index === 0 ? "2-Piece Set" : "4-Piece Set", locale)}</strong>
                          <code>{set.buff_id || set.buff_ids?.join(", ") || "—"}</code>
                        </div>
                        <div className={styles.simDevMatrixDesc}>{setTemplate || "—"}</div>
                        {(set.stars || []).map((star: any, starIndex: number) => {
                          const tierTemplate = String(
                            locale === "ru"
                              ? star.template_ru || star.template_en || ""
                              : star.template_en || star.template_ru || "",
                          ).trim();
                          const hasDistinctTierText = tierTemplate.length > 0 && tierTemplate !== setTemplate;

                          return (
                            <div className={styles.simDevMatrixTier} key={starIndex}>
                              <span className={styles.simDevMatrixStar}>★{star.star ?? starIndex}</span>
                              <code className={styles.simDevMatrixVariable}>{star.buff_id || "—"}</code>
                              {hasDistinctTierText && (
                                <span className={styles.simDevMatrixTierText}>{tierTemplate}</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()
                ))}
              </div>
            </div>
          )}

          {!isMmo && traitDevData.length > 0 && (
            <div className={styles.simDevGroup} hidden={!isVisible("traits")}>
              <h4 className={styles.simDevGroupTitle}>
                {translateUiText('Trait Drivers & Affinity Ladder', locale)}
              </h4>
              <SourceList strings={strings} entries={sourceEntries(character, "traits", locale)} />
              {traitDevData.map((trait: any, index: number) => {
                const ladder = trait.affinity_ladder?.length
                  ? trait.affinity_ladder
                  : character.affinity_ladder || [];
                return (
                  <div className={styles.simDevTraitCard} key={index}>
                    <div className={styles.simDevMatrixHeader}>
                      <strong>{displayName(trait, locale, strings.devFallbackTrait.replace('{index}', String(index + 1)))}</strong>
                      <span>♥ {trait.affinity ?? 0}</span>
                    </div>
                    <div className={styles.simDevTraitDriver}>
                      {strings.devDriver}:{" "}
                      {trait[locale === "ru" ? "driver_ru" : "driver_en"] || "—"}
                    </div>
                    {ladder.length > 0 && (
                      <div className={styles.simDevLadder}>
                        {ladder.map((step: any, stepIndex: number) => (
                          <span key={stepIndex}>
                            ♥ {step.level_pts}: ATK +{step.atk || 0}, HP +{step.hp || 0}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {coefficientEntries.length > 0 && (
            <div className={styles.simDevGroup} hidden={!isVisible("coefficients")}>
              <h4 className={styles.simDevGroupTitle}>
                {strings.devCatCoefficients} ({coefficientEntries.length})
              </h4>
              <SourceList strings={strings} entries={sourceEntries(character, "coefficients", locale)} />
              <div className={styles.simDevGrid}>
                {coefficientEntries.map(([key, value]) => (
                  <div className={styles.simDevCard} key={key}>
                    <span className={styles.simDevLabel}>{key}</span>
                    <code className={styles.simDevVal}>{String(value)}</code>
                  </div>
                ))}
              </div>
            </div>
          )}

          {advancementMultipliers.length > 0 && (
            <div className={styles.simDevGroup} hidden={!isVisible("advancements")}>
              <h4 className={styles.simDevGroupTitle}>
                {strings.devGroupAdvMult}
              </h4>
              <SourceList strings={strings} entries={sourceEntries(character, "advancements", locale)} />
              <div className={styles.simDevList}>
                {advancementMultipliers.map((adv: any) => (
                  <div className={styles.simDevAdvItem} key={adv.star}>
                    <div className={styles.simDevAdvStar}>★{adv.star}</div>
                    <div className={styles.simDevMultiplierList}>
                      {Object.entries(adv.multipliers).map(([key, value]) => (
                        <span className={styles.simDevMultiplierTag} key={key}>
                          <code>{key}</code>
                          <span>{String(value)}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {skillsWithParams.length > 0 && (
            <div className={styles.simDevGroup} hidden={!isVisible("curves")}>
              <h4 className={styles.simDevGroupTitle}>
                {strings.devSkillCurves} (
                {skillsWithParams.length})
              </h4>
              <SourceList strings={strings} entries={sourceEntries(character, "curves", locale)} />
              <div className={styles.simDevSkillParamsList}>
                {skillsWithParams.map((skill: any) => (
                  <details className={styles.simDevSkillParamCard} key={skill.id}>
                    <summary className={styles.simDevSkillParamSummary}>
                      <span className={styles.simDevParamTitle}>
                        <strong>{displayName(skill, locale, strings.devColSkill)}</strong>
                        <code>{skill.id || skill.action_id || "—"}</code>
                      </span>
                      <span className={styles.simDevParamBadge}>
                        {skill.parameters.length} {strings.devCurvesShort}
                      </span>
                    </summary>
                    <div className={styles.simDevParamTableWrap}>
                      <table className={styles.simDevParamTable}>
                        <thead>
                          <tr>
                            <th>{strings.devColParameter}</th>
                            <th>{strings.devColValues}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {skill.parameters.map((parameter: any) => (
                            <tr key={parameter.key}>
                              <td><code>{parameter.key}</code></td>
                              <td>
                                {Object.entries(parameter.levels || {})
                                  .map(([level, value]) => `L${level}: ${value}`)
                                  .join(" · ") || String(parameter.defaultValue || "—")}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                ))}
              </div>
            </div>
          )}

          {skills.length > 0 && (
            <div className={styles.simDevGroup} hidden={!isVisible("skills")}>
              <h4 className={styles.simDevGroupTitle}>
                {strings.devSkillProvenance} ({skills.length})
              </h4>
              <SourceList strings={strings} entries={skillSources} />
              <div className={styles.simDevProvenanceWrap}>
                <table className={styles.simDevProvenanceTable}>
                  <thead>
                    <tr>
                      <th>{strings.devColSkill}</th>
                      <th>{translateUiText('Action ID', locale)}</th>
                      <th>{strings.devColSource}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {skills.map((skill: any, index: number) => (
                      <tr key={skill.id || index}>
                        <td className={styles.simDevProvName}>{displayName(skill, locale, strings.devColSkill)}</td>
                        <td className={styles.simDevProvAction}>
                          <code>{skill.id || skill.action_id || "—"}</code>
                        </td>
                        <td className={styles.simDevProvKey}>
                          {skill.provenance?.source || "—"}
                          {skill.provenance?.namespace ? ` · ${skill.provenance.namespace}` : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </details>
    </div>
  );
};

SimulacraDevSection.displayName = "SimulacraDevSection";
