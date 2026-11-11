'use client';

import { localized, translateUiText, type Locale } from '@tof-hub/i18n';
import React, { useState, useEffect, useLayoutEffect, useMemo, useCallback, useRef } from 'react';
import { useI18n } from '@/lib/i18n';
import { useSiteHeaderInset } from '@/components/site-shell/use-site-header-inset';
import { intlLocale } from '@/lib/i18n/format';
import { gameAssetPng } from '@tof-hub/game-assets';
import {
  Button, CatalogControls, CatalogCounter, CatalogSearch, FilterChip, FilterGroup,
  Lightbox, LoadingState, ModeSwitcher, SortListbox,
} from '@tof-hub/ui';
import { resolveItemsFilter, resolveItemsTradeFilter } from './items-types';
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
  getItemsTradeCategories,
} from './items-domain';
import { exportItemsJson } from './items-export';
import styles from './items.module.css';
import {ItemsTradeCells} from './items-trade-cell';
import {ItemsTradeRules} from './items-trade-rules';

const ITEMS_BATCH_SIZE = 100;
const itemTextMeasurements = new WeakMap<Element, () => void>();
let itemTextObserver: ResizeObserver | undefined;

function HighlightedText({text, search}: {text: string; search: string}) {
  return <>{buildHighlightedParts(text, search).map((part, index) => part.match
    ? <mark key={index} className={styles.match}>{part.text}</mark>
    : <React.Fragment key={index}>{part.text}</React.Fragment>
  )}</>;
}

function ItemTextDisclosure({text, search}: {text: string; search: string}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(false);

  const measure = useCallback(() => {
    const container = containerRef.current;
    if (!container || container.querySelector('details[open]')) return;
    const value = container.querySelector<HTMLElement>(`.${styles.itemTextValue}`);
    if (value) setOverflowing(value.scrollWidth > container.clientWidth || text.trim().includes('\n'));
  }, [text]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    measure();
    itemTextObserver ??= new ResizeObserver(entries => {
      for (const {target} of entries) itemTextMeasurements.get(target)?.();
    });
    itemTextMeasurements.set(container, measure);
    itemTextObserver.observe(container);
    return () => {
      itemTextObserver?.unobserve(container);
      itemTextMeasurements.delete(container);
    };
  }, [measure, search]);

  if (!text) return null;
  const value = <span className={styles.itemTextValue}><HighlightedText text={text} search={search} /></span>;
  return (
    <div ref={containerRef} className={styles.itemText}>
      {overflowing ? <details onToggle={measure}><summary>{value}</summary></details> : value}
    </div>
  );
}

function ItemIconFrame({iconUrl, name, borderColor, shardLabel, viewImage, onOpen, onPreview, onLeave}: {
  iconUrl: string;
  name: string;
  borderColor: string;
  shardLabel: string;
  viewImage: string;
  onOpen: () => void;
  onPreview: (rect: DOMRect) => void;
  onLeave: () => void;
}) {
  const [failed, setFailed] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);
  const badge = shardLabel ? <span className={styles.shardBadge} title={shardLabel} /> : null;

  if (!iconUrl || failed) return <div className={styles.iconFrame} style={{borderColor}}>{badge}</div>;

  return (
    <button
      type="button"
      className={styles.iconFrame}
      style={{borderColor}}
      aria-label={[`${viewImage}: ${name}`, shardLabel].filter(Boolean).join(' · ')}
      title={viewImage}
      onClick={() => { if (imageRef.current?.naturalWidth) onOpen(); }}
      onPointerEnter={event => {
        if (imageRef.current?.naturalWidth) onPreview(event.currentTarget.getBoundingClientRect());
      }}
      onPointerLeave={onLeave}
    >
      <img ref={imageRef} src={iconUrl} alt="" className={styles.iconImg} loading="lazy" onError={() => setFailed(true)} />
      {badge}
    </button>
  );
}

