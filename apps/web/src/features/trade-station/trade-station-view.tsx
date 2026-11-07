'use client';

import { localized, translateUiText } from '@tof-hub/i18n';
import { normalizeSearchText } from '@tof-hub/contracts';
import { CatalogCounter, CatalogSearch, CatalogSort, FilterChip, FilterGroup, ResetFiltersButton } from '@tof-hub/ui';
import Link from 'next/link';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { intlLocale } from '@/lib/i18n/format';
import { resolveMediaUrl } from '@/features/datamine/items/items-domain';
import { TRADE_STATION_COPY } from './copy';
import { clampPrice, computeFees, priceLadder, priceStepOf } from './fees';
import type { TradeSort, TradeStationDataset, TradeStationInitialState, TradeStationRow, TradeSectionId } from './types';
import styles from './trade-station.module.css';

const SORT_VALUES: TradeSort[] = ['category', 'price-desc', 'price-asc', 'name-asc'];

interface CalculatorState {
  rowId: string;
  price: number;
  quantityText: string;
  pass: boolean;
}

/** Rows render in pages so a 669-row table does not arrive in one paint. */
const PAGE_SIZE = 60;

/**
 * Filters survive a trip to an item page and back. Session scope: a new tab starts clean, and an
 * explicit bookmark (`?section=…`) always wins over what the tab remembers.
 */
const FILTER_STORAGE_KEY = 'tof-hub:trade-station:filters';

interface StoredFilters {
  search: string;
  section: TradeSectionId | 'all';
  type: number | null;
  sort: TradeSort;
  showUnlistable: boolean;
}

function readStoredFilters(): StoredFilters | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(FILTER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredFilters>;
    return {
      search: typeof parsed.search === 'string' ? parsed.search : '',
      section: typeof parsed.section === 'string' ? (parsed.section as TradeSectionId | 'all') : 'all',
      type: typeof parsed.type === 'number' ? parsed.type : null,
      sort: SORT_VALUES.includes(parsed.sort as TradeSort) ? (parsed.sort as TradeSort) : 'category',
      showUnlistable: parsed.showUnlistable === true,
    };
  } catch {
    return null;
  }
}

function writeStoredFilters(filters: StoredFilters): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filters));
  } catch {
    // A full or blocked sessionStorage must not break filtering.
  }
}

/** `ITEM_QUALITY_LEGENDRY` → `Legendary`; unknown or absent values render nothing. */
function qualityLabel(quality: string): string {
  const bare = quality.replace(/^ITEM_QUALITY_/i, '').toLowerCase();
  // The client spells the tier "LEGENDRY"; showing that typo reads as a site bug.
  if (bare === 'legendry') return 'Legendary';
  return bare ? bare.charAt(0).toUpperCase() + bare.slice(1) : '';
}

function bandPercent(ratio: number): string {
  return formatPercent(Math.round((ratio - 1) * 100));
}

function formatPercent(percent: number): string {
  return `${percent > 0 ? '+' : ''}${percent}%`;
}

/** The client's own icons for `EHottaCurrencyType::TradeDiamond` (Universal Crystal) and Gold. */
const UC_ICON = '/game-assets/webp/Hotta/Content/Resources/Icon/huobi/tradediamond.webp';
const GOLD_ICON = '/game-assets/webp/Hotta/Content/Resources/Icon/huobi/jinbi.webp';

/**
 * Decorative where a note or label already names the unit; the fee note has replaced its words with
 * icons, so it passes `label` and the icon keeps the currency readable for a screen reader.
 */
function UcIcon({ label }: { label?: string }) {
  return <CurrencyIcon icon={UC_ICON} label={label} />;
}

function GoldIcon({ label }: { label?: string }) {
  return <CurrencyIcon icon={GOLD_ICON} label={label} />;
}

function CurrencyIcon({ icon, label }: { icon: string; label?: string }) {
  return <img className={styles.currencyIcon} src={icon} alt={label ?? ''} loading="lazy" />;
}

