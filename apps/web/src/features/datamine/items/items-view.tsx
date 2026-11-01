'use client';

import { localized } from '@tof-hub/i18n';
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useI18n } from '@/lib/i18n';
import { gameAssetPng } from '@tof-hub/game-assets';
import { Lightbox } from '@tof-hub/ui';
import type {
  ItemsViewProps,
  ItemsMode,
  ItemsFilter,
  ItemRow,
  ItemsSortColumn,
  ItemsSortDirection,
} from './items-types';
import { ITEMS_COPY } from './items-copy';
import { mergeItemsData } from './items-data';
import {
  filterItemRows,
  sortItemRows,
  buildHighlightedParts,
  normalizeItemRows,
  resolveMediaUrl,
  getRarityBorderColor,
} from './items-domain';
import { exportItemsJson } from './items-export';
import styles from './items.module.css';

const ITEMS_BATCH_SIZE = 100;

export function ItemsView({ initialData, initialLocale, initialMode, initialFilter, initialSearch }: ItemsViewProps) {
  const { locale: activeLocale } = useI18n();
  const currentLocale = activeLocale || initialLocale;
  const isRu = currentLocale === 'ru';
  const copy = localized(ITEMS_COPY, currentLocale);

  // Seed from the server-parsed URL params (?mode=&filter=&q=) so a shared
  // link fetches the selected dataset immediately instead of loading gacha
  // and refetching after mount.
  const [mode, setMode] = useState<ItemsMode>(initialMode ?? 'gacha');
  const [filter, setFilter] = useState<ItemsFilter>(initialFilter ?? 'all');
  const [search, setSearch] = useState(initialSearch ?? '');
  const [sortState, setSortState] = useState<{ column: ItemsSortColumn; direction: ItemsSortDirection }>({
    column: 'num',
    direction: 'ascending',
  });
  const [visibleCount, setVisibleCount] = useState(ITEMS_BATCH_SIZE);
  const [isLoadingAll, setIsLoadingAll] = useState(false);
  const loadAllRunRef = useRef(0);
  const tableWrapRef = useRef<HTMLDivElement>(null);

  // Client Dataset Store for dynamically fetched datasets
  const [dynamicDatasets, setDynamicDatasets] = useState<Partial<Record<ItemsMode, ItemRow[]>>>({});
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [lightboxTarget, setLightboxTarget] = useState<{ png: string; webp: string; name: string } | null>(null);

  // Icon zoom state
  const [zoomTarget, setZoomTarget] = useState<{
    visible: boolean;
    x: number;
    y: number;
    name: string;
    icon: string;
  } | null>(null);

  // Base items per mode
  const currentRows = useMemo(() => {
    if (dynamicDatasets[mode] && dynamicDatasets[mode]!.length > 0) {
      return dynamicDatasets[mode]!;
    }
    return mergeItemsData(initialData, mode);
  }, [initialData, mode, dynamicDatasets]);

  // Fetch the full gacha dataset only while gacha is active. A shared
  // ?mode=mmo link must not pay for the gacha payload before the mmo one.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (mode !== 'gacha' || dynamicDatasets.gacha || initialData) return;

    // Fetch full Gacha dataset if available
    const gachaUrls = [
      `/game-data/${currentLocale}/runtime/items.json`,
      `/game-data/${currentLocale}/datamine/items.json`,
      `/datamine/items/data/merged_mapping_with_original.json`,
    ];

    const tryFetch = async (urls: string[], targetMode: ItemsMode) => {
      for (const url of urls) {
        try {
          const res = await fetch(url);
          if (res.ok) {
            const data = await res.json();
            if (data && typeof data === 'object' && Object.keys(data).length > 0) {
              const itemsMap = data.items && Array.isArray(data.items)
                ? Object.fromEntries(data.items.map((it: any, idx: number) => [String(it.num || idx + 1), it]))
                : data;
              const rows = mergeItemsData(itemsMap, targetMode);
              if (rows.length > 0) {
                setDynamicDatasets((prev) => ({ ...prev, [targetMode]: rows }));
                return;
              }
            }
          }
        } catch {}
      }
    };

    tryFetch(gachaUrls, 'gacha');
  }, [currentLocale, mode, dynamicDatasets.gacha]);

  // When mode switches to MMO, attempt fetch of MMO data if not already loaded
  useEffect(() => {
    if (typeof window === 'undefined' || mode !== 'mmo' || dynamicDatasets.mmo) return;

    const mmoUrls = [
      `/game-data/${currentLocale}/runtime/items-mmo.json`,
      `/game-data/${currentLocale}/datamine/items-mmo.json`,
      `/${currentLocale}/datamine/items-mmo.json`,
      `/datamine/items/data/merged_mapping_with_original_mmo.json`,
      `/api/datamine/items?mode=mmo`,
    ];

    (async () => {
      for (const url of mmoUrls) {
        try {
          const res = await fetch(url);
          if (res.ok) {
            const data = await res.json();
            if (data && typeof data === 'object') {
              const itemsMap = data.items && Array.isArray(data.items)
                ? Object.fromEntries(data.items.map((item: any, index: number) => [String(item.num || index + 1), item]))
                : data;
              const rows = normalizeItemRows(itemsMap);
              if (rows.length > 0) {
                setDynamicDatasets((prev) => ({ ...prev, mmo: rows }));
                return;
              }
            }
          }
        } catch {}
      }
    })();
  }, [mode, dynamicDatasets.mmo]);

  const isInitialMount = useRef(true);
  const prevFilterState = useRef({ filter, search, mode });

  // Initialize from URL params on mount & listen to popstate / Escape
  useEffect(() => {
    if (typeof window === 'undefined') return;

    function applyUrlParams() {
      const params = new URLSearchParams(window.location.search);
      const m = params.get('mode');
      if (m === 'gacha' || m === 'mmo') setMode((prev) => (prev === m ? prev : m));
      else setMode((prev) => (prev === 'gacha' ? prev : 'gacha'));

      const f = params.get('filter');
      if (f === 'renamed' || f === 'all') setFilter((prev) => (prev === f ? prev : f));
      else setFilter((prev) => (prev === 'all' ? prev : 'all'));

      const q = params.get('q') || params.get('item');
      // State is seeded from the server-parsed URL, so only correct when
      // the live URL disagrees. Equal values keep their state (no refetch).
      if (q != null) setSearch((prev) => (prev === q ? prev : q));
      else setSearch((prev) => (prev === '' ? prev : ''));

    }

    applyUrlParams();

    function onPopState() {
      applyUrlParams();
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setZoomTarget(null);
        setToastMessage(null);
      }
    }

    window.addEventListener('popstate', onPopState);
    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('popstate', onPopState);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  // Sync URL query params
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams();
    const selectedItem = new URLSearchParams(window.location.search).get('item');
    if (selectedItem && search === selectedItem) params.set('item', selectedItem);
    if (mode !== 'gacha') params.set('mode', mode);
    if (filter !== 'all') params.set('filter', filter);
    if (search.trim()) params.set('q', search.trim());
    const qs = params.toString();
    const newUrl = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    window.history.replaceState({}, '', newUrl);
  }, [mode, filter, search]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    return filterItemRows(currentRows, filter, search);
  }, [currentRows, filter, search]);

  const sortedRows = useMemo(
    () => sortItemRows(filteredRows, sortState.column, sortState.direction, currentLocale),
    [filteredRows, sortState, currentLocale]
  );

  const handleSort = useCallback((column: ItemsSortColumn) => {
    loadAllRunRef.current += 1;
    setIsLoadingAll(false);
    setVisibleCount(ITEMS_BATCH_SIZE);
    if (tableWrapRef.current) tableWrapRef.current.scrollTop = 0;
    setSortState((current) => ({
      column,
      direction: current.column === column && current.direction === 'ascending' ? 'descending' : 'ascending',
    }));
  }, []);

  // Start a filtered result set from its first batch when the user's query changes.
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      prevFilterState.current = { filter, search, mode };
      return;
    }
    if (
      prevFilterState.current.filter !== filter ||
      prevFilterState.current.search !== search ||
      prevFilterState.current.mode !== mode
    ) {
      prevFilterState.current = { filter, search, mode };
      loadAllRunRef.current += 1;
      setIsLoadingAll(false);
      setVisibleCount(ITEMS_BATCH_SIZE);
    }
  }, [filter, search, mode]);

  const visibleRows = useMemo(
    () => sortedRows.slice(0, visibleCount),
    [sortedRows, visibleCount]
  );
  const hasMoreRows = visibleRows.length < filteredRows.length;
  const loadMoreRows = useCallback(() => {
    setVisibleCount((count) => Math.min(count + ITEMS_BATCH_SIZE, filteredRows.length));
  }, [filteredRows.length]);
  const loadAllRows = useCallback(async () => {
    if (isLoadingAll || !hasMoreRows) return;

    const run = ++loadAllRunRef.current;
    let count = visibleCount;
    setIsLoadingAll(true);

    try {
      while (count < filteredRows.length && loadAllRunRef.current === run) {
        count = Math.min(count + ITEMS_BATCH_SIZE, filteredRows.length);
        setVisibleCount(count);
        if (count < filteredRows.length) {
          await new Promise((resolve) => window.setTimeout(resolve, 32));
        }
      }
    } finally {
      if (loadAllRunRef.current === run) setIsLoadingAll(false);
    }
  }, [filteredRows.length, hasMoreRows, isLoadingAll, visibleCount]);
  const stopLoadingAll = useCallback(() => {
    loadAllRunRef.current += 1;
    setIsLoadingAll(false);
  }, []);
  const handleTableScroll = useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      const table = event.currentTarget;
      if (!isLoadingAll && hasMoreRows && table.scrollHeight - table.scrollTop - table.clientHeight <= 700) {
        loadMoreRows();
      }
    },
    [hasMoreRows, isLoadingAll, loadMoreRows]
  );

  // Copy ID handler
  const handleCopyId = useCallback(
    async (id: string) => {
      try {
        await navigator.clipboard.writeText(id);
        setToastMessage(`${copy.copied}: ${id}`);
        setTimeout(() => setToastMessage(null), 2000);
      } catch {
        setToastMessage(copy.copyFailed);
        setTimeout(() => setToastMessage(null), 2000);
      }
    },
    [copy.copied, copy.copyFailed]
  );

  // Status text calculation
  const statusText = useMemo(() => {
    const visibleCount = filteredRows.length;
    const totalCount = currentRows.length;
    const hasSearch = Boolean(search.trim());

    if (filter === 'renamed' && hasSearch) {
      return `${visibleCount.toLocaleString()} ${copy.matches} / ${totalCount.toLocaleString()} ${copy.rows}`;
    }
    if (filter === 'renamed') {
      return `${visibleCount.toLocaleString()} ${copy.renamed.toLowerCase()} / ${totalCount.toLocaleString()} ${copy.rows}`;
    }
    if (hasSearch) {
      return `${visibleCount.toLocaleString()} ${copy.matches} / ${totalCount.toLocaleString()} ${copy.rows}`;
    }
    return `${totalCount.toLocaleString()} ${copy.rows}`;
  }, [filteredRows.length, currentRows.length, filter, search, copy]);

  // Highlight helper component
  const HighlightedText = ({ text }: { text: string }) => {
    const parts = buildHighlightedParts(text, search);
    return (
      <>
        {parts.map((part, i) =>
          part.match ? (
            <mark key={i} className={styles.match}>
              {part.text}
            </mark>
          ) : (
            <React.Fragment key={i}>{part.text}</React.Fragment>
          )
        )}
      </>
    );
  };

  return (
    <div className={styles.container}>
      {/* Hero */}
      <section className={styles.hero}>
        <p className={styles.eyebrow}>{copy.eyebrow}</p>
        <h1 className={styles.title}>{copy.title}</h1>
      </section>

      {/* Main Table Panel */}
      <section className={styles.panel}>
        {/* Toolbar */}
        <div className={styles.toolbar}>
          <div className={styles.toolbarMain}>
            <span
              className={`${styles.status} ${
                filteredRows.length > 0 ? styles.statusSuccess : ''
              }`}
            >
              {statusText}
            </span>
          </div>

          <div className={styles.toolbarControls}>
            {/* Mode: Gacha / MMO */}
            <div className={styles.modeGroup} role="group" aria-label={copy.itemSourceAria}>
              <button
                type="button"
                className={`${styles.modeButton} ${mode === 'gacha' ? styles.modeButtonActive : ''}`}
                onClick={() => setMode('gacha')}
              >
                {copy.gacha}
              </button>
              <button
                type="button"
                className={`${styles.modeButton} ${mode === 'mmo' ? styles.modeButtonActive : ''}`}
                onClick={() => setMode('mmo')}
              >
                {copy.mmo}
              </button>
            </div>

            {/* Filter: All / Renamed */}
            <div className={styles.filterGroup} role="group" aria-label={copy.rowFilterAria}>
              <button
                type="button"
                className={`${styles.filterButton} ${filter === 'all' ? styles.filterButtonActive : ''}`}
                onClick={() => setFilter('all')}
              >
                {copy.all}
              </button>
              <button
                type="button"
                className={`${styles.filterButton} ${filter === 'renamed' ? styles.filterButtonActive : ''}`}
                onClick={() => setFilter('renamed')}
              >
                {copy.renamed}
              </button>
            </div>

            {/* Search Input */}
            <label className={styles.searchLabel}>
              <input
                type="search"
                className={styles.searchInput}
                placeholder={copy.searchPlaceholder}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>

            {/* Export JSON Button */}
            <button
              type="button"
              className={styles.exportBtn}
              onClick={() => exportItemsJson(filteredRows, mode)}
              title={copy.exportJsonAria}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
              </svg>
              <span>{copy.exportJson}</span>
            </button>
          </div>
        </div>

        {/* Scrollable Table View */}
        <div ref={tableWrapRef} className={styles.tableWrap} onScroll={handleTableScroll}>
          {filteredRows.length === 0 ? (
            <div className={styles.emptyState}>{copy.noRows}</div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  {([
                    ['num', copy.num, styles.cellNum],
                    ['icon', copy.icon, styles.cellIcon],
                    ['id', copy.id, styles.cellId],
                    ['name', copy.name, styles.cellName],
                    ['description', copy.description, styles.cellDesc],
                    ['original', copy.original, styles.cellOriginal],
                    ['rename', copy.rename, styles.cellRename],
                  ] as const).map(([column, label, className]) => {
                    const active = sortState.column === column;
                    const direction = active ? sortState.direction : undefined;
                    return (
                      <th key={column} className={className} scope="col" aria-sort={direction}>
                        <button
                          type="button"
                          className={styles.sortHeader}
                          onClick={() => handleSort(column)}
                          aria-label={`${label}, ${active ? (direction === 'ascending' ? copy.sortAscending : copy.sortDescending) : copy.sortAscending}`}
                        >
                          {label}
                          <span className={styles.sortIndicator} aria-hidden="true">
                            {active ? (direction === 'ascending' ? '▲' : '▼') : '↕'}
                          </span>
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => {
                  const desc = isRu ? row.description_ru || row.description_en : row.description_en;
                  const iconUrl = resolveMediaUrl(row.icon);
                  const borderColor = getRarityBorderColor(row.rarity);

                  return (
                    <tr
                      key={row.key}
                      className={`${styles.tableRow} ${row.rename ? styles.tableRowRenamed : ''}`}
                    >
                      <td className={styles.cellNum}>{row.num}</td>
                      <td className={styles.cellIcon}>
                        {iconUrl ? (
                          <button
                            type="button"
                            className={styles.iconFrame}
                            style={{ borderColor }}
                            aria-label={`${copy.viewImage}: ${row.name}`}
                            title={copy.viewImage}
                            onClick={() => setLightboxTarget({ png: gameAssetPng(row.icon), webp: iconUrl, name: row.name })}
                            onPointerEnter={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect();
                              setZoomTarget({
                                visible: true,
                                x: rect.right + 12,
                                y: rect.top,
                                name: row.name,
                                icon: iconUrl,
                              });
                            }}
                            onPointerLeave={() => setZoomTarget(null)}
                          >
                            <img
                              src={iconUrl}
                              alt={row.name}
                              className={styles.iconImg}
                              loading="lazy"
                              onError={(e) => {
                                (e.currentTarget as HTMLElement).style.display = 'none';
                              }}
                            />
                          </button>
                        ) : (
                          <div className={styles.iconFrame} style={{ borderColor }} />
                        )}
                      </td>
                      <td className={styles.cellId}>
                        <button
                          type="button"
                          className={styles.idButton}
                          onClick={() => handleCopyId(row.id)}
                          title={copy.copyIdTitle}
                        >
                          <code className={styles.idCode}>
                            <HighlightedText text={row.id} />
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                            </svg>
                          </code>
                        </button>
                      </td>
                      <td className={styles.cellName}>
                        <HighlightedText text={row.name} />
                      </td>
                      <td className={styles.cellDesc}>
                        <HighlightedText text={desc} />
                      </td>
                      <td className={styles.cellOriginal}>
                        <HighlightedText text={row.original} />
                      </td>
                      <td className={styles.cellRename}>
                        <HighlightedText text={row.rename} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {hasMoreRows && (
          <div className={styles.loadMore}>
            <span aria-live="polite">
              {visibleRows.length.toLocaleString()} / {filteredRows.length.toLocaleString()} {copy.rows}
            </span>
            <button
              type="button"
              className={styles.loadMoreButton}
              onClick={() => {
                if (isLoadingAll) stopLoadingAll();
                else void loadAllRows();
              }}
              aria-busy={isLoadingAll}
            >
              {isLoadingAll ? copy.stopLoading : copy.loadAll}
            </button>
          </div>
        )}
      </section>

      {/* Floating Icon Zoom Preview */}
      {zoomTarget && zoomTarget.visible && (
        <div
          className={styles.iconZoom}
          style={{
            top: `${Math.min(window.innerHeight - 180, Math.max(20, zoomTarget.y - 40))}px`,
            left: `${Math.min(window.innerWidth - 180, zoomTarget.x)}px`,
          }}
        >
          <img
            src={zoomTarget.icon}
            alt={zoomTarget.name}
            className={styles.iconZoomImg}
          />
          <span className={styles.iconZoomName}>{zoomTarget.name}</span>
        </div>
      )}

      <Lightbox
        isOpen={lightboxTarget !== null}
        onClose={() => setLightboxTarget(null)}
        src={lightboxTarget?.png ?? ''}
        webpSrc={lightboxTarget?.webp}
        alt={lightboxTarget?.name ?? ''}
        title={lightboxTarget?.name}
        caption={lightboxTarget?.name}
        downloadName={lightboxTarget?.name}
        locale={currentLocale}
      />

      {/* Feedback Toast */}
      {toastMessage && <div className={styles.toast}>{toastMessage}</div>}
    </div>
  );
}