export function ItemsView({ initialData, tradeRules, initialLocale, initialMode, initialFilter, initialSearch, initialTradeFilter }: ItemsViewProps) {
  const { locale: activeLocale } = useI18n();
  const currentLocale = activeLocale || initialLocale;
  const isRu = currentLocale === 'ru';
  const copy = localized(ITEMS_COPY, currentLocale);
  const numberFormat = useMemo(() => new Intl.NumberFormat(intlLocale(currentLocale)), [currentLocale]);
  const percentFormat = useMemo(() => new Intl.NumberFormat(intlLocale(currentLocale), {
    style: 'percent', signDisplay: 'exceptZero', maximumFractionDigits: 0,
  }), [currentLocale]);
  const tradeLabel = translateUiText('Trade Station', currentLocale);

  // Seed from the server-parsed URL params (?mode=&filter=&q=) so a shared
  // link fetches the selected dataset immediately instead of loading gacha
  // and refetching after mount.
  const [mode, setMode] = useState<ItemsMode>(initialMode ?? 'gacha');
  const [filter, setFilter] = useState<ItemsFilter>(resolveItemsFilter(initialMode ?? 'gacha', initialFilter));
  const [search, setSearch] = useState(initialSearch ?? '');
  const [tradeFilter, setTradeFilter] = useState(() => initialTradeFilter ?? resolveItemsTradeFilter('gacha'));
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
  const [mmoDatasets, setMmoDatasets] = useState<Partial<Record<Locale, ItemRow[]>>>({});
  const mmoRows = mmoDatasets[currentLocale];
  const headerInset = useSiteHeaderInset(mode === 'mmo' && Boolean(mmoRows));
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
    if (mode === 'mmo') return mmoRows ?? [];
    if (dynamicDatasets[mode] && dynamicDatasets[mode]!.length > 0) {
      return dynamicDatasets[mode]!;
    }
    return mergeItemsData(initialData, mode);
  }, [initialData, mode, dynamicDatasets, mmoRows]);

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
    if (mode !== 'mmo' || mmoRows) return;
    const controller = new AbortController();

    const mmoUrls = [
      `/game-data/${currentLocale}/runtime/items-mmo.json`,
      `/game-data/${currentLocale}/datamine/items-mmo.json`,
      '/game-data/en/runtime/items-mmo.json',
      `/${currentLocale}/datamine/items-mmo.json`,
      `/datamine/items/data/merged_mapping_with_original_mmo.json`,
      `/api/datamine/items?mode=mmo`,
    ];

    (async () => {
      for (const url of mmoUrls) {
        try {
          const res = await fetch(url, {signal: controller.signal});
          if (res.ok) {
            const data = await res.json();
            if (data && typeof data === 'object') {
              const itemsMap = data.items && Array.isArray(data.items)
                ? Object.fromEntries(data.items.map((item: any, index: number) => [String(item.num || index + 1), item]))
                : data;
              const rows = normalizeItemRows(itemsMap);
              if (rows.length > 0) {
                if (!controller.signal.aborted) setMmoDatasets((prev) => ({...prev, [currentLocale]: rows}));
                return;
              }
            }
          }
        } catch {
          if (controller.signal.aborted) return;
        }
      }
      if (!controller.signal.aborted) setMmoDatasets((prev) => ({...prev, [currentLocale]: []}));
    })();
    return () => controller.abort();
  }, [mode, mmoRows, currentLocale]);

  const isInitialMount = useRef(true);
  const prevFilterState = useRef({ filter, search, mode, tradeFilter });
  const previousUrlState = useRef({ filter, search, mode, tradeFilter });

  // Initialize from URL params on mount & listen to popstate / Escape
  useEffect(() => {
    if (typeof window === 'undefined') return;

    function applyUrlParams() {
      const params = new URLSearchParams(window.location.search);
      const nextMode = params.get('mode') === 'mmo' ? 'mmo' : 'gacha';
      setMode(nextMode);
      setFilter(resolveItemsFilter(nextMode, params.get('filter')));
      const category = resolveItemsTradeFilter(nextMode, params.get('section'), params.get('type'));
      setTradeFilter(previous => previous.section === category.section && previous.type === category.type ? previous : category);

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
    const previous = previousUrlState.current;
    if (previous.mode === mode && previous.filter === filter && previous.search === search && previous.tradeFilter === tradeFilter) return;
    previousUrlState.current = {mode, filter, search, tradeFilter};

    const params = new URLSearchParams();
    const selectedItem = new URLSearchParams(window.location.search).get('item');
    if (selectedItem && search === selectedItem) params.set('item', selectedItem);
    if (mode !== 'gacha') params.set('mode', mode);
    if (filter !== resolveItemsFilter(mode)) params.set('filter', filter);
    if (search.trim()) params.set('q', search.trim());
    if (mode === 'mmo' && tradeFilter.section) {
      params.set('section', tradeFilter.section);
      if (tradeFilter.type !== null) params.set('type', String(tradeFilter.type));
    }
    const qs = params.toString();
    const newUrl = `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`;
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (newUrl !== currentUrl) window.history.replaceState(window.history.state, '', newUrl);
  }, [mode, filter, search, tradeFilter]);

  const categories = useMemo(() => mmoRows ? getItemsTradeCategories(mmoRows, tradeRules?.categories) : [], [mmoRows, tradeRules?.categories]);
  const selectedCategory = categories.find(category => category.id === tradeFilter.section);
  const selectedType = selectedCategory?.types.find(type => type.index === tradeFilter.type);
  const typeOptions = useMemo(() => {
    const unnamedType = translateUiText('Type {slot}', currentLocale);
    return (selectedCategory ? [selectedCategory] : categories).flatMap(category =>
      category.types.map((entry, index) => {
        const name = entry.name && entry.name !== `#${entry.index}`
          ? entry.name
          : unnamedType.replace('{slot}', numberFormat.format(entry.index));
        return {
          value: `${category.id}:${entry.index}`,
          label: selectedCategory ? name : `${name} · ${category.name}`,
          name,
          section: category.id,
          categoryName: category.name,
          type: entry.index,
          dividerBefore: !selectedCategory && index === 0,
        };
      }),
    );
  }, [categories, selectedCategory, currentLocale, numberFormat]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    return filterItemRows(currentRows, filter, search, undefined, mode === 'mmo' && selectedCategory
      ? {section: selectedCategory.id, type: selectedType?.index ?? null} : undefined);
  }, [currentRows, filter, search, mode, selectedCategory, selectedType]);

  const sortedRows = useMemo(
    () => mode === 'gacha' && sortState.column === 'trade'
      ? sortItemRows(filteredRows, 'num', 'ascending', currentLocale)
      : sortItemRows(filteredRows, sortState.column, sortState.direction, currentLocale),
    [filteredRows, sortState, currentLocale, mode]
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
      prevFilterState.current = { filter, search, mode, tradeFilter };
      return;
    }
    if (
      prevFilterState.current.filter !== filter ||
      prevFilterState.current.search !== search ||
      prevFilterState.current.mode !== mode ||
      prevFilterState.current.tradeFilter !== tradeFilter
    ) {
      prevFilterState.current = { filter, search, mode, tradeFilter };
      loadAllRunRef.current += 1;
      setIsLoadingAll(false);
      setVisibleCount(ITEMS_BATCH_SIZE);
      if (tableWrapRef.current) tableWrapRef.current.scrollTop = 0;
    }
  }, [filter, search, mode, tradeFilter]);

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

  const changeMode = (nextMode: ItemsMode) => {
    setMode(nextMode);
    setFilter(resolveItemsFilter(nextMode));
    setTradeFilter(resolveItemsTradeFilter(nextMode));
  };

  return (
    <div className={`info-ui ${styles.container}`}>
      <h1 className="sr-only">{copy.title}</h1>

      <CatalogControls className={styles.controls} ariaLabel={copy.rowFilterAria} textSelectable>
        <CatalogSearch
          value={search} onChange={setSearch} debounceMs={0}
          placeholder={copy.searchPlaceholder} clearAriaLabel={copy.clearSearch}
          serverModeSlot={
            <ModeSwitcher<ItemsMode>
              value={mode} onChange={changeMode} ariaLabel={copy.itemSourceAria}
              className={styles.modeSwitcher} dataAttribute="data-server-filter"
              options={[
                {value: 'gacha', label: copy.gacha, tone: 'orange'},
                {value: 'mmo', label: copy.mmo, tone: 'rose'},
              ]}
            />
          }
        />
        <CatalogControls.Middle>
          <CatalogControls.Left className={styles.controlFilters}>
            <FilterGroup label={translateUiText('Items', currentLocale)} ariaLabel={copy.rowFilterAria} layout="flow">
              <FilterChip value="all" active={filter === 'all'} onClick={() => setFilter('all')}>{copy.all}</FilterChip>
              <FilterChip value="renamed" active={filter === 'renamed'} onClick={() => setFilter('renamed')}>{copy.renamed}</FilterChip>
            </FilterGroup>
            {mode === 'mmo' ? (
              <FilterGroup label={tradeLabel} ariaLabel={tradeLabel} layout="flow" className="filter-hover-preview">
                <FilterChip value="tradeable" variant="yellow" className={styles.tradeFilter} active={filter === 'tradeable'} onClick={() => setFilter('tradeable')}>
                  {translateUiText('Can be listed', currentLocale)}
                </FilterChip>
                <FilterChip value="unlistable" variant="flame" className={styles.tradeFilter} active={filter === 'unlistable'} onClick={() => setFilter('unlistable')}>
                  {translateUiText('Cannot be listed', currentLocale)}
                </FilterChip>
                {tradeRules?.en && tradeRules.observedAt && tradeRules.serverTimeZone
                  ? <ItemsTradeRules rules={{en: tradeRules.en, observedAt: tradeRules.observedAt, serverTimeZone: tradeRules.serverTimeZone}} locale={currentLocale} />
                  : null}
              </FilterGroup>
            ) : null}
            {mode === 'mmo' && categories.length > 0 ? (
              <div className={styles.tradeCategories}>
                <SortListbox presentation="field" label={null} viewportTopInset={headerInset} ariaLabel={translateUiText('Category', currentLocale)}
                  value={selectedCategory?.id ?? ''} onChange={section => setTradeFilter({section, type: null})}
                  options={[{value: '', label: translateUiText('All categories', currentLocale)},
                    ...categories.map(category => ({value: category.id, label: category.name}))]}
                />
                <SortListbox presentation="field" label={null} viewportTopInset={headerInset} ariaLabel={translateUiText('Type', currentLocale)}
                  value={selectedCategory && selectedType ? `${selectedCategory.id}:${selectedType.index}` : ''}
                  onChange={value => {
                    const option = typeOptions.find(type => type.value === value);
                    setTradeFilter({section: option?.section ?? selectedCategory?.id ?? '', type: option?.type ?? null});
                  }}
                  options={[{value: '', label: translateUiText('All types', currentLocale)}, ...typeOptions]}
                  renderOption={option => {
                    if (selectedCategory || !option.value) return option.label;
                    const type = typeOptions.find(entry => entry.value === option.value);
                    return type ? <span className={styles.tradeTypeOption}>
                      {type.name}<span className={styles.tradeTypeCategory}>{type.categoryName}</span>
                    </span> : option.label;
                  }}
                />
              </div>
            ) : null}
          </CatalogControls.Left>
          <div className={styles.controlsActions}>
            <CatalogCounter count={filteredRows.length} total={currentRows.length} entityLabel={copy.rows}
              formatString={(count, total, label) => <><strong>{numberFormat.format(count)}</strong> / {numberFormat.format(total)} {label}</>}
            />
            <Button size="sm" variant="outline" onClick={() => exportItemsJson(filteredRows, mode)} title={copy.exportJsonAria}>
              {copy.exportJson}
            </Button>
          </div>
        </CatalogControls.Middle>
      </CatalogControls>

      <section className={styles.panel}>
        {/* Scrollable Table View */}
        <div ref={tableWrapRef} className={styles.tableWrap} onScroll={handleTableScroll}>
          {mode === 'mmo' && !mmoRows ? <LoadingState message={copy.loading} /> : filteredRows.length === 0 ? (
            <div className={styles.emptyState}>{copy.noRows}</div>
          ) : (
            <table className={`${styles.table} ${mode === 'mmo' ? styles.tradeTable : ''}`}>
              <colgroup><col/><col/><col/><col/><col/><col/><col/>{mode === 'mmo' ? <><col/><col/></> : null}</colgroup>
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
                    ...(mode === 'mmo' ? [['trade', translateUiText('Reference price', currentLocale), styles.tradeReference] as const] : []),
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
                  {mode === 'mmo' ? <th scope="col" className={styles.tradeRange}>{translateUiText('Listing band', currentLocale)}</th> : null}
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => {
                  const desc = isRu ? row.description_ru || row.description_en : row.description_en;
                  const iconUrl = resolveMediaUrl(row.icon);
                  const borderColor = getRarityBorderColor(row.rarity);
                  const shardLabel = row.trade?.shard ? copy.shard : '';

                  return (
                    <tr
                      key={row.key}
                      className={`${styles.tableRow} ${row.rename ? styles.tableRowRenamed : ''}`}
                    >
                      <td className={styles.cellNum}>{row.num}</td>
                      <td className={styles.cellIcon}>
                        <ItemIconFrame key={iconUrl} iconUrl={iconUrl} name={row.name} borderColor={borderColor}
                          shardLabel={shardLabel} viewImage={copy.viewImage}
                          onOpen={() => setLightboxTarget({png: gameAssetPng(row.icon), webp: iconUrl, name: row.name})}
                          onPreview={rect => setZoomTarget({visible: true, x: rect.right + 12, y: rect.top, name: row.name, icon: iconUrl})}
                          onLeave={() => setZoomTarget(null)}
                        />
                      </td>
                      <td className={styles.cellId}>
                        <button
                          type="button"
                          className={styles.idButton}
                          onClick={() => handleCopyId(row.id)}
                          title={copy.copyIdTitle}
                        >
                          <code className={styles.idCode}>
                            <HighlightedText text={row.id} search={search} />
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                            </svg>
                          </code>
                        </button>
                      </td>
                      <td className={styles.cellName}>
                        <ItemTextDisclosure text={row.name} search={search} />
                      </td>
                      <td className={styles.cellDesc}>
                        <ItemTextDisclosure text={desc} search={search} />
                      </td>
                      <td className={styles.cellOriginal}>
                        <HighlightedText text={row.original} search={search} />
                      </td>
                      <td className={styles.cellRename}>
                        <HighlightedText text={row.rename} search={search} />
                      </td>
                      {mode === 'mmo' ? <ItemsTradeCells trade={row.trade} locale={currentLocale} format={numberFormat} percentFormat={percentFormat} /> : null}
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
