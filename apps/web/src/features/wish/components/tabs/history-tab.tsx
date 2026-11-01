'use client';
import { localeText } from '@/lib/i18n/text';
import { localized } from '@tof-hub/i18n';
import { formatWishPosition } from '../../format-wish-position';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { WishRecordDto, WishBannerDto } from '@tof-hub/contracts';
import { Tooltip, useDismiss } from '@tof-hub/ui';
import { WISH_TRANSLATIONS, type WishLocale } from '../../wish-i18n';
import { getMatrixSlotVisual } from '../../matrix-slot-visual';
import type { WishFilters, BannerKind, PrimaryCategory } from '../../types';
import { useWishMediaMap, resolvePullMedia } from '../../pull-media';
import { formatPullDate, formatPullDay } from '../../format-pull-date';
import { downloadBlob } from '@/lib/download';

interface HistoryTabProps {
  pulls: WishRecordDto[];
  exportPulls: WishRecordDto[];
  totalFiltered: number;
  viewMode: 'cards' | 'table';
  onViewModeChange: (mode: 'cards' | 'table') => void;
  filters: WishFilters;
  onFilterChange: (filters: WishFilters) => void;
  hasMore: boolean;
  onLoadMore: () => void;
  activeKind: BannerKind;
  activeBannerId?: string;
  onBannerSelect?: (bannerId: string) => void;
  allPlayerBanners?: WishBannerDto[];
  bannerPullCounts?: Record<string, number>;
  locale: WishLocale;
}

interface WishExportRow {
  number: number | string;
  dateTime: string;
  banner: string;
  item: string;
  itemId: string;
  itemType: string;
  slot: string;
  rarity: string;
  pityPosition: string;
  guaranteed: boolean;
  outcome: string;
  compensation: number;
  compensationCurrency: string;
}

interface ZipFile {
  name: string;
  content: string;
}

// Package the small OOXML workbook directly so the page does not need a spreadsheet library.
const crc32Table = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});

function crc32(bytes: Uint8Array): number {
  let checksum = 0xffffffff;
  for (const byte of bytes) checksum = crc32Table[(checksum ^ byte) & 0xff] ^ (checksum >>> 8);
  return (checksum ^ 0xffffffff) >>> 0;
}

