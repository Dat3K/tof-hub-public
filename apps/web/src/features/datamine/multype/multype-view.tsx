'use client';

import { localized, translateUiText} from '@tof-hub/i18n';
import { type Locale } from '@tof-hub/i18n';
import React, {
  forwardRef,
  memo,
  useState,
  useEffect,
  useLayoutEffect,
  useMemo,
  useCallback,
  useImperativeHandle,
  useRef,
} from 'react';
import Link from 'next/link';
import { CatalogSearch, FilterChip, SortListbox } from '@tof-hub/ui';
import { useI18n } from '@/lib/i18n';
import { determineVersionStatus, useVersionStatus } from '@/lib/version-status';
import { useMultypeData } from '../data/hooks';
import { copyText } from '@/lib/clipboard';
import type {
  MultypeViewProps,
  MultypeMode,
  MultypeRenameFilter,
  MultypeElementFilter,
  MultypePalette,
  MultypeFilterState,
  MultypeValueItem,
} from './multype-types';
import { MULTYPE_COPY, CATEGORY_LABELS_RU } from './multype-copy';
import { mergeMultypeData } from './multype-data';
import {
  buildMultypeViewModel,
  buildGlobalStats,
} from './multype-domain';
import { exportMultypeJson, exportMultypeTableToPng } from './multype-export';
import styles from './multype.module.css';

const DEFAULT_SCALE = 1;
const STORAGE_GUIDE_KEY = 'tof_multype_guide_clicked';
const STORAGE_THEME_KEY = 'tof-multype-theme';

type MultypeTooltipHandle = {
  show: (
    item: MultypeValueItem,
    xOrRect: number | DOMRect,
    yOrIsAi?: number | boolean,
    maybeIsAi?: boolean
  ) => void;
  showLabel: (label: string, x: number, y: number, followsPointer?: boolean) => void;
  move: (x: number, y: number) => void;
  hide: () => void;
  isScrollable: () => boolean;
  scrollBy: (deltaY: number) => void;
  resetScroll: () => void;
};

function estimateTooltipHeight(tooltip: {
  title: string;
  lines: string[];
  isAiMode: boolean;
  manualRenameLabels: string[];
  suitName?: string;
}): number {
  if (!tooltip.lines.length) return 38;
  if (!tooltip.isAiMode) {
    return 36 + tooltip.lines.length * 20 + 20;
  }
  let h = 34; // title
  if (tooltip.lines[0]) h += 24; // confidence
  if (tooltip.suitName) h += 24; // suit block
  if (tooltip.manualRenameLabels && tooltip.manualRenameLabels.length > 0) {
    h += 24 + tooltip.manualRenameLabels.length * 22; // manual block
  }
  if (tooltip.lines[1]) h += 26; // source heading
  const fileCount = Math.max(0, tooltip.lines.length - 2);
  h += fileCount * 24; // each source item
  h += 24; // container padding & borders
  return h;
}