/**
 * `10 shards → 1 × {name} · reference {price}` — the price carries the UC icon, so the template is
 * split around `{price}` instead of substituted.
 */
function ShardPriceHint({ template, name, price }: { template: string; name: string; price: string }) {
  const [before, after] = template.split('{price}');
  return (
    <>
      {before.replace('{name}', name)}
      <span className={styles.ucValue}>
        {price} <UcIcon />
      </span>
      {after}
    </>
  );
}

/** `Listing fee is charged in {gold}, sale fee in {uc}.` — each placeholder becomes its client icon. */
function FeeCurrencyNote({
  template,
  goldLabel,
  ucLabel,
}: {
  template: string;
  goldLabel: string;
  ucLabel: string;
}) {
  const [prefix, rest] = template.split('{gold}');
  const [between, suffix] = rest.split('{uc}');
  return (
    <>
      {prefix}
      <GoldIcon label={goldLabel} />
      {between}
      <UcIcon label={ucLabel} />
      {suffix}
    </>
  );
}

export function TradeStationView({ dataset, initial }: { dataset: TradeStationDataset; initial: TradeStationInitialState }) {
  const { locale } = useI18n();
  const copy = localized(TRADE_STATION_COPY, locale);
  const numberFormat = useMemo(() => new Intl.NumberFormat(intlLocale(locale)), [locale]);
  // The step count sits inside a sentence; splitting lets the UC icon follow the number.
  const [priceStepPrefix, priceStepSuffix] = copy.priceStepNote.split('{step}');

  const [search, setSearch] = useState(initial.search);
  const [section, setSection] = useState<TradeSectionId | 'all'>(initial.section);
  const [type, setType] = useState<number | null>(initial.type);
  const [sort, setSort] = useState<TradeSort>(initial.sort);
  const [showUnlistable, setShowUnlistable] = useState(initial.showUnlistable);
  const [calculator, setCalculator] = useState<CalculatorState | null>(null);
  const [limit, setLimit] = useState(PAGE_SIZE);
  // Assets a game patch moved or dropped must degrade to the placeholder, not to a broken image.
  const [failedIcons, setFailedIcons] = useState<ReadonlySet<string>>(() => new Set());
  // Flips once the tab's stored filters are in state; until then the sync effect must not stamp the
  // default set over them. A ref cannot do this job: the effect that would overwrite the storage runs
  // immediately after the restore effect in the same commit.
  const [filtersReady, setFiltersReady] = useState(initial.explicit);
  const priceSelectRef = useRef<HTMLSelectElement>(null);

  const sectionOrder = useMemo(
    () => new Map(dataset.sections.map((entry, index) => [entry.id, index])),
    [dataset.sections],
  );
  const activeSection = useMemo(
    () => dataset.sections.find((entry) => entry.id === section) ?? null,
    [dataset.sections, section],
  );

  // Every listable row sits in a single SubTypeIndex, so only the type axis narrows the list.
  const types = activeSection?.types ?? [];

  // A declared type can hold no tradeable rows (Normal Supply's Equipment Expansion Packs are all
  // unlistable), so a chip that can only ever yield an empty table is not rendered.
  const typeCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const row of dataset.rows) {
      if (!row.canList && !showUnlistable) continue;
      if (section !== 'all' && row.section !== section) continue;
      counts.set(row.type, (counts.get(row.type) ?? 0) + 1);
    }
    return counts;
  }, [dataset.rows, section, showUnlistable]);

  // The chip for the active type always stays, so unfiltering never turns into a hidden state.
  const visibleTypes = types.filter(
    (entry) => entry.index === type || (typeCounts.get(entry.index) ?? 0) > 0,
  );

  const onSectionChange = useCallback((value: TradeSectionId | 'all') => {
    setSection(value);
    setType(null);
  }, []);

  const resetFilters = useCallback(() => {
    setSearch('');
    setSection('all');
    setType(null);
    setShowUnlistable(false);
  }, []);

  const hasActiveFilters = search !== '' || section !== 'all' || type !== null || showUnlistable;

  const listableTotal = useMemo(() => dataset.rows.filter((row) => row.canList).length, [dataset.rows]);

  const rows = useMemo(() => {
    const query = normalizeSearchText(search.trim());
    const matching = dataset.rows.filter((row) => {
      if (!row.canList && !showUnlistable) return false;
      if (section !== 'all' && row.section !== section) return false;
      if (type !== null && row.type !== type) return false;
      if (!query) return true;
      return normalizeSearchText(`${row.name ?? ''} ${row.id}`).includes(query);
    });

    const categoryOf = (row: TradeStationRow) =>
      (sectionOrder.get(row.section) ?? 0) * 10000 + row.type;
    const nameOf = (row: TradeStationRow) => normalizeSearchText(row.name ?? row.id);

    matching.sort((a, b) => {
      switch (sort) {
        case 'price-desc':
          return b.basePrice - a.basePrice || nameOf(a).localeCompare(nameOf(b));
        case 'price-asc':
          return a.basePrice - b.basePrice || nameOf(a).localeCompare(nameOf(b));
        case 'name-asc':
          return nameOf(a).localeCompare(nameOf(b));
        default:
          return categoryOf(a) - categoryOf(b) || b.basePrice - a.basePrice;
      }
    });
    return matching;
  }, [dataset.rows, search, section, type, sort, showUnlistable, sectionOrder]);

  // A fresh filter set starts a new page; the previous limit would land the user past their query.
  useEffect(() => setLimit(PAGE_SIZE), [search, section, type, sort, showUnlistable]);
  const visibleRows = rows.slice(0, limit);
  const rowsById = useMemo(() => new Map(dataset.rows.map((row) => [row.id, row])), [dataset.rows]);

  // Restore the tab's last filter set, unless this URL states its own.
  useEffect(() => {
    if (initial.explicit) return;
    const stored = readStoredFilters();
    if (stored) {
      setSearch(stored.search);
      setSection(stored.section);
      setType(stored.type);
      setSort(stored.sort);
      setShowUnlistable(stored.showUnlistable);
    }
    setFiltersReady(true);
  }, [initial.explicit]);

  // Mirror the view state into the URL so a filtered table can be shared and reloaded, and keep the
  // tab's copy so leaving for an item page does not reset the table.
  useEffect(() => {
    const params = new URLSearchParams();
    if (section !== 'all') params.set('section', section);
    if (type !== null) params.set('type', String(type));
    if (sort !== 'category') params.set('sort', sort);
    if (showUnlistable) params.set('all', '1');
    if (search.trim()) params.set('q', search.trim());
    const next = `${window.location.pathname}${params.size ? `?${params}` : ''}`;
    window.history.replaceState(null, '', next);
    if (filtersReady) writeStoredFilters({ search, section, type, sort, showUnlistable });
  }, [search, section, type, sort, showUnlistable, filtersReady]);

  useEffect(() => {
    if (calculator) priceSelectRef.current?.focus();
  }, [calculator?.rowId]);

  const openCalculator = useCallback((row: TradeStationRow) => {
    setCalculator((current) =>
      current?.rowId === row.id
        ? null
        : { rowId: row.id, price: row.basePrice, quantityText: '1', pass: false },
    );
  }, []);

  const sortOptions = useMemo(
    () => [
      { value: 'category', label: copy.sortCategory },
      { value: 'price-desc', label: copy.sortPriceDesc },
      { value: 'price-asc', label: copy.sortPriceAsc },
      { value: 'name-asc', label: copy.sortNameAsc },
    ],
    [copy],
  );

  return (
    <div className={styles.container}>
      <header className={styles.hero}>
        <p className={styles.eyebrow}>{copy.eyebrow}</p>
        <h1 className={styles.title}>{copy.title}</h1>
        <p className={styles.subtitle}>{copy.subtitle}</p>
      </header>

      {dataset.rules ? (
        <details className={styles.rules}>
          <summary className={styles.rulesSummary}>{copy.rulesTitle}</summary>
          <div className={styles.rulesMeta}>
            <span>{copy.rulesObserved}: {dataset.rules.observedAt}</span>
            <span>{copy.rulesTimeZone}: {dataset.rules.serverTimeZone}</span>
          </div>
          {dataset.rules.en.sections.map((entry) => (
            <section key={entry.title} className={styles.rulesSection}>
              <h2 className={styles.rulesHeading}>{entry.title}</h2>
              <ol className={styles.rulesList}>
                {entry.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
            </section>
          ))}
        </details>
      ) : (
        <p className={styles.rulesMissing}>{copy.rulesMissing}</p>
      )}

      <div className={styles.controls}>
        <CatalogSearch value={search} onChange={setSearch} placeholder={copy.searchPlaceholder} />
        <FilterGroup label={copy.sectionLabel} layout="flow" ariaLabel={copy.sectionLabel}>
          <FilterChip value="all" active={section === 'all'} onClick={() => onSectionChange('all')}>
            {copy.all}
          </FilterChip>
          {dataset.sections.map((entry) => (
            <FilterChip
              key={entry.id}
              value={entry.id}
              active={section === entry.id}
              onClick={() => onSectionChange(entry.id)}
            >
              {entry.name}
            </FilterChip>
          ))}
        </FilterGroup>

        {visibleTypes.length > 0 ? (
          <FilterGroup label={copy.typeLabel} layout="flow" ariaLabel={copy.typeLabel}>
            <FilterChip value="all" active={type === null} onClick={() => setType(null)}>
              {copy.all}
            </FilterChip>
            {visibleTypes.map((entry) => (
              <FilterChip
                key={entry.index}
                value={String(entry.index)}
                active={type === entry.index}
                onClick={() => setType(type === entry.index ? null : entry.index)}
              >
                {entry.name}
              </FilterChip>
            ))}
          </FilterGroup>
        ) : null}

        <FilterGroup label={copy.rowsUnit} layout="flow" ariaLabel={copy.rowsUnit}>
          <FilterChip
            value="all-items"
            active={showUnlistable}
            onClick={() => setShowUnlistable(!showUnlistable)}
            title={copy.notListableReason}
          >
            {copy.showUnlistable}
          </FilterChip>
        </FilterGroup>

        <div className={styles.controlsFooter}>
          <CatalogCounter
            count={rows.length}
            total={showUnlistable ? dataset.rows.length : listableTotal}
            entityLabel={copy.rowsUnit}
          />
          <CatalogSort value={sort} onChange={(value) => setSort(SORT_VALUES.includes(value as TradeSort) ? (value as TradeSort) : 'category')} options={sortOptions} label={copy.sortLabel} />
          {hasActiveFilters ? <ResetFiltersButton onClick={resetFilters} label={copy.resetFilters} /> : null}
        </div>
      </div>

      <div className={styles.currencyNote}>
        <UcIcon /> {copy.currencyNote.replace('{currency}', dataset.currency.name)}
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">{copy.itemColumn}</th>
              <th scope="col">{copy.referencePriceColumn}</th>
              <th scope="col">{copy.listingBandColumn}</th>
              <th scope="col">{copy.qualityColumn}</th>
              <th scope="col" aria-label={copy.viewItem} />
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => {
              const isOpen = calculator?.rowId === row.id;
              const typedQuantity = isOpen && calculator ? Number(calculator.quantityText) : 1;
              const price = clampPrice(
                isOpen && calculator ? calculator.price : row.basePrice,
                row.minPrice,
                row.maxPrice,
              );
              const quantity = Number.isFinite(typedQuantity)
                ? Math.min(999, Math.max(1, Math.round(typedQuantity)))
                : 1;
              const fees = isOpen ? computeFees(price, quantity, calculator.pass) : null;
              const rungs = isOpen ? priceLadder(row) : [];
              const activeRung = rungs.find((rung) => rung.price === price);
              return (
                <React.Fragment key={row.id}>
                  <tr className={row.canList ? styles.row : styles.rowUnlistable}>
                    <th scope="row" className={styles.itemCell}>
                      <div className={styles.itemCellInner}>
                        <span className={styles.iconStack}>
                          {row.icon && !failedIcons.has(row.icon) ? (
                            <img
                              className={styles.icon}
                              src={resolveMediaUrl(row.icon)}
                              alt=""
                              loading="lazy"
                              decoding="async"
                              width={32}
                              height={32}
                              onError={() =>
                                setFailedIcons((current) => new Set(current).add(row.icon))
                              }
                            />
                          ) : (
                            <span className={styles.iconPlaceholder} aria-hidden="true" />
                          )}
                          {row.shard ? <span className={styles.shardBadge}>{copy.shardBadge}</span> : null}
                        </span>
                        <span className={styles.itemText}>
                          <button
                            type="button"
                            className={styles.itemName}
                            aria-expanded={isOpen}
                            aria-controls={`calc-${row.id}`}
                            onClick={() => openCalculator(row)}
                          >
                            {row.name ?? copy.missingName}
                          </button>
                          <span className={styles.itemId}>{row.id}</span>
                          {row.shard ? (
                            <span className={styles.shardHint}>
                              {row.shardOfId ? (
                                <ShardPriceHint
                                  template={copy.shardCombinesIntoNamed}
                                  name={rowsById.get(row.shardOfId)?.name ?? row.shardOfId}
                                  price={numberFormat.format(rowsById.get(row.shardOfId)?.basePrice ?? 0)}
                                />
                              ) : (
                                copy.shardCombinesInto
                              )}
                            </span>
                          ) : null}
                          {!row.canList ? <span className={styles.badgeWarn}>{copy.notListable}</span> : null}
                          {row.bindOnPurchase ? <span className={styles.badge}>{copy.bindOnPurchase}</span> : null}
                        </span>
                      </div>
                    </th>
                    <td>
                      <span className={styles.ucValue}>
                        <span className={styles.numeric}>{numberFormat.format(row.basePrice)}</span> <UcIcon />
                      </span>
                    </td>
                    <td>
                      <div className={styles.bandCell}>
                        <span className={styles.ucValue}>
                          <span className={styles.numeric}>
                            {numberFormat.format(row.minPrice)} – {numberFormat.format(row.maxPrice)}
                          </span>{' '}
                          <UcIcon />
                        </span>
                        <span className={styles.ratios}>
                          {bandPercent(row.minRatio)} / {bandPercent(row.maxRatio)}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className={styles.quality}>{qualityLabel(row.quality)}</span>
                    </td>
                    <td className={styles.actions}>
                      <Link
                        className={styles.linkButton}
                        href={`/datamine/items/?mode=mmo&q=${encodeURIComponent(row.id)}`}
                        title={copy.openInItems}
                      >
                        {copy.viewItem}
                      </Link>
                    </td>
                  </tr>
                  {isOpen && calculator && fees ? (
                    <tr className={styles.calculatorRow} id={`calc-${row.id}`}>
                      <td colSpan={5}>
                        <div
                          className={styles.calculator}
                          onKeyDown={(event) => {
                            if (event.key === 'Escape') {
                              event.stopPropagation();
                              setCalculator(null);
                            }
                          }}
                        >
                          <div className={styles.calculatorHead}>
                            <h2 className={styles.calculatorTitle}>{copy.calculatorTitle}</h2>
                            <span className={styles.muted}>
                              {copy.listingBandColumn}:{' '}
                              <span className={styles.ucValue}>
                                {row.minPrice} – {row.maxPrice} <UcIcon />
                              </span>
                            </span>
                            {row.bandSource === 'server' ? (
                              <span className={styles.muted}>
                                {copy.serverBandNote
                                  .replace('{min}', bandPercent(row.minRatio))
                                  .replace('{max}', bandPercent(row.maxRatio))
                                  .replace('{step}', formatPercent(Math.round(row.priceStep * 1e6) / 1e4))}
                              </span>
                            ) : (
                              <span className={styles.muted}>
                                {priceStepPrefix}
                                <span className={styles.ucValue}>
                                  {numberFormat.format(priceStepOf(row.basePrice, row.priceStep))} <UcIcon />
                                </span>
                                {priceStepSuffix}
                              </span>
                            )}
                          </div>
                          <div className={styles.calculatorInputs}>
                            <label className={styles.field}>
                              <span>
                                {copy.pricePerUnit}:{' '}
                                <span className={styles.ucValue}>
                                  {numberFormat.format(price)} <UcIcon />
                                </span>{' '}
                                <span className={styles.muted}>
                                  ({activeRung ? formatPercent(activeRung.percent) : bandPercent(price / row.basePrice)})
                                </span>
                              </span>
                              <select
                                ref={priceSelectRef}
                                value={price}
                                onChange={(event) => setCalculator({ ...calculator, price: Number(event.target.value) })}
                              >
                                {rungs.map((rung) => (
                                  <option key={rung.price} value={rung.price}>
                                    {numberFormat.format(rung.price)} · {formatPercent(rung.percent)}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className={styles.field}>
                              <span>{copy.quantityLabel}</span>
                              <input
                                type="number"
                                min={1}
                                max={999}
                                step={1}
                                value={calculator.quantityText}
                                onChange={(event) => setCalculator({ ...calculator, quantityText: event.target.value })}
                                onBlur={() =>
                                  setCalculator({ ...calculator, quantityText: String(quantity) })
                                }
                              />
                            </label>
                            <label className={styles.checkbox}>
                              <input
                                type="checkbox"
                                checked={calculator.pass}
                                onChange={(event) => setCalculator({ ...calculator, pass: event.target.checked })}
                              />
                              <span>{copy.passLabel}</span>
                            </label>
                          </div>
                          <dl className={styles.breakdown}>
                            <div>
                              <dt>{copy.grossLabel}</dt>
                              <dd><span className={styles.ucValue}>{numberFormat.format(fees.grossUC)} <UcIcon /></span></dd>
                            </div>
                            <div>
                              <dt>{copy.listingFeeLabel}</dt>
                              <dd><span className={styles.ucValue}>{numberFormat.format(fees.listingFeeGold)} <GoldIcon /></span></dd>
                            </div>
                            <div>
                              <dt>{copy.saleFeeLabel}</dt>
                              <dd><span className={styles.ucValue}>{numberFormat.format(fees.saleFeeUC)} <UcIcon /></span></dd>
                            </div>
                            <div className={styles.strong}>
                              <dt>{copy.netLabel}</dt>
                              <dd><span className={styles.ucValue}>{numberFormat.format(fees.netUC)} <UcIcon /></span></dd>
                            </div>
                          </dl>
                          <p className={styles.feeNote}>
                            <FeeCurrencyNote
                              template={copy.feeCurrencyNote}
                              goldLabel={translateUiText('Gold', locale)}
                              ucLabel={dataset.currency.name}
                            />
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 ? <p className={styles.empty}>{copy.noRows}</p> : null}
      </div>

      {rows.length > limit ? (
        <div className={styles.loadMoreRow}>
          <button
            type="button"
            className={styles.loadMoreButton}
            onClick={() => setLimit((current) => current + PAGE_SIZE)}
          >
            {copy.loadMore.replace('{count}', numberFormat.format(rows.length - limit))}
          </button>
          <button type="button" className={styles.loadMoreButton} onClick={() => setLimit(rows.length)}>
            {copy.loadAll.replace('{total}', numberFormat.format(rows.length))}
          </button>
        </div>
      ) : null}

      <p className={styles.bandNote}>{copy.bandNote}</p>
    </div>
  );
}
