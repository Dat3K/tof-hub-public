'use client';

import { localized, translateUiText} from '@tof-hub/i18n';
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useI18n } from '@/lib/i18n';
import type {
  BygoneViewProps,
  BygoneFloorItem,
  BygoneRangePreset,
  BygoneRangeState,
  BygoneFilterTab,
  BygoneChartKind,
  BygoneChartTheme,
} from './bygone-types';
import { BYGONE_COPY } from './bygone-copy';
import { mergeBygoneData } from './bygone-data';
import {
  formatHpG,
  formatPowercreep,
  getFloorPowercreep,
  getEnemyDisplayName,
  getMissingBygoneEnemyName,
  formatNumber,
  getElemIcon,
  getWeaknessGameIcon,
  formatRangeStatus,
} from './bygone-domain';
import { exportBygoneCsv, exportCanvasAsPng } from './bygone-export';
import styles from './bygone.module.css';
import { CHART_TITLE_CANVAS_FONT, drawChartWatermark } from '../components/chart-branding';
import { ChartHoverCard } from '../components/chart-hover-card';
import { BygoneHeader } from './bygone-header';

const CHART_WIDTH = 1800;
const CHART_HEIGHT = 760;
const CHART_EXPORT_SCALE = 2;
/** Plot geometry shared by the canvas drawing and the hover guide (chart units). */
const CHART_MARGIN = { top: 76, right: 86, bottom: 92, left: 104 };
const CHART_EDGE_INSET = 34;
const chartWeaknessImages = new Map<string, HTMLImageElement>();

function getChartWeaknessImage(element: string): HTMLImageElement | null {
  const src = getWeaknessGameIcon(element);
  if (!src || typeof Image === 'undefined') return null;

  let image = chartWeaknessImages.get(src);
  if (!image) {
    image = new Image();
    image.src = src;
    chartWeaknessImages.set(src, image);
  }
  return image;
}