const MultypeHoverTooltip = memo(
  forwardRef<MultypeTooltipHandle, { locale: Locale }>(function MultypeHoverTooltip(
    { locale },
    ref
  ) {
    const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [tooltip, setTooltip] = useState<{
      x: number;
      y: number;
      triggerRect?: { top: number; bottom: number; left: number; right: number };
      title: string;
      lines: string[];
      isAiMode: boolean;
      manualRenameLabels: string[];
      suitName?: string;
      followsPointer: boolean;
    } | null>(null);

    const cancelHide = useCallback(() => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    }, []);

    const scheduleHide = useCallback((delay = 300) => {
      cancelHide();
      hideTimerRef.current = setTimeout(() => {
        if (containerRef.current) {
          containerRef.current.scrollTop = 0;
        }
        setTooltip(null);
      }, delay);
    }, [cancelHide]);

    useEffect(() => () => cancelHide(), [cancelHide]);

    // Ensure scrollTop is reset to 0 whenever tooltip content or target changes
    useLayoutEffect(() => {
      if (containerRef.current) {
        containerRef.current.scrollTop = 0;
      }
    }, [tooltip]);

    useImperativeHandle(
      ref,
      () => ({
        show: (item, xOrRect, yOrIsAi, maybeIsAi) => {
          cancelHide();
          if (containerRef.current) {
            containerRef.current.scrollTop = 0;
          }
          let x = 0;
          let y = 0;
          let triggerRect: { top: number; bottom: number; left: number; right: number } | undefined;
          let isAi = false;

          if (typeof xOrRect === 'object' && xOrRect !== null) {
            const r = xOrRect as DOMRect;
            x = r.left + r.width / 2;
            y = r.top;
            triggerRect = { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
            isAi = Boolean(yOrIsAi);
          } else {
            x = typeof xOrRect === 'number' ? xOrRect : 0;
            y = typeof yOrIsAi === 'number' ? yOrIsAi : 0;
            triggerRect = { top: y, bottom: y, left: x, right: x };
            isAi = Boolean(maybeIsAi);
          }

          setTooltip({
            title: item.tooltipTitle,
            lines: item.tooltipLines,
            isAiMode: isAi,
            manualRenameLabels: item.manualRenameLabels,
            suitName: item.aiGuessSuitName,
            x,
            y,
            triggerRect,
            followsPointer: false,
          });
        },
        showLabel: (title, x, y, followsPointer = false) => {
          cancelHide();
          if (containerRef.current) {
            containerRef.current.scrollTop = 0;
          }
          setTooltip({
            title,
            lines: [],
            isAiMode: false,
            manualRenameLabels: [],
            x,
            y,
            triggerRect: { top: y, bottom: y, left: x, right: x },
            followsPointer,
          });
        },
        move: (x, y) =>
          setTooltip((current) => current?.followsPointer ? { ...current, x, y } : current),
        hide: () => {
          if (containerRef.current) {
            containerRef.current.scrollTop = 0;
          }
          scheduleHide(250);
        },
        resetScroll: () => {
          if (containerRef.current) {
            containerRef.current.scrollTop = 0;
          }
        },
        isScrollable: () => {
          if (!containerRef.current) return false;
          return containerRef.current.scrollHeight > containerRef.current.clientHeight + 2;
        },
        scrollBy: (deltaY: number) => {
          if (containerRef.current) {
            containerRef.current.scrollTop += deltaY;
          }
        },
      }),
      [cancelHide, scheduleHide]
    );

    if (!tooltip) return null;

    const tooltipHalfWidth = Math.min(160, (window.innerWidth - 16) / 2);
    const left = tooltip.followsPointer
      ? Math.max(8, Math.min(tooltip.x + 14, window.innerWidth - 328))
      : Math.max(8 + tooltipHalfWidth, Math.min(tooltip.x, window.innerWidth - 8 - tooltipHalfWidth));

    const triggerTop = tooltip.triggerRect ? tooltip.triggerRect.top : tooltip.y;
    const triggerBottom = tooltip.triggerRect ? tooltip.triggerRect.bottom : tooltip.y;
    const spaceAbove = Math.max(48, triggerTop - 18);
    const spaceBelow = Math.max(48, window.innerHeight - triggerBottom - 18);
    const neededHeight = estimateTooltipHeight(tooltip);

    const fitsAbove = spaceAbove >= neededHeight + 6;
    const fitsBelow = spaceBelow >= neededHeight + 6;

    let placeAbove = false;
    if (!tooltip.followsPointer) {
      if (fitsAbove) {
        placeAbove = true;
      } else if (fitsBelow) {
        placeAbove = false;
      } else {
        placeAbove = spaceAbove >= spaceBelow;
      }
    }

    const top = tooltip.followsPointer
      ? Math.max(8, Math.min(tooltip.y + 18, window.innerHeight - 110))
      : placeAbove ? undefined : triggerBottom + 6;
    const bottom = placeAbove ? `${window.innerHeight - triggerTop + 6}px` : undefined;
    const maxHeight = tooltip.followsPointer
      ? Math.max(80, window.innerHeight - (top ?? 0) - 8)
      : placeAbove ? spaceAbove : spaceBelow;

    return (
      <div
        className={styles.tooltip}
        data-placement={tooltip.followsPointer ? 'pointer' : placeAbove ? 'top' : 'bottom'}
        style={{
          top: top === undefined ? undefined : `${top}px`,
          bottom,
          left: `${left}px`,
          maxHeight: `${maxHeight}px`,
          transform: tooltip.followsPointer ? undefined : 'translateX(-50%)',
        }}
        onPointerEnter={cancelHide}
        onPointerLeave={() => scheduleHide(250)}
        onClick={(e) => e.stopPropagation()}
      >
        <div ref={containerRef} className={styles.tooltipInner}>
          <div className={styles.tooltipTitle}>{tooltip.title}</div>
          {tooltip.lines.length > 0 && (
            <div className={styles.tooltipLines}>
              {tooltip.isAiMode ? (
                <>
                  {tooltip.lines[0] && (
                    <div className={styles.tooltipConfidence}>{tooltip.lines[0]}</div>
                  )}
                  {tooltip.suitName && (
                    <div className={styles.tooltipSuitBlock}>
                      <span className={styles.tooltipSuitLabel}>{localized(MULTYPE_COPY, locale).aiMatrixSet}: </span>
                      <span className={styles.tooltipSuitValue}>{tooltip.suitName}</span>
                    </div>
                  )}
                  {tooltip.manualRenameLabels.length > 0 && (
                    <div className={styles.tooltipManualBlock}>
                      <div className={styles.tooltipManualHeading}>
                        {localized(MULTYPE_COPY, locale).manualRename}
                      </div>
                      {tooltip.manualRenameLabels.map((label) => (
                        <div className={styles.tooltipManualValue} key={label}>{label}</div>
                      ))}
                    </div>
                  )}
                  <div className={styles.tooltipSourceHeading}>{tooltip.lines[1]}</div>
                  {tooltip.lines.slice(2).map((line, i) => (
                    <div className={styles.tooltipSourceItem} key={`${line}-${i}`}>{line}</div>
                  ))}
                </>
              ) : (
                tooltip.lines.map((line, i) => <div key={i}>{line}</div>)
              )}
            </div>
          )}
        </div>
      </div>
    );
  })
);

