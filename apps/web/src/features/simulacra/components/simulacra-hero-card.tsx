"use client";

import React, { useEffect, useRef } from "react";
import type { SimulacraDatasetItemRaw } from "@tof-hub/contracts";
import { gameAsset } from "@tof-hub/game-assets";
import { normalizeElement, normalizeRole } from "@tof-hub/game-domain";
import { Badge } from "@tof-hub/ui";
import type { Locale } from "@tof-hub/i18n";
import { fillText, localeText } from '@/lib/i18n/text';
import type { ServerMode } from "@tof-hub/ui";
import type { SimulacraStrings } from "../types";
import { STAT_ICONS, GRADE_ICONS, getStatGrade } from "../constants";
import { getDualElementIconPath } from "../../info-sections/common/element-icons";
import { GameStatGrade } from "../../info-sections/common/game-stat-grade";
import { getWeaponStatsAtLevel } from "../utils/skill-scaling";
import { getElementLabelText, getRoleLabelText } from "../utils/labels";
import styles from "../simulacra.module.css";

interface SimulacraHeroCardProps {
  character: SimulacraDatasetItemRaw;
  locale: Locale;
  serverMode: ServerMode;
  strings: SimulacraStrings;
  onOpenLightbox: (src: string, caption?: string, webpSrc?: string) => void;
  weaponLevel: number;
}

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
    case "dps":
      return "Hotta/Content/Resources/UI/wuqi/icon_qianggong";
    case "tank":
      return "Hotta/Content/Resources/UI/wuqi/icon_fangyu";
    case "benediction":
      return "Hotta/Content/Resources/UI/wuqi/icon_zengyi";
    default:
      return "Hotta/Content/Resources/UI/wuqi/icon_qianggong";
  }
}

function getLegacyHeroArtPath(character: SimulacraDatasetItemRaw): string | null {
  const candidates = [
    character.portrait,
    character.detail_art,
    character.portrait_thumb,
    character.detail_art_thumb,
  ].filter((value): value is string => typeof value === "string" && value.length > 0);

  const xiangqingArt = candidates.find((value) => value.toLowerCase().includes("xiangqing"));
  if (xiangqingArt) return xiangqingArt;

  const imitationMatch = String(character.imitation_id || "").match(/\d+/);
  if (imitationMatch) {
    return `Hotta/Content/Resources/UI/shizhuang/nitai/xiangqing/imitation_${imitationMatch[0]}.webp`;
  }

  return character.portrait || character.detail_art || character.card || character.avatar || null;
}

