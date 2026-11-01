"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { gameAsset } from "@tof-hub/game-assets";
import { Badge } from "@tof-hub/ui";
import { normalizeElement, normalizeRole } from "@tof-hub/game-domain";
import { useI18n } from "@/lib/i18n";
import { useSimulacraData } from "@/lib/game-data-client";
import type { Locale } from "@tof-hub/i18n";
import type { ServerMode } from "@tof-hub/ui";
import type { SimulacraDatasetItemRaw } from "@tof-hub/contracts";
import type {
  SimulacraChangelogViewProps,
  SimulacraChangelogStrings,
  ChangelogValueChange,
  ChangelogSectionItem,
  CharacterPatchGroup,
} from "../types";
import { getSimulacraChangelogStrings } from "../copy";
import { formatDiffHtml } from "../utils/diff";
import { getElementLabelText, getRoleLabelText } from "../utils/labels";
import styles from "../changelog.module.css";
import simulacraStyles from "../simulacra.module.css";

function getElemIconSuffix(norm: string): string {
  switch (norm) {
    case "physical":
      return "wu";
    case "flame":
      return "huo";
    case "frost":
      return "bing";
    case "volt":
      return "lei";
    case "altered":
      return "powers";
    default:
      return "powers";
  }
}

function getRoleIconPath(norm: string): string {
  switch (norm) {
    case "tank":
      return "Hotta/Content/Resources/UI/wuqi/icon_fangyu";
    case "benediction":
      return "Hotta/Content/Resources/UI/wuqi/icon_zengyi";
    default:
      return "Hotta/Content/Resources/UI/wuqi/icon_qianggong";
  }
}

function getCategoryFallbackSvg(category: string) {
  const cat = String(category || "").toLowerCase();
  switch (cat) {
    case "normal":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={styles.changelogSkillIconPlaceholder}
        >
          <path d="M14.5 17.5L3 6V3h3l11.5 11.5" />
          <path d="M13 19l6-6" />
          <path d="M16 16l4 4" />
          <path d="M19 21l2-2" />
        </svg>
      );
    case "dodge":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={styles.changelogSkillIconPlaceholder}
        >
          <path d="M5 12h14M12 5l7 7-7 7M2 7h6M2 17h6" />
        </svg>
      );
    case "skill":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={styles.changelogSkillIconPlaceholder}
        >
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      );
    case "discharge":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={styles.changelogSkillIconPlaceholder}
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12" />
        </svg>
      );
    case "passive":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={styles.changelogSkillIconPlaceholder}
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      );
    default:
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={styles.changelogSkillIconPlaceholder}
        >
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      );
  }
}