export function MultypeView({
  initialData,
  initialLocale,
  initialMode = 'ai-guess',
  initialSearch = null,
  initialMainFilter = null,
  initialSubFilter = null,
  initialRenameFilter = null,
  initialElementFilter = null,
  initialPalette = 'dark',
}: MultypeViewProps) {
  const { locale: activeLocale } = useI18n();
  const currentLocale = activeLocale || initialLocale;
  const isRu = currentLocale === 'ru';
  const copy = localized(MULTYPE_COPY, currentLocale);
  const { status: versionStatus } = useVersionStatus();
  // A missing/older SSR payload must not permanently hide the published scan metadata.
  // Complete SSR data seeds the shared cache without an additional request.
  const { data: publishedData } = useMultypeData({
    locale: activeLocale,
    initialData: initialData?.scan?.gameVersion ? initialData : undefined,
  });

  // Base Data
  const baseData = useMemo(() => mergeMultypeData(publishedData ?? initialData), [publishedData, initialData]);
  // Multype is refreshed only by its own scan, so compare Global with the scan, not the site release.
  const scanVersion = baseData.scanGameVersion;
  const globalVersion = versionStatus.globalVersion;
  const scanUpdateAvailable = determineVersionStatus(scanVersion, globalVersion).updateAvailable;

  // View States, seeded from the server-parsed URL (?mode=&q=&main=&sub=
  // &rename=&element=) so shared links render filtered on the first paint.
  const [mode, setMode] = useState<MultypeMode>(initialMode);
  const [search, setSearch] = useState(initialSearch ?? '');
  const [mainFilter, setMainFilter] = useState(initialMainFilter ?? 'all');
  const [subFilter, setSubFilter] = useState(initialSubFilter ?? 'all');
  const [renameFilter, setRenameFilter] = useState<MultypeRenameFilter>(initialRenameFilter ?? 'all');
  const [elementFilter, setElementFilter] = useState<MultypeElementFilter>(initialElementFilter ?? 'all');
  const [palette, setPalette] = useState<MultypePalette>(initialPalette ?? 'dark');
  const [scale, setScale] = useState(DEFAULT_SCALE);
  const [guideClicked, setGuideClicked] = useState(false);
  const [versionOpen, setVersionOpen] = useState(false);
  const [copyNotice, setCopyNotice] = useState('');
  const copyNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Tooltip State
  const tooltipRef = useRef<MultypeTooltipHandle>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const tableInnerRef = useRef<HTMLDivElement>(null);
  const versionCardRef = useRef<HTMLDivElement>(null);

  // Initialize from URL and LocalStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check guide click status
    try {
      const hasClicked =
        localStorage.getItem(STORAGE_GUIDE_KEY) === 'true' ||
        document.cookie.includes(`${STORAGE_GUIDE_KEY}=1`);
      setGuideClicked(hasClicked);
    } catch {}

    // Check saved theme
    try {
      const savedTheme = document.cookie
        .split('; ')
        .find((entry) => entry.startsWith(`${STORAGE_THEME_KEY}=`))
        ?.split('=')[1];
      if (savedTheme === 'light' || savedTheme === 'dark') {
        setPalette(savedTheme);
      }
    } catch {}

    // Read URL query params helper. State is seeded from the server-parsed
    // URL, so assignments only fire on disagreement (no extra render).
    function applyUrlParams() {
      const params = new URLSearchParams(window.location.search);
      const m = params.get('mode');
      if (m === 'renamed' || m === 'combined' || m === 'datamined' || m === 'ai-guess') {
        setMode((prev) => (prev === m ? prev : m));
      }
      const q = params.get('q');
      if (q != null) setSearch((prev) => (prev === q ? prev : q));

      const main = params.get('main');
      if (main) setMainFilter((prev) => (prev === main ? prev : main));

      const sub = params.get('sub');
      if (sub) setSubFilter((prev) => (prev === sub ? prev : sub));

      const ren = params.get('rename');
      if (ren === 'all' || ren === 'renamed' || ren === 'unrenamed') {
        setRenameFilter((prev) => (prev === ren ? prev : ren));
      }

      const elem = params.get('element');
      if (elem) {
        const firstElem = elem.split(',')[0].toLowerCase();
        if (
          ['all', 'final', 'fire', 'ice', 'volt', 'phys', 'super'].includes(firstElem)
        ) {
          setElementFilter((prev) => (prev === firstElem ? prev : (firstElem as MultypeElementFilter)));
        }
      }

      const pal = params.get('palette') || params.get('theme');
      if (pal === 'light' || pal === 'dark') {
        setPalette((prev) => (prev === pal ? prev : pal));
      }
    }

    applyUrlParams();

    function onPopState() {
      applyUrlParams();
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setVersionOpen(false);
        tooltipRef.current?.hide();
      }
    }

    function onPointerDown(e: PointerEvent) {
      if (versionCardRef.current && !versionCardRef.current.contains(e.target as Node)) {
        setVersionOpen(false);
      }
    }

    window.addEventListener('popstate', onPopState);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('pointerdown', onPointerDown);

    return () => {
      window.removeEventListener('popstate', onPopState);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pointerdown', onPointerDown);
      if (copyNoticeTimerRef.current) clearTimeout(copyNoticeTimerRef.current);
    };
  }, []);

  // Sync URL when filter changes
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams();
    if (mode !== 'ai-guess') params.set('mode', mode);
    if (search.trim()) params.set('q', search.trim());
    if (mainFilter !== 'all') params.set('main', mainFilter);
    if (subFilter !== 'all') params.set('sub', subFilter);
    if (renameFilter !== 'all') params.set('rename', renameFilter);
    if (elementFilter !== 'all') params.set('element', elementFilter);
    if (palette !== 'dark') params.set('palette', palette);

    const qs = params.toString();
    const newUrl = qs
      ? `${window.location.pathname}?${qs}${window.location.hash}`
      : `${window.location.pathname}${window.location.hash}`;
    window.history.replaceState({}, '', newUrl);
  }, [mode, search, mainFilter, subFilter, renameFilter, elementFilter, palette]);

  // Handle Guide Click
  const handleGuideClick = () => {
    setGuideClicked(true);
    try {
      localStorage.setItem(STORAGE_GUIDE_KEY, 'true');
      document.cookie = `${STORAGE_GUIDE_KEY}=1; path=/; max-age=31536000; SameSite=Lax`;
    } catch {}
  };

  // Handle Theme Change
  const handleThemeChange = (newPalette: MultypePalette) => {
    setPalette(newPalette);
    try {
      document.cookie = `${STORAGE_THEME_KEY}=${newPalette}; path=/; max-age=31536000; SameSite=Lax`;
    } catch {}
  };

  // Compute Global Stats
  const globalStats = useMemo(() => {
    return buildGlobalStats(baseData.mapping, baseData.renames);
  }, [baseData]);

  // Filter State Object
  const filterState: MultypeFilterState = useMemo(() => {
    return {
      mode,
      search,
      mainFilter,
      subFilter,
      renameFilter,
      elementFilter,
      palette,
      scale,
    };
  }, [mode, search, mainFilter, subFilter, renameFilter, elementFilter, palette, scale]);

  // Compute View Model
  const viewModel = useMemo(() => {
    return buildMultypeViewModel(
      baseData.mapping,
      baseData.renames,
      filterState,
      currentLocale,
      baseData.aiGuesses
    );
  }, [baseData, filterState, currentLocale]);

  // Zoom handlers
  const handleZoomIn = () => setScale((s) => Math.min(1.5, Math.round((s + 0.1) * 10) / 10));
  const handleZoomOut = () => setScale((s) => Math.max(0.4, Math.round((s - 0.1) * 10) / 10));
  const handleZoomReset = () => setScale(DEFAULT_SCALE);

  const handleZoomFit = () => {
    if (!tableContainerRef.current || !tableInnerRef.current) return;
    const containerWidth = tableContainerRef.current.clientWidth - 32;
    const tableWidth = tableInnerRef.current.scrollWidth / scale;
    if (tableWidth > 0 && containerWidth > 0) {
      const fitScale = Math.min(1.0, Math.max(0.4, containerWidth / tableWidth));
      setScale(Math.round(fitScale * 100) / 100);
    }
  };

  const handleResetFilters = () => {
    setMode('ai-guess');
    setSearch('');
    setMainFilter('all');
    setSubFilter('all');
    setRenameFilter('all');
    setElementFilter('all');
  };

  // Wheel scroll forwarding & cleanup
  const activeWheelCleanupRef = useRef<(() => void) | null>(null);

  const cleanupWheel = useCallback(() => {
    if (activeWheelCleanupRef.current) {
      activeWheelCleanupRef.current();
      activeWheelCleanupRef.current = null;
    }
  }, []);

  // Tooltip handlers
  const handleCellPointerEnter = useCallback(
    (item: MultypeValueItem, e: React.PointerEvent<HTMLDivElement>) => {
      cleanupWheel();
      const el = e.currentTarget;
      const rect = el.getBoundingClientRect();
      tooltipRef.current?.show(item, rect, mode === 'ai-guess');

      const onWheel = (event: WheelEvent) => {
        if (tooltipRef.current?.isScrollable()) {
          event.preventDefault();
          event.stopPropagation();
          tooltipRef.current.scrollBy(event.deltaY);
        }
      };

      el.addEventListener('wheel', onWheel, { passive: false });
      activeWheelCleanupRef.current = () => {
        el.removeEventListener('wheel', onWheel);
      };
    },
    [mode, cleanupWheel]
  );

  const handleSubHeaderPointerEnter = useCallback(
    (label: string, e: React.PointerEvent<HTMLSpanElement>) => {
      cleanupWheel();
      const rect = e.currentTarget.getBoundingClientRect();
      tooltipRef.current?.showLabel(label, rect.left + rect.width / 2, rect.top - 8);
    },
    [cleanupWheel]
  );

  const handleMainHeaderPointerEnter = useCallback(
    (label: string, e: React.PointerEvent<HTMLDivElement>) => {
      cleanupWheel();
      tooltipRef.current?.showLabel(label, e.clientX, e.clientY, true);
    },
    [cleanupWheel]
  );

  const handleMainHeaderPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    tooltipRef.current?.move(e.clientX, e.clientY);
  }, []);

  const handleCellPointerLeave = useCallback(() => {
    cleanupWheel();
    tooltipRef.current?.resetScroll();
    tooltipRef.current?.hide();
  }, [cleanupWheel]);

  const handleCopyOriginal = useCallback(
    async (item: MultypeValueItem, event?: React.MouseEvent<HTMLDivElement>) => {
      if (event) {
        const selection = window.getSelection();
        if (selection && !selection.isCollapsed && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          if (range.intersectsNode(event.currentTarget)) return;
        }
      }

      const originalName = item.originalLabel.trim();
      if (!originalName) return;

      // Clipboard API, then the hidden textarea for LAN HTTP origins where it is unavailable.
      const copied = await copyText(originalName);

      const message = copied
        ? copy.copiedOriginal.replace('{key}', originalName)
        : copy.copyOriginalFailed;
      setCopyNotice(message);
      if (copyNoticeTimerRef.current) clearTimeout(copyNoticeTimerRef.current);
      copyNoticeTimerRef.current = setTimeout(() => setCopyNotice(''), 2200);
    },
    [copy]
  );

  return (
    <div className={`${styles.container} datamine-multype`}>
      {/* Hero Section */}
      <section className={styles.hero} id="overview">
        <div className={styles.heroContent}>
          <p className={styles.eyebrow}>{copy.eyebrow}</p>
          <h1 className={styles.title}>{copy.title}</h1>
          <p className={styles.subtitle}>{copy.subtitle}</p>
        </div>

        <div className={styles.heroActions}>
          <div className={styles.themeBar}>
            <div className={styles.themeControl}>
              <span className={styles.themeLabel}>{copy.palette}</span>
              <div className={styles.themeSwitch} role="group" aria-label={translateUiText("Table color theme", activeLocale)}>
                <button
                  className={`${styles.themeButton} ${palette === 'light' ? styles.themeButtonActive : ''}`}
                  type="button"
                  onClick={() => handleThemeChange('light')}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <circle cx="12" cy="12" r="4" />
                    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
                  </svg>
                  <span>{copy.paletteLight}</span>
                </button>
                <button
                  className={`${styles.themeButton} ${palette === 'dark' ? styles.themeButtonActive : ''}`}
                  type="button"
                  onClick={() => handleThemeChange('dark')}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                  </svg>
                  <span>{copy.paletteDark}</span>
                </button>
              </div>
            </div>

            {/* Version Card & Popover */}
            <div
              ref={versionCardRef}
              className={`${styles.versionCard} ${versionOpen ? styles.versionCardOpen : ''}`}
              role="button"
              tabIndex={0}
              aria-haspopup="dialog"
              aria-expanded={versionOpen}
              aria-label={`${copy.datasetVersion}: ${scanVersion || copy.versionUnavailable}`}
              onClick={() => setVersionOpen((prev) => !prev)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setVersionOpen((prev) => !prev);
                }
              }}
            >
              <span className={styles.versionLabel}>{copy.datasetVersion}</span>
              <strong className={styles.versionText}>
                {scanVersion ? `v${scanVersion}` : '—'}
              </strong>

              {versionOpen && (
                <div
                  className={styles.versionPopover}
                  role="region"
                  aria-label={copy.popoverTitle}
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className={styles.versionPopoverTitle}>{copy.popoverTitle}</span>
                  <div className={styles.versionPopoverRow}>
                    <span className={styles.versionPopoverKey}>{copy.datasetKey}</span>
                    <span className={styles.versionPopoverValue}>
                      {scanVersion || copy.versionUnavailable}
                    </span>
                  </div>
                  {globalVersion && (
                    <div className={styles.versionPopoverRow}>
                      <span className={styles.versionPopoverKey}>{copy.globalKey}</span>
                      <span className={styles.versionPopoverValue}>
                        {globalVersion}
                      </span>
                    </div>
                  )}

                  {scanUpdateAvailable && (
                    <div className={styles.versionUpdateSection}>
                      <span className={styles.versionUpdateTitle}>{copy.updateAvailable}</span>
                      <p className={styles.versionUpdateText}>{copy.updateNotice}</p>
                      <p className={styles.versionUpdateDesc}>{copy.updateDesc}</p>
                      <div className={styles.versionTimeBadge}>{copy.timeWarning}</div>
                      <Link className={styles.versionHelpLink} href="/contribute/#multype">
                        {copy.howToHelp}
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>

            <Link
              href="/datamine/multype/guide/"
              onClick={handleGuideClick}
              className={`${styles.guideLink} ${guideClicked ? styles.guideLinkRegular : styles.guideLinkRainbow}`}
              title={copy.guideTitle}
            >
              <span className={styles.guideLinkInner}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
                <span>{copy.guideButton}</span>
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* Summary Strip */}
      <div className={styles.summaryStrip}>
        <span className={styles.summaryStat}>
          {copy.total}: <strong>{globalStats.totalCategories}</strong> {copy.categories}
        </span>
        <span className={styles.summarySep}>•</span>
        <span className={styles.summaryStat}>
          <strong>{globalStats.totalSubcategories}</strong> {copy.subcategories}
        </span>
        <span className={styles.summarySep}>•</span>
        <span className={styles.summaryStat}>
          <strong>{globalStats.totalBuffs.toLocaleString()}</strong> {copy.buffs}
        </span>
        <span className={styles.summarySep}>•</span>
        <span className={styles.summaryFile}>
          {copy.sourceFile}: <code>{baseData.sourceFile}</code>
        </span>

        <a href="#table" className={styles.focusLink}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M7 13l5 5 5-5M7 6l5 5 5-5" />
          </svg>
          <span>{copy.focusTable}</span>
        </a>
      </div>

      {/* Toolbar & Filters */}
      <div className={styles.toolbar}>
        {/* Row 1: Legacy-style labeled control groups */}
        <div className={styles.toolbarTopRow}>
          <div className={styles.controlGroups}>
          <div className={styles.controlGroup}>
            <span className={styles.groupLabel}>{copy.displayMode}</span>
            <div className={styles.displayModeOptions}>
            <div className={styles.segmentedGroup} role="group" aria-label={copy.displayMode}>
            <button
              type="button"
              className={`${styles.segmentBtn} ${mode === 'renamed' ? styles.segmentBtnActive : ''}`}
              onClick={() => setMode('renamed')}
              aria-pressed={mode === 'renamed'}
            >
              {copy.renamed}
            </button>
            <button
              type="button"
              className={`${styles.segmentBtn} ${mode === 'combined' ? styles.segmentBtnActive : ''}`}
              onClick={() => setMode('combined')}
              aria-pressed={mode === 'combined'}
            >
              {copy.combined}
            </button>
            <button
              type="button"
              className={`${styles.segmentBtn} ${mode === 'datamined' ? styles.segmentBtnActive : ''}`}
              onClick={() => setMode('datamined')}
              aria-pressed={mode === 'datamined'}
            >
              {copy.datamined}
            </button>
            <button
              type="button"
              className={`${styles.segmentBtn} ${styles.aiGuessBtn} ${mode === 'ai-guess' ? styles.aiGuessBtnActive : ''}`}
              onClick={() => setMode('ai-guess')}
              aria-pressed={mode === 'ai-guess'}
            >
              <svg className={styles.aiGuessIcon} viewBox="0 0 16 16" aria-hidden="true">
                <path d="M8 1.5l.75 2.25L11 4.5l-2.25.75L8 7.5l-.75-2.25L5 4.5l2.25-.75L8 1.5Z" />
                <path d="M12.5 8l.5 1.5 1.5.5-1.5.5-.5 1.5-.5-1.5-1.5-.5 1.5-.5.5-1.5Z" />
                <path d="M5.25 8.5l.75 2.25 2.25.75-2.25.75-.75 2.25-.75-2.25-2.25-.75 2.25-.75.75-2.25Z" />
              </svg>
              <span>{copy.aiGuess}</span>
            </button>
            </div>
          </div>
          </div>

          {/* Element Filter Pills */}
          <div className={styles.controlGroup}>
          <span className={styles.groupLabel}>{copy.renameStatus}</span>
          <div className={styles.filterPills} role="group" aria-label={copy.renameStatus}>
            {(
              [
                ['all', copy.all],
                ['renamed', copy.renamedOnly],
                ['unrenamed', copy.unrenamedOnly],
              ] as const
            ).map(([key, label]) => (
              <FilterChip
                key={key}
                value={key}
                variant={key === 'all' ? 'all' : 'default'}
                active={renameFilter === key}
                onClick={() => setRenameFilter(key)}
              >
                {label}
              </FilterChip>
            ))}
          </div>
          </div>

          <div className={styles.controlGroup}>
          <span className={styles.groupLabel}>{copy.elementCategory}</span>
          <div className={styles.filterPills} role="group" aria-label={copy.elementCategory}>
            {(
              [
                ['all', copy.elemAll],
                ['final', copy.elemFinal],
                ['phys', copy.elemPhys],
                ['fire', copy.elemFire],
                ['ice', copy.elemIce],
                ['volt', copy.elemVolt],
                ['super', copy.elemSuper],
              ] as const
            ).map(([key, label]) => (
              <FilterChip
                key={key}
                value={key}
                variant={
                  key === 'all'
                    ? 'all'
                    : key === 'final'
                      ? 'final'
                      : key === 'fire'
                        ? 'flame'
                        : key === 'ice'
                          ? 'frost'
                          : key === 'volt'
                            ? 'volt'
                            : key === 'phys'
                              ? 'phys'
                              : key === 'super'
                                ? 'altered'
                                : 'default'
                }
                active={elementFilter === key}
                icon={
                  key === 'final'
                    ? <span aria-hidden="true">☆</span>
                    : key === 'fire'
                      ? '/datamine/shared/assets/icons/elements/elem_fire.webp'
                      : key === 'ice'
                        ? '/datamine/shared/assets/icons/elements/elem_frost.webp'
                        : key === 'volt'
                          ? '/datamine/shared/assets/icons/elements/elem_volt.webp'
                          : key === 'phys'
                            ? '/datamine/shared/assets/icons/elements/elem_phys.webp'
                            : key === 'super'
                              ? '/datamine/shared/assets/icons/elements/elem_altered.webp'
                              : undefined
                }
                onClick={() => setElementFilter(key)}
              >
                {label}
              </FilterChip>
            ))}
          </div>
          </div>
          </div>

          <div className={styles.toolbarActions}>
            <div className={styles.controlGroup}>
              <span className={styles.groupLabel}>{copy.tableScale}</span>
              <div className={styles.zoomGroup} role="group" aria-label={copy.tableScale}>
                <button type="button" className={styles.actionBtn} onClick={handleZoomOut} title={copy.zoomOut} aria-label={copy.zoomOut}>−</button>
                <button type="button" className={styles.actionBtn} onClick={handleZoomReset} title={copy.zoomResetTitle}>{Math.round(scale * 100)}%</button>
                <button type="button" className={styles.actionBtn} onClick={handleZoomIn} title={copy.zoomIn} aria-label={copy.zoomIn}>+</button>
                <button type="button" className={styles.actionBtn} onClick={handleZoomFit} title={copy.zoomFitTitle}>{copy.zoomFit}</button>
              </div>
            </div>

            <div className={styles.exportActions}>
              <button type="button" className={`${styles.actionBtn} ${styles.actionBtnPrimary}`} onClick={() => exportMultypeJson(viewModel, mode)} title={copy.exportJsonAria}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
                <span>{copy.exportJson}</span>
              </button>
              <button type="button" className={`${styles.actionBtn} ${styles.actionBtnPrimary}`} onClick={() => exportMultypeTableToPng(viewModel, palette)} title={copy.exportTableImage}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
                <span>PNG</span>
              </button>
            </div>
          </div>
        </div>

        {/* Row 2: Search, main and sub filters */}
        <div className={styles.fieldsRow}>
          <div className={styles.searchField}>
            <span className={styles.groupLabel}>{copy.search}</span>
            <CatalogSearch
              value={search}
              onChange={setSearch}
              placeholder={copy.searchPlaceholder}
            />
          </div>

          <div className={styles.filterField}>
            <span className={styles.groupLabel}>{copy.main}</span>
            <SortListbox
              label=""
              ariaLabel={copy.main}
              value={mainFilter}
              onChange={setMainFilter}
              options={[
                { value: 'all', label: copy.allMain },
                ...viewModel.mainOptions.map((key) => ({
                  value: key,
                  label: isRu ? CATEGORY_LABELS_RU[key] || key : translateUiText(baseData.renames.mainRenames?.[key] || key, currentLocale),
                })),
              ]}
            />
          </div>

          <div className={styles.filterField}>
            <span className={styles.groupLabel}>{copy.sub}</span>
            <SortListbox
              label=""
              ariaLabel={copy.sub}
              value={subFilter}
              onChange={setSubFilter}
              options={[
                { value: 'all', label: copy.allSub },
                ...viewModel.subOptions.map((key) => ({ value: key, label: key })),
              ]}
            />
          </div>

        </div>

      </div>

      {copyNotice && (
        <div className={styles.copyNotice} role="status" aria-live="polite">
          {copyNotice}
        </div>
      )}

      {/* Matrix Table */}
      <div
        className={styles.tableContainer}
        id="table"
        ref={tableContainerRef}
        data-multype-palette={palette}
        onScroll={() => {
          cleanupWheel();
          tooltipRef.current?.hide();
        }}
      >
        {viewModel.groups.length === 0 ? (
          <div className={styles.emptyCard}>
            <h3 className={styles.emptyTitle}>{copy.emptyTitle}</h3>
            <p className={styles.emptyBody}>{copy.emptyBody}</p>
            <button
              type="button"
              className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
              onClick={handleResetFilters}
            >
              {copy.resetFilters}
            </button>
          </div>
        ) : (
          <div
            className={styles.tableInner}
            ref={tableInnerRef}
            style={{ transform: `scale(${scale})` }}
          >
            {viewModel.groups.map((group) => (
              <div
                key={group.mainKey}
                className={styles.mainColumn}
                style={{ borderColor: group.accentLine }}
              >
                {/* Main Header */}
                <div
                  className={styles.mainHeader}
                  style={{
                    backgroundColor: palette === 'light' ? 'rgba(16, 13, 20, 0.95)' : group.accentWash,
                    borderColor: group.accentLine,
                    boxShadow: `inset 0 3px 0 0 ${group.accent}`,
                  }}
                  onPointerEnter={(e) =>
                    handleMainHeaderPointerEnter(
                      group.displayLabel ||
                        (group.mainKey === 'NoModule'
                          ? copy.generalCategory
                          : group.mainKey),
                      e
                    )
                  }
                  onPointerMove={handleMainHeaderPointerMove}
                  onPointerLeave={handleCellPointerLeave}
                >
                  <div
                    className={styles.mainHeaderTitle}
                    style={{ color: palette === 'light' ? '#f5f0f8' : group.accent }}
                  >
                    {group.displayLabel}
                  </div>
                  <div className={styles.mainHeaderMeta}>
                    {group.subColumns.length} {copy.subColumns}
                  </div>
                </div>

                {/* Sub Columns Grid */}
                <div className={styles.subGrid}>
                  {group.subColumns.map((sub) => (
                    <div
                      key={sub.subKey}
                      className={styles.subColumn}
                      style={{
                        backgroundColor: palette === 'light' ? sub.surface.accentSoft : undefined,
                        borderColor: sub.surface.accentLine,
                      }}
                    >
                      {/* Sub Header */}
                      <div
                        className={styles.subHeader}
                        style={{
                          backgroundColor: sub.surface.accentPanel,
                          borderColor: sub.surface.accentLine,
                          color: sub.surface.accentInk,
                        }}
                      >
                        <span
                          onPointerEnter={(e) => handleSubHeaderPointerEnter(sub.displayLabel, e)}
                          onPointerLeave={handleCellPointerLeave}
                        >
                          {sub.displayLabel}
                        </span>
                        <span className={styles.subHeaderCount}>
                          ({sub.values.length})
                        </span>
                      </div>

                      {/* Values List */}
                      <div className={styles.valueList}>
                        {sub.values.map((val) => (
                          <div
                            key={val.primaryValueKey}
                            className={`${styles.valueCard} ${
                              mode === 'ai-guess' && val.hasRename
                                ? styles.valueCardAiManual
                                : val.hasRename || (
                                mode === 'ai-guess' &&
                                Boolean(val.aiGuessLabel) &&
                                val.aiGuessLabel !== val.originalLabel
                              ) ? styles.valueCardRenamed : ''
                            }`}
                            onPointerEnter={(e) => handleCellPointerEnter(val, e)}
                            onPointerLeave={handleCellPointerLeave}
                            onClick={(e) => void handleCopyOriginal(val, e)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                void handleCopyOriginal(val);
                              }
                            }}
                            role="button"
                            tabIndex={0}
                            aria-label={copy.copyOriginalAria.replace('{key}', val.originalLabel)}
                          >
                            <span className={styles.valueLabel}>
                              {val.displayLabel}
                            </span>
                            {val.allValueKeys.length > 1 && (
                              <span className={styles.dedupeBadge}>
                                x{val.allValueKeys.length}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <MultypeHoverTooltip ref={tooltipRef} locale={currentLocale} />
    </div>
  );
}
