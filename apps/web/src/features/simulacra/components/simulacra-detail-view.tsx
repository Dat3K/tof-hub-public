"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { translateUiText } from '@tof-hub/i18n';
import { Lightbox } from "@tof-hub/ui";
import { ErrorState } from "@/components/site-shell";
import type { SimulacraDetailViewProps } from "../types";
import { SimulacraDetailNav } from "./simulacra-detail-nav";
import { SimulacraHeroCard } from "./simulacra-hero-card";
import { SimulacraAdvancementsSection } from "./simulacra-advancements-section";
import { SimulacraTraitsSection } from "./simulacra-traits-section";
import { SimulacraPassivesSection } from "./simulacra-passives-section";
import { SimulacraMatrixSection } from "./simulacra-matrix-section";
import { SimulacraSkillsSection } from "./simulacra-skills-section";
import { SimulacraAssetsSection } from "./simulacra-assets-section";
import { SimulacraDevSection } from "./simulacra-dev-section";
import { SimulacraCharacterChangelogSection } from "./simulacra-character-changelog-section";
import { SimulacraEfficiencyRadarSection } from "./simulacra-efficiency-radar-section";
import { createSimulacraKeywordMatcher } from "../utils/keyword-links";
import { useAnimatedDetails } from "../../info-sections/common/use-animated-details";
import styles from "../simulacra.module.css";

