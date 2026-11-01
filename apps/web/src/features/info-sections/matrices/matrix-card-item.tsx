"use client";

import React from "react";
import { EntityCard, GameBadge as Badge } from "@tof-hub/ui";
import { gameAsset } from "@tof-hub/game-assets";
import { normalizeElement, normalizeRole } from "@tof-hub/game-domain";
import type { MatrixCardItemProps } from "./types";
import { ELEMENT_FILTER_OPTIONS, getDualElementIconPath, ROLE_FILTER_OPTIONS } from "./constants";
import styles from "./matrices.module.css";

export const MatrixCardItem: React.FC<MatrixCardItemProps> = ({
  item,
  locale,
  strings,
  onSelect,
}) => {
  const name =
    locale === "ru"
      ? item.name_ru || item.name || item.name_en || item.id
      : item.name_en || item.name || item.id;

  const rawQuality = (item.quality || "SSR").toUpperCase();
  const quality = (
    rawQuality === "SR" ? "sr" : rawQuality === "R" ? "r" : rawQuality === "N" ? "n" : "ssr"
  ) as "ssr" | "sr" | "r" | "n";

  // Primary Carrier (Carrier 0)
  const carrier0 = item.carriers && item.carriers.length > 0 ? item.carriers[0] : null;
  const ownerWeaponName = carrier0
    ? locale === "ru"
      ? carrier0.weapon_name_ru || carrier0.weapon_name || carrier0.weapon_name_en || ""
      : carrier0.weapon_name_en || carrier0.weapon_name || ""
    : "";

  // Element and Role
  const elementStr = carrier0?.element || "";
  const elementNorm = elementStr ? normalizeElement(elementStr).toLowerCase() : "";
  const elementVariant = (elementNorm === "physical" ? "phys" : elementNorm) as
    "phys" | "flame" | "frost" | "volt" | "altered" | undefined;

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

  // Chip Icon URL
  const chipIconPath = item.icon || item.piece_icon || item.icon_thumb || item.piece_icon_thumb;
  const chipIconUrl = chipIconPath ? gameAsset(chipIconPath) : "/datamine/favicon.svg";

  // Weapon Corner Icon URL
  const weaponIconPath = carrier0?.icon || carrier0?.icon_thumb;
  const weaponIconUrl = weaponIconPath ? gameAsset(weaponIconPath) : null;

  // Element & Role Icon URLs
  const dualElementIconPath = getDualElementIconPath(elementStr, secondaryLabel);
  const elementIconUrl = dualElementIconPath || carrier0?.element_combo_icon
    ? gameAsset(dualElementIconPath || carrier0?.element_combo_icon || "")
    : elementNorm
      ? gameAsset(
          ELEMENT_FILTER_OPTIONS.find((option) => option.id === elementNorm)?.iconPath || "",
        )
      : null;

  const roleIconUrl = carrier0?.role_icon
    ? gameAsset(carrier0.role_icon)
    : roleNorm
      ? gameAsset(ROLE_FILTER_OPTIONS.find((option) => option.id === roleNorm)?.iconPath || "")
      : null;

  const handleClick = (e: React.MouseEvent<HTMLElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
      return;
    }
    e.preventDefault();
    onSelect(item.id);
  };

  const badges: React.ReactNode[] = [];
  if (elementVariant && elementIconUrl) {
    badges.push(
      <Badge
        presentation="icon"
        key="elem"
        variant={elementVariant}
        secondaryElement={secondaryElement}
        size="sm"
        title={carrier0?.element || ""}
        icon={
          <img
            src={elementIconUrl}
            alt=""
            className={styles.badgeIcon}
            loading="lazy"
            onError={(e) => {
              (e.currentTarget as HTMLElement).style.display = "none";
            }}
          />
        }
      >
        <span className="sr-only">{carrier0?.element}</span>
      </Badge>,
    );
  }

  if (roleVariant && roleIconUrl) {
    badges.push(
      <Badge
        presentation="icon"
        key="role"
        variant={roleVariant}
        size="sm"
        title={carrier0?.role || ""}
        icon={
          <img
            src={roleIconUrl}
            alt=""
            className={styles.badgeIcon}
            loading="lazy"
            onError={(e) => {
              (e.currentTarget as HTMLElement).style.display = "none";
            }}
          />
        }
      >
        <span className="sr-only">{carrier0?.role}</span>
      </Badge>,
    );
  }

  return (
    <EntityCard
      id={`matrix-card-${item.id}`}
      dataId={item.id}
      dataName={name}
      title={name}
      rarity={quality}
      href={`/info/matrices#${encodeURIComponent(item.id)}`}
      onClick={handleClick}
      aria-label={`${name} (${rawQuality})`}
      className={styles.matrixCard}
    >
      <div className={styles.matrixCardArtStage}>
        <div className={styles.matrixCardBadgesOverlay}>{badges}</div>

        <div className={styles.matrixCardRarityOverlay}>
          <Badge presentation="icon" variant={quality} size="sm">
            {rawQuality}
          </Badge>
        </div>

        <div className={styles.matrixCardChipFrame}>
          <img
            src={chipIconUrl}
            alt={name}
            loading="lazy"
            decoding="async"
            className={styles.matrixCardChipImg}
            onError={(e) => {
              (e.currentTarget as HTMLElement).style.display = "none";
            }}
          />
        </div>
      </div>

      <div className={styles.matrixCardTitles}>
        <h3 className={styles.matrixCardName} title={name}>
          {name}
        </h3>

        <div className={styles.matrixCardOwner}>
          <span className={styles.matrixCardOwnerName} title={ownerWeaponName || "—"}>
            {ownerWeaponName ? (
              <>
                <span className={styles.matrixCardOwnerIcon} aria-hidden="true">
                  ✦
                </span>
                {ownerWeaponName}
              </>
            ) : (
              "—"
            )}
          </span>

          {weaponIconUrl && (
            <div
              className={styles.weaponCornerBox}
              data-element={elementNorm || undefined}
              title={ownerWeaponName}
            >
              <img
                src={weaponIconUrl}
                alt={ownerWeaponName}
                loading="lazy"
                onError={(e) => {
                  (e.currentTarget.parentElement as HTMLElement).style.display = "none";
                }}
              />
            </div>
          )}
        </div>
      </div>
    </EntityCard>
  );
};