function concatenateBytes(parts: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function createStoredZip(files: ZipFile[]): Uint8Array {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let localOffset = 0;

  for (const file of files) {
    const name = encoder.encode(file.name);
    const content = encoder.encode(file.content);
    const checksum = crc32(content);
    const localHeader = new Uint8Array(30 + name.length);
    const localView = new DataView(localHeader.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint32(14, checksum, true);
    localView.setUint32(18, content.length, true);
    localView.setUint32(22, content.length, true);
    localView.setUint16(26, name.length, true);
    localHeader.set(name, 30);
    localParts.push(localHeader, content);

    const centralHeader = new Uint8Array(46 + name.length);
    const centralView = new DataView(centralHeader.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint32(16, checksum, true);
    centralView.setUint32(20, content.length, true);
    centralView.setUint32(24, content.length, true);
    centralView.setUint16(28, name.length, true);
    centralView.setUint32(42, localOffset, true);
    centralHeader.set(name, 46);
    centralParts.push(centralHeader);
    localOffset += localHeader.length + content.length;
  }

  const centralDirectory = concatenateBytes(centralParts);
  const endRecord = new Uint8Array(22);
  const endView = new DataView(endRecord.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, centralDirectory.length, true);
  endView.setUint32(16, localOffset, true);
  return concatenateBytes([...localParts, centralDirectory, endRecord]);
}

function escapeXml(value: unknown): string {
  return String(value ?? '').replace(/[<>&"']/g, (character) => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    '"': '&quot;',
    "'": '&apos;',
  })[character] ?? character);
}

function createWishWorkbook(headers: string[], rows: WishExportRow[], locale: WishLocale): Uint8Array {
  const columns = [
    'number', 'dateTime', 'banner', 'item', 'itemId', 'itemType', 'slot',
    'rarity', 'pityPosition', 'guaranteed', 'outcome', 'compensation', 'compensationCurrency',
  ] as const;
  const columnName = (index: number) => {
    let value = index + 1;
    let name = '';
    while (value > 0) {
      const remainder = (value - 1) % 26;
      name = String.fromCharCode(65 + remainder) + name;
      value = Math.floor((value - 1) / 26);
    }
    return name;
  };
  const values = rows.map((row) => columns.map((column) => row[column]));
  const columnWidths = headers.map((header, index) => {
    const longest = values.reduce(
      (maximum, row) => Math.max(maximum, String(row[index] ?? '').length),
      header.length,
    );
    return Math.min(52, Math.max(10, longest + 2));
  });
  const makeCell = (reference: string, value: unknown, header = false) => {
    const style = header ? ' s="1"' : '';
    if (typeof value === 'number' && Number.isFinite(value)) {
      return `<c r="${reference}"${style}><v>${value}</v></c>`;
    }
    if (typeof value === 'boolean') {
      return `<c r="${reference}"${style} t="b"><v>${value ? 1 : 0}</v></c>`;
    }
    return `<c r="${reference}"${style} t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
  };
  const headerRow = `<row r="1">${headers.map((value, index) => makeCell(`${columnName(index)}1`, value, true)).join('')}</row>`;
  const dataRows = values.map((row, rowIndex) => {
    const number = rowIndex + 2;
    return `<row r="${number}">${row.map((value, columnIndex) => makeCell(`${columnName(columnIndex)}${number}`, value)).join('')}</row>`;
  }).join('');
  const lastCell = `${columnName(headers.length - 1)}${rows.length + 1}`;
  const sheetName = localeText(locale)('Wish History');
  const xmlHeader = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

  return createStoredZip([
    { name: '[Content_Types].xml', content: `${xmlHeader}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>` },
    { name: '_rels/.rels', content: `${xmlHeader}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { name: 'xl/workbook.xml', content: `${xmlHeader}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${escapeXml(sheetName)}" sheetId="1" r:id="rId1"/></sheets></workbook>` },
    { name: 'xl/_rels/workbook.xml.rels', content: `${xmlHeader}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
    { name: 'xl/styles.xml', content: `${xmlHeader}<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1F2937"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs></styleSheet>` },
    { name: 'xl/worksheets/sheet1.xml', content: `${xmlHeader}<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols>${columnWidths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join('')}</cols><sheetData>${headerRow}${dataRows}</sheetData><autoFilter ref="A1:${lastCell}"/></worksheet>` },
  ]);
}

function FallbackSvg({ type }: { type: WishRecordDto['item_type'] }) {
  if (type === 'matrix') {
    return (
      <svg className="w-6 h-6 text-[#64748b]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="5" y="5" width="14" height="14" rx="2" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="9" y="9" width="6" height="6" rx="1" strokeLinecap="round" strokeLinejoin="round" />
        <path strokeLinecap="round" d="M9 1v4M15 1v4M9 19v4M15 19v4M1 9h4M1 15h4M19 9h4M19 15h4" />
      </svg>
    );
  }
  return (
    <svg className="w-6 h-6 text-[#64748b]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.5 9.5 21 3m0 0h-5m5 0v5M3 21l6.5-6.5m0 0L7 12l5.5-5.5 2.5 2.5L9.5 14.5Zm0 0L12 17l-5.5 5.5-2.5-2.5L9.5 14.5Z" />
    </svg>
  );
}

function CircularMediaImage({
  src,
  alt,
  itemType,
  imageScale = 'default',
  portraitZoom,
}: {
  src: string | null;
  alt: string;
  itemType: WishRecordDto['item_type'];
  imageScale?: 'default' | 'portrait' | 'small-weapon';
  portraitZoom?: 'tight' | null;
}) {
  const [hasError, setHasError] = useState(false);

  if (!src || hasError) {
    return (
      <div className={`w-full h-full flex items-center justify-center bg-[#07090f] ${itemType === 'matrix' ? 'rounded-lg' : 'rounded-full'}`}>
        <FallbackSvg type={itemType} />
      </div>
    );
  }

  const isTransparentIcon =
    src.includes('ChaJian') ||
    src.includes('CaJian') ||
    src.includes('/Icon/item/') ||
    src.includes('/Icon/weapon/') ||
    src.includes('UI_UP_');
  const scaleClass = imageScale === 'portrait'
    ? portraitZoom === 'tight' ? 'scale-[1.75]' : 'scale-150'
    : imageScale === 'small-weapon' ? 'scale-[1.65]' : '';

  return (
    <img
      src={src}
      alt={alt}
      onError={() => setHasError(true)}
      className={`w-full h-full ${
        itemType === 'matrix'
          ? 'object-contain p-0.5 rounded-lg'
          : isTransparentIcon || imageScale !== 'default'
          ? `object-contain p-1 rounded-full ${scaleClass}`
          : 'object-cover rounded-full'
      }`}
      loading="lazy"
    />
  );
}

export function HistoryTab({
  pulls,
  exportPulls,
  totalFiltered,
  viewMode,
  onViewModeChange,
  filters,
  onFilterChange,
  hasMore,
  onLoadMore,
  activeKind,
  activeBannerId,
  onBannerSelect,
  allPlayerBanners = [],
  bannerPullCounts = {},
  locale,
}: HistoryTabProps) {
  const loadMoreSentinelRef = useRef<HTMLDivElement>(null);
  const pullGalleryRef = useRef<HTMLDivElement>(null);
  const [pinnedTooltipRecordId, setPinnedTooltipRecordId] = useState<string | null>(null);
  const [collapsedDates, setCollapsedDates] = useState<Set<string>>(() => new Set());
  const t = localized(WISH_TRANSLATIONS, locale) ?? WISH_TRANSLATIONS.en;
  const mediaMap = useWishMediaMap();

  useDismiss({ refs: [pullGalleryRef], onDismiss: () => setPinnedTooltipRecordId(null), enabled: !!pinnedTooltipRecordId, capture: true });

  useEffect(() => {
    setPinnedTooltipRecordId(null);
  }, [viewMode]);

  useEffect(() => {
    const sentinel = loadMoreSentinelRef.current;
    if (!sentinel || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) onLoadMore();
      },
      { rootMargin: '0px 0px 500px 0px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, onLoadMore, pulls.length]);

  const gapsBefore = useMemo(() => {
    const gaps = new Map<string, number>();
    const previous = new Map<string, {number: number; unanchored: number}>();
    const sorted = [...exportPulls].sort((a, b) => a.pull_timestamp.localeCompare(b.pull_timestamp)
      || (a.group_ticks ?? '').localeCompare(b.group_ticks ?? '') || (a.item_index ?? 0) - (b.item_index ?? 0));
    for (const pull of sorted) {
      const last = previous.get(pull.banner_type) ?? {number: 0, unanchored: 0};
      if (pull.track_pull_number === undefined) {
        previous.set(pull.banner_type, {...last, unanchored: last.unanchored + 1});
        continue;
      }
      const gap = pull.track_pull_number - last.number - last.unanchored - 1;
      if (gap > 0) gaps.set(pull.id, gap);
      previous.set(pull.banner_type, {number: pull.track_pull_number, unanchored: 0});
    }
    return gaps;
  }, [exportPulls]);

  // Banner map for lookup
  const bannerMap = useMemo(() => {
    const map = new Map<string, WishBannerDto>();
    for (const b of allPlayerBanners) {
      map.set(b.id, b);
    }
    return map;
  }, [allPlayerBanners]);

  // Group banners by category and type
  const categorizedBanners = useMemo(() => {
    return allPlayerBanners.filter((b) => {
      if (filters.primaryCategory === 'all') return true;
      if (filters.primaryCategory === 'limited') {
        return b.banner_type === 'weapon_limited' || b.banner_type === 'matrix_limited';
      }
      if (filters.primaryCategory === 'standard') {
        return b.banner_type === 'standard_weapon' || b.banner_type === 'standard_matrix';
      }
      if (filters.primaryCategory === 'black_nucleus') {
        return b.banner_type === 'black_nucleus';
      }
      return true;
    });
  }, [allPlayerBanners, filters.primaryCategory]);

  const weaponBanners = useMemo(() => {
    return categorizedBanners.filter((b) => !b.banner_type.includes('matrix'));
  }, [categorizedBanners]);

  const matrixBanners = useMemo(() => {
    return categorizedBanners.filter((b) => b.banner_type.includes('matrix'));
  }, [categorizedBanners]);

  // Total counts for rows
  const totalWeaponPulls = useMemo(() => {
    return weaponBanners.reduce((acc, b) => acc + (bannerPullCounts[b.id] ?? 0), 0);
  }, [weaponBanners, bannerPullCounts]);

  const totalMatrixPulls = useMemo(() => {
    return matrixBanners.reduce((acc, b) => acc + (bannerPullCounts[b.id] ?? 0), 0);
  }, [matrixBanners, bannerPullCounts]);

  // Stats for the active selected banner / group
  const activeStats = useMemo(() => {
    let ssr = 0;
    let sr = 0;
    for (const p of pulls) {
      if (p.rarity === 5) ssr++;
      else if (p.rarity === 4) sr++;
    }
    const ssrRate = pulls.length > 0 ? ((ssr / pulls.length) * 100).toFixed(2) : '0.00';
    const rateNum = Number(ssrRate);
    const luckRating =
      rateNum >= 2.5
        ? '3.1x — Very Lucky'
        : rateNum >= 1.8
        ? '1.4x — Lucky'
        : rateNum >= 1.0
        ? '1.0x — Expected'
        : '0.6x — Unlucky';

    return {
      total: pulls.length,
      ssr,
      sr,
      ssrRate,
      luckRating,
    };
  }, [pulls]);

  // Group pulls by date for the grid view
  const groupedPulls = useMemo(() => {
    const groups: Array<{
      dateKey: string;
      dateLabel: string;
      items: Array<{ record: WishRecordDto; pullNumber: number }>;
    }> = [];
    const map: Record<
      string,
      { dateKey: string; dateLabel: string; items: Array<{ record: WishRecordDto; pullNumber: number }> }
    > = {};

    pulls.forEach((record, i) => {
      const pullNumber = record.track_pull_number ?? (record.raw_banner_code ? -1 : i + 1);
      const dateStr = record.pull_timestamp.slice(0, 10);
      if (!map[dateStr]) {
        const dateLabel = formatPullDay(record.pull_timestamp, locale);

        map[dateStr] = {
          dateKey: dateStr,
          dateLabel,
          items: [],
        };
        groups.push(map[dateStr]);
      }
      map[dateStr].items.push({ record, pullNumber });
    });

    return groups;
  }, [pulls, locale]);

  const handleCategorySelect = (cat: PrimaryCategory) => {
    onFilterChange({ ...filters, primaryCategory: cat, bannerId: 'all' });
  };

  const handleBannerSelect = (bannerId: string) => {
    onFilterChange({ ...filters, bannerId });
  };

  const handleRaritySelect = (r: WishFilters['rarity']) => {
    onFilterChange({ ...filters, rarity: r });
  };

  const toggleHideLosses = () => {
    onFilterChange({ ...filters, hideLosses: !filters.hideLosses });
  };

  const getExportRows = () => exportPulls.map((record, index) => {
    const banner = bannerMap.get(record.banner_id);
    const pityLimit = record.banner_type === 'black_nucleus'
      ? ''
      : record.banner_type.includes('matrix') ? 40 : 80;
    const outcome = record.streak_outcome ?? (record.rarity === 5 && (record.banner_type === 'standard_weapon' || record.banner_type === 'standard_matrix' || record.banner_type === 'black_nucleus')
      ? 'standard'
      : record.rarity === 5 ? (record.is_featured ? 'win' : 'loss') : '');

    return {
      number: record.track_pull_number ?? (record.raw_banner_code ? '?' : index + 1),
      dateTime: record.pull_timestamp.slice(0, 19).replace('T', ' '),
      banner: banner ? (locale === 'ru' ? banner.name_ru : banner.name_en) : record.banner_id,
      item: locale === 'ru' ? (record.item_name_ru ?? record.item_name) : record.item_name,
      itemId: record.item_id,
      itemType: record.item_type,
      slot: record.slot ?? '',
      rarity: `${record.rarity}★`,
      pityPosition: record.banner_type === 'black_nucleus' ? `#${formatWishPosition(record.pity_count)}` : `${formatWishPosition(record.pity_count)} / ${pityLimit}`,
      guaranteed: record.is_guaranteed_pity,
      outcome,
      compensation: record.compensation?.amount ?? 0,
      compensationCurrency: record.compensation?.currency_id ?? '',
    };
  });

  const downloadFile = (contents: BlobPart, type: string, extension: string) => {
    downloadBlob(contents, type, `wish-history-${new Date().toISOString().slice(0, 10)}.${extension}`);
  };

  const exportJson = () => {
    downloadFile(JSON.stringify(getExportRows(), null, 2), 'application/json;charset=utf-8', 'json');
  };

  const exportExcel = () => {
    const headers = locale === 'ru'
      ? ['№', 'Дата и время', 'Баннер', 'Предмет', 'ID предмета', 'Тип предмета', 'Слот', 'Редкость', 'Пити', 'Гарант', 'Исход', 'Компенсация', 'Валюта']
      : ['#', 'Date & time', 'Banner', 'Item', 'Item ID', 'Type', 'Slot', 'Rarity', 'Pity', 'Guaranteed', 'Outcome', 'Compensation', 'Currency'];
    const workbook = createWishWorkbook(headers, getExportRows(), locale);
    const workbookBuffer = workbook.buffer.slice(
      workbook.byteOffset,
      workbook.byteOffset + workbook.byteLength,
    ) as ArrayBuffer;
    downloadFile(workbookBuffer, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'xlsx');
  };

  // Get active banner title for header
  const activeBannerName = useMemo(() => {
    const bannerId = activeBannerId ?? filters.bannerId;
    if (bannerId === 'characters') return t.bannerCharacters;
    if (bannerId === 'matrices') return t.accountMatrices;
    if (bannerId === 'all') return t.bannerAll;
    const b = bannerMap.get(bannerId);
    return b ? (locale === 'ru' ? b.name_ru : b.name_en) : bannerId;
  }, [activeBannerId, filters.bannerId, bannerMap, locale, t.accountMatrices, t.bannerAll, t.bannerCharacters]);
  const selectedBannerId = activeBannerId ?? filters.bannerId;
  const showBannerIcon = !selectedBannerId || ['all', 'characters', 'matrices'].includes(selectedBannerId);

  return (
    <div className="space-y-4">
      {/* Controls & Quick Filters Bar (Grid/Log, Type, Rarity, Hide Losses) */}
      <div className="p-3.5 rounded-xl bg-[var(--surface-inset)]/90 border border-white/10 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            {/* View Mode Switcher (Grid / Log) */}
            <div className="flex items-center p-0.5 rounded-full bg-[#07090f] border border-white/10">
              {([
                {
                  value: 'cards' as const,
                  label: t.gridMode,
                  icon: (
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <rect x="3" y="3" width="7" height="7" rx="1" />
                      <rect x="14" y="3" width="7" height="7" rx="1" />
                      <rect x="14" y="14" width="7" height="7" rx="1" />
                      <rect x="3" y="14" width="7" height="7" rx="1" />
                    </svg>
                  ),
                },
                {
                  value: 'table' as const,
                  label: t.logMode,
                  icon: (
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="3" y1="6" x2="21" y2="6" strokeLinecap="round" />
                      <line x1="3" y1="12" x2="21" y2="12" strokeLinecap="round" />
                      <line x1="3" y1="18" x2="21" y2="18" strokeLinecap="round" />
                    </svg>
                  ),
                },
              ]).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onViewModeChange(option.value)}
                  aria-pressed={viewMode === option.value}
                  className={`relative flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all ${
                    viewMode === option.value
                      ? 'z-10 bg-[#fbbf24] text-black ring-2 ring-amber-100 shadow-[0_0_0_2px_#07090f,0_0_12px_rgba(251,191,36,0.35)]'
                      : 'text-[#9ca3af] hover:bg-white/[0.06] hover:text-white'
                  }`}
                >
                  {option.icon}
                  <span>{option.label}</span>
                </button>
              ))}
            </div>

            {/* Rarity Circle Pills (All, 5★, 4★, 3★) */}
            <div className="flex items-center gap-1 p-1 rounded-full bg-[#07090f] border border-white/15 shadow-inner">
              {(['ALL', '5', '4', '3'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => handleRaritySelect(r)}
                  aria-pressed={filters.rarity === r}
                  className={`w-8 h-8 rounded-full text-xs font-black transition-all flex items-center justify-center ${
                    filters.rarity === r
                      ? 'bg-[#fbbf24] text-black shadow-[0_0_0_1px_#fde68a,0_0_10px_rgba(251,191,36,0.25)]'
                      : 'bg-[var(--surface-panel)] text-[#9ca3af] hover:bg-[#202534] hover:text-white border border-white/5'
                  }`}
                >
                  {r === 'ALL' ? localeText(locale)('All') : `${r}★`}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
          {/* Toggle: Hide 50/50 Losses */}
          <button
            type="button"
            onClick={toggleHideLosses}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border transition-all ${
              filters.hideLosses
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                : 'bg-[var(--surface-panel)] text-[#9ca3af] border-white/5 hover:text-white'
            }`}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
            </svg>
            <span>{t.hideLosses}</span>
          </button>
          <Tooltip
            placement="top"
            portal
            delayMs={120}
            className="!max-w-64 !whitespace-normal !rounded-lg !border-emerald-400/25 !bg-[var(--surface-panel)] !px-3 !py-2.5 !shadow-[0_12px_36px_rgba(0,0,0,0.65),0_0_18px_rgba(16,185,129,0.12)]"
            content={(
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-emerald-300/20 bg-emerald-300/10 text-[9px] font-black text-emerald-200">CSV</span>
                <span className="min-w-0">
                  <span className="block text-[11px] font-bold text-white">Excel</span>
                  <span className="mt-0.5 block text-[10px] leading-relaxed text-slate-300">{t.exportExcelTitle}</span>
                </span>
              </div>
            )}
          >
            <button type="button" onClick={exportExcel} className="px-3 py-1 rounded-full text-xs font-bold border border-emerald-500/25 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 transition-colors">{t.exportExcel}</button>
          </Tooltip>
          <Tooltip
            placement="top"
            portal
            delayMs={120}
            className="!max-w-64 !whitespace-normal !rounded-lg !border-sky-400/25 !bg-[var(--surface-panel)] !px-3 !py-2.5 !shadow-[0_12px_36px_rgba(0,0,0,0.65),0_0_18px_rgba(56,189,248,0.12)]"
            content={(
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-sky-300/20 bg-sky-300/10 text-[9px] font-black text-sky-200">JSON</span>
                <span className="min-w-0">
                  <span className="block text-[11px] font-bold text-white">JSON</span>
                  <span className="mt-0.5 block text-[10px] leading-relaxed text-slate-300">{t.exportJsonTitle}</span>
                </span>
              </div>
            )}
          >
            <button type="button" onClick={exportJson} className="px-3 py-1 rounded-full text-xs font-bold border border-sky-500/25 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20 transition-colors">JSON</button>
          </Tooltip>
          </div>
        </div>
      </div>

      {/* 3. ALL PULLS Header (Endfield style: Title, Active Banner indicator, shown / total count) */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-xl bg-[#10141b] border border-white/10">
        <div className="flex items-center gap-2.5">
          <span className="w-2 h-2 rounded-full bg-amber-300/80" />
          <h3 className="text-sm font-black text-white uppercase tracking-wider">
            {t.allPullsTitle}
          </h3>
          <span className="text-xs text-amber-200/80 font-semibold">
            • {activeBannerName}
          </span>
        </div>
        <div className="text-xs text-[#9ca3af] font-mono">
          {t.shownOf.replace('{{count}}', String(pulls.length)).replace('{{total}}', String(totalFiltered))}
        </div>
      </div>

      {exportPulls.some((pull) => pull.raw_banner_code && pull.track_pull_number === undefined) && (
        <p role="note" className="text-xs text-slate-400">{t.importHistoryUnanchored}</p>
      )}

      {/* 7. View Mode: Grid (Circular Tokens Grouped by Date) */}
      {viewMode === 'cards' && (
        <div
          ref={pullGalleryRef}
          className="space-y-6"
          onMouseLeave={() => setPinnedTooltipRecordId(null)}
          onClick={(event) => {
            const target = event.target;
            if (!(target instanceof Element) || target.closest('[role="tooltip"], [data-pull-tooltip-trigger]')) return;
            setPinnedTooltipRecordId(null);
          }}
        >
          {groupedPulls.map((group) => (
            <div key={group.dateKey} className="p-4 rounded-xl bg-[#10141b]/90 border border-white/10">
              {/* Date header for this group of pulls */}
              <div className={`flex items-center justify-between gap-3 text-xs text-[#9ca3af] font-mono ${collapsedDates.has(group.dateKey) ? '' : 'mb-3 border-b border-white/5 pb-2'}`}>
                <span className="font-bold text-white flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 text-amber-200/75" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" strokeLinecap="round" strokeLinejoin="round" />
                    <line x1="16" y1="2" x2="16" y2="6" strokeLinecap="round" />
                    <line x1="8" y1="2" x2="8" y2="6" strokeLinecap="round" />
                    <line x1="3" y1="10" x2="21" y2="10" strokeLinecap="round" />
                  </svg>
                  <span>{group.dateLabel}</span>
                </span>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-[11px] text-[#6b7280]">
                    {group.items.length} {localeText(locale)('pulls')}
                  </span>
                  <button
                    type="button"
                    aria-expanded={!collapsedDates.has(group.dateKey)}
                    aria-controls={`pull-grid-${group.dateKey}`}
                    aria-label={collapsedDates.has(group.dateKey)
                      ? localeText(locale)(`Expand pulls for ${group.dateLabel}`, `Развернуть крутки за ${group.dateLabel}`)
                      : localeText(locale)(`Collapse pulls for ${group.dateLabel}`, `Свернуть крутки за ${group.dateLabel}`)}
                    title={collapsedDates.has(group.dateKey)
                      ? (localeText(locale)('Expand', 'Развернуть'))
                      : (localeText(locale)('Collapse'))}
                    onClick={() => setCollapsedDates((current) => {
                      const next = new Set(current);
                      if (next.has(group.dateKey)) next.delete(group.dateKey);
                      else next.add(group.dateKey);
                      return next;
                    })}
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-white/[0.03] text-slate-400 transition-colors hover:border-amber-300/30 hover:text-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70"
                  >
                    <svg className={`h-4 w-4 transition-transform ${collapsedDates.has(group.dateKey) ? '' : 'rotate-180'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Circular Tokens Row/Grid */}
              <div id={`pull-grid-${group.dateKey}`} hidden={collapsedDates.has(group.dateKey)} className="flex flex-wrap gap-2.5 sm:gap-3">
                {group.items.map(({ record, pullNumber }) => {
                  const media = resolvePullMedia(mediaMap, record, locale);
                  const rarity = media.rarity ?? record.rarity;
                  const isSSR = rarity === 5;
                  const isSR = rarity === 4;
                  const isFeaturedEvent = isSSR && (record.banner_type === 'weapon_limited' || record.banner_type === 'matrix_limited') && record.is_featured;
                  const isHardPity = isSSR && record.is_guaranteed_pity;
                  const bannerObj = bannerMap.get(record.banner_id);
                  const bannerIcon = bannerObj?.assets?.icon;

                  // Token ring color by rarity
                  const ringClass = isFeaturedEvent
                    ? 'border-2 border-amber-300/85 bg-[#1b1713] shadow-[0_0_8px_rgba(241,181,80,0.16)]'
                    : isSSR
                    ? 'border border-amber-200/55 bg-[#191817]'
                    : isSR
                    ? 'border border-violet-300/50 bg-[#171520]'
                    : 'border border-slate-500/30 bg-[#111722] hover:border-slate-300/55';

                  // Pity badge theme
                  const pityBadgeClass = isHardPity
                    ? 'border border-orange-300/60 bg-[#6d3719] text-orange-100 font-bold'
                    : isSSR
                    ? 'border border-amber-200/30 bg-[#30291e] text-amber-100 font-semibold'
                    : isSR
                    ? 'border border-violet-300/25 bg-[#30243c] text-violet-100 font-semibold'
                    : 'border border-white/10 bg-[#1e2230] text-slate-400 font-mono font-medium';

                  const bannerName = bannerObj ? (locale === 'ru' ? bannerObj.name_ru : bannerObj.name_en) : record.banner_id;
                  const outcome = record.streak_outcome ?? (record.is_featured ? 'win' : 'loss');
                  const showOutcome = isSSR && (record.banner_type === 'weapon_limited' || record.banner_type === 'matrix_limited');

                  return (
                    <React.Fragment key={record.id}>
                    {gapsBefore.has(record.id) && <div className="flex min-h-16 max-w-36 items-center px-2 text-[11px] text-slate-400" role="note">
                      {localeText(locale)(`Missing: ${gapsBefore.get(record.id)} pulls`, `Пропуск: ${gapsBefore.get(record.id)} круток`)}
                    </div>}
                    <Tooltip
                      placement="top"
                      open={pinnedTooltipRecordId ? pinnedTooltipRecordId === record.id : undefined}
                      interactive={pinnedTooltipRecordId === record.id}
                      className="w-64 !whitespace-normal !border-amber-300/30 !bg-[var(--surface-panel)] !shadow-[0_12px_36px_rgba(0,0,0,0.7),0_0_18px_rgba(245,190,90,0.12)]"
                      content={(
                        <div className="space-y-1.5 whitespace-normal">
                          <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-1.5">
                            <p className="min-w-0 text-[10px] font-bold uppercase leading-snug tracking-wide text-sky-300">{bannerName}</p>
                            <span className="shrink-0 rounded border border-white/10 bg-white/[0.05] px-1.5 py-0.5 font-mono text-[9px] text-slate-300">#{formatWishPosition(pullNumber)}</span>
                          </div>
                          <p className="text-sm font-semibold leading-snug text-white">{media.displayName}</p>
                          <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                            <span className={`rounded border px-1.5 py-0.5 font-bold ${isSSR ? 'border-amber-300/25 bg-amber-300/10 text-amber-200' : isSR ? 'border-violet-300/25 bg-violet-300/10 text-violet-200' : 'border-slate-300/15 bg-slate-300/5 text-slate-300'}`}>
                              {isSSR ? '5★ SSR' : isSR ? '4★ SR' : rarity === 3 ? '3★ R' : '—'}
                            </span>
                            {isFeaturedEvent && <span className="rounded border border-amber-300/25 bg-amber-300/10 px-1.5 py-0.5 font-semibold text-amber-200">{localeText(locale)('Featured item')}</span>}
                            {isHardPity && <span className="rounded border border-orange-300/25 bg-orange-300/10 px-1.5 py-0.5 font-semibold text-orange-200">{t.modalGuaranteed}</span>}
                          </div>
                          <p className="text-[10px] text-white/65">{t.bannerDropDate} {formatPullDate(record.pull_timestamp, locale)}</p>
                          <div className="flex items-center justify-between border-t border-white/10 pt-1.5 text-[10px]">
                            {showOutcome ? <span className={`font-bold ${outcome === 'win' ? 'text-emerald-300' : 'text-rose-300'}`}>{outcome === 'win' ? localeText(locale)('WIN') : localeText(locale)('LOSS')}</span> : <span className="text-white/50">{record.item_type === 'matrix' ? (localeText(locale)('Matrix')) : (localeText(locale)('Weapon', 'Оружие'))}</span>}
                            <span className="font-mono text-slate-300">{formatWishPosition(record.pity_count)} {t.pullDistance}</span>
                          </div>
                        </div>
                      )}
                    >
                    <div
                      data-pull-tooltip-trigger
                      onClick={() => setPinnedTooltipRecordId((current) => current === record.id ? null : record.id)}
                      className="group relative select-none rounded-full"
                    >
                      {/* Token Frame */}
                      <div className={`w-16 h-16 sm:w-18 sm:h-18 ${record.item_type === 'matrix' ? 'rounded-xl' : 'rounded-full'} overflow-hidden flex items-center justify-center p-0.5 ${ringClass}`}>
                        <CircularMediaImage
                          src={media.image}
                          alt={media.name}
                          itemType={record.item_type}
                          imageScale={record.item_type === 'weapon' && media.characterName
                            ? 'portrait'
                            : record.item_type === 'weapon' && rarity === 3
                            ? 'small-weapon'
                            : 'default'}
                          portraitZoom={media.portraitZoom}
                        />
                      </div>

                      {/* A star marks the featured item, independently of the pity guarantee. */}
                      {isFeaturedEvent && (
                        <div className="absolute -top-1 -left-1 w-4 h-4 rounded-full border border-amber-200/70 bg-[#b98526] text-[#17120a] flex items-center justify-center text-[10px] font-black leading-none">
                          ★
                        </div>
                      )}

                      {/* Bottom-Left: Tiny round banner icon showing which banner gave this item */}
                      {showBannerIcon && bannerIcon && (
                        <div
                          className="absolute -bottom-1 -left-1 w-4 h-4 sm:w-5 sm:h-5 rounded-full border border-white/25 overflow-hidden bg-[#11151c] flex items-center justify-center"
                        >
                          <img src={bannerIcon} alt="" className="w-full h-full object-cover" />
                        </div>
                      )}

                      {/* Bottom-Right: Pity number pill */}
                      <div className={`absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-full text-[9px] leading-none ${pityBadgeClass}`}>
                        {formatWishPosition(record.pity_count)}
                      </div>
                    </div>
                    </Tooltip>
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          ))}

          {groupedPulls.length === 0 && (
            <div className="py-12 text-center text-xs text-[#6b7280] italic">
              {localeText(locale)('No pulls matching the active filters', 'Нет круток, соответствующих выбранным фильтрам')}
            </div>
          )}
        </div>
      )}

      {/* 8. View Mode: Log (Table view with explicit Date & Banner columns) */}
      {viewMode === 'table' && (
        <div className="md:hidden w-full overflow-hidden rounded-xl border border-white/10 bg-[var(--surface-inset)]/90">
          <ol className="divide-y divide-white/[0.07]">
            {pulls.map((record, i) => {
              const media = resolvePullMedia(mediaMap, record, locale);
              const rarity = media.rarity ?? record.rarity;
              const isSSR = rarity === 5;
              const isSR = rarity === 4;
              const isR = rarity === 3;
              const isBlackNucleus = record.banner_type === 'black_nucleus';
              const isStandard = record.banner_type === 'standard_weapon' || record.banner_type === 'standard_matrix';
              const cycleMax = isBlackNucleus ? 0 : record.banner_type.includes('matrix') ? 40 : 80;
              const bannerObj = bannerMap.get(record.banner_id);
              const slotVisual = getMatrixSlotVisual(record.slot, locale);
              const outcome = record.streak_outcome ?? (record.is_featured ? 'win' : 'loss');
              const showOutcome = isSSR && (record.banner_type === 'weapon_limited' || record.banner_type === 'matrix_limited');
              const bannerName = bannerObj ? (locale === 'ru' ? bannerObj.name_ru : bannerObj.name_en) : record.banner_id;
              const rarityClass = isSSR
                ? 'border-amber-300/35 bg-amber-300/10 text-amber-200'
                : isSR
                ? 'border-violet-300/30 bg-violet-300/10 text-violet-200'
                : 'border-white/10 bg-white/[0.03] text-slate-300';
              const currencyUnit = record.item_type === 'weapon' ? t.cashbackUnitFg : t.cashbackUnitChip;

              return (
                <li key={record.id ?? i} className="min-w-0 px-3 py-2.5">
                  <div className="flex min-w-0 items-center justify-between gap-2">
                    <span className="shrink-0 font-mono text-[10px] font-bold text-amber-200">#{i + 1}</span>
                    <time className="min-w-0 truncate text-right font-mono text-[10px] text-slate-400">
                      {record.pull_timestamp.slice(0, 19).replace('T', ' ')}
                    </time>
                  </div>

                  <div className="mt-1 flex min-w-0 items-center gap-1.5 text-[10px] text-slate-500">
                    {bannerObj?.assets.icon && <img src={bannerObj.assets.icon} alt="" className="h-3.5 w-3.5 shrink-0 rounded-full object-cover" />}
                    <span className="truncate">{bannerName}</span>
                  </div>

                  <div className="mt-1.5 flex min-w-0 items-center gap-2.5">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden border border-white/10 bg-[var(--surface-inset)] p-0.5 ${record.item_type === 'matrix' ? 'rounded-lg' : 'rounded-full'}`}>
                      <CircularMediaImage
                        src={media.image}
                        alt=""
                        itemType={record.item_type}
                        imageScale={record.item_type === 'weapon' && isR && !media.ref?.startsWith('standard_battery_') ? 'small-weapon' : 'default'}
                      />
                    </div>
                    {slotVisual && <img src={slotVisual.image} alt={slotVisual.label} title={slotVisual.label} className="h-4 w-4 shrink-0 object-contain" />}
                    <div className="min-w-0 flex-1">
                      <div className="break-words text-xs font-semibold leading-snug text-white">{media.primaryName}</div>
                      {media.secondaryName && <div className="mt-0.5 truncate text-[10px] text-slate-500">{media.secondaryName}</div>}
                    </div>
                  </div>

                  <div className="mt-2 flex min-w-0 flex-wrap items-center gap-1.5">
                    <span className={`rounded border px-1.5 py-0.5 font-mono text-[9px] font-bold ${rarityClass}`}>
                      {isSSR ? '5★ SSR' : isSR ? '4★ SR' : rarity === 3 ? '3★ R' : '—'}
                    </span>
                    <span className="rounded border border-white/10 bg-white/[0.03] px-1.5 py-0.5 font-mono text-[9px] text-slate-300">
                      {isBlackNucleus ? `#${formatWishPosition(record.pity_count)}` : `${formatWishPosition(record.pity_count)}/${cycleMax}`}
                      {record.is_guaranteed_pity && <span className="ml-1 text-amber-200">★ {t.hardPityBadge}</span>}
                    </span>
                    {showOutcome ? (
                      <span className={`rounded border px-1.5 py-0.5 font-mono text-[9px] font-black ${outcome === 'win' ? 'border-emerald-300/25 bg-emerald-300/10 text-emerald-300' : 'border-rose-300/25 bg-rose-300/10 text-rose-300'}`}>
                        {outcome === 'win' ? localeText(locale)('WIN') : localeText(locale)('LOSS')}
                      </span>
                    ) : (isStandard || isBlackNucleus) && isSSR ? (
                      <span className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[9px] font-bold text-slate-400">{localeText(locale)('STD')}</span>
                    ) : null}
                    {record.compensation && <span className="ml-auto whitespace-nowrap font-mono text-[10px] font-bold text-amber-200">+{record.compensation.amount} {currencyUnit}</span>}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {viewMode === 'table' && (
        <div className="hidden w-full overflow-x-auto rounded-xl border border-white/10 bg-[var(--surface-inset)]/90 md:block">
          <table className="w-full min-w-[980px] table-fixed text-left text-xs text-[#d7d0dd]">
            <colgroup>
              <col style={{ width: '4%' }} />
              <col style={{ width: '15%' }} />
              <col style={{ width: '16%' }} />
              <col style={{ width: '22%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '11%' }} />
              <col style={{ width: '12%' }} />
            </colgroup>
            <thead className="bg-[var(--surface-inset)] border-b border-white/10 text-[11px] font-mono text-[#9ca3af] uppercase">
              <tr>
                <th className="py-3 px-3">#</th>
                <th className="py-3 px-3">{t.thDate}</th>
                <th className="py-3 px-3">{t.thBanner}</th>
                <th className="py-3 px-3">{t.thItem}</th>
                <th className="py-3 px-3">{t.thRarity}</th>
                <th className="py-3 px-3">{t.thPityPos}</th>
                <th className="py-3 px-3">{t.thOutcome}</th>
                <th className="py-3 px-3">{t.thCashback}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {pulls.map((record, i) => {
                const pullNumber = record.track_pull_number ?? (record.raw_banner_code ? -1 : i + 1);
                const media = resolvePullMedia(mediaMap, record, locale);
                const rarity = media.rarity ?? record.rarity;
                const isSSR = rarity === 5;
                const isSR = rarity === 4;
                const isR = rarity === 3;
                const rarityLabel = isSSR ? '5★ SSR' : isSR ? '4★ SR' : rarity === 3 ? '3★ R' : '—';
                const slotVisual = getMatrixSlotVisual(record.slot, locale);
                const bannerObj = bannerMap.get(record.banner_id);
                const isBlackNucleus = record.banner_type === 'black_nucleus';
                const isStandard = record.banner_type === 'standard_weapon' || record.banner_type === 'standard_matrix';
                const cycleMax = isBlackNucleus ? 0 : record.banner_type.includes('matrix') ? 40 : 80;

                return (
                  <tr
                    key={record.id ?? i}
                    className="hover:bg-white/5 transition-colors"
                  >
                    {/* Pull Number */}
                    <td className="py-2.5 px-3 font-mono font-bold text-white">
                      #{formatWishPosition(pullNumber)}
                      {gapsBefore.has(record.id) && <span className="block text-[10px] font-normal text-slate-400">
                        {localeText(locale)(`Missing: ${gapsBefore.get(record.id)} pulls`, `Пропуск: ${gapsBefore.get(record.id)} круток`)}
                      </span>}
                    </td>

                    {/* Date & Time */}
                    <td className="py-2.5 px-3 font-mono text-[#9ca3af] text-[11px] whitespace-nowrap">
                      {record.pull_timestamp.slice(0, 19).replace('T', ' ')}
                    </td>

                    {/* Banner name & icon */}
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1.5 whitespace-nowrap">
                        {bannerObj?.assets.icon && (
                          <img src={bannerObj.assets.icon} alt="" className="w-4 h-4 rounded-full object-cover" />
                        )}
                        <span className="font-semibold text-[#e5e7eb] text-xs">
                          {bannerObj ? (locale === 'ru' ? bannerObj.name_ru : bannerObj.name_en) : record.banner_id}
                        </span>
                      </div>
                    </td>

                    {/* Item Avatar & Name */}
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 ${record.item_type === 'matrix' ? 'rounded-lg' : 'rounded-full'} bg-[var(--surface-inset)] border border-white/10 overflow-hidden flex items-center justify-center flex-shrink-0`}>
                          <CircularMediaImage
                            src={media.image}
                            alt=""
                            itemType={record.item_type}
                            imageScale={record.item_type === 'weapon' && isR && !media.ref?.startsWith('standard_battery_')
                              ? 'small-weapon'
                              : 'default'}
                          />
                        </div>
                        {slotVisual && (
                          <img
                            src={slotVisual.image}
                            alt={slotVisual.label}
                            title={slotVisual.label}
                            className="w-4 h-4 object-contain flex-shrink-0"
                          />
                        )}
                        <div className="flex min-w-0 items-center gap-1.5 flex-wrap">
                          <span className="break-words font-semibold text-white">{media.primaryName}</span>
                          {media.secondaryName && (
                            <span className="text-[11px] text-[#9ca3af] font-normal">
                              • {media.secondaryName}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Rarity */}
                    <td className="py-2.5 px-3 font-mono">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-black font-mono ${
                        isSSR
                          ? 'bg-[#fbbf24]/20 text-[#fbbf24] border border-[#fbbf24]/40'
                          : isSR
                          ? 'bg-[#a855f7]/20 text-[#c084fc] border border-[#a855f7]/40'
                          : 'text-[#9ca3af]'
                      }`}>
                        {rarityLabel}
                      </span>
                    </td>

                    {/* Pity Position */}
                    <td className="py-2.5 px-3 font-mono text-xs">
                      {isBlackNucleus ? (
                        <span className="text-[#9ca3af]">#{formatWishPosition(record.pity_count)}</span>
                      ) : record.is_guaranteed_pity ? (
                        <span className="inline-flex items-center gap-1 font-bold text-[#fbbf24]">
                          <span>{formatWishPosition(record.pity_count)} / {cycleMax}</span>
                          <span className="text-[10px] px-1 py-0.5 rounded bg-[#fbbf24]/20 border border-[#fbbf24]/40">
                            ★ {t.hardPityBadge}
                          </span>
                        </span>
                      ) : isSSR ? (
                        <span className="inline-flex items-center gap-1 font-bold text-[#c084fc]">
                          <span>{formatWishPosition(record.pity_count)} / {cycleMax}</span>
                          <span className="text-[10px] px-1 py-0.5 rounded bg-[#a855f7]/20 border border-[#a855f7]/40">
                            {t.earlyPityBadge}
                          </span>
                        </span>
                      ) : (
                        <span className="text-[#9ca3af]">
                          {formatWishPosition(record.pity_count)} <span className="text-[#4b5563]">/ {cycleMax}</span>
                        </span>
                      )}
                    </td>

                    {/* Outcome */}
                    <td className="py-2.5 px-3">
                      {isStandard || isBlackNucleus ? (
                        isSSR ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-white/10 text-[#d1d5db] border border-white/20">
                            {localeText(locale)('STD')}
                          </span>
                        ) : (
                          <span className="text-[#4b5563] font-mono select-none">—</span>
                        )
                      ) : record.streak_outcome === 'win' || (isSSR && record.is_featured) ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-black tracking-wider uppercase bg-[#10b981]/20 text-[#10b981] border border-[#10b981]/40 shadow-[0_0_8px_rgba(16,185,129,0.2)]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" />
                          {localeText(locale)('WIN')}
                        </span>
                      ) : record.streak_outcome === 'loss' || (isSSR && !record.is_featured) ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-black tracking-wider uppercase bg-[#ef4444]/20 text-[#ef4444] border border-[#ef4444]/40 shadow-[0_0_8px_rgba(239,68,68,0.2)]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#ef4444]" />
                          {localeText(locale)('LOSS')}
                        </span>
                      ) : (
                        <span className="text-[#4b5563] font-mono select-none">—</span>
                      )}
                    </td>

                    {/* Cashback / Conversion */}
                    <td className="py-2.5 px-3 font-mono font-bold">
                      {record.item_type === 'matrix' && (isSSR || isR) ? (
                        <span
                          className="text-[#6b7280]"
                          title={isSSR ? t.cashbackNoMatrixBonus : t.cashbackMatrixNoConversion}
                        >
                          —
                        </span>
                      ) : isR || record.compensation?.currency_id === 'weapon_exp_r' ? (
                        <Tooltip
                          placement="top"
                          portal
                          delayMs={120}
                          className="!max-w-64 !whitespace-normal !rounded-lg !border-sky-300/25 !bg-[var(--surface-panel)] !px-3 !py-2.5 !shadow-[0_12px_36px_rgba(0,0,0,0.65),0_0_18px_rgba(56,189,248,0.12)]"
                          content={(
                            <div className="flex items-center gap-2.5">
                              {mediaMap?.byKey['weapon_exp_r']?.image ? (
                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-sky-300/20 bg-sky-300/[0.08] p-1">
                                  <img src={mediaMap.byKey['weapon_exp_r'].image} alt="" className="h-full w-full object-contain" />
                                </span>
                              ) : (
                                <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-sky-300/20 bg-sky-300/[0.08] text-sky-200">⚙</span>
                              )}
                              <span className="text-xs font-medium leading-relaxed text-white/90">{t.cashbackBatteryTooltip}</span>
                            </div>
                          )}
                        >
                          <span tabIndex={0} className="flex items-center gap-1.5 text-sky-300 font-bold text-[11px]">
                            {mediaMap?.byKey['weapon_exp_r']?.image ? (
                              <img
                                src={mediaMap.byKey['weapon_exp_r'].image}
                                alt=""
                                className="w-4 h-4 object-contain inline-block shrink-0"
                              />
                            ) : (
                              <span>⚙</span>
                            )}
                            <span>{t.cashbackBattery}</span>
                          </span>
                        </Tooltip>
                      ) : record.compensation ? (
                        (() => {
                          const compensationKey = record.compensation.currency_id.toLowerCase();
                          const bannerCurrency = bannerMap.get(record.banner_id)?.cashback_currency;
                          const currencyKey = bannerCurrency ?? (
                            compensationKey.includes('up') || record.banner_type.includes('weapon')
                              ? 'flame_gold'
                              : 'overclocking_chip'
                          );
                          const compMedia = mediaMap?.byKey[currencyKey];
                          const unitLabel = {
                            flame_gold: t.cashbackUnitFg,
                            overclocking_chip: t.cashbackUnitChip,
                            black_gold: t.cashbackUnitBlackGold,
                            base_chip: t.cashbackUnitBaseChip,
                            none: '',
                          }[currencyKey] ?? t.cashbackUnitChip;
                          const compImg = compMedia?.image;
                          const currencyName = compMedia
                            ? (locale === 'ru' ? compMedia.name_ru : compMedia.name_en)
                            : unitLabel;
                          return (
                            <Tooltip
                              placement="top"
                              portal
                              delayMs={120}
                              className="!max-w-64 !whitespace-normal !rounded-lg !border-amber-300/25 !bg-[var(--surface-panel)] !px-3 !py-2.5 !shadow-[0_12px_36px_rgba(0,0,0,0.65),0_0_18px_rgba(251,191,36,0.12)]"
                              content={(
                                <div className="flex items-center gap-2.5">
                                  {compImg && (
                                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-amber-300/20 bg-amber-300/[0.08] p-1">
                                      <img src={compImg} alt="" className="h-full w-full object-contain" />
                                    </span>
                                  )}
                                  <span className="min-w-0">
                                    <span className="block text-xs font-bold text-white">{currencyName}</span>
                                    <span className="mt-0.5 block text-[10px] font-medium text-amber-200/80">{t.cashbackLabel} +{record.compensation.amount} {unitLabel}</span>
                                  </span>
                                </div>
                              )}
                            >
                              <span tabIndex={0} className="flex items-center gap-1.5 text-[11px] text-[#fbbf24]">
                                {compImg && <img src={compImg} alt="" className="inline-block h-4 w-4 shrink-0 object-contain" />}
                                <span>+{record.compensation.amount} {unitLabel}</span>
                              </span>
                            </Tooltip>
                          );
                        })()
                      ) : (
                        <span className="text-[#4b5563]">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div ref={loadMoreSentinelRef} aria-hidden="true" className="h-px" />

    </div>
  );
}