export const SimulacraHeroCard: React.FC<SimulacraHeroCardProps> = ({
  character,
  locale,
  serverMode,
  strings,
  onOpenLightbox,
  weaponLevel,
}) => {
  const artWrapRef = useRef<HTMLDivElement | null>(null);
  const artImgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const artWrap = artWrapRef.current;
    const artImg = artImgRef.current;
    if (!artWrap || !artImg) return;

    let rafId: number | null = null;
    let targetPanX = 0;
    let targetPanY = 0;
    let currentPanX = 0;
    let currentPanY = 0;
    let currentScale = 1;
    let targetScale = 1;
    let isHovered = false;

    const defaultHoverZoom = 3.6;
    const minZoom = 1;
    const maxZoom = 5.5;

    const updatePanTargets = (clientX: number, clientY: number) => {
      const rect = artWrap.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const normX = Math.min(1, Math.max(-1, ((clientX - rect.left) / rect.width - 0.5) * 2));
      const normY = Math.min(1, Math.max(-1, ((clientY - rect.top) / rect.height - 0.5) * 2));
      const effectiveScale = Math.max(1, targetScale);
      const naturalWidth = artImg.naturalWidth || rect.width;
      const naturalHeight = artImg.naturalHeight || rect.height;
      const coverScale = Math.max(rect.width / naturalWidth, rect.height / naturalHeight);
      const renderWidth = naturalWidth * coverScale;
      const renderHeight = naturalHeight * coverScale;

      let positionX = 0.5;
      let positionY = 0.18;
      const positionParts = window.getComputedStyle(artImg).objectPosition.split(/\s+/);
      const parsePosition = (value: string | undefined, fallback: number) => {
        if (!value) return fallback;
        if (value.endsWith("%")) return parseFloat(value) / 100;
        if (value === "center") return 0.5;
        if (value === "top" || value === "left") return 0;
        if (value === "bottom" || value === "right") return 1;
        const numeric = parseFloat(value);
        return Number.isNaN(numeric) ? fallback : numeric;
      };
      positionX = parsePosition(positionParts[0], positionX);
      positionY = parsePosition(positionParts[1], positionY);

      const unscaledLeft = (rect.width - renderWidth) * positionX;
      const unscaledTop = (rect.height - renderHeight) * positionY;
      const maxPanUp = effectiveScale * (rect.height / 2 - unscaledTop) - rect.height / 2;
      const maxPanDown = rect.height / 2 - effectiveScale * (unscaledTop + renderHeight - rect.height / 2);
      const maxPanLeft = effectiveScale * (rect.width / 2 - unscaledLeft) - rect.width / 2;
      const maxPanRight = rect.width / 2 - effectiveScale * (unscaledLeft + renderWidth - rect.width / 2);
      const restingPanY = Math.max(0, Math.min(maxPanUp, 0.2 * maxPanUp));

      targetPanY =
        normY <= 0
          ? restingPanY + -normY * (maxPanUp - restingPanY)
          : restingPanY + normY * (maxPanDown - restingPanY);
      targetPanX =
        normX <= 0
          ? -normX * maxPanLeft
          : normX * maxPanRight;
    };

    const applyPan = () => {
      if (!isHovered) {
        currentPanX += (0 - currentPanX) * 0.1;
        currentPanY += (0 - currentPanY) * 0.1;
        currentScale += (1 - currentScale) * 0.1;

        if (
          Math.abs(currentPanX) < 0.05 &&
          Math.abs(currentPanY) < 0.05 &&
          Math.abs(currentScale - 1) < 0.005
        ) {
          currentPanX = 0;
          currentPanY = 0;
          currentScale = 1;
          artWrap.style.setProperty("--sim-pan-x", "0px");
          artWrap.style.setProperty("--sim-pan-y", "0px");
          artWrap.style.setProperty("--sim-hero-art-scale", "1");
          artWrap.classList.remove(styles.simCharHeroArtPanning);
          rafId = null;
          return;
        }
      } else {
        currentPanX += (targetPanX - currentPanX) * 0.14;
        currentPanY += (targetPanY - currentPanY) * 0.14;
        currentScale += (targetScale - currentScale) * 0.12;
      }

      artWrap.style.setProperty("--sim-pan-x", `${currentPanX.toFixed(2)}px`);
      artWrap.style.setProperty("--sim-pan-y", `${currentPanY.toFixed(2)}px`);
      artWrap.style.setProperty("--sim-hero-art-scale", currentScale.toFixed(3));
      rafId = window.requestAnimationFrame(applyPan);
    };

    const startTracking = (event: MouseEvent) => {
      isHovered = true;
      artWrap.classList.add(styles.simCharHeroArtPanning);
      if (targetScale < 2) targetScale = defaultHoverZoom;
      updatePanTargets(event.clientX, event.clientY);
      if (!rafId) rafId = window.requestAnimationFrame(applyPan);
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (!isHovered) startTracking(event);
      updatePanTargets(event.clientX, event.clientY);
      if (!rafId) rafId = window.requestAnimationFrame(applyPan);
    };

    const handleMouseLeave = () => {
      isHovered = false;
      targetPanX = 0;
      targetPanY = 0;
      targetScale = 1;
      if (!rafId) rafId = window.requestAnimationFrame(applyPan);
    };

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      targetScale = Math.min(maxZoom, Math.max(minZoom, targetScale + (event.deltaY < 0 ? 0.4 : -0.4)));
      if (!isHovered) startTracking(event as unknown as MouseEvent);
      updatePanTargets(event.clientX, event.clientY);
      if (!rafId) rafId = window.requestAnimationFrame(applyPan);
    };

    artWrap.addEventListener("mouseenter", startTracking);
    artWrap.addEventListener("mousemove", handleMouseMove);
    artWrap.addEventListener("mouseleave", handleMouseLeave);
    artWrap.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      artWrap.removeEventListener("mouseenter", startTracking);
      artWrap.removeEventListener("mousemove", handleMouseMove);
      artWrap.removeEventListener("mouseleave", handleMouseLeave);
      artWrap.removeEventListener("wheel", handleWheel);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, []);

  const isRu = locale === "ru";
  const charName = isRu
    ? character.name_ru || character.name || character.name_en || character.id
    : character.name_en || character.name || character.id;

  const weaponName = isRu
    ? character.weapon_name_ru || character.weapon_name || character.weapon_name_en || "—"
    : character.weapon_name_en || character.weapon_name || "—";

  const rarity = (character.rarity || "SSR").toUpperCase();
  const rarityNorm = (rarity === "SR" ? "sr" : "ssr") as "ssr" | "sr";

  const elementNorm = normalizeElement(character.element).toLowerCase();
  const elementVariant = (elementNorm === "physical" ? "phys" : elementNorm) as
    | "phys"
    | "flame"
    | "frost"
    | "volt"
    | "altered";
  const elementLabel = [character.element, character.element_secondary]
    .filter(Boolean)
    .map((value) => getElementLabelText(value, locale).toUpperCase())
    .join(" / ");
  const elementPair = [
    elementNorm,
    normalizeElement(character.element_secondary || "").toLowerCase(),
  ]
    .filter(Boolean)
    .join("-");
  const elementComboClass =
    elementPair === "physical-flame"
      ? styles.simHeroElementPhysicalFlame
      : elementPair === "flame-physical"
        ? styles.simHeroElementFlamePhysical
        : elementPair === "frost-volt"
          ? styles.simHeroElementFrostVolt
          : elementPair === "volt-frost"
            ? styles.simHeroElementVoltFrost
            : "";

  const roleNorm = normalizeRole(character.role || character.resonance).toLowerCase();
  const roleVariant = (roleNorm === "benediction" || roleNorm === "tank" ? roleNorm : "dps") as
    | "dps"
    | "tank"
    | "benediction";
  const roleLabel = getRoleLabelText(character.role || character.resonance, locale).toUpperCase();

  const isMmo =
    serverMode === "mmo" || character.server_mode === "mmo" || character.edition === "mmo";
  const seasonNum =
    typeof character.season === "number" && character.season > 0
      ? character.season
      : parseInt(
          String(character.season || character.season_badge || character.season_tag || "").replace(
            /\D+/g,
            "",
          ),
          10,
        ) || 1;

  // Artwork resolution
  const artPath = getLegacyHeroArtPath(character);
  const portraitSrc = artPath ? gameAsset(artPath) : "/datamine/favicon.svg";
  const portraitPngSrc = artPath ? gameAsset(artPath, "png") : portraitSrc;

  // Weapon icon
  const weaponThumb = character.icon ? gameAsset(character.icon) : null;

  // Element and Role icons
  const dualElementIconPath = getDualElementIconPath(character.element, character.element_secondary);
  const elementIconSrc = dualElementIconPath || character.element_combo_icon
    ? gameAsset(dualElementIconPath || character.element_combo_icon || "")
    : gameAsset(`Hotta/Content/Resources/UI/wuqi/icon_element_${getElemIconSuffix(elementNorm)}`);

  const roleIconSrc = character.role_icon
    ? gameAsset(character.role_icon)
    : gameAsset(getRoleIconPath(roleNorm));

  // Base and Max Stats
  const baseStats = character.base_stats as any;
  const maxStats = (character.max_stats || baseStats?.max_stats) as any;
  const weaponStats = getWeaponStatsAtLevel(character, weaponLevel);

  const shatterVal = maxStats?.shatter ?? baseStats?.shatter ?? "—";
  const shatterGrade =
    baseStats?.shatter_grade || maxStats?.shatter_grade || getStatGrade(shatterVal);

  const chargeVal = maxStats?.charge ?? baseStats?.charge ?? "—";
  const chargeGrade = baseStats?.charge_grade || maxStats?.charge_grade || getStatGrade(chargeVal);

  const statLevelLabel = (template: string) => template.replace(/\b200\b/, String(weaponStats.level));
  const atkVal = weaponStats.attack;
  const hpVal = weaponStats.hp;

  const hasDef = maxStats?.resistance !== undefined || maxStats?.def !== undefined;
  const thirdStatVal = hasDef
    ? weaponStats.resistance
    : weaponStats.crit;
  const thirdStatLabel = hasDef ? strings.statDefMax : strings.statCritMax;
  const thirdStatIcon = hasDef ? STAT_ICONS.resist : STAT_ICONS.crit;

  return (
    <div
      className={`sim-header-card ${styles.simCharHero} ${isMmo ? styles.simCharHeroMmo : ""}`}
      id="sim-char-hero"
    >
      {/* Hero Art Wrap */}
      <div ref={artWrapRef} className={styles.simCharHeroArtWrap}>
        <img
          ref={artImgRef}
          src={portraitSrc}
          alt={charName}
          className={styles.simCharHeroArt}
          loading="eager"
          decoding="async"
          onClick={() => onOpenLightbox(portraitPngSrc, charName, portraitSrc)}
          title={`${charName} (${strings.lightboxZoomIn})`}
        />

        {/* Top-Left Badges: Element & Role */}
        <div className={styles.simCharHeroBadges}>
          <Badge
            variant={elementVariant}
            size="sm"
            className={`${styles.simHeroBadge} ${styles.simHeroElementBadge} ${elementComboClass}`}
            title={elementLabel}
            icon={
              <img
                src={elementIconSrc}
                alt=""
                className={styles.badgeIcon}
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = "none";
                }}
              />
            }
          >
            <span className={styles.simHeroBadgeText}>{elementLabel}</span>
          </Badge>

          <Badge
            variant={roleVariant}
            size="sm"
            className={`${styles.simHeroBadge} ${styles.simHeroRoleBadge}`}
            title={roleLabel}
            icon={
              <img
                src={roleIconSrc}
                alt=""
                className={styles.badgeIcon}
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = "none";
                }}
              />
            }
          >
            <span className={styles.simHeroBadgeText}>{roleLabel}</span>
          </Badge>
        </div>

        {/* Top-Right Badges: MMO Season & Rarity */}
        <div className={styles.simCharHeroRarity}>
          {isMmo && (
            <span
              className={`${styles.seasonBadge} ${
                seasonNum === 1 ? styles.seasonBadge1 : styles.seasonBadge2
              }`}
                        title={fillText(localeText(locale)('Season {0}'), [seasonNum])}
            >
              S{seasonNum}
            </span>
          )}
          <Badge
            variant={rarityNorm}
            size="sm"
            className={`${styles.simHeroBadge} ${styles.simHeroRarityBadge}`}
          >
            {rarity}
          </Badge>
        </div>

        {/* Bottom-Right Corner Badge: Weapon icon (Click to zoom) */}
        {weaponThumb && (
          <button
            type="button"
            className={styles.simCharHeroWeaponBadge}
            onClick={(e) => {
              e.stopPropagation();
              onOpenLightbox(weaponThumb, `${charName} — ${weaponName}`);
            }}
            aria-label={`${weaponName} (${strings.lightboxZoomIn})`}
            title={`${weaponName} (${strings.lightboxZoomIn})`}
          >
            <img src={weaponThumb} alt={weaponName} loading="lazy" />
          </button>
        )}
      </div>

      {/* Hero Body */}
      <div className={styles.simCharHeroBody}>
        <div className={styles.simCharHeroHeader}>
          <div className={styles.simCharHeroNameRow}>
            <h2 className={styles.simCharHeroName}>{charName}</h2>
            {!isMmo && (
              <div className={styles.simHeroPrimaryStats}>
                <div
                  className={`${styles.simHeroPrimaryStat} ${styles.simHeroPrimaryStatShatter}`}
                >
                  <span className={styles.simHeroPrimaryLabel}>{strings.statShatter}</span>
                  <span className={styles.simStatBoxValWrap}>
                    {shatterGrade && GRADE_ICONS[shatterGrade] && (
                      <GameStatGrade
                        className={styles.simStatGradeImg}
                        grade={shatterGrade}
                        title={fillText(localeText(locale)('Grade {0}'), [shatterGrade])}
                      />
                    )}
                    <span className={`${styles.simStatBoxVal} ${styles.simHeroPrimaryValueShatter}`}>
                      {String(shatterVal)}
                    </span>
                  </span>
                </div>

                <div className={`${styles.simHeroPrimaryStat} ${styles.simHeroPrimaryStatCharge}`}>
                  <span className={styles.simHeroPrimaryLabel}>{strings.statCharge}</span>
                  <span className={styles.simStatBoxValWrap}>
                    {chargeGrade && GRADE_ICONS[chargeGrade] && (
                      <GameStatGrade
                        className={styles.simStatGradeImg}
                        grade={chargeGrade}
                        title={fillText(localeText(locale)('Grade {0}'), [chargeGrade])}
                      />
                    )}
                    <span className={`${styles.simStatBoxVal} ${styles.simHeroPrimaryValueCharge}`}>
                      {String(chargeVal)}
                    </span>
                  </span>
                </div>
              </div>
            )}
          </div>
          <div className={styles.simCharHeroWeaponName}>{weaponName}</div>
        </div>

        {/* Base / Max Stats Grid */}
        {!isMmo && <div className={styles.simBaseStatsGrid}>
          {/* ATK */}
          <div className={`${styles.simStatBox} ${styles.simStatBoxAtk}`}>
            <div className={styles.simStatBoxLabel}>
              <img className={styles.simStatBoxIcon} src={gameAsset(STAT_ICONS.atk)} alt="" />
              <span>{statLevelLabel(strings.statAtkMax)}</span>
            </div>
            <div className={styles.simStatBoxVal}>{String(atkVal)}</div>
          </div>

          {/* HP */}
          <div className={`${styles.simStatBox} ${styles.simStatBoxHp}`}>
            <div className={styles.simStatBoxLabel}>
              <img className={styles.simStatBoxIcon} src={gameAsset(STAT_ICONS.hp)} alt="" />
              <span>{statLevelLabel(strings.statHpMax)}</span>
            </div>
            <div className={styles.simStatBoxVal}>{String(hpVal)}</div>
          </div>

          {/* Crit / Resistance */}
          <div className={`${styles.simStatBox} ${styles.simStatBoxCrit}`}>
            <div className={styles.simStatBoxLabel}>
              <img className={styles.simStatBoxIcon} src={gameAsset(thirdStatIcon)} alt="" />
              <span>{statLevelLabel(thirdStatLabel)}</span>
            </div>
            <div className={styles.simStatBoxVal}>{String(thirdStatVal)}</div>
          </div>
        </div>}
      </div>
    </div>
  );
};

SimulacraHeroCard.displayName = "SimulacraHeroCard";