export const SimulacraDetailView: React.FC<SimulacraDetailViewProps> = ({
  character,
  roster,
  locale,
  serverMode,
  strings,
  onBack,
  onSelectCharacter,
  detailLoadError,
}) => {
  const isMmo =
    serverMode === "mmo" || character.server_mode === "mmo" || character.edition === "mmo";
  const keywordMatcher = useMemo(() => createSimulacraKeywordMatcher(character), [character]);
  const [weaponLevel, setWeaponLevel] = useState(200);

  const updateHashWithoutScroll = useCallback((anchor: string) => {
    if (typeof window === "undefined" || !anchor) return;
    const cleanAnchor = anchor.replace(/^#/, "");
    const encodedAnchor = encodeURIComponent(cleanAnchor);
    const nextPath = `${window.location.pathname}${window.location.search}#${encodedAnchor}`;
    const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;

    if (nextPath !== currentPath) {
      window.history.replaceState(null, "", nextPath);
    }
  }, []);

  const navigateToHash = useCallback((anchor: string) => {
    if (typeof window === "undefined" || !anchor) return;
    const cleanAnchor = anchor.replace(/^#/, "");
    const target = document.getElementById(cleanAnchor);
    if (!target) {
      // The skill list may be filtered to another category, so the target is
      // not in the DOM yet. Update the URL without native instant scrolling;
      // the skills section will select the category and perform the smooth
      // navigation once the card exists.
      updateHashWithoutScroll(cleanAnchor);
      window.dispatchEvent(new Event("hashchange"));
      return;
    }

    let openedDetails = false;
    if (target instanceof HTMLDetailsElement && !target.open) {
      target.open = true;
      openedDetails = true;
    }
    let parent = target.parentElement;
    while (parent && parent !== document.body) {
      if (parent instanceof HTMLDetailsElement && !parent.open) {
        parent.open = true;
        openedDetails = true;
      }
      parent = parent.parentElement;
    }

    updateHashWithoutScroll(cleanAnchor);
    const scrollToTarget = () => {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      target.classList.remove(styles.simKeywordTargetHighlight);
      void target.offsetWidth;
      target.classList.add(styles.simKeywordTargetHighlight);
      window.setTimeout(() => target.classList.remove(styles.simKeywordTargetHighlight), 2500);
    };

    // Let opened details finish their height animation before starting the
    // scroll, otherwise the layout shift makes the navigation look instant.
    const delay = openedDetails && !window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? 360
      : 0;
    window.setTimeout(scrollToTarget, delay);
  }, [updateHashWithoutScroll]);

  // Lightbox state
  const [lightboxState, setLightboxState] = useState<{
    isOpen: boolean;
    src: string;
    webpSrc?: string;
    caption?: string;
  }>({
    isOpen: false,
    src: "",
  });

  const handleOpenLightbox = (src: string, caption?: string, webpSrc?: string) => {
    setLightboxState({
      isOpen: true,
      src,
      webpSrc,
      caption,
    });
  };

  const handleCloseLightbox = () => {
    setLightboxState((prev) => ({ ...prev, isOpen: false }));
  };

  // Scroll to top whenever character changes
  useEffect(() => {
    setWeaponLevel(200);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  }, [character.id]);

  // Global Escape key handler when Lightbox is NOT open -> Back to Catalog
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !lightboxState.isOpen) {
        e.preventDefault();
        onBack();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxState.isOpen, onBack]);

  useEffect(() => {
    const article = document.querySelector<HTMLElement>('[aria-labelledby="sim-char-hero"]');
    if (!article) return;

    const handleKeywordClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest<HTMLAnchorElement>(".sim-keyword-link[data-keyword-anchor]");
      if (!link) return;
      const anchor = link.dataset.keywordAnchor;
      if (!anchor) return;
      event.preventDefault();
      event.stopPropagation();
      navigateToHash(anchor);
    };

    article.addEventListener("click", handleKeywordClick, true);
    return () => article.removeEventListener("click", handleKeywordClick, true);
  }, [navigateToHash]);

  useEffect(() => {
    const article = document.querySelector<HTMLElement>('[aria-labelledby="sim-char-hero"]');
    if (!article) return;

    const handlePanelClick = (event: MouseEvent) => {
      const eventTarget = event.target;
      if (!(eventTarget instanceof Element)) return;
      if (eventTarget.closest("a, button, input, select, textarea")) return;

      const panel = eventTarget.closest<HTMLElement>("[data-panel-anchor]");
      const anchor = panel?.dataset.panelAnchor;
      if (anchor) updateHashWithoutScroll(anchor);
    };

    article.addEventListener("click", handlePanelClick, true);
    return () => article.removeEventListener("click", handlePanelClick, true);
  }, [character.id, updateHashWithoutScroll]);

  useAnimatedDetails({
    containerSelector: '[aria-labelledby="sim-char-hero"]',
    dependencyKey: character.id,
  });

  useEffect(() => {
    const rawHash = window.location.hash;
    if (!rawHash) return;
    const anchor = decodeURIComponent(rawHash.slice(1));
    const frame = window.requestAnimationFrame(() => navigateToHash(anchor));
    return () => window.cancelAnimationFrame(frame);
  }, [character.id, navigateToHash]);

  return (
    <article className={styles.simDetailContainer} aria-labelledby="sim-char-hero">
      {/* 1. Navigation Header: Back to Grid + Prev/Next Pager */}
      <SimulacraDetailNav
        character={character}
        roster={roster}
        locale={locale}
        strings={strings}
        onBack={onBack}
        onSelectCharacter={onSelectCharacter}
      />

      {/* 2. 3-Column Compact Profile Layout */}
      <div className={`${styles.simDetailColumns} ${isMmo ? styles.simDetailColumnsMmo : ""}`}>
        {/* LEFT COLUMN: Hero Card + Advancements */}
        <div className={`${styles.simDetailCol} ${styles.simDetailColLeft}`}>
          <SimulacraHeroCard
            character={character}
            locale={locale}
            serverMode={serverMode}
            strings={strings}
            onOpenLightbox={handleOpenLightbox}
            weaponLevel={weaponLevel}
          />

          {detailLoadError ? (
            <ErrorState
              title={strings.detailErrorTitle}
              message={strings.detailErrorMessage}
              onRetry={detailLoadError.onRetry}
              retryLabel={strings.detailRetry}
              homeHref=""
              className="my-4"
            />
          ) : (
            <SimulacraAdvancementsSection
              character={character}
              locale={locale}
              strings={strings}
              keywordMatcher={keywordMatcher}
            />
          )}
        </div>

        {!detailLoadError && (
          <>
        {/* MIDDLE COLUMN: Awakening Traits + Passives (Gacha) */}
        {!isMmo && (
          <div className={`${styles.simDetailCol} ${styles.simDetailColMid}`}>
            <SimulacraTraitsSection
              character={character}
              locale={locale}
              strings={strings}
              keywordMatcher={keywordMatcher}
            />

            <SimulacraPassivesSection
              character={character}
              locale={locale}
              strings={strings}
              keywordMatcher={keywordMatcher}
            />
          </div>
        )}

        {/* RIGHT COLUMN: Matrix Set Effects (Gacha) OR MMO Passives */}
        <div
          className={`${styles.simDetailCol} ${
            isMmo ? styles.simDetailColMmo : styles.simDetailColRight
          }`}
        >
          {isMmo ? (
            <>
              <SimulacraEfficiencyRadarSection
                character={character}
                locale={locale}
                strings={strings}
              />
              <SimulacraPassivesSection
                character={character}
                locale={locale}
                strings={strings}
                keywordMatcher={keywordMatcher}
              />
            </>
          ) : (
            <SimulacraMatrixSection
              character={character}
              locale={locale}
              strings={strings}
              onOpenLightbox={handleOpenLightbox}
              keywordMatcher={keywordMatcher}
            />
          )}
        </div>

        {/* WEAPON SKILLS SECTION: Flows across columns under Matrix/Traits */}
        <div className={styles.simSkillsSectionWrap}>
          <SimulacraSkillsSection
            character={character}
            locale={locale}
            strings={strings}
            onOpenLightbox={handleOpenLightbox}
            isMmo={isMmo}
            level={weaponLevel}
            onLevelChange={setWeaponLevel}
            keywordMatcher={keywordMatcher}
          />
        </div>
          </>
        )}
      </div>

      {!detailLoadError && (
        <>
          {/* 3. Character Assets & Datamine Media Gallery */}
          <SimulacraAssetsSection
            character={character}
            locale={locale}
            strings={strings}
            onOpenLightbox={handleOpenLightbox}
          />

          {/* 4. Developer Data & Technical IDs */}
          <SimulacraDevSection character={character} locale={locale} strings={strings} />

          {/* 5. Character Changelog (only rendered when history exists) */}
          <SimulacraCharacterChangelogSection character={character} locale={locale} strings={strings} />
        </>
      )}

      {/* 6. Lightbox Modal */}
      <Lightbox
        zoomable={false}
        isOpen={lightboxState.isOpen}
        src={lightboxState.src}
        webpSrc={lightboxState.webpSrc}
        alt={lightboxState.caption || translateUiText('Preview', locale)}
        caption={lightboxState.caption}
        downloadPngLabel={strings.assetsOpenPng}
        downloadWebpLabel={strings.assetsOpenWebp}
        onClose={handleCloseLightbox}
      />
    </article>
  );
};

SimulacraDetailView.displayName = "SimulacraDetailView";