function resolveEntityInfo(
  sim: SimulacraDatasetItemRaw,
  pathStr: string,
  changeType: string,
  lang: string,
  change: ChangelogValueChange,
  labels: SimulacraChangelogStrings,
): {
  name: string;
  typeLabel: string;
  sectionKey: "traits" | "advancements" | "skills" | "passives" | "matrices" | "other";
  icon?: string;
  star?: number | null;
  category?: string;
  affinity?: number | null;
} {
  let name = "";
  let icon = "";
  let star: number | null = null;
  let typeLabel = changeType || "";
  let category = "";
  let affinity: number | null = null;
  let sectionKey: "traits" | "advancements" | "skills" | "passives" | "matrices" | "other" =
    "other";

  try {
    const parts = pathStr.split(".");
    const rootKey = (parts[0] || "").toLowerCase();

    if (changeType === "Stat") {
      const statKey = String(change.field || parts[parts.length - 1] || "")
        .replace(/^(base|max)_stats?\.?/i, "")
        .toLowerCase();
      const statLabels: Record<string, string> = {
        attack: labels.changeStatAtk,
        atk: labels.changeStatAtk,
        hp: labels.changeStatHp,
        crit: labels.changeStatCrit,
        resistance: labels.changeStatDef,
        defense: labels.changeStatDef,
        def: labels.changeStatDef,
        shatter: labels.changeStatShatter,
        charge: labels.changeStatCharge,
      };
      const fallbackLabel = statKey
        .replace(/[_-]+/g, " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
      name = statLabels[statKey] || fallbackLabel || "Stat";
      typeLabel = "Stat";
      sectionKey = "other";
    } else if (rootKey === "traits" || rootKey === "awakening" || changeType === "Trait") {
      const arr: any[] = sim.traits || [];
      const indexNum = parseInt(parts[1] || "0", 10);
      const entity =
        arr[indexNum] || arr.find((t) => t.id === parts[1] || String(t.affinity) === parts[1]);
      name = entity
        ? lang === "ru"
          ? entity.name_ru || entity.name_en || labels.trait
          : entity.name_en || entity.name_ru || labels.trait
        : labels.trait;
      affinity = entity?.affinity ?? null;
      typeLabel = "Trait";
      sectionKey = "traits";
    } else if (rootKey === "advancements" || changeType === "Advancement") {
      const arr: any[] = sim.advancements || [];
      const starNum = parseInt(parts[1] || "0", 10);
      const entity = arr[starNum] || arr.find((a) => a.star === starNum);
      star = entity?.star ?? starNum;
      const rawName =
        (lang === "ru" ? entity?.name_ru || entity?.name_en : entity?.name_en || entity?.name_ru) ||
        "";
      let advName = String(rawName || "")
        .replace(/\{[0-9]+\}/g, "—")
        .trim();
      advName = advName.replace(/^\d+\s*[-–—]?\s*(?:★\s*|\*\s*)?/, "").trim();
      name = advName || labels.starAdvancement;
      typeLabel = "Advancement";
      sectionKey = "advancements";
    } else if (
      rootKey === "skills" ||
      rootKey === "skill" ||
      (rootKey === "weapon" && (parts[1] === "skills" || parts[1] === "skill")) ||
      changeType === "Skill" ||
      changeType === "Normal" ||
      changeType === "Discharge" ||
      changeType === "Dodge"
    ) {
      const weaponSkills = (sim.weapon as any)?.skills;
      const bucketedWeaponSkills =
        weaponSkills && typeof weaponSkills === "object" && !Array.isArray(weaponSkills)
          ? Object.values(weaponSkills).flatMap((bucket: any) =>
              Array.isArray(bucket) ? bucket : [],
            )
          : [];
      const allSkills: any[] = [
        ...(Array.isArray(weaponSkills) ? weaponSkills : []),
        ...bucketedWeaponSkills,
        ...(Array.isArray((sim as any).skills) ? (sim as any).skills : []),
      ];
      const rawId =
        change.skill_id || change.action_id || (rootKey === "weapon" ? parts[2] : parts[1]);

      let entity: any;
      if (rawId != null) {
        entity = allSkills.find((s) => s && (s.id === rawId || s.action_id === rawId));
        if (!entity && !isNaN(parseInt(rawId, 10))) {
          entity = allSkills[parseInt(rawId, 10)];
        }
      }

      if (!entity) {
        if (
          changeType === "Discharge" ||
          (rawId && String(rawId).toLowerCase().includes("discharge"))
        ) {
          entity = allSkills.find((s) => (s.category || "").toLowerCase() === "discharge");
        } else if (
          changeType === "Normal" ||
          (rawId && String(rawId).toLowerCase().includes("normal"))
        ) {
          entity = allSkills.find((s) => (s.category || "").toLowerCase() === "normal");
        } else if (
          changeType === "Dodge" ||
          (rawId && String(rawId).toLowerCase().includes("dodge"))
        ) {
          entity = allSkills.find((s) => (s.category || "").toLowerCase() === "dodge");
        } else if (
          changeType === "Skill" ||
          (rawId && String(rawId).toLowerCase().includes("skill"))
        ) {
          entity = allSkills.find((s) => (s.category || "").toLowerCase() === "skill");
        }
      }

      if (entity) {
        name =
          (lang === "ru"
            ? entity.name_ru || entity.name_en || entity.name
            : entity.name_en || entity.name_ru || entity.name) || "";
        category = entity.category || changeType || "Skill";
        icon = entity.icon?.thumb || entity.icon || "";
      } else {
        category = changeType || "Skill";
        if (category.toLowerCase() === "discharge") {
          name = labels.changeFallbackDischarge;
        } else if (category.toLowerCase() === "normal") {
          name = labels.changeFallbackNormal;
        } else if (category.toLowerCase() === "dodge") {
          name = labels.changeFallbackDodge;
        } else {
          name = labels.weaponSkill;
        }
      }

      typeLabel = category;
      sectionKey = "skills";
    } else if (
      rootKey === "passives" ||
      (rootKey === "weapon" && parts[1] === "passives") ||
      changeType === "Passive"
    ) {
      const weaponSkills = (sim.weapon as any)?.skills;
      const bucketedPassives =
        weaponSkills && typeof weaponSkills === "object" && !Array.isArray(weaponSkills)
          ? Array.isArray(weaponSkills.passives)
            ? weaponSkills.passives
            : []
          : [];
      const allPassives: any[] = [
        ...(Array.isArray((sim.weapon as any)?.passives) ? (sim.weapon as any).passives : []),
        ...bucketedPassives,
        ...(Array.isArray((sim as any).passives) ? (sim as any).passives : []),
      ];
      const rawId =
        change.passive_id || change.action_id || (rootKey === "weapon" ? parts[2] : parts[1]);
      let entity: any;
      if (rawId != null) {
        entity = allPassives.find((p) => p && (p.id === rawId || p.action_id === rawId));
        if (!entity && !isNaN(parseInt(rawId, 10))) {
          entity = allPassives[parseInt(rawId, 10)];
        }
      }
      if (entity) {
        name =
          (lang === "ru"
            ? entity.name_ru || entity.name_en || entity.name
            : entity.name_en || entity.name_ru || entity.name) ||
          labels.changeFallbackPassive;
        icon = entity.icon?.thumb || entity.icon || "";
      } else {
        name = labels.changeFallbackPassive;
      }
      typeLabel = "Passive";
      sectionKey = "passives";
    } else if (rootKey === "matrix" || rootKey === "matrices" || changeType === "Matrix") {
      const pieceKey = String(parts[1] || "").toLowerCase();
      const isSet4 = pieceKey.includes("4") || pieceKey === "set4" || pieceKey === "piece4";
      name = isSet4 ? labels.matrix4pc : labels.matrix2pc;
      typeLabel = "Matrix";
      sectionKey = "matrices";
    } else {
      name = changeType || pathStr;
      sectionKey = "other";
    }
  } catch {
    name = changeType || pathStr;
    sectionKey = "other";
  }

  return {
    name: name || changeType || pathStr,
    typeLabel,
    sectionKey,
    icon,
    star,
    category,
    affinity,
  };
}

export const SimulacraChangelogView: React.FC<SimulacraChangelogViewProps> = ({
  initialData,
  initialLocale = "en",
  initialCharId = null,
  initialServerMode = "gacha",
}) => {
  const { locale: activeLocale } = useI18n();
  const currentLocale = (activeLocale || initialLocale) as Locale;
  const strings = getSimulacraChangelogStrings(currentLocale);

  // Load dataset with SSR hydration
  const { data: dataset } = useSimulacraData({
    initialData: initialData ?? undefined,
    locale: currentLocale,
  });

  const effectiveData = dataset || initialData || null;

  // Server mode (gacha / mmo)
  const [serverMode, setServerModeState] = useState<ServerMode>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const urlServer = params.get("server") || params.get("mode");
      if (urlServer === "mmo" || urlServer === "gacha") {
        return urlServer as ServerMode;
      }
      try {
        const stored = localStorage.getItem("tof_simulacra_server_mode");
        if (stored === "mmo" || stored === "gacha") {
          return stored as ServerMode;
        }
      } catch {
        // local storage restricted
      }
    }
    return initialServerMode;
  });

  // Optional character filter (?char=<slug>)
  const [selectedCharId, setSelectedCharId] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      return params.get("char") || initialCharId;
    }
    return initialCharId;
  });

  // Collapsed states
  const [collapsedPatches, setCollapsedPatches] = useState<Set<string>>(new Set());
  const [collapsedChars, setCollapsedChars] = useState<Set<string>>(new Set());

  // URL state sync
  const updateUrl = useCallback((newMode: ServerMode, newCharId: string | null) => {
    if (typeof window === "undefined") return;
    try {
      const url = new URL(window.location.href);
      if (newMode === "mmo") {
        url.searchParams.set("server", "mmo");
      } else {
        url.searchParams.delete("server");
      }
      url.searchParams.delete("mode");

      if (newCharId) {
        url.searchParams.set("char", newCharId);
      } else {
        url.searchParams.delete("char");
      }

      window.history.replaceState(
        null,
        "",
        url.pathname + (url.search ? url.search : "") + url.hash,
      );
    } catch {
      // ignore history state failure
    }
  }, []);

  const handleSetServerMode = (mode: ServerMode) => {
    setServerModeState(mode);
    try {
      localStorage.setItem("tof_simulacra_server_mode", mode);
    } catch {
      // ignore
    }
    updateUrl(mode, selectedCharId);
  };

  const handleClearCharFilter = () => {
    setSelectedCharId(null);
    updateUrl(serverMode, null);
  };

  // Popstate listener for browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const urlServer = params.get("server") || params.get("mode");
      if (urlServer === "mmo" || urlServer === "gacha") {
        setServerModeState(urlServer as ServerMode);
      }
      setSelectedCharId(params.get("char") || null);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const togglePatchCollapse = (patchKey: string) => {
    setCollapsedPatches((prev) => {
      const next = new Set(prev);
      if (next.has(patchKey)) {
        next.delete(patchKey);
      } else {
        next.add(patchKey);
      }
      return next;
    });
  };

  const toggleCharCollapse = (charKey: string) => {
    setCollapsedChars((prev) => {
      const next = new Set(prev);
      if (next.has(charKey)) {
        next.delete(charKey);
      } else {
        next.add(charKey);
      }
      return next;
    });
  };

  // Active characters list
  const activeRoster: SimulacraDatasetItemRaw[] = useMemo(() => {
    if (!effectiveData) return [];
    if (serverMode === "mmo") {
      return effectiveData.mmo || [];
    }
    return effectiveData.gacha || effectiveData.items || [];
  }, [effectiveData, serverMode]);

  // Find character name for filter chip
  const filteredCharacter = useMemo(() => {
    if (!selectedCharId) return null;
    return activeRoster.find((c) => c.id === selectedCharId) || null;
  }, [selectedCharId, activeRoster]);

  const filteredCharName = useMemo(() => {
    if (!filteredCharacter) return selectedCharId;
    return currentLocale === "ru"
      ? filteredCharacter.name_ru ||
          filteredCharacter.name ||
          filteredCharacter.name_en ||
          filteredCharacter.id
      : filteredCharacter.name_en || filteredCharacter.name || filteredCharacter.id;
  }, [filteredCharacter, selectedCharId, currentLocale]);

  // Aggregate and sort patch blocks
  const sortedPatches: CharacterPatchGroup[] = useMemo(() => {
    const patchMap = new Map<string, CharacterPatchGroup>();

    for (const sim of activeRoster) {
      const changelogs = (sim as any).changelogs;
      if (!Array.isArray(changelogs) || changelogs.length === 0) continue;

      // Filter by selected character if specified
      if (selectedCharId && sim.id !== selectedCharId) continue;

      for (const cl of changelogs) {
        // Keep only changes with a comparable previous value
        const filteredChanges = (cl.changes || []).filter((c: ChangelogValueChange) => {
          if (
            !c.old ||
            typeof c.old !== "string" ||
            !c.old.trim() ||
            c.old.trim() === "—" ||
            /^(?:tbd|none|null|n\/a)$/i.test(c.old.trim())
          ) {
            return false;
          }
          if (!c.new || typeof c.new !== "string" || !c.new.trim()) {
            return false;
          }

          const pathLower = String(c.path || "").toLowerCase();
          if (currentLocale === "en" && pathLower.endsWith("_ru")) return false;
          if (currentLocale === "ru" && pathLower.endsWith("_en")) return false;
          if (
            pathLower.endsWith("_pt") ||
            pathLower.endsWith("_es") ||
            pathLower.endsWith("_de") ||
            pathLower.endsWith("_fr") ||
            pathLower.endsWith("_id") ||
            pathLower.endsWith("_th")
          ) {
            return false;
          }
          return true;
        });

        if (filteredChanges.length === 0) continue;

        const patchKey = String(cl.patch || "Patch");
        if (!patchMap.has(patchKey)) {
          patchMap.set(patchKey, {
            patch: patchKey,
            client: cl.client,
            clientRu: cl.clientRu,
            date: cl.date || "",
            characters: [],
          });
        } else {
          const existing = patchMap.get(patchKey)!;
          if (!existing.client && cl.client) existing.client = cl.client;
          if (!existing.clientRu && cl.clientRu) existing.clientRu = cl.clientRu;
        }

        patchMap.get(patchKey)!.characters.push({
          character: sim,
          changes: filteredChanges,
        });
      }
    }

    return Array.from(patchMap.values()).sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
  }, [activeRoster, selectedCharId, currentLocale]);

  const renderModeControls = (
    <div className={styles.changelogModeControl} onClick={(e) => e.stopPropagation()}>
      <span className={styles.changelogModeLabel}>{strings.gameMode}</span>
      <div className={styles.changelogModeToggle} role="radiogroup" aria-label={strings.gameMode}>
        <button
          type="button"
          className={`${styles.changelogModeBtn} ${
            serverMode === "gacha" ? styles.changelogModeBtnActive : ""
          }`}
          data-server-mode="gacha"
          role="radio"
          aria-checked={serverMode === "gacha"}
          onClick={() => handleSetServerMode("gacha")}
        >
          {strings.modeGacha}
        </button>
        <button
          type="button"
          className={`${styles.changelogModeBtn} ${
            serverMode === "mmo" ? styles.changelogModeBtnActive : ""
          }`}
          data-server-mode="mmo"
          role="radio"
          aria-checked={serverMode === "mmo"}
          onClick={() => handleSetServerMode("mmo")}
        >
          {strings.modeMmo}
        </button>
      </div>
    </div>
  );

  return (
    <main id="main-content" className={`${styles.changelogFeed} editorial-page`}>
      <h1 className="sr-only">{strings.title}</h1>

      {/* Top Controls Bar */}
      <div className={styles.changelogTopControls}>
        <div className="flex items-center gap-3">
          <Link href="/info/simulacra" className={styles.changelogBackLink}>
            <span aria-hidden="true">←</span>
            <span>{strings.backToCatalog}</span>
          </Link>

          {selectedCharId && (
            <div className={styles.changelogFilterBadge}>
              <span>
                {strings.filterCharacter} <strong>{filteredCharName}</strong>
              </span>
              <button
                type="button"
                className={styles.changelogClearBtn}
                onClick={handleClearCharFilter}
                aria-label={strings.clearFilter}
                title={strings.clearFilter}
              >
                ✕
              </button>
            </div>
          )}
        </div>

        <div className={styles.changelogTopControlsRight}>{renderModeControls}</div>
      </div>

      {/* Empty State */}
      {sortedPatches.length === 0 ? (
        <div className={styles.changelogEmptyState}>
          <p className={styles.changelogEmptyText}>{strings.noChanges}</p>
        </div>
      ) : (
        /* Patch Blocks Feed */
        <div>
          {sortedPatches.map((patchGroup) => {
            const rawPatch = String(patchGroup.patch || "").trim();
            const versionText = /^v/i.test(rawPatch)
              ? rawPatch
              : /^\d/.test(rawPatch)
                ? `v${rawPatch}`
                : rawPatch;

            const isPatchCollapsed = collapsedPatches.has(patchGroup.patch);

            return (
              <div
                key={patchGroup.patch}
                className={`${styles.changelogPatchBlock} ${
                  isPatchCollapsed ? styles.changelogPatchBlockCollapsed : ""
                }`}
              >
                {/* Patch Header */}
                <div
                  className={styles.changelogPatchHeader}
                  role="button"
                  tabIndex={0}
                  aria-expanded={!isPatchCollapsed}
                  onClick={() => togglePatchCollapse(patchGroup.patch)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      togglePatchCollapse(patchGroup.patch);
                    }
                  }}
                >
                  <div className={styles.changelogPatchHeaderLeft}>
                    <span
                      className={`${styles.changelogPatchArrow} ${
                        isPatchCollapsed ? styles.changelogPatchArrowCollapsed : ""
                      }`}
                      aria-hidden="true"
                    >
                      ▸
                    </span>
                    <h2 className={styles.changelogPatchVersion}>{versionText}</h2>
                  </div>
                </div>

                {/* Patch Content (Characters) */}
                {!isPatchCollapsed && (
                  <div className={styles.changelogPatchContent}>
                    {patchGroup.characters.map(({ character, changes }) => {
                      const charName =
                        currentLocale === "ru"
                          ? character.name_ru || character.name || character.name_en || character.id
                          : character.name_en || character.name || character.id;

                      const weaponName =
                        currentLocale === "ru"
                          ? character.weapon_name_ru ||
                            character.weapon_name ||
                            character.weapon_name_en ||
                            ""
                          : character.weapon_name_en || character.weapon_name || "";

                      const charHref = `/info/simulacra?server=${serverMode}&char=${encodeURIComponent(
                        character.id,
                      )}`;

                      // Resolve avatar
                      const rawAvatar =
                        character.avatar_thumb ||
                        character.avatar ||
                        character.portrait_thumb ||
                        (character as any).icon_thumb ||
                        (character as any).icon ||
                        "";
                      const avatarSrc = rawAvatar ? gameAsset(rawAvatar) : "/datamine/favicon.svg";

                      // Resolve weapon texture
                      const rawWeaponIcon =
                        character.weapon?.icon ||
                        (character as any).icon ||
                        (character as any).icon_thumb ||
                        "";
                      const weaponIconSrc = rawWeaponIcon ? gameAsset(rawWeaponIcon) : "";

                      // Badges
                      const elementNorm = normalizeElement(character.element).toLowerCase();
                      const elementVariant = (elementNorm === "physical" ? "phys" : elementNorm) as
                        | "phys"
                        | "flame"
                        | "frost"
                        | "volt"
                        | "altered";
                      const elementLabel = [character.element, character.element_secondary]
                        .filter(Boolean)
                        .map((value) => getElementLabelText(value, currentLocale).toUpperCase())
                        .join(" / ");
                      const elementPair = [
                        elementNorm,
                        normalizeElement(character.element_secondary || "").toLowerCase(),
                      ]
                        .filter(Boolean)
                        .join("-");
                      const elementComboClass =
                        elementPair === "physical-flame"
                          ? simulacraStyles.simHeroElementPhysicalFlame
                          : elementPair === "flame-physical"
                            ? simulacraStyles.simHeroElementFlamePhysical
                            : elementPair === "frost-volt"
                              ? simulacraStyles.simHeroElementFrostVolt
                              : elementPair === "volt-frost"
                                ? simulacraStyles.simHeroElementVoltFrost
                                : "";

                      const roleNorm = normalizeRole(
                        character.role || character.resonance,
                      ).toLowerCase();
                      const roleVariant = (
                        roleNorm === "benediction" || roleNorm === "tank" ? roleNorm : "dps"
                      ) as "dps" | "tank" | "benediction";
                      const roleLabel = getRoleLabelText(
                        character.role || character.resonance,
                        currentLocale,
                      ).toUpperCase();
                      const elementIconSrc = character.element_combo_icon
                        ? gameAsset(character.element_combo_icon)
                        : gameAsset(
                            `Hotta/Content/Resources/UI/wuqi/icon_element_${getElemIconSuffix(elementNorm)}`,
                          );
                      const roleIconSrc = character.role_icon
                        ? gameAsset(character.role_icon)
                        : gameAsset(getRoleIconPath(roleNorm));

                      // Group changes by section
                      const sections: Record<string, ChangelogSectionItem[]> = {
                        traits: [],
                        advancements: [],
                        skills: [],
                        passives: [],
                        matrices: [],
                        other: [],
                      };

                      for (const change of changes) {
                        const info = resolveEntityInfo(
                          character,
                          change.path,
                          change.type,
                          currentLocale,
                          change,
                          strings,
                        );
                        const diffHtml = formatDiffHtml(change.old, change.new);
                        const item: ChangelogSectionItem = { change, info, diffHtml };

                        if (sections[info.sectionKey]) {
                          sections[info.sectionKey].push(item);
                        } else {
                          sections.other.push(item);
                        }
                      }

                      const charKey = `${patchGroup.patch}_${character.id}`;
                      const isCharCollapsed = collapsedChars.has(charKey);

                      return (
                        <article
                          key={character.id}
                          className={`${styles.changelogCharBlock} ${
                            isCharCollapsed ? styles.changelogCharBlockCollapsed : ""
                          }`}
                        >
                          {/* Character Header */}
                          <div
                            className={`${styles.changelogCharHeader} ${
                              isCharCollapsed ? styles.changelogCharHeaderCollapsed : ""
                            }`}
                            role="button"
                            tabIndex={0}
                            aria-expanded={!isCharCollapsed}
                            onClick={(e) => {
                              if ((e.target as HTMLElement).closest("a, button")) return;
                              toggleCharCollapse(charKey);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                if ((e.target as HTMLElement).closest("a, button")) return;
                                e.preventDefault();
                                toggleCharCollapse(charKey);
                              }
                            }}
                          >
                            <div className={styles.changelogCharHeaderLeft}>
                              <Link
                                href={charHref}
                                className={styles.changelogCharAvatarWrap}
                                aria-label={charName}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <img
                                  src={avatarSrc}
                                  alt={charName}
                                  className={styles.changelogCharAvatar}
                                  loading="lazy"
                                />
                              </Link>

                              <div className={styles.changelogCharInfo}>
                                <div className={styles.changelogCharTitleRow}>
                                  <h3 className={styles.changelogCharName}>
                                    <Link
                                      href={charHref}
                                      className={styles.changelogCharNameLink}
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {charName}
                                    </Link>
                                  </h3>

                                  {weaponName && (
                                    <div
                                      className={styles.changelogCharWeaponWrap}
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <Link
                                        href={charHref}
                                        className={styles.changelogCharWeapon}
                                        title={weaponName}
                                      >
                                        {weaponName}
                                      </Link>

                                      {weaponIconSrc && (
                                        <div
                                          className={styles.changelogWeaponPopover}
                                          role="tooltip"
                                        >
                                          <div className={styles.changelogWeaponPopoverIconWrap}>
                                            <img
                                              src={weaponIconSrc}
                                              alt={weaponName}
                                              className={styles.changelogWeaponPopoverIcon}
                                              loading="lazy"
                                            />
                                          </div>
                                          <div className={styles.changelogWeaponPopoverName}>
                                            {weaponName}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  <div className={styles.changelogCharBadges}>
                                    {elementLabel && (
                                      <Badge
                                        variant={elementVariant}
                                        size="sm"
                                        className={`${simulacraStyles.simHeroBadge} ${simulacraStyles.simHeroElementBadge} ${elementComboClass}`}
                                        title={elementLabel}
                                        icon={
                                          <img
                                            src={elementIconSrc}
                                            alt=""
                                            className={simulacraStyles.badgeIcon}
                                            onError={(e) => {
                                              (e.currentTarget as HTMLElement).style.display = "none";
                                            }}
                                          />
                                        }
                                      >
                                        <span className={simulacraStyles.simHeroBadgeText}>
                                          {elementLabel}
                                        </span>
                                      </Badge>
                                    )}
                                    {roleLabel && (
                                      <Badge
                                        variant={roleVariant}
                                        size="sm"
                                        className={`${simulacraStyles.simHeroBadge} ${simulacraStyles.simHeroRoleBadge}`}
                                        title={roleLabel}
                                        icon={
                                          <img
                                            src={roleIconSrc}
                                            alt=""
                                            className={simulacraStyles.badgeIcon}
                                            onError={(e) => {
                                              (e.currentTarget as HTMLElement).style.display = "none";
                                            }}
                                          />
                                        }
                                      >
                                        <span className={simulacraStyles.simHeroBadgeText}>
                                          {roleLabel}
                                        </span>
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className={styles.changelogCharHeaderRight}>
                              <span
                                className={`${styles.changelogCharArrow} ${
                                  isCharCollapsed ? styles.changelogCharArrowCollapsed : ""
                                }`}
                                aria-hidden="true"
                              >
                                ▸
                              </span>
                            </div>
                          </div>

                          {/* Character Sections */}
                          {!isCharCollapsed && (
                            <div className={styles.changelogCharSections}>
                              {/* 1. Awakening Traits */}
                              {sections.traits.length > 0 && (
                                <details className={styles.changelogSection} open>
                                  <summary className={styles.changelogSectionSummary}>
                                    <span>{strings.sectionTraits}</span>
                                    <span
                                      className={styles.changelogSectionArrow}
                                      aria-hidden="true"
                                    >
                                      ▸
                                    </span>
                                  </summary>
                                  <div className={styles.changelogSectionBody}>
                                    <div className="flex flex-col gap-3">
                                      {sections.traits.map((item, idx) => (
                                        <div key={idx} className={styles.changelogTraitCard}>
                                          <div className={styles.changelogTraitTop}>
                                            <span className={styles.changelogTraitName}>
                                              {item.info.name}
                                            </span>
                                            {item.info.affinity != null && (
                                              <span className={styles.changelogTraitAffinity}>
                                                <span>♥</span> {item.info.affinity}{" "}
                                                {strings.pointsAffinity}
                                              </span>
                                            )}
                                          </div>
                                          <p
                                            className={styles.changelogTraitDesc}
                                            dangerouslySetInnerHTML={{
                                              __html: item.diffHtml,
                                            }}
                                          />
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </details>
                              )}

                              {/* 2. Advancements */}
                              {sections.advancements.length > 0 && (
                                <details className={styles.changelogSection} open>
                                  <summary className={styles.changelogSectionSummary}>
                                    <span>{strings.sectionAdvancements}</span>
                                    <span
                                      className={styles.changelogSectionArrow}
                                      aria-hidden="true"
                                    >
                                      ▸
                                    </span>
                                  </summary>
                                  <div className={styles.changelogSectionBody}>
                                    <div>
                                      {sections.advancements.map((item, idx) => (
                                        <details key={idx} className={styles.changelogAdvItem} open>
                                          <summary className={styles.changelogAdvSummary}>
                                            <div className={styles.changelogAdvHeaderLeft}>
                                              <div className={styles.changelogAdvStarBadge}>
                                                <span>★</span>
                                                <span>{item.info.star ?? 0}</span>
                                              </div>
                                              <span className={styles.changelogAdvTitle}>
                                                {item.info.name}
                                              </span>
                                            </div>
                                            <span
                                              className={styles.changelogSectionArrow}
                                              aria-hidden="true"
                                            >
                                              ▸
                                            </span>
                                          </summary>
                                          <div
                                            className={styles.changelogAdvBody}
                                            dangerouslySetInnerHTML={{
                                              __html: item.diffHtml,
                                            }}
                                          />
                                        </details>
                                      ))}
                                    </div>
                                  </div>
                                </details>
                              )}

                              {/* 3. Weapon Skills */}
                              {sections.skills.length > 0 && (
                                <details className={styles.changelogSection} open>
                                  <summary className={styles.changelogSectionSummary}>
                                    <span>{strings.sectionSkills}</span>
                                    <span
                                      className={styles.changelogSectionArrow}
                                      aria-hidden="true"
                                    >
                                      ▸
                                    </span>
                                  </summary>
                                  <div className={styles.changelogSectionBody}>
                                    <div className="flex flex-col gap-3">
                                      {sections.skills.map((item, idx) => {
                                        const catKey = (
                                          item.info.category || "Skill"
                                        ).toLowerCase();
                                        const skillIconSrc = item.info.icon
                                          ? gameAsset(item.info.icon)
                                          : "";

                                        const badgeClassMap: Record<string, string> = {
                                          normal: styles.changelogSkillBadgeNormal,
                                          dodge: styles.changelogSkillBadgeDodge,
                                          skill: styles.changelogSkillBadgeSkill,
                                          discharge: styles.changelogSkillBadgeDischarge,
                                        };

                                        const badgeTextMap: Record<string, string> = {
                                          normal: strings.catNormal,
                                          dodge: strings.catDodge,
                                          skill: strings.catSkill,
                                          discharge: strings.catDischarge,
                                          passive: strings.catPassive,
                                        };

                                        return (
                                          <div key={idx} className={styles.changelogSkillCard}>
                                            <div className={styles.changelogSkillMedia}>
                                              {skillIconSrc ? (
                                                <img
                                                  src={skillIconSrc}
                                                  alt={item.info.name}
                                                  className={styles.changelogSkillIcon}
                                                  loading="lazy"
                                                />
                                              ) : (
                                                getCategoryFallbackSvg(catKey)
                                              )}
                                            </div>

                                            <div className={styles.changelogSkillContent}>
                                              <div className={styles.changelogSkillHeaderLine}>
                                                <h4 className={styles.changelogSkillName}>
                                                  {item.info.name}
                                                </h4>
                                                <span
                                                  className={`${
                                                    styles.changelogSkillBadge
                                                  } ${badgeClassMap[catKey] || ""}`}
                                                >
                                                  {badgeTextMap[catKey] || item.info.category}
                                                </span>
                                              </div>

                                              <div
                                                className={styles.changelogSkillDesc}
                                                dangerouslySetInnerHTML={{
                                                  __html: item.diffHtml,
                                                }}
                                              />
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </details>
                              )}

                              {/* 4. Passives */}
                              {sections.passives.length > 0 && (
                                <details className={styles.changelogSection} open>
                                  <summary className={styles.changelogSectionSummary}>
                                    <span>{strings.sectionPassives}</span>
                                    <span
                                      className={styles.changelogSectionArrow}
                                      aria-hidden="true"
                                    >
                                      ▸
                                    </span>
                                  </summary>
                                  <div className={styles.changelogSectionBody}>
                                    <div>
                                      {sections.passives.map((item, idx) => {
                                        const passiveIconSrc = item.info.icon
                                          ? gameAsset(item.info.icon)
                                          : "";

                                        return (
                                          <details
                                            key={idx}
                                            className={styles.changelogPassiveItem}
                                            open
                                          >
                                            <summary className={styles.changelogPassiveSummary}>
                                              <span className={styles.changelogPassiveTitle}>
                                                {passiveIconSrc && (
                                                  <img
                                                    src={passiveIconSrc}
                                                    alt=""
                                                    className={styles.changelogPassiveIcon}
                                                    loading="lazy"
                                                  />
                                                )}
                                                <span>{item.info.name}</span>
                                              </span>
                                              <span
                                                className={styles.changelogSectionArrow}
                                                aria-hidden="true"
                                              >
                                                ▸
                                              </span>
                                            </summary>
                                            <div
                                              className={styles.changelogPassiveDesc}
                                              dangerouslySetInnerHTML={{
                                                __html: item.diffHtml,
                                              }}
                                            />
                                          </details>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </details>
                              )}

                              {/* 5. Matrix Set Effects */}
                              {sections.matrices.length > 0 && (
                                <details className={styles.changelogSection} open>
                                  <summary className={styles.changelogSectionSummary}>
                                    <span>{strings.sectionMatrix}</span>
                                    <span
                                      className={styles.changelogSectionArrow}
                                      aria-hidden="true"
                                    >
                                      ▸
                                    </span>
                                  </summary>
                                  <div className={styles.changelogSectionBody}>
                                    <div className="flex flex-col gap-3">
                                      {sections.matrices.map((item, idx) => (
                                        <div key={idx} className={styles.changelogMatrixCard}>
                                          <span className={styles.changelogMatrixBadge}>
                                            {item.info.name}
                                          </span>
                                          <div
                                            className={styles.changelogMatrixDesc}
                                            dangerouslySetInnerHTML={{
                                              __html: item.diffHtml,
                                            }}
                                          />
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </details>
                              )}

                              {/* 6. Other Changes */}
                              {sections.other.length > 0 && (
                                <details className={styles.changelogSection} open>
                                  <summary className={styles.changelogSectionSummary}>
                                    <span>{strings.sectionOther}</span>
                                    <span
                                      className={styles.changelogSectionArrow}
                                      aria-hidden="true"
                                    >
                                      ▸
                                    </span>
                                  </summary>
                                  <div className={styles.changelogSectionBody}>
                                    <div className="flex flex-col gap-3">
                                      {sections.other.map((item, idx) => (
                                        <div key={idx} className={styles.changelogTraitCard}>
                                          <div className={styles.changelogTraitTop}>
                                            <span className={styles.changelogTraitName}>
                                              {item.info.name}
                                            </span>
                                          </div>
                                          <div
                                            className={styles.changelogTraitDesc}
                                            dangerouslySetInnerHTML={{
                                              __html: item.diffHtml,
                                            }}
                                          />
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </details>
                              )}
                            </div>
                          )}
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
};