export function BygoneView({ initialData, initialLocale, initialChartTheme }: BygoneViewProps) {
  const { locale: activeLocale } = useI18n();
  const currentLocale = activeLocale || initialLocale;
  const isRu = currentLocale === 'ru';
  const copy = localized(BYGONE_COPY, currentLocale);

  // Base Data
  const allFloors: BygoneFloorItem[] = useMemo(() => mergeBygoneData(initialData), [initialData]);
  const latestUniqueFloor = useMemo(
    () => allFloors.reduce((maxFloor, floor) =>
      !floor.is_duplicate && floor.floor > maxFloor ? floor.floor : maxFloor, 0),
    [allFloors]
  );

  // View States, seeded from the server-parsed ?chartTheme= so shared
  // links render with the selected theme on the first paint.
  const [chartTheme, setChartTheme] = useState<BygoneChartTheme>(initialChartTheme ?? 'light');
  const [showRepeats, setShowRepeats] = useState<boolean>(false);
  const [rangeState, setRangeState] = useState<BygoneRangeState>(() => ({
    minFloor: Math.max(1, latestUniqueFloor - 19),
    maxFloor: latestUniqueFloor,
    preset: 'latest20',
  }));
  const [directoryFilter, setDirectoryFilter] = useState<BygoneFilterTab>('all');
  const [floorSearchQuery, setFloorSearchQuery] = useState<string>('');

  // Tooltip & Zoom States
  const [activeTooltip, setActiveTooltip] = useState<{
    visible: boolean;
    /** Viewport pointer position for the hover card. */
    x: number;
    y: number;
    /** Hovered point as a fraction of the chart width (vertical guide). */
    guideX: number;
    floor: BygoneFloorItem;
    chartKind: BygoneChartKind;
  } | null>(null);

  const [zoomModal, setZoomModal] = useState<{
    isOpen: boolean;
    chartKind: BygoneChartKind;
    scale: number;
    translateX: number;
    translateY: number;
    isDragging: boolean;
    dragStartX: number;
    dragStartY: number;
  }>({
    isOpen: false,
    chartKind: 'hp',
    scale: 1,
    translateX: 0,
    translateY: 0,
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
  });

  // Canvas Refs
  const hpCanvasRef = useRef<HTMLCanvasElement>(null);
  const powercreepCanvasRef = useRef<HTMLCanvasElement>(null);
  const overviewCanvasRef = useRef<HTMLCanvasElement>(null);
  const zoomCanvasRef = useRef<HTMLCanvasElement>(null);

  // Maximum floor based on repeat toggle
  const maxAvailableFloor = useMemo(() => {
    return allFloors.reduce((maxFloor, floor) => {
      if (!showRepeats && floor.is_duplicate) return maxFloor;
      return Math.max(maxFloor, floor.floor);
    }, 0);
  }, [allFloors, showRepeats]);

  // Set shared range helper
  const setRange = useCallback(
    (minFloor: number, maxFloor: number, preset: BygoneRangePreset = 'custom') => {
      const clampedMin = Math.max(1, Math.min(minFloor, maxAvailableFloor));
      const clampedMax = Math.max(clampedMin, Math.min(maxFloor, maxAvailableFloor));
      setRangeState({
        minFloor: clampedMin,
        maxFloor: clampedMax,
        preset,
      });
    },
    [maxAvailableFloor]
  );

  // Initialize theme, hash, and history listeners
  useEffect(() => {
    if (typeof window === 'undefined') return;

    function applyUrlState() {
      // State is seeded from the server-parsed URL: only correct on
      // disagreement, and only consult storage when the URL is silent.
      const params = new URLSearchParams(window.location.search);
      const themeParam = params.get('chartTheme');
      if (themeParam === 'light' || themeParam === 'dark') {
        setChartTheme((prev) => (prev === themeParam ? prev : themeParam));
      } else {
        try {
          const stored = localStorage.getItem('tof-datamine-bygone-chart-theme');
          if (stored === 'light' || stored === 'dark') {
            setChartTheme((prev) => (prev === stored ? prev : stored));
          }
        } catch {}
      }

      const hash = params.get('floor') || (window.location.hash || '').replace(/^#/, '').trim().toLowerCase();
      if (hash) {
        const match = hash.match(/^(?:f|floor-?)?(\d+)$/i);
        if (match) {
          const floorNum = parseInt(match[1], 10);
          if (floorNum >= 1 && floorNum <= 600) {
            const newMin = Math.max(1, floorNum - 9);
            const newMax = Math.min(600, newMin + 19);
            setRange(newMin, newMax, 'custom');
          }
        }
      }
    }

    applyUrlState();

    function onHashChange() {
      applyUrlState();
    }

    function onPopState() {
      applyUrlState();
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && zoomModal.isOpen) {
        e.preventDefault();
        setZoomModal((prev) => ({ ...prev, isOpen: false }));
      }
    }

    window.addEventListener('hashchange', onHashChange);
    window.addEventListener('popstate', onPopState);
    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('hashchange', onHashChange);
      window.removeEventListener('popstate', onPopState);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [setRange, zoomModal.isOpen]);

  // Sync theme to document body and storage
  const handleSetTheme = useCallback((theme: BygoneChartTheme) => {
    setChartTheme(theme);
    if (typeof document !== 'undefined') {
      document.body.setAttribute('data-chart-theme', theme);
    }
    try {
      localStorage.setItem('tof-datamine-bygone-chart-theme', theme);
    } catch {}
  }, []);

  // Filtered floors for display in chart
  const chartVisibleFloors = useMemo(() => {
    return allFloors.filter((f) => {
      if (f.floor < rangeState.minFloor || f.floor > rangeState.maxFloor) return false;
      if (!showRepeats && f.is_duplicate) return false;
      return true;
    });
  }, [allFloors, rangeState, showRepeats]);

  // Filtered floors for table
  const tableVisibleFloors = useMemo(() => {
    let list = allFloors;

    if (!showRepeats) {
      list = list.filter((f) => !f.is_duplicate);
    }

    if (directoryFilter === 'boss') {
      list = list.filter((f) => f.is_boss_floor);
    } else if (directoryFilter === '1-500') {
      list = list.filter((f) => f.floor <= 500);
    } else if (directoryFilter === '501-600') {
      list = list.filter((f) => f.floor >= 501);
    } else {
      list = list.filter((f) => f.floor >= rangeState.minFloor && f.floor <= rangeState.maxFloor);
    }

    if (floorSearchQuery.trim()) {
      const q = floorSearchQuery.trim().toLowerCase();
      const num = parseInt(q, 10);
      if (!isNaN(num)) {
        list = list.filter((f) => f.floor === num);
      } else {
        list = list.filter(
          (f) =>
            String(f.floor).includes(q) ||
            (q === 'boss' && f.is_boss_floor) ||
            (f.primary_enemy &&
              (f.primary_enemy.name_en.toLowerCase().includes(q) ||
                f.primary_enemy.name_ru.toLowerCase().includes(q)))
        );
      }
    }

    return list;
  }, [allFloors, showRepeats, directoryFilter, rangeState, floorSearchQuery]);

  // ==========================================
  // Canvas Rendering Logic
  // ==========================================

  // Colors
  const isDark = chartTheme === 'dark';
  const colors = useMemo(
    () => ({
      plotBg: isDark ? '#0f0b15' : '#ffffff',
      grid: isDark ? 'rgba(255,255,255,0.06)' : '#e6e6e6',
      axis: isDark ? '#9a91ad' : '#555555',
      text: isDark ? '#f4f0f6' : '#1f2937',
      rose: '#fb7185',
      purple: '#c084fc',
      gold: '#f5d97a',
      gridMajor: isDark ? 'rgba(255,255,255,0.12)' : '#cccccc',
      baseline: isDark ? 'rgba(255,255,255,0.18)' : '#bdbdbd',
      pointStroke: isDark ? '#0f0b15' : '#ffffff',
      halo: isDark ? '#0f0b15' : '#ffffff',
      crosshair: isDark ? 'rgba(255,255,255,0.32)' : 'rgba(0,0,0,0.28)',
      title: isDark ? '#f4f0f6' : '#1f2937',
    }),
    [isDark]
  );

  // Render charts with the same geometry and typography as the legacy page.
  const drawChart = useCallback(
    (canvas: HTMLCanvasElement | null, chartKind: BygoneChartKind) => {
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(CHART_EXPORT_SCALE, 0, 0, CHART_EXPORT_SCALE, 0, 0);

      const width = CHART_WIDTH;
      const height = CHART_HEIGHT;
      const margin = CHART_MARGIN;
      const plotW = width - margin.left - margin.right;
      const plotH = height - margin.top - margin.bottom;
      const edgeInset = CHART_EDGE_INSET;

      ctx.fillStyle = colors.plotBg;
      ctx.fillRect(0, 0, width, height);

      if (chartVisibleFloors.length === 0) return;

      const values = chartVisibleFloors.map((f) =>
        chartKind === 'powercreep' ? (getFloorPowercreep(allFloors, f)?.percent ?? 0) : f.hp_buff_stacks
      );
      let minVal = chartKind === 'powercreep' ? Math.min(...values) : 0;
      let maxVal = Math.max(...values);
      if (chartKind === 'powercreep') {
        const span = Math.max(1, maxVal - minVal);
        minVal -= span * 0.12;
        maxVal += span * 0.16;
      } else {
        maxVal = Math.max(1, maxVal * 1.1);
      }

      const accent = chartKind === 'powercreep' ? '#ff9bb2' : '#ff4f77';
      const title = chartKind === 'powercreep' ? copy.chartPowercreepTitle : copy.chartHpTitle;
      const valueLabel = (value: number) => chartKind === 'powercreep' ? formatPowercreep(value) : formatHpG(value);

      ctx.fillStyle = colors.title;
      ctx.font = CHART_TITLE_CANVAS_FONT;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(title, width / 2, 42);

      drawChartWatermark(ctx, 40, height - 20, colors.axis);

      // Draw horizontal grid lines (5 steps)
      ctx.strokeStyle = colors.grid;
      ctx.lineWidth = 1;
      ctx.fillStyle = colors.axis;
      ctx.font = '18px Manrope, Arial, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';

      const steps = 5;
      for (let i = 0; i <= steps; i++) {
        const y = margin.top + plotH - (i / steps) * plotH;
        const val = minVal + (i / steps) * (maxVal - minVal);
        ctx.strokeStyle = i === 0 ? colors.gridMajor : colors.grid;
        ctx.beginPath();
        ctx.moveTo(margin.left, y);
        ctx.lineTo(margin.left + plotW, y);
        ctx.stroke();
        ctx.fillStyle = colors.axis;
        ctx.fillText(valueLabel(val), margin.left - 18, y);
      }

      ctx.strokeStyle = colors.baseline;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(margin.left, margin.top + plotH);
      ctx.lineTo(width - margin.right, margin.top + plotH);
      ctx.stroke();

      // X scale
      const count = chartVisibleFloors.length;
      const getX = (idx: number) => {
        if (count <= 1) return margin.left + plotW / 2;
        return margin.left + edgeInset + (idx / (count - 1)) * (plotW - edgeInset * 2);
      };
      const getY = (val: number) => margin.top + plotH - ((val - minVal) / (maxVal - minVal)) * plotH;

      // Legacy uses a clean line chart: no area fill, with large outlined points.
      ctx.beginPath();
      values.forEach((value, idx) => {
        const x = getX(idx);
        const y = getY(value);
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = accent;
      ctx.lineWidth = 3;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.stroke();

      chartVisibleFloors.forEach((f, idx) => {
        const x = getX(idx);
        const y = getY(values[idx]);

        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.arc(x, y, 8.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = colors.pointStroke;
        ctx.lineWidth = 2.6;
        ctx.stroke();

        const xStep = count > 1 ? plotW / (count - 1) : 0;
        const visibleLabel = xStep >= 42 || idx % Math.max(1, Math.ceil(42 / Math.max(1, xStep))) === 0 || idx === count - 1;
        if (visibleLabel) {
          ctx.fillStyle = colors.axis;
          ctx.font = '16px Manrope, Arial, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(`F${f.floor}`, x, margin.top + plotH + 24);
          ctx.fillStyle = accent;
          ctx.font = '700 15.5px Manrope, Arial, sans-serif';
          ctx.lineWidth = 3;
          ctx.strokeStyle = colors.halo;
          ctx.strokeText(valueLabel(values[idx]), x, y - 30);
          ctx.fillText(valueLabel(values[idx]), x, y - 30);
        }

        const weaknesses = f.weakness
          .map((weakness) => getChartWeaknessImage(weakness.element))
          .filter((image): image is HTMLImageElement => image !== null);
        if (weaknesses.length > 0 && visibleLabel && xStep > 0) {
          const iconSize = Math.min(18, (xStep - 2 * (weaknesses.length - 1)) / weaknesses.length);
          if (iconSize >= 10) {
            const gap = Math.min(2, iconSize * 0.12);
            const groupWidth = weaknesses.length * iconSize + (weaknesses.length - 1) * gap;
            const startX = x - groupWidth / 2;
            const iconY = margin.top + plotH + 42;
            weaknesses.forEach((image, weaknessIndex) => {
              if (image.complete && image.naturalWidth > 0) {
                ctx.drawImage(image, startX + weaknessIndex * (iconSize + gap), iconY, iconSize, iconSize);
              }
            });
          }
        }
      });
    },
    [allFloors, chartVisibleFloors, colors, copy]
  );

  const drawHpChart = useCallback((canvas: HTMLCanvasElement | null) => drawChart(canvas, 'hp'), [drawChart]);
  const drawPowercreepChart = useCallback(
    (canvas: HTMLCanvasElement | null) => drawChart(canvas, 'powercreep'),
    [drawChart]
  );

  // Render Mini Overview Navigator Track
  const drawOverviewTrack = useCallback(
    (canvas: HTMLCanvasElement | null) => {
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const w = canvas.width;
      const h = canvas.height;

      ctx.fillStyle = isDark ? '#0f0b15' : '#f1f5f9';
      ctx.fillRect(0, 0, w, h);

      const maxLimit = maxAvailableFloor;
      const nonDups = allFloors.filter((f) => !f.is_duplicate && f.floor <= maxLimit);
      if (nonDups.length === 0) return;

      const maxHp = Math.max(...nonDups.map((f) => f.hp_buff_stacks), 1);

      // Draw sparkline curve
      ctx.beginPath();
      nonDups.forEach((f, idx) => {
        const x = (f.floor / maxLimit) * w;
        const y = h - (f.hp_buff_stacks / maxHp) * (h - 6) - 3;
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = 'rgba(251, 113, 133, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Highlight the selected range window
      const xStart = ((rangeState.minFloor - 1) / maxLimit) * w;
      const xEnd = (rangeState.maxFloor / maxLimit) * w;
      const rectW = Math.max(8, xEnd - xStart);

      ctx.fillStyle = 'rgba(245, 217, 122, 0.22)';
      ctx.fillRect(xStart, 0, rectW, h);

      ctx.strokeStyle = '#f5d97a';
      ctx.lineWidth = 2;
      ctx.strokeRect(xStart, 0, rectW, h);
    },
    [allFloors, isDark, maxAvailableFloor, rangeState]
  );

  // Re-draw canvases when dependencies update
  useEffect(() => {
    drawHpChart(hpCanvasRef.current);
    drawPowercreepChart(powercreepCanvasRef.current);
    drawOverviewTrack(overviewCanvasRef.current);
  }, [drawHpChart, drawPowercreepChart, drawOverviewTrack]);

  useEffect(() => {
    let cancelled = false;
    const iconSources = Array.from(new Set(
      chartVisibleFloors.flatMap((floor) => floor.weakness
        .map((weakness) => getWeaknessGameIcon(weakness.element))
        .filter((src): src is string => src !== null))
    ));

    void Promise.all(iconSources.map((src) => new Promise<void>((resolve) => {
      const image = chartWeaknessImages.get(src);
      if (!image || image.complete) {
        resolve();
        return;
      }
      image.addEventListener('load', () => resolve(), { once: true });
      image.addEventListener('error', () => resolve(), { once: true });
    }))).then(() => {
      if (cancelled) return;
      drawHpChart(hpCanvasRef.current);
      drawPowercreepChart(powercreepCanvasRef.current);
      if (zoomModal.isOpen) {
        (zoomModal.chartKind === 'hp' ? drawHpChart : drawPowercreepChart)(zoomCanvasRef.current);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [chartVisibleFloors, drawHpChart, drawPowercreepChart, zoomModal.isOpen, zoomModal.chartKind]);

  // Overview canvas click/drag navigation
  const handleOverviewClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = overviewCanvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const ratio = Math.max(0, Math.min(1, clickX / rect.width));
      const targetFloor = Math.round(ratio * maxAvailableFloor);

      const span = rangeState.maxFloor - rangeState.minFloor;
      let newMin = Math.max(1, targetFloor - Math.floor(span / 2));
      const newMax = Math.min(maxAvailableFloor, newMin + span);
      if (newMax - newMin < span) newMin = Math.max(1, newMax - span);

      setRange(newMin, newMax, 'custom');
    },
    [maxAvailableFloor, rangeState, setRange]
  );

  // Zoom Modal Canvas Redraw
  useEffect(() => {
    if (!zoomModal.isOpen || !zoomCanvasRef.current) return;
    if (zoomModal.chartKind === 'hp') {
      drawHpChart(zoomCanvasRef.current);
    } else {
      drawPowercreepChart(zoomCanvasRef.current);
    }
  }, [zoomModal.isOpen, zoomModal.chartKind, drawHpChart, drawPowercreepChart]);

  // Zoom Modal Scale & Pan
  const handleZoomWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 0.85;
    setZoomModal((prev) => ({
      ...prev,
      scale: Math.max(0.5, Math.min(4, prev.scale * factor)),
    }));
  }, []);

  const handleZoomMouseDown = useCallback((e: React.MouseEvent) => {
    setZoomModal((prev) => ({
      ...prev,
      isDragging: true,
      dragStartX: e.clientX - prev.translateX,
      dragStartY: e.clientY - prev.translateY,
    }));
  }, []);

  const handleZoomMouseMove = useCallback((e: React.MouseEvent) => {
    setZoomModal((prev) => {
      if (!prev.isDragging) return prev;
      return {
        ...prev,
        translateX: e.clientX - prev.dragStartX,
        translateY: e.clientY - prev.dragStartY,
      };
    });
  }, []);

  const handleZoomMouseUp = useCallback(() => {
    setZoomModal((prev) => ({ ...prev, isDragging: false }));
  }, []);

  const handleChartMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>, chartKind: BygoneChartKind) => {
      const count = chartVisibleFloors.length;
      if (count === 0) return;
      const rect = e.currentTarget.getBoundingClientRect();
      if (rect.width <= 0) return;
      // Nearest point in chart units, using the same x scale as drawChart.
      const plotW = CHART_WIDTH - CHART_MARGIN.left - CHART_MARGIN.right;
      const span = plotW - CHART_EDGE_INSET * 2;
      const pointX = (idx: number) =>
        count <= 1 ? CHART_MARGIN.left + plotW / 2 : CHART_MARGIN.left + CHART_EDGE_INSET + (idx / (count - 1)) * span;
      const chartX = ((e.clientX - rect.left) / rect.width) * CHART_WIDTH;
      const index =
        count <= 1
          ? 0
          : Math.max(0, Math.min(count - 1, Math.round(((chartX - CHART_MARGIN.left - CHART_EDGE_INSET) / span) * (count - 1))));
      setActiveTooltip({
        visible: true,
        x: e.clientX,
        y: e.clientY,
        guideX: pointX(index) / CHART_WIDTH,
        floor: chartVisibleFloors[index],
        chartKind,
      });
    },
    [chartVisibleFloors]
  );

  const renderChartHover = (chartKind: BygoneChartKind) => {
    if (!activeTooltip?.visible || activeTooltip.chartKind !== chartKind) return null;
    const f = activeTooltip.floor;
    const powercreep = getFloorPowercreep(allFloors, f);
    const showEnemy = f.floor <= 500 && f.primary_enemy;
    const enemyName = f.primary_enemy ? getEnemyDisplayName(f.primary_enemy, isRu) : getMissingBygoneEnemyName(f.floor, isRu);
    const plotTop = CHART_MARGIN.top / CHART_HEIGHT;
    const plotHeight = (CHART_HEIGHT - CHART_MARGIN.top - CHART_MARGIN.bottom) / CHART_HEIGHT;
    return (
      <>
        <span
          className={styles.chartGuide}
          aria-hidden="true"
          style={{
            left: `${activeTooltip.guideX * 100}%`,
            top: `${plotTop * 100}%`,
            height: `${plotHeight * 100}%`,
            borderColor: colors.crosshair,
          }}
        />
        <ChartHoverCard
          x={activeTooltip.x}
          y={activeTooltip.y}
          eyebrow={`${copy.floor} ${f.floor}`}
          portrait={showEnemy ? f.primary_enemy?.imageThumb || f.primary_enemy?.image || null : null}
          name={showEnemy ? enemyName : undefined}
          value={chartKind === 'hp' ? formatHpG(f.hp_buff_stacks) : formatPowercreep(powercreep?.percent ?? 0)}
          meta={
            chartKind === 'hp'
              ? `${copy.powercreep} ${powercreep ? formatPowercreep(powercreep.percent) : '—'}`
              : `HP: ${formatHpG(f.hp_buff_stacks)}`
          }
          footer={
            <div className={styles.chartHoverWeakness}>
              <span className={styles.chartHoverWeaknessLabel}>{copy.weakness}</span>
              {f.weakness.length === 0 ? (
                <span>{copy.noWeakness}</span>
              ) : (
                f.weakness.map((w, idx) => {
                  const iconSrc = getElemIcon(w.element) || w.icon;
                  return (
                    <span key={`${w.element}-${idx}`} className={styles.chartHoverWeaknessChip}>
                      {iconSrc && <img src={iconSrc} alt="" aria-hidden="true" />}
                      {isRu ? w.element_name_ru || w.element : w.element_name_en || w.element}
                    </span>
                  );
                })
              )}
            </div>
          }
        />
      </>
    );
  };

  return (
    <div className={styles.container}>
      <main className={styles.layout}>
        {/* Hero Section */}
        <BygoneHeader mode="gacha" />

        {/* Charts Section */}
        <section className={styles.section} id="charts">
          <div className={styles.sectionInner}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>{copy.chartsTitle}</h2>

              <div className={styles.chartsControls}>
                {/* Range Presets */}
                <div className={styles.controlItem}>
                  <span className={styles.controlLabel}>{copy.ctrlRange}</span>
                  <div className={styles.segmentedSwitch} role="group" aria-label={translateUiText("Range Presets", activeLocale)}>
                    <button
                      type="button"
                      className={`${styles.switchBtn} ${rangeState.preset === 'latest20' ? styles.isActive : ''}`}
                      onClick={() => {
                        const count = 20;
                        const min = Math.max(1, maxAvailableFloor - count + 1);
                        setRange(min, maxAvailableFloor, 'latest20');
                      }}
                      aria-pressed={rangeState.preset === 'latest20'}
                    >
                      {copy.rangeLatest20}
                    </button>
                    <button
                      type="button"
                      className={`${styles.switchBtn} ${rangeState.preset === 'all' ? styles.isActive : ''}`}
                      onClick={() => setRange(1, maxAvailableFloor, 'all')}
                      aria-pressed={rangeState.preset === 'all'}
                    >
                      {copy.rangeAll}
                    </button>
                    <button
                      type="button"
                      className={`${styles.switchBtn} ${rangeState.preset === '1-500' ? styles.isActive : ''}`}
                      onClick={() => setRange(1, Math.min(500, maxAvailableFloor), '1-500')}
                      aria-pressed={rangeState.preset === '1-500'}
                    >
                      {copy.rangeEarly}
                    </button>
                    <button
                      type="button"
                      className={`${styles.switchBtn} ${rangeState.preset === '501-600' ? styles.isActive : ''}`}
                      onClick={() => setRange(501, maxAvailableFloor, '501-600')}
                      aria-pressed={rangeState.preset === '501-600'}
                    >
                      {copy.rangeLate}
                    </button>
                  </div>
                </div>

                {/* Range Status */}
                <span className={styles.rangeStatus} aria-live="polite">
                  {formatRangeStatus(
                    copy.rangeStatus,
                    rangeState.minFloor,
                    rangeState.maxFloor,
                    Math.max(0, rangeState.maxFloor - rangeState.minFloor + 1)
                  )}
                </span>

                {/* Chart Palette Toggle */}
                <div className={styles.controlItem}>
                  <span className={styles.controlLabel}>{copy.chartPalette}</span>
                  <div className={styles.segmentedSwitch} role="group" aria-label={translateUiText("Chart palette", activeLocale)}>
                    <button
                      type="button"
                      className={`${styles.switchBtn} ${chartTheme === 'light' ? styles.isActive : ''}`}
                      onClick={() => handleSetTheme('light')}
                      aria-pressed={chartTheme === 'light'}
                    >
                      <svg className={styles.paletteIcon} viewBox="0 0 24 24" aria-hidden="true">
                        <circle cx="12" cy="12" r="4" />
                        <path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41" />
                      </svg>
                      <span>{copy.paletteLight}</span>
                    </button>
                    <button
                      type="button"
                      className={`${styles.switchBtn} ${chartTheme === 'dark' ? styles.isActive : ''}`}
                      onClick={() => handleSetTheme('dark')}
                      aria-pressed={chartTheme === 'dark'}
                    >
                      <svg className={styles.paletteIcon} viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z" />
                      </svg>
                      <span>{copy.paletteDark}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.chartStack}>
              {/* HP Scaling Chart Card */}
              <article className={styles.chartCard} id="hp">
                <div className={styles.chartCardHeader}>
                  <h3 className={styles.chartCardTitle}>{copy.chartHpTitle}</h3>
                  <div className={styles.actionGroup}>
                    <button
                      type="button"
                      className={styles.button}
                      onClick={() => {
                        if (hpCanvasRef.current) {
                          exportCanvasAsPng(
                            hpCanvasRef.current,
                            `bygone-hp-floors-${rangeState.minFloor}-to-${rangeState.maxFloor}.png`
                          );
                        }
                      }}
                    >
                      {copy.downloadPng}
                    </button>
                    <button
                      type="button"
                      className={`${styles.button} ${styles.buttonSubtle}`}
                      onClick={() =>
                        exportBygoneCsv(
                          allFloors,
                          'hp',
                          rangeState.minFloor,
                          rangeState.maxFloor,
                          showRepeats
                        )
                      }
                    >
                      {copy.downloadCsv}
                    </button>
                  </div>
                </div>

                <div className={styles.chartSubbar}>
                  <span className={styles.chartUnit}>{copy.chartHpUnit}</span>
                  <div className={styles.chartOptions}>
                    <button
                      type="button"
                      className={styles.btnIcon}
                      title={translateUiText("Zoom in (+)", activeLocale)}
                      onClick={() => {
                        const span = rangeState.maxFloor - rangeState.minFloor;
                        const newSpan = Math.max(5, Math.round(span * 0.75));
                        const mid = Math.round((rangeState.minFloor + rangeState.maxFloor) / 2);
                        setRange(
                          Math.max(1, mid - Math.floor(newSpan / 2)),
                          Math.min(maxAvailableFloor, mid + Math.floor(newSpan / 2))
                        );
                      }}
                    >
                      +
                    </button>
                    <button
                      type="button"
                      className={styles.btnIcon}
                      title={translateUiText("Zoom out (-)", activeLocale)}
                      onClick={() => {
                        const span = rangeState.maxFloor - rangeState.minFloor;
                        const newSpan = Math.round(span * 1.35);
                        const mid = Math.round((rangeState.minFloor + rangeState.maxFloor) / 2);
                        setRange(
                          Math.max(1, mid - Math.floor(newSpan / 2)),
                          Math.min(maxAvailableFloor, mid + Math.floor(newSpan / 2))
                        );
                      }}
                    >
                      −
                    </button>
                    <button
                      type="button"
                      className={styles.btnIcon}
                      title={translateUiText("Reset Zoom", activeLocale)}
                      onClick={() => {
                        const count = 20;
                        setRange(Math.max(1, maxAvailableFloor - count + 1), maxAvailableFloor, 'latest20');
                      }}
                    >
                      {copy.zoomReset}
                    </button>
                  </div>
                </div>

                <div
                  className={styles.chartFrame}
                  tabIndex={0}
                  role="button"
                  aria-label={translateUiText("Click to open zoom modal", activeLocale)}
                  onMouseMove={(e) => handleChartMouseMove(e, 'hp')}
                  onMouseLeave={() => setActiveTooltip(null)}
                  onClick={() =>
                    setZoomModal({
                      isOpen: true,
                      chartKind: 'hp',
                      scale: 1,
                      translateX: 0,
                      translateY: 0,
                      isDragging: false,
                      dragStartX: 0,
                      dragStartY: 0,
                    })
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setZoomModal({
                        isOpen: true,
                        chartKind: 'hp',
                        scale: 1,
                        translateX: 0,
                        translateY: 0,
                        isDragging: false,
                        dragStartX: 0,
                        dragStartY: 0,
                      });
                    }
                  }}
                >
                  <canvas
                    ref={hpCanvasRef}
                    width={CHART_WIDTH * CHART_EXPORT_SCALE}
                    height={CHART_HEIGHT * CHART_EXPORT_SCALE}
                    className={styles.chartCanvas}
                  />
                  {renderChartHover('hp')}
                </div>
              </article>

              {/* Powercreep Chart Card */}
              <article className={styles.chartCard} id="powercreep">
                <div className={styles.chartCardHeader}>
                  <h3 className={styles.chartCardTitle}>{copy.chartPowercreepTitle}</h3>
                  <div className={styles.actionGroup}>
                    <button
                      type="button"
                      className={styles.button}
                      onClick={() => {
                        if (powercreepCanvasRef.current) {
                          exportCanvasAsPng(
                            powercreepCanvasRef.current,
                            `bygone-powercreep-floors-${rangeState.minFloor}-to-${rangeState.maxFloor}.png`
                          );
                        }
                      }}
                    >
                      {copy.downloadPng}
                    </button>
                    <button
                      type="button"
                      className={`${styles.button} ${styles.buttonSubtle}`}
                      onClick={() =>
                        exportBygoneCsv(
                          allFloors,
                          'powercreep',
                          rangeState.minFloor,
                          rangeState.maxFloor,
                          showRepeats
                        )
                      }
                    >
                      {copy.downloadCsv}
                    </button>
                  </div>
                </div>

                <div
                  className={styles.chartFrame}
                  tabIndex={0}
                  role="button"
                  aria-label={translateUiText("Click to open zoom modal", activeLocale)}
                  onMouseMove={(e) => handleChartMouseMove(e, 'powercreep')}
                  onMouseLeave={() => setActiveTooltip(null)}
                  onClick={() =>
                    setZoomModal({
                      isOpen: true,
                      chartKind: 'powercreep',
                      scale: 1,
                      translateX: 0,
                      translateY: 0,
                      isDragging: false,
                      dragStartX: 0,
                      dragStartY: 0,
                    })
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setZoomModal({
                        isOpen: true,
                        chartKind: 'powercreep',
                        scale: 1,
                        translateX: 0,
                        translateY: 0,
                        isDragging: false,
                        dragStartX: 0,
                        dragStartY: 0,
                      });
                    }
                  }}
                >
                  <canvas
                    ref={powercreepCanvasRef}
                    width={CHART_WIDTH * CHART_EXPORT_SCALE}
                    height={CHART_HEIGHT * CHART_EXPORT_SCALE}
                    className={styles.chartCanvas}
                  />
                  {renderChartHover('powercreep')}
                </div>
              </article>
            </div>

            {/* Mini Overview Navigator Track */}
            <div className={styles.overviewPanel}>
              <div className={styles.overviewWrap}>
                <span className={styles.overviewLabel}>{copy.overviewLabel}</span>
                <canvas
                  ref={overviewCanvasRef}
                  width={1800}
                  height={42}
                  className={styles.overviewCanvas}
                  onClick={handleOverviewClick}
                />
              </div>
              <p className={styles.chartHint}>{copy.chartHint}</p>
            </div>
          </div>
        </section>

        {/* Floor Directory / Table Section */}
        <section className={styles.section} id="floors">
          <div className={styles.sectionInner}>
            <div className={styles.floorsHeader}>
              <div>
                <h2 className={styles.sectionTitle}>{copy.floorsTitle}</h2>
                <p className={styles.sectionBody}>{copy.floorsSubtitle}</p>
              </div>

              <div className={styles.searchWrap}>
                <input
                  type="search"
                  className={styles.searchInput}
                  placeholder={copy.searchPlaceholder}
                  value={floorSearchQuery}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFloorSearchQuery(val);
                    const num = parseInt(val, 10);
                    if (!isNaN(num) && num >= 1 && num <= maxAvailableFloor) {
                      const newMin = Math.max(1, num - 9);
                      const newMax = Math.min(maxAvailableFloor, newMin + 19);
                      setRange(newMin, newMax, 'custom');
                    }
                  }}
                  aria-label={copy.searchPlaceholder}
                />
              </div>
            </div>

            {/* Filter Bar */}
            <div className={styles.filterBar}>
              <div className={styles.segmentedSwitch} role="group" aria-label={translateUiText("Floor Filters", activeLocale)}>
                <button
                  type="button"
                  className={`${styles.switchBtn} ${directoryFilter === 'all' ? styles.isActive : ''}`}
                  onClick={() => setDirectoryFilter('all')}
                  aria-pressed={directoryFilter === 'all'}
                >
                  {copy.filterAll}
                </button>
                <button
                  type="button"
                  className={`${styles.switchBtn} ${directoryFilter === 'boss' ? styles.isActive : ''}`}
                  onClick={() => setDirectoryFilter('boss')}
                  aria-pressed={directoryFilter === 'boss'}
                >
                  {copy.filterBoss}
                </button>
                <button
                  type="button"
                  className={`${styles.switchBtn} ${directoryFilter === '1-500' ? styles.isActive : ''}`}
                  onClick={() => setDirectoryFilter('1-500')}
                  aria-pressed={directoryFilter === '1-500'}
                >
                  {copy.filterEarly}
                </button>
                <button
                  type="button"
                  className={`${styles.switchBtn} ${directoryFilter === '501-600' ? styles.isActive : ''}`}
                  onClick={() => setDirectoryFilter('501-600')}
                  aria-pressed={directoryFilter === '501-600'}
                >
                  {copy.filterLate}
                </button>
              </div>

              {/* Show Repeats Checkbox */}
              <label className={styles.checkboxWrap}>
                <input
                  type="checkbox"
                  checked={showRepeats}
                  onChange={(e) => setShowRepeats(e.target.checked)}
                />
                <span>{copy.showRepeats}</span>
              </label>
            </div>

            {/* Floor Rows Container */}
            <div className={styles.tableWrap} tabIndex={0}>
              <div className={styles.floorRowList}>
                {tableVisibleFloors.map((f) => {
                  const powercreep = getFloorPowercreep(allFloors, f);
                  const enemyName = f.primary_enemy
                    ? getEnemyDisplayName(f.primary_enemy, isRu)
                    : getMissingBygoneEnemyName(f.floor, isRu);

                  return (
                    <div
                      key={`floor-${f.floor}`}
                      id={`floor-${f.floor}`}
                      className={`${styles.row} ${f.is_boss_floor ? styles.rowBoss : ''}`}
                    >
                      <div className={styles.rowLeft}>
                        <div className={styles.floorBadge}>
                          <span>{translateUiText('Floor', activeLocale)} {f.floor}</span>
                          {f.is_boss_floor && (
                            <span className={`${styles.badge} ${styles.badgeBoss}`}>★ {translateUiText('BOSS', activeLocale)}</span>
                          )}
                          {f.is_duplicate && (
                            <span
                              className={`${styles.badge} ${styles.badgeDuplicate}`}
                              title={copy.repeatsFloor.replace('{floor}', String(f.duplicated_from_floor))}
                            >
                              ⚠ {copy.repeatsFloor.replace('{floor}', String(f.duplicated_from_floor))}
                            </span>
                          )}
                        </div>

                        {/* Enemy Portrait & Name */}
                        {f.floor <= 500 && <div className={styles.rowEnemy}>
                          <div className={styles.rowPortrait}>
                            {f.primary_enemy?.imageThumb || f.primary_enemy?.image ? (
                              <img
                                src={f.primary_enemy.imageThumb || f.primary_enemy.image || ''}
                                alt={enemyName}
                                loading="lazy"
                              />
                            ) : (
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  width: '100%',
                                  height: '100%',
                                }}
                              >
                                <span>{f.is_boss_floor ? '👾' : '⚔️'}</span>
                              </div>
                            )}
                          </div>
                          <span className={styles.rowEnemyName}>{enemyName}</span>
                        </div>}

                        {/* Weaknesses */}
                        {f.weakness && f.weakness.length > 0 && (
                          <div className={styles.weaknessList}>
                            {f.weakness.map((w, wIdx) => {
                              const elemName = isRu ? w.element_name_ru || w.element : w.element_name_en || w.element;
                              const iconSrc = getElemIcon(w.element) || w.icon;
                              return (
                                <span
                                  key={`weak-${wIdx}`}
                                  className={styles.weaknessChip}
                                  title={w.name_en || elemName}
                                >
                                  {iconSrc && (
                                    <img
                                      className={styles.weaknessIcon}
                                      src={iconSrc}
                                      alt=""
                                      aria-hidden="true"
                                      loading="lazy"
                                    />
                                  )}
                                  <span>{elemName}</span>
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Stats */}
                      <div className={styles.rowStats}>
                        <div className={styles.statCell}>
                          <span>{copy.difficulty}</span>
                          <strong style={{ color: 'var(--bygone-emerald)' }}>
                            {formatNumber(f.displayed_difficulty)}
                          </strong>
                        </div>
                        <div className={styles.statCell}>
                          <span>{copy.hpStacks}</span>
                          <strong style={{ color: 'var(--bygone-rose)' }}>
                            {formatNumber(f.hp_buff_stacks)}
                          </strong>
                        </div>
                        <div className={styles.statCell}>
                          <span>{copy.atkStacks}</span>
                          <strong style={{ color: 'var(--bygone-cyan)' }}>
                            {formatNumber(f.atk_buff_stacks)}
                          </strong>
                        </div>
                        <div className={styles.statCell}>
                          <span>{copy.level}</span>
                          <strong style={{ color: 'var(--bygone-gold)' }}>
                            {translateUiText('Lv.', activeLocale)} {f.monster_level || 70}
                          </strong>
                        </div>
                        <div className={styles.statCell}>
                          <span>{copy.powercreep}</span>
                          <strong style={{ color: 'var(--bygone-rose)' }}>
                            {formatPowercreep(powercreep?.percent)}
                          </strong>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Full-Screen Zoom Modal */}
      {zoomModal.isOpen && (
        <div className={styles.zoomModal}>
          <div
            className={styles.zoomBackdrop}
            onClick={() => setZoomModal((prev) => ({ ...prev, isOpen: false }))}
          />
          <div
            className={styles.zoomDialog}
            role="dialog"
            aria-modal="true"
            aria-label={copy.zoomEyebrow}
          >
            <div className={styles.zoomHeader}>
              <div>
                <p className={styles.zoomEyebrow}>{copy.zoomEyebrow}</p>
                <h3 className={styles.zoomTitle}>
                  {zoomModal.chartKind === 'hp' ? copy.chartHpTitle : copy.chartPowercreepTitle}
                </h3>
              </div>
              <div className={styles.actionGroup}>
                <button
                  type="button"
                  className={`${styles.button} ${styles.buttonSubtle}`}
                  onClick={() =>
                    setZoomModal((prev) => ({
                      ...prev,
                      scale: Math.max(0.5, prev.scale * 0.8),
                    }))
                  }
                >
                  −
                </button>
                <button
                  type="button"
                  className={`${styles.button} ${styles.buttonSubtle}`}
                  onClick={() =>
                    setZoomModal((prev) => ({
                      ...prev,
                      scale: 1,
                      translateX: 0,
                      translateY: 0,
                    }))
                  }
                >
                  100%
                </button>
                <button
                  type="button"
                  className={`${styles.button} ${styles.buttonSubtle}`}
                  onClick={() =>
                    setZoomModal((prev) => ({
                      ...prev,
                      scale: Math.min(4, prev.scale * 1.25),
                    }))
                  }
                >
                  +
                </button>
                <button
                  type="button"
                  className={styles.button}
                  onClick={() => setZoomModal((prev) => ({ ...prev, isOpen: false }))}
                >
                  {copy.close}
                </button>
              </div>
            </div>

            <p className={styles.zoomHint}>{copy.zoomHint}</p>

            <div
              className={styles.zoomViewport}
              onWheel={handleZoomWheel}
              onMouseDown={handleZoomMouseDown}
              onMouseMove={handleZoomMouseMove}
              onMouseUp={handleZoomMouseUp}
            >
              <div
                className={styles.zoomCanvasWrap}
                style={{
                  transform: `translate(${zoomModal.translateX}px, ${zoomModal.translateY}px) scale(${zoomModal.scale})`,
                }}
              >
                <canvas
                  ref={zoomCanvasRef}
                  width={CHART_WIDTH * CHART_EXPORT_SCALE}
                  height={CHART_HEIGHT * CHART_EXPORT_SCALE}
                  className={styles.zoomCanvas}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
