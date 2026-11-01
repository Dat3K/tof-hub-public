'use client';

import { localized, translateUiText} from '@tof-hub/i18n';
import { fillText, localeText } from '@/lib/i18n/text';
import React, { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from 'react';
import { useI18n } from '@/lib/i18n';
import { EncounterChoice, ExportButton, MediaLightbox, setStoredServerMode } from '@tof-hub/ui';
import { PillSwitcher } from '@/components/pill-switcher/pill-switcher';
import { gameAsset } from '@tof-hub/game-assets';
import { BossDefenses, BossStatsToggle, useBossStatsVisible } from '../components/boss-defenses';
import type { FceViewProps, FceMode, FceBossItem, FceMechanicItem } from './fce-types';
import { FCE_COPY } from './fce-copy';
import { mergeFceData, getDefaultBossSlug, toBossUrlHash, resolveBossSlugFromHash } from './fce-data';
import { exportFceBossCard } from './fce-export';
import { renderFceMechanicText } from './fce-rich-text';
import { useSiteHeaderInset } from '@/components/site-shell/use-site-header-inset';
import styles from './fce.module.css';

const SCENE_WIDTH = 1920;
const SCENE_HEIGHT = 1080;

function resolveAsset(path: string | undefined): string {
  if (!path) return '';
  try {
    return gameAsset(path);
  } catch {
    return path;
  }
}

function bossDisplayName(boss: FceBossItem, locale: string): string {
  if (locale === 'ru') return boss.name_ru || boss.name;
  return boss.l10n?.[locale]?.name || boss.name;
}

/** Game text of the culture, merged over the English list so unmatched mechanics keep their English wording. */
function localizedMechanics(boss: FceBossItem, locale: string): FceMechanicItem[] {
  const own = boss.l10n?.[locale]?.mechanics;
  if (!own?.length) return boss.mechanics;
  const byIndex = new Map(own.map(item => [item.index, item]));
  return boss.mechanics.map(item => byIndex.get(item.index) ?? item);
}

export function FceView({ initialData, initialCards, initialMode, initialBoss, statIcons }: FceViewProps) {
  const { visible: statsVisible, toggle: toggleStats } = useBossStatsVisible();
  const headerInset = useSiteHeaderInset(true);
  const { locale: activeLocale } = useI18n();
  const currentLocale = activeLocale;
  const copy = localized(FCE_COPY, currentLocale);
  const isRu = currentLocale === 'ru';

  // Seed mode from the server-parsed ?mode= so a shared mmo link renders
  // the mmo roster immediately. The boss hash stays client-side (hashes
  // never reach the server) and is applied by the mount effect below.
  const [mode, setMode] = useState<FceMode>(initialMode ?? 'standard');
  const [selectedSlug, setSelectedSlug] = useState<string>(() => {
    return initialBoss || getDefaultBossSlug(initialMode === 'mmo' ? 'mmo' : 'standard', initialCards?.[initialMode === 'mmo' ? 'mmo' : 'standard']);
  });
  const [rowCount, setRowCount] = useState<number>(3);
  const [isRendering, setIsRendering] = useState<boolean>(false);
  const [artOpen, setArtOpen] = useState(false);
  const hasInitializedSelectionRef = useRef(false);

  const shellRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  const visualRef = useRef<HTMLDivElement>(null);

  // Sync URL params without full page reload
  const syncUrl = useCallback((nextMode: FceMode, nextSlug: string) => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (nextMode === 'mmo') {
      params.set('mode', 'mmo');
    } else {
      params.delete('mode');
    }
    if (nextSlug) params.set('boss', nextSlug);
    else params.delete('boss');
    const q = params.toString() ? `?${params.toString()}` : '';
    const h = nextSlug ? `#${toBossUrlHash(nextSlug)}` : '';
    window.history.replaceState(null, '', `${window.location.pathname}${q}${h}`);
  }, []);

  // Initialize mode & hash from URL on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const m = params.get('mode');
    const isMmo = m === 'mmo';
    setMode(isMmo ? 'mmo' : 'standard');

    const hashSlug = params.get('boss') || window.location.hash.replace(/^#/, '').trim();
    if (isMmo) {
      const mmoBosses = (initialCards?.mmo ?? mergeFceData(null, 'mmo'));
      const resolvedMmo = hashSlug ? resolveBossSlugFromHash(hashSlug, mmoBosses) : null;
      if (resolvedMmo) {
        setSelectedSlug(resolvedMmo);
        if (!params.get('boss') || toBossUrlHash(resolvedMmo) !== hashSlug) {
          syncUrl('mmo', resolvedMmo);
        }
      } else {
        const defaultMmoSlug = getDefaultBossSlug('mmo', initialCards?.mmo);
        setSelectedSlug(defaultMmoSlug);
        syncUrl('mmo', defaultMmoSlug);
      }
    } else {
      const standardBosses = (initialCards?.standard ?? mergeFceData(initialData, 'standard'));
      const resolvedStandard = hashSlug ? resolveBossSlugFromHash(hashSlug, standardBosses) : null;
      if (resolvedStandard) {
        setSelectedSlug(resolvedStandard);
        if (!params.get('boss') || toBossUrlHash(resolvedStandard) !== hashSlug) {
          syncUrl('standard', resolvedStandard);
        }
      } else {
        // A visit without a link opens on the latest added boss (the saved last boss is not restored).
        setSelectedSlug(getDefaultBossSlug('standard', initialCards?.standard));
      }
    }
    hasInitializedSelectionRef.current = true;

    function onHashChange() {
      const nextHash = window.location.hash.replace(/^#/, '').trim();
      if (nextHash) {
        const nextMode = new URLSearchParams(window.location.search).get('mode') === 'mmo' ? 'mmo' : 'standard';
        const list = initialCards?.[nextMode] ?? mergeFceData(nextMode === 'standard' ? initialData : null, nextMode);
        const resolved = resolveBossSlugFromHash(nextHash, list);
        if (resolved) { setSelectedSlug(resolved); syncUrl(nextMode, resolved); }
      }
    }

    function onPopState() {
      const currentParams = new URLSearchParams(window.location.search);
      const nextIsMmo = currentParams.get('mode') === 'mmo';
      setMode(nextIsMmo ? 'mmo' : 'standard');
      const h = currentParams.get('boss') || window.location.hash.replace(/^#/, '').trim();
      if (h) {
        setSelectedSlug(h);
      } else {
        setSelectedSlug(getDefaultBossSlug(nextIsMmo ? 'mmo' : 'standard', initialCards?.[nextIsMmo ? 'mmo' : 'standard']));
      }
    }

    window.addEventListener('hashchange', onHashChange);
    window.addEventListener('popstate', onPopState);

    return () => {
      window.removeEventListener('hashchange', onHashChange);
      window.removeEventListener('popstate', onPopState);
    };
  }, [syncUrl, initialData, initialCards]);

  // Boss list based on current mode
  const bosses: FceBossItem[] = useMemo(() => {
    const list = initialCards?.[mode] ?? mergeFceData(mode === 'standard' ? initialData : null, mode);
    return list;
  }, [mode, initialData, initialCards]);

  // Ensure selected slug exists in current mode. URL hashes use the short
  // season-less form (`#merbelle`); resolve them to full slugs, with the
  // latest season winning when a base name spans seasons.
  useEffect(() => {
    if (bosses.length === 0) return;
    const resolved = resolveBossSlugFromHash(selectedSlug, bosses);
    if (!resolved) {
      setSelectedSlug(getDefaultBossSlug(mode, bosses));
      return;
    }
    if (resolved !== selectedSlug) {
      setSelectedSlug(resolved);
      if (typeof window !== 'undefined') {
        const hash = window.location.hash.replace(/^#/, '').trim();
        if (hash && hash !== toBossUrlHash(resolved)) {
          syncUrl(mode, resolved);
        }
      }
    }
  }, [bosses, mode, selectedSlug, syncUrl]);

  // Reopen the last boss selected in standard FCE mode unless the URL explicitly
  // points to a boss via its hash.
  useEffect(() => {
    if (!hasInitializedSelectionRef.current || typeof window === 'undefined') return;
    if (mode === 'mmo') return;
    if (!bosses.some((boss) => boss.slug === selectedSlug)) return;
    window.localStorage.setItem('tof_fce_last_boss_standard', selectedSlug);
  }, [bosses, mode, selectedSlug]);


  // Handle Mode Toggle
  const handleModeChange = useCallback((nextMode: FceMode) => {
    setMode(nextMode);
    const nextList = initialCards?.[nextMode] ?? mergeFceData(nextMode === 'standard' ? initialData : null, nextMode);

    // Preserve the currently selected boss across modes by matching base slug / hash
    const currentCandidate =
      selectedSlug || (typeof window !== 'undefined' ? window.location.hash.replace(/^#/, '') : '');
    const resolvedInNext = currentCandidate ? resolveBossSlugFromHash(currentCandidate, nextList) : null;

    let targetSlug: string;
    if (resolvedInNext) {
      targetSlug = resolvedInNext;
    } else if (nextMode === 'mmo') {
      targetSlug = getDefaultBossSlug('mmo', nextList);
    } else {
      targetSlug = getDefaultBossSlug('standard', nextList);
    }

    setSelectedSlug(targetSlug);
    syncUrl(nextMode, targetSlug);
  }, [initialData, initialCards, selectedSlug, syncUrl]);

  // Handle Boss Select
  const handleBossSelect = useCallback((slug: string) => {
    setSelectedSlug(slug);
    syncUrl(mode, slug);
  }, [mode, syncUrl]);

  // Keyboard navigation for switching bosses with ArrowLeft / ArrowRight
  useEffect(() => {
    function handleGlobalKeyDown(e: KeyboardEvent) {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        const idx = bosses.findIndex((b) => b.slug === selectedSlug);
        if (idx !== -1 && idx < bosses.length - 1) {
          e.preventDefault();
          handleBossSelect(bosses[idx + 1].slug);
        }
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        const idx = bosses.findIndex((b) => b.slug === selectedSlug);
        if (idx > 0) {
          e.preventDefault();
          handleBossSelect(bosses[idx - 1].slug);
        }
      }
    }

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [bosses, selectedSlug, handleBossSelect]);

  // Responsive row count & scaling
  const updateSceneScale = useCallback(() => {
    if (typeof window === 'undefined') return;
    const width = window.innerWidth;
    // Original roster: three scrolling rows on every width (phones included); MMO season rows keep their own layout.
    if (mode !== 'mmo') setRowCount(3);
    else setRowCount(width <= 760 ? 1 : 2);

    const shell = shellRef.current;
    const viewport = viewportRef.current;
    if (!shell || !viewport) return;

    const shellRect = shell.getBoundingClientRect();
    const availableWidth = Math.min(
      shell.clientWidth || shellRect.width || (window.innerWidth - 32),
      1520
    );
    const topOffset = Math.max(0, shellRect.top + window.scrollY);
    const availableHeight = Math.max(window.innerHeight - topOffset - 48, 1);
    const scaleByWidth = availableWidth / SCENE_WIDTH;
    const scaleByHeight = availableHeight / SCENE_HEIGHT;

    const scale = Math.min(scaleByWidth, scaleByHeight, 0.7916);

    viewport.style.width = `${Math.round(SCENE_WIDTH * scale)}px`;
    viewport.style.height = `${Math.round(SCENE_HEIGHT * scale)}px`;
    viewport.style.setProperty('--fce-scale', scale.toFixed(5));
    viewport.setAttribute('data-ready', 'true');
  }, [mode]);

  useLayoutEffect(() => {
    updateSceneScale();
  }, [updateSceneScale, selectedSlug]);

  useEffect(() => {
    updateSceneScale();
    const handleResize = () => updateSceneScale();
    window.addEventListener('resize', handleResize);

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && shellRef.current) {
      ro = new ResizeObserver(() => {
        updateSceneScale();
      });
      ro.observe(shellRef.current);
    }

    const rafId = requestAnimationFrame(updateSceneScale);
    const timerId = setTimeout(updateSceneScale, 100);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (ro) ro.disconnect();
      cancelAnimationFrame(rafId);
      clearTimeout(timerId);
    };
  }, [updateSceneScale]);

  // Active Boss
  const activeBoss = useMemo(() => {
    return bosses.find((b) => b.slug === selectedSlug) || bosses[0];
  }, [bosses, selectedSlug]);

  // Partition bosses into rows for switcher (standard mode)
  const rows = useMemo(() => {
    const safeCount = Math.max(1, Math.min(rowCount, bosses.length || 1));
    const result: FceBossItem[][] = Array.from({ length: safeCount }, () => []);
    bosses.forEach((b, idx) => {
      result[idx % safeCount].push(b);
    });
    return result.filter((r) => r.length > 0);
  }, [bosses, rowCount]);

  // Group bosses by season for MMO mode (S1, S2, S3, S4...)
  interface SeasonRow {
    season: number;
    bosses: FceBossItem[];
  }

  const seasonRows = useMemo<SeasonRow[]>(() => {
    if (mode !== 'mmo') return [];
    const seasonsMap = new Map<number, FceBossItem[]>();
    bosses.forEach((b) => {
      const s = b.season || 1;
      if (!seasonsMap.has(s)) {
        seasonsMap.set(s, []);
      }
      seasonsMap.get(s)!.push(b);
    });
    const sortedSeasons = Array.from(seasonsMap.keys()).sort((a, b) => a - b);
    return sortedSeasons.map((s) => ({
      season: s,
      bosses: seasonsMap.get(s)!.sort((a, b) => (a.ladder_level ?? 0) - (b.ladder_level ?? 0)),
    }));
  }, [bosses, mode]);


  const mmoSwitcherRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logic for MMO season rows:
  // Default to showing the latest seasons (scrolled to bottom),
  // allowing user to scroll UP to see earlier seasons (e.g. Season 1).
  useEffect(() => {
    if (mode !== 'mmo') return;
    const container = mmoSwitcherRef.current;
    if (!container) return;

    const latestSeasonRow = seasonRows[seasonRows.length - 1];
    const isLatestSeason = Boolean(latestSeasonRow?.bosses.some((b) => b.slug === selectedSlug));

    const doScroll = () => {
      const el = mmoSwitcherRef.current;
      if (!el) return;
      if (isLatestSeason) {
        el.scrollTo({ top: el.scrollHeight, behavior: 'instant' as ScrollBehavior });
        el.scrollTop = el.scrollHeight;
      } else {
        const activeChip = el.querySelector<HTMLElement>('[aria-pressed="true"]');
        if (activeChip) {
          activeChip.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        } else {
          el.scrollTo({ top: el.scrollHeight, behavior: 'instant' as ScrollBehavior });
          el.scrollTop = el.scrollHeight;
        }
      }
    };

    doScroll();

    const rafId = requestAnimationFrame(doScroll);
    const timerId = setTimeout(doScroll, 80);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timerId);
    };
  }, [mode, seasonRows, selectedSlug]);

  // Download Handler (screenshots the live card DOM, like legacy).
  const handleDownload = useCallback(async () => {
    if (!activeBoss || isRendering) return;
    try {
      await exportFceBossCard(
        activeBoss,
        currentLocale,
        setIsRendering,
        mode,
        viewportRef.current
      );
    } catch (e) {
      console.error('[FCE] Export failed:', e);
      const detail = e instanceof Error && e.message ? `: ${e.message}` : '';
      alert(`${copy.downloadError}${detail}`);
    }
  }, [activeBoss, currentLocale, isRendering, copy.downloadError, mode]);

  const displayName = activeBoss ? bossDisplayName(activeBoss, currentLocale) : '';

  const mechanicsList = activeBoss
    ? ((isRu && activeBoss.ru_mechanics && activeBoss.ru_mechanics.length > 0)
        ? activeBoss.ru_mechanics
        : localizedMechanics(activeBoss, currentLocale))
    : [];

  // Match the legacy card's content fitting: center shorter mechanics blocks
  // within the available copy area and shrink overflowing blocks/names.
  useLayoutEffect(() => {
    const copyElement = copyRef.current;
    const visualElement = visualRef.current;
    if (!activeBoss || !copyElement || !visualElement) return;

    const baseTop = activeBoss.copy_y ?? 220;
    const copyScale = activeBoss.copy_scale ?? 1;
    copyElement.style.setProperty('--fce-copy-scale', String(copyScale));
    const naturalHeight = copyElement.scrollHeight;
    const availableHeight = SCENE_HEIGHT - baseTop;
    const centeredOffset = Math.max(0, (availableHeight - naturalHeight * copyScale) / 2);
    const centeredTop = baseTop + Math.min(42, centeredOffset);
    const overflowTop = Math.max(18, 916 - naturalHeight);
    const copyTop = naturalHeight > 696 ? overflowTop : centeredTop;

    copyElement.style.setProperty('--fce-copy-y', `${copyTop}px`);
    const finalAvailableHeight = SCENE_HEIGHT - copyTop;
    const scaledHeight = copyElement.scrollHeight * copyScale;
    if (scaledHeight > finalAvailableHeight) {
      const fittedScale = Math.max(0.84, finalAvailableHeight / copyElement.scrollHeight);
      copyElement.style.setProperty('--fce-copy-scale', fittedScale.toFixed(4));
    }

    visualElement.style.setProperty('--fce-name-scale', String(activeBoss.name_scale ?? 1));
    const nameElement = visualElement.querySelector<HTMLElement>(`.${styles.cardName}`);
    const nameWidth = activeBoss.name_width ?? 620;
    if (nameElement && nameElement.scrollWidth > nameWidth) {
      const fittedScale = Math.max(0.72, nameWidth / nameElement.scrollWidth);
      visualElement.style.setProperty('--fce-name-scale', fittedScale.toFixed(4));
    }
  }, [activeBoss, displayName, mechanicsList, currentLocale]);

  const bossArtSrc = activeBoss
    ? resolveAsset(activeBoss.displayWebpUrl || activeBoss.art)
    : '';

  return (
    <div className={styles.container} style={{ '--fce-header-inset': `${headerInset}px` } as React.CSSProperties}>
      <div className={styles.layout}>
        {/* Hero Section */}
        <section className={styles.hero} id="overview" aria-label={copy.title}>
          <div className={styles.heroContent}>
            <p className={styles.heroEyebrow}>{copy.eyebrow}</p>
            <h1 className={styles.heroTitle}>{copy.title}</h1>
          </div>

          {/* Game Mode Switcher */}
          <PillSwitcher
            mode={mode}
            onChange={(next) => {
              setStoredServerMode(next === 'mmo' ? 'mmo' : 'gacha');
              handleModeChange(next);
            }}
            originalLabel="Gacha"
            label={copy.gameMode}
            mmoLabel={copy.mmoMode}
            ariaLabel={copy.gameMode}
          />
        </section>

        {/* Boss Switcher */}
        <section className={styles.switcherSection} id="bosses" aria-label={translateUiText("Boss Selector", activeLocale)}>
          {mode === 'mmo' ? (
            <div className={styles.mmoSwitcher} ref={mmoSwitcherRef}>
              {seasonRows.map((sRow) => (
                <div key={sRow.season} className={styles.seasonRow} data-season={sRow.season}>
                  <span
                    className={`${styles.seasonBadge} ${
                      sRow.season === 1
                        ? styles.seasonBadge1
                        : sRow.season === 2
                        ? styles.seasonBadge2
                        : sRow.season === 3
                        ? styles.seasonBadge3
                        : styles.seasonBadge4
                    }`}
                    title={fillText(localeText(currentLocale)('Season {0}'), [sRow.season])}
                  >
                    S{sRow.season}
                  </span>
                  <div className={styles.seasonChips}>
                    {sRow.bosses.map((boss) => {
                      const isActive = boss.slug === selectedSlug;
                      const bName = bossDisplayName(boss, currentLocale);
                      const avatarSrc = resolveAsset(boss.cardThumbnail || boss.preview || boss.art);

                      return (
                        <EncounterChoice
                          key={boss.slug}
                          label={bName}
                          image={avatarSrc || null}
                          active={isActive}
                          title={boss.ladder_level == null ? bName : `${bName} · Lv. ${boss.ladder_level}`}
                          aria-label={boss.ladder_level == null ? bName : fillText(localeText(currentLocale)('{0} Level {1}'), [bName, boss.ladder_level])}
                          onClick={() => handleBossSelect(boss.slug)}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}

            </div>
          ) : (
            <div className={styles.switcher}>
              {rows.map((row, rowIdx) => (
                <div key={rowIdx} className={styles.switcherRow}>
                  {row.map((boss) => {
                    const isActive = boss.slug === selectedSlug;
                    const bName = bossDisplayName(boss, currentLocale);
                    const avatarSrc = resolveAsset(boss.cardThumbnail || boss.preview || boss.art);

                    return (
                      <EncounterChoice
                        key={boss.slug}
                        label={bName}
                        image={avatarSrc || null}
                        active={isActive}
                        title={bName}
                        aria-label={bName}
                        onClick={() => handleBossSelect(boss.slug)}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Boss Card Viewport */}
        <section className={styles.cardShell} ref={shellRef}>
          {activeBoss ? (
            <div className={styles.cardViewport} ref={viewportRef}>
              <article className={`${styles.card} ${mode === 'mmo' ? styles.cardMmo : ''}`} aria-label={fillText(localeText(currentLocale)('{0} Guide'), [displayName])}>
                <div className={styles.cardSky} />
                <div className={styles.cardFog} />
                <div className={styles.cardWash} />
                <div className={styles.cardSignature}>@kritik</div>
                {statsVisible && activeBoss.last_phase && mode !== 'mmo' && <BossDefenses
                  className={styles.cardDefenses}
                  style={{'--fce-copy-width': `${activeBoss.copy_width ?? 1300}px`} as React.CSSProperties}
                  label={displayName}
                  phase={activeBoss.last_phase.phase}
                  hpIcon={statIcons?.hp}
                  critIcon={statIcons?.crit}
                  data={{resistPct: activeBoss.last_phase.derived.resistPct, finalCritDefPct: activeBoss.last_phase.derived.finalCritDefPct, maxHealth: activeBoss.last_phase.fields.MaxHealth ?? null}}
                />}

                {/* Left Mechanics Copy */}
                <div
                  className={styles.cardCopy}
                  ref={copyRef}
                  style={
                    {
                      '--fce-copy-y': `${activeBoss.copy_y ?? 220}px`,
                      '--fce-copy-width': `${activeBoss.copy_width ?? 1300}px`,
                      '--fce-copy-scale': String(activeBoss.copy_scale ?? 1),
                    } as React.CSSProperties
                  }
                >
                  {mechanicsList.map((mech) => (
                    <div key={mech.index} className={styles.cardLine}>
                      <p className={styles.cardText}>
                        <span className={styles.cardIndex}>{mech.index}.</span>
                        <span>{renderFceMechanicText(mech.html || mech.text)}</span>
                      </p>
                    </div>
                  ))}
                </div>

                {/* Right Visual Art & Title */}
                <div
                  className={styles.cardVisual}
                  ref={visualRef}
                  style={
                    {
                      '--fce-art-scale': String(activeBoss.art_scale ?? 1.08),
                      '--fce-art-x': `${activeBoss.art_x ?? -96}px`,
                      '--fce-art-y': `${activeBoss.art_y ?? 0}px`,
                      '--fce-name-right': `${activeBoss.name_right ?? 0}px`,
                      '--fce-name-y': `${activeBoss.name_y ?? 38}px`,
                      '--fce-name-width': `${activeBoss.name_width ?? 620}px`,
                      '--fce-name-scale': String(activeBoss.name_scale ?? 1),
                      '--fce-name-color': activeBoss.name_color || '#72d4ca',
                    } as React.CSSProperties
                  }
                >
                  {bossArtSrc && (
                    <button
                      type="button"
                      className={styles.cardArtButton}
                      aria-label={localeText(currentLocale)('Open boss artwork', 'Открыть иллюстрацию босса')}
                      onClick={() => setArtOpen(true)}
                    >
                      <img
                        key={activeBoss.slug}
                        className={styles.cardArt}
                        src={bossArtSrc}
                        alt={displayName}
                        style={{
                          objectPosition: activeBoss.art_object_position || 'center center',
                        }}
                        onError={(e) => {
                          (e.currentTarget as HTMLElement).style.display = 'none';
                        }}
                      />
                    </button>
                  )}
                  <div className={styles.cardName}>
                    <span className={styles.cardNameWrapper}>
                      {mode === 'mmo' && activeBoss.ladder_level != null && (
                        <span className={styles.cardLevelBadge}>
                          <span className={styles.cardLevelBadgeText}>
                            {translateUiText('Lv.', currentLocale).toLocaleUpperCase()} {activeBoss.ladder_level}
                          </span>
                        </span>
                      )}
                      {displayName}
                    </span>
                  </div>


                </div>
              </article>
            </div>
          ) : (
            <div className={styles.cardLoader}>{copy.noBoss}</div>
          )}

        </section>
      </div>

      {bossArtSrc && (
        <MediaLightbox
          isOpen={artOpen}
          onClose={() => setArtOpen(false)}
          src={bossArtSrc}
          webpSrc={bossArtSrc}
          showPngDownload={false}
          downloadWebpLabel={isRu ? 'Скачать WebP' : translateUiText('Download WebP', currentLocale)}
          title={displayName}
          alt={displayName}
          zoomable={false}
          locale={currentLocale}
        />
      )}

      {/* Floating Download Button (Fixed to bottom-right of viewport, matching legacy) */}
      {activeBoss && (
        <div className={styles.exportBar}>
          {activeBoss.last_phase && mode !== 'mmo' && <BossStatsToggle visible={statsVisible} onToggle={toggleStats} />}
          <ExportButton
            aria-label={copy.downloadAria}
            busy={isRendering}
            onClick={handleDownload}
          >
            {isRendering ? copy.rendering : copy.download}
          </ExportButton>
        </div>
      )}
    </div>
  );
}

