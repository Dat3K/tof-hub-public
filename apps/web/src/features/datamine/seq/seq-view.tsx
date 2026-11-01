'use client';

import { localized, translateUiText} from '@tof-hub/i18n';
import { EncounterModeSwitcher } from '../components/encounter-ui';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useI18n } from '@/lib/i18n';
import type {
  SeqViewProps,
  SeqStageItem,
  SeqStageView,
  SeqChartTheme,
  SeqChartKey,
} from './seq-types';
import { SEQ_COPY } from './seq-copy';
import { mergeSeqData } from './seq-data';
import {
  formatCompact,
  formatInteger,
  formatPercent,
  formatCritResist,
  getVisibleSequentialRows,
  getMechanicsNote,
  findNearestChartPoint,
  SEQ_SUPPORT_LEVEL_INITIAL,
  SEQ_REFERENCE_DAMAGE_PERCENT,
  SEQ_RESIST_IGNORE_RANGE,
  seqDamageBonusMultiplier,
  seqRequiredCactusDamage,
  seqResistanceHpMultiplier,
} from './seq-domain';
import { exportSeqCsv, exportSvgAsPng } from './seq-export';
import { SeqFormulaInfo } from './seq-formula-info';
import { RailGlyph } from '@/components/tool-rail/tool-rail';
import {
  CHART_FONT_FAMILY,
  CHART_TITLE_FONT_SIZE,
  CHART_TITLE_FONT_WEIGHT,
  ChartWatermark,
} from '../components/chart-branding';
import { ChartHoverCard } from '../components/chart-hover-card';
import styles from './seq.module.css';

const CHART_WIDTH = 1800;
const CHART_HEIGHT = 760;
/** Author mark: bottom-left corner, under the y-axis labels. */
const WATERMARK_X = 40;
const WATERMARK_Y = 740;

/** Selecting chart text (title, badge) must not open the zoom view. */
function isTextInteraction(event: React.MouseEvent): boolean {
  if (event.target instanceof SVGTextElement) return true;
  return typeof window !== 'undefined' && (window.getSelection()?.toString().length ?? 0) > 0;
}

/** Slider values in the title band (top right), so PNG exports carry them. */
function ChartParamsBadge({
  rows,
  right,
  top,
  colors,
}: {
  rows: { label: string; value: string }[];
  right: number;
  top: number;
  colors: { axis: string; gold: string };
}) {
  const cellW = 180;
  const height = 54;
  const width = cellW * rows.length;
  const x = right - width;
  return (
    <g fontFamily={CHART_FONT_FAMILY}>
      <rect
        x={x}
        y={top}
        width={width}
        height={height}
        rx="10"
        fill={colors.gold}
        fillOpacity="0.07"
        stroke={colors.gold}
        strokeOpacity="0.55"
        strokeWidth="1.5"
      />
      {rows.map((row, idx) => {
        const cx = x + idx * cellW;
        return (
          <g key={row.label}>
            {idx > 0 && (
              <line x1={cx} y1={top + 10} x2={cx} y2={top + height - 10} stroke={colors.gold} strokeOpacity="0.35" />
            )}
            <text x={cx + cellW / 2} y={top + 21} textAnchor="middle" fontSize="13" fontWeight="600" fill={colors.axis}>
              {row.label}
            </text>
            <text x={cx + cellW / 2} y={top + 44} textAnchor="middle" fontSize="21" fontWeight="800" fill={colors.gold}>
              {row.value}
            </text>
          </g>
        );
      })}
    </g>
  );
}

export function SeqView({
  initialData,
  initialLocale,
  initialStageView,
  initialChartTheme,
  resistanceConstant = null,
  supportDamageByLevel = null,
}: SeqViewProps) {
  const { locale: activeLocale } = useI18n();
  const currentLocale = activeLocale || initialLocale;
  const isRu = currentLocale === 'ru';
  const copy = localized(SEQ_COPY, currentLocale);

  // Base Data
  const stages: SeqStageItem[] = useMemo(() => mergeSeqData(initialData), [initialData]);

  // View States, seeded from the server-parsed URL (?stageView=&chartTheme=)
  // so shared links render the selected view on the first paint.
  const [stageView, setStageView] = useState<SeqStageView>(initialStageView ?? '16plus');
  const [chartTheme, setChartTheme] = useState<SeqChartTheme>(initialChartTheme ?? 'light');

  // Required cactus damage inputs (first chart only).
  const [resistIgnore, setResistIgnore] = useState<number>(SEQ_RESIST_IGNORE_RANGE.initial);
  const supportMaxLevel = supportDamageByLevel ? supportDamageByLevel.length - 1 : 0;
  const [supportLevel, setSupportLevel] = useState<number>(
    Math.min(SEQ_SUPPORT_LEVEL_INITIAL, supportMaxLevel)
  );
  const damageBonus = supportDamageByLevel?.[supportLevel] ?? 0;
  const levelLabel = `${copy.levelShort} ${supportLevel}`;
  const [formulaOpen, setFormulaOpen] = useState(false);

  // Tooltip & Modal States
  const [tooltip, setTooltip] = useState<{
    visible: boolean;
    x: number;
    y: number;
    chartKey: SeqChartKey;
    stage: SeqStageItem;
    value: number;
  } | null>(null);

  const [zoomModal, setZoomModal] = useState<{
    isOpen: boolean;
    chartKey: SeqChartKey;
    scale: number;
    translateX: number;
    translateY: number;
    isDragging: boolean;
    dragStartX: number;
    dragStartY: number;
  }>({
    isOpen: false,
    chartKey: 'effective',
    scale: 1,
    translateX: 0,
    translateY: 0,
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
  });

  const [bossModal, setBossModal] = useState<{
    isOpen: boolean;
    title: string;
    image: string;
  }>({
    isOpen: false,
    title: '',
    image: '',
  });

  // SVG Refs for PNG export
  const effectiveSvgRef = useRef<SVGSVGElement>(null);
  const pureSvgRef = useRef<SVGSVGElement>(null);
  const powercreepSvgRef = useRef<SVGSVGElement>(null);

  // Initialize from URL query & hash on mount and listen to navigation/Escape events
  useEffect(() => {
    if (typeof window === 'undefined') return;

    function applyUrlState() {
      // State is seeded from the server-parsed URL: only correct on
      // disagreement, and only consult storage when the URL is silent.
      const params = new URLSearchParams(window.location.search);
      const v = params.get('stageView');
      if (v === 'all' || v === '16plus') {
        setStageView((prev) => (prev === v ? prev : v));
      } else {
        try {
          const stored = localStorage.getItem('tof-datamine-seq-stage-view');
          if (stored === 'all' || stored === '16plus') {
            setStageView((prev) => (prev === stored ? prev : stored));
          }
        } catch {}
      }

      const t = params.get('chartTheme');
      if (t === 'light' || t === 'dark') {
        setChartTheme((prev) => (prev === t ? prev : t));
      } else {
        try {
          const stored = localStorage.getItem('tof-datamine-seq-chart-theme');
          if (stored === 'light' || stored === 'dark') {
            setChartTheme((prev) => (prev === stored ? prev : stored));
          }
        } catch {}
      }

      const hash = (window.location.hash || '').replace(/^#/, '').trim().toLowerCase();
      if (hash === 'hp' || hash === 'pure') {
        document.getElementById('pure')?.scrollIntoView({ behavior: 'smooth' });
      } else if (hash === 'effective') {
        document.getElementById('effective')?.scrollIntoView({ behavior: 'smooth' });
      } else if (hash === 'powercreep') {
        document.getElementById('powercreep')?.scrollIntoView({ behavior: 'smooth' });
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
      if (e.key === 'Escape') {
        if (bossModal.isOpen) {
          e.preventDefault();
          setBossModal((prev) => ({ ...prev, isOpen: false }));
        } else if (zoomModal.isOpen) {
          e.preventDefault();
          setZoomModal((prev) => ({ ...prev, isOpen: false }));
        }
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
  }, [bossModal.isOpen, zoomModal.isOpen]);

  // Keep chart deep-links in sync with the section currently in view.
  useEffect(() => {
    const chartIds = ['effective', 'pure', 'powercreep'] as const;
    let scheduled = false;

    const updateHash = () => {
      scheduled = false;
      const activeId = [...chartIds].reverse().find((id) => {
        const section = document.getElementById(id);
        if (!section) return false;
        const rect = section.getBoundingClientRect();
        return rect.top <= window.innerHeight * 0.35 && rect.bottom > window.innerHeight * 0.35;
      });
      if (!activeId || window.location.hash === `#${activeId}`) return;
      window.history.replaceState(
        null,
        '',
        `${window.location.pathname}${window.location.search}#${activeId}`
      );
    };

    const onScroll = () => {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(updateHash);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleSetTheme = useCallback((t: SeqChartTheme) => {
    setChartTheme(t);
    if (typeof document !== 'undefined') {
      document.body.setAttribute('data-chart-theme', t);
    }
    try {
      localStorage.setItem('tof-datamine-seq-chart-theme', t);
    } catch {}
  }, []);

  const handleSetStageView = useCallback((v: SeqStageView) => {
    setStageView(v);
    try {
      localStorage.setItem('tof-datamine-seq-stage-view', v);
    } catch {}
  }, []);

  // Filtered rows
  const visibleStages = useMemo(
    () => getVisibleSequentialRows(stages, stageView),
    [stages, stageView]
  );

  const requiredDamage = useMemo(() => {
    const byStage = new Map<number, number>();
    for (const s of stages) {
      const value = seqRequiredCactusDamage({
        maxHealth: s.maxHealth,
        resistance: s.def,
        resistanceConstant,
        resistIgnore,
        damageBonus,
      });
      if (value !== null) byStage.set(s.stage, value);
    }
    return byStage;
  }, [stages, resistanceConstant, resistIgnore, damageBonus]);

  const requiredStages = useMemo(
    () => visibleStages.filter((s) => requiredDamage.has(s.stage)),
    [visibleStages, requiredDamage]
  );

  // Every stage shares DEF 7500 today; the summary shows the first stage's multiplier.
  const summaryResistance = requiredStages[0]?.def ?? stages[0]?.def ?? null;
  const resistMultiplier =
    summaryResistance !== null && resistanceConstant
      ? seqResistanceHpMultiplier(summaryResistance, resistanceConstant, resistIgnore)
      : null;
  const totalMultiplier =
    resistMultiplier === null ? null : resistMultiplier / seqDamageBonusMultiplier(damageBonus);
  const percentLabel = (value: number) => `${Math.round(value * 100)}%`;
  const requiredParams = [
    {
      label: copy.resistIgnoreLabel,
      value: percentLabel(resistIgnore),
    },
    { label: copy.damageBonusLabel, value: levelLabel },
  ];

  // SVG Dimensions & Margins
  const isDark = chartTheme === 'dark';
  const themeColors = useMemo(
    () => ({
      plotBg: isDark ? '#0f0b15' : '#ffffff',
      grid: isDark ? 'rgba(255,255,255,0.06)' : '#e6e6e6',
      gridMajor: isDark ? 'rgba(255,255,255,0.12)' : '#cccccc',
      baseline: isDark ? 'rgba(255,255,255,0.18)' : '#bdbdbd',
      axis: isDark ? '#9a91ad' : '#555555',
      text: isDark ? '#f4f0f6' : '#1f2937',
      title: isDark ? '#f6f1fb' : '#1f2937',
      effective: '#b57bff',
      pure: '#f5d97a',
      powercreep: '#ff9bb2',
      pointStroke: isDark ? '#0f0b15' : '#ffffff',
      halo: isDark ? '#0f0b15' : '#ffffff',
      // Page gold (--seq-gold); a deeper shade keeps it readable on the light plot.
      gold: isDark ? '#f5d97a' : '#b8860b',
    }),
    [isDark]
  );

  // Helper to build SVG curve paths & points
  const buildSvgData = useCallback(
    (
      key: SeqChartKey,
      accessor: (s: SeqStageItem) => number,
      formatter: (v: number) => string,
      rows: SeqStageItem[] = visibleStages
    ) => {
      const margin = { top: 76, right: 86, bottom: 92, left: 104 };
      const plotW = CHART_WIDTH - margin.left - margin.right;
      const plotH = CHART_HEIGHT - margin.top - margin.bottom;
      const edgeInset = 34;

      if (rows.length === 0) {
        return {
          gridLines: [],
          pathD: '',
          areaD: '',
          points: [],
          margin,
          plotW,
          plotH,
        };
      }

      const values = rows.map(accessor);
      let minVal = key === 'powercreep' ? Math.min(...values) : 0;
      let maxVal = Math.max(...values);
      if (key === 'powercreep') {
        const span = Math.max(1, maxVal - minVal);
        minVal -= span * 0.12;
        maxVal += span * 0.16;
      } else {
        maxVal = Math.max(1, maxVal * 1.1);
      }

      // 5 horizontal grid lines
      const gridLines: { y: number; label: string }[] = [];
      const steps = 5;
      for (let i = 0; i <= steps; i++) {
        const y = margin.top + plotH - (i / steps) * plotH;
        const val = minVal + (i / steps) * (maxVal - minVal);
        gridLines.push({ y, label: formatter(val) });
      }

      const count = rows.length;
      const getX = (idx: number) => {
        if (count <= 1) return margin.left + plotW / 2;
        return margin.left + edgeInset + (idx / (count - 1)) * (plotW - edgeInset * 2);
      };
      const getY = (val: number) =>
        margin.top + plotH - ((val - minVal) / (maxVal - minVal)) * plotH;

      // Curve path
      let pathD = '';
      const points = rows.map((s, idx) => {
        const x = getX(idx);
        const y = getY(accessor(s));
        if (idx === 0) pathD += `M ${x} ${y}`;
        else pathD += ` L ${x} ${y}`;

        return {
          stage: s.stage,
          stageItem: s,
          x,
          y,
          value: accessor(s),
          label:
            key === 'powercreep'
              ? `${formatPercent(s.powercreep)}${s.isMechanicsAdjusted ? '*' : ''}`
              : formatCompact(accessor(s)),
          isMechanicsAdjusted: s.isMechanicsAdjusted,
        };
      });

      // Area gradient path
      const areaD = `${pathD} L ${getX(count - 1)} ${margin.top + plotH} L ${getX(
        0
      )} ${margin.top + plotH} Z`;

      return { gridLines, pathD, areaD, points, margin, plotW, plotH };
    },
    [visibleStages, isRu, copy]
  );

  const effectiveChartData = useMemo(
    () =>
      buildSvgData(
        'effective',
        (s) => requiredDamage.get(s.stage) ?? 0,
        (v) => formatCompact(v),
        requiredStages
      ),
    [buildSvgData, requiredDamage, requiredStages]
  );

  const pureChartData = useMemo(
    () =>
      buildSvgData(
        'pure',
        (s) => s.maxHealth,
        (v) => formatCompact(v)
      ),
    [buildSvgData]
  );

  const powercreepChartData = useMemo(
    () =>
      buildSvgData(
        'powercreep',
        (s) => s.powercreep,
        (v) => `${v.toFixed(0)}%`
      ),
    [buildSvgData]
  );

  // Download handlers
  const handleDownloadPng = useCallback(
    (key: SeqChartKey) => {
      let svg: SVGSVGElement | null = null;
      if (key === 'effective') svg = effectiveSvgRef.current;
      else if (key === 'pure') svg = pureSvgRef.current;
      else svg = powercreepSvgRef.current;

      if (svg) {
        exportSvgAsPng(svg, `sequential-${key}-stages-1-to-35.png`, 2);
      }
    },
    []
  );

  const handleDownloadCsv = useCallback(
    (key: SeqChartKey) => {
      exportSeqCsv(stages, key, 35, {
        requiredDamage,
        resistIgnore,
        damageBonus,
        supportLevel,
        baseDamagePercent: SEQ_REFERENCE_DAMAGE_PERCENT,
      });
    },
    [stages, requiredDamage, resistIgnore, damageBonus, supportLevel]
  );

  // Zoom Modal Wheel / Pan
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

  return (
    <div className={styles.container}>
      <main className={styles.layout}>
        {/* Hero Section */}
        <section className={styles.hero} id="overview">
          <div className={styles.heroContent}>
            <p className={styles.heroEyebrow}>{copy.eyebrow}</p>
            <h1 className={styles.heroTitle}>{copy.title}</h1>
            <p className={styles.heroSubtitle}>{copy.subtitle}</p>
          </div>
          <EncounterModeSwitcher mode="gacha" path="/datamine/seq/" />
        </section>

        {/* Charts Section */}
        <section className={styles.section} id="charts">
          <div className={styles.sectionInner}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>{copy.chartsTitle}</h2>

              <div className={styles.requiredControls} role="group" aria-label={copy.chartEffective}>
                <label className={styles.rangeBlock}>
                  <span className={styles.controlLabel}>{copy.resistIgnoreLabel}</span>
                  <input
                    type="range"
                    min={SEQ_RESIST_IGNORE_RANGE.min}
                    max={SEQ_RESIST_IGNORE_RANGE.max}
                    step={SEQ_RESIST_IGNORE_RANGE.step}
                    value={resistIgnore}
                    aria-valuetext={percentLabel(resistIgnore)}
                    onChange={(e) => setResistIgnore(Number(e.target.value))}
                  />
                  <output className={styles.rangeValue}>{percentLabel(resistIgnore)}</output>
                </label>
                <label className={styles.rangeBlock}>
                  <span className={styles.controlLabel}>{copy.supportModuleLabel}</span>
                  <input
                    type="range"
                    min={0}
                    max={supportMaxLevel}
                    step={1}
                    value={supportLevel}
                    disabled={supportMaxLevel === 0}
                    aria-valuetext={`${levelLabel} (+${percentLabel(damageBonus)})`}
                    onChange={(e) => setSupportLevel(Number(e.target.value))}
                  />
                  <output className={styles.rangeValue} title={`+${percentLabel(damageBonus)}`}>
                    {levelLabel}
                  </output>
                </label>
                <div className={styles.multiplierBlock}>
                  <span className={styles.controlLabel}>{copy.totalMultiplierLabel}</span>
                  <output className={styles.multiplierValue}>
                    {totalMultiplier === null ? '—' : `×${totalMultiplier.toFixed(3)}`}
                  </output>
                  <button
                    type="button"
                    className={styles.formulaButton}
                    onClick={() => setFormulaOpen(true)}
                    aria-label={copy.formulaButton}
                    title={copy.formulaButton}
                  >
                    <RailGlyph name="formula" />
                  </button>
                </div>
              </div>


              <div className={styles.controlsGroup}>
                {/* Selection switch: All vs 16+ */}
                <div className={styles.controlItem}>
                  <span className={styles.controlLabel}>{copy.stageViewLabel}</span>
                  <div className={styles.switchWrap} role="group" aria-label={copy.stageViewLabel}>
                    <button
                      type="button"
                      className={`${styles.switchBtn} ${stageView === 'all' ? styles.isActive : ''}`}
                      onClick={() => handleSetStageView('all')}
                      aria-pressed={stageView === 'all'}
                    >
                      {copy.stageViewAll}
                    </button>
                    <button
                      type="button"
                      className={`${styles.switchBtn} ${stageView === '16plus' ? styles.isActive : ''}`}
                      onClick={() => handleSetStageView('16plus')}
                      aria-pressed={stageView === '16plus'}
                    >
                      {copy.stageView16Plus}
                    </button>
                  </div>
                </div>

                {/* Palette Switch */}
                <div className={styles.controlItem}>
                  <span className={styles.controlLabel}>{copy.chartPalette}</span>
                  <div className={styles.switchWrap} role="group" aria-label={copy.chartPalette}>
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
              {/* 1. Effective HP Chart Card */}
              <article className={styles.chartCard} id="effective">
                <div className={styles.chartCardHeader}>
                  <h3 className={styles.chartCardTitle}>{copy.chartEffective}</h3>
                  <div className={styles.actionGroup}>
                    <button
                      type="button"
                      className={styles.button}
                      onClick={() => handleDownloadPng('effective')}
                    >
                      {copy.downloadPng}
                    </button>
                    <button
                      type="button"
                      className={`${styles.button} ${styles.buttonSubtle}`}
                      onClick={() => handleDownloadCsv('effective')}
                    >
                      {copy.downloadCsv}
                    </button>
                  </div>
                </div>

                {requiredStages.length === 0 && <p className={styles.sectionBody}>{copy.noResistConstant}</p>}

                <div
                  className={styles.svgFrame}
                  tabIndex={0}
                  role="button"
                  aria-label={translateUiText("Click to zoom Effective HP chart", activeLocale)}
                  onClick={(e) =>
                    !isTextInteraction(e) &&
                    setZoomModal({
                      isOpen: true,
                      chartKey: 'effective',
                      scale: 1,
                      translateX: 0,
                      translateY: 0,
                      isDragging: false,
                      dragStartX: 0,
                      dragStartY: 0,
                    })
                  }
                >
                  <svg
                    ref={effectiveSvgRef}
                    viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
                    preserveAspectRatio="xMidYMid meet"
                  >
                    <rect width={CHART_WIDTH} height={CHART_HEIGHT} fill={themeColors.plotBg} />
                    <text x={CHART_WIDTH / 2} y="46" textAnchor="middle" fontFamily={CHART_FONT_FAMILY} fontSize={CHART_TITLE_FONT_SIZE} fontWeight={CHART_TITLE_FONT_WEIGHT} fill={themeColors.title}>{copy.chartEffective}</text>
                    {/* Grid lines */}
                    {effectiveChartData.gridLines.map((g, idx) => (
                      <g key={`grid-${idx}`}>
                        <line
                          x1={effectiveChartData.margin.left}
                          y1={g.y}
                          x2={effectiveChartData.margin.left + effectiveChartData.plotW}
                          y2={g.y}
                          stroke={idx === 0 ? themeColors.gridMajor : themeColors.grid}
                          strokeWidth="1"
                        />
                        <text
                          x={effectiveChartData.margin.left - 14}
                          y={g.y + 4}
                          fill={themeColors.axis}
                          fontSize="18"
                          fontFamily="Manrope, sans-serif"
                          textAnchor="end"
                        >
                          {g.label}
                        </text>
                      </g>
                    ))}
                    {tooltip?.visible && tooltip.chartKey === 'effective' && (
                      <line
                        x1={effectiveChartData.points.find((p) => p.stage === tooltip.stage.stage)?.x}
                        x2={effectiveChartData.points.find((p) => p.stage === tooltip.stage.stage)?.x}
                        y1={effectiveChartData.margin.top}
                        y2={effectiveChartData.margin.top + effectiveChartData.plotH}
                        stroke={themeColors.axis}
                        strokeDasharray="5 6"
                        strokeOpacity="0.5"
                        pointerEvents="none"
                      />
                    )}
                    <line x1={effectiveChartData.margin.left} y1={effectiveChartData.margin.top + effectiveChartData.plotH} x2={CHART_WIDTH - effectiveChartData.margin.right} y2={effectiveChartData.margin.top + effectiveChartData.plotH} stroke={themeColors.baseline} strokeWidth="1.2" />
                    {/* Curve line */}
                    <path
                      d={effectiveChartData.pathD}
                      fill="none"
                      stroke={themeColors.effective}
                      strokeWidth="3.5"
                    />
                    <ChartParamsBadge
                      rows={requiredParams}
                      right={CHART_WIDTH - effectiveChartData.margin.right}
                      top={12}
                      colors={themeColors}
                    />
                    {/* Points & Labels */}
                    {effectiveChartData.points.map((p) => (
                      <g key={`p-${p.stage}`}>
                        <circle
                          cx={p.x}
                          cy={p.y}
                          r={p.isMechanicsAdjusted ? 8.5 : 8.5}
                          fill={themeColors.effective}
                          stroke={themeColors.pointStroke}
                          strokeWidth="2.6"
                        />

                        <text
                          x={p.x}
                          y={effectiveChartData.margin.top + effectiveChartData.plotH + 24}
                          fill={themeColors.axis}
                          fontSize="16"
                          fontFamily="Manrope, sans-serif"
                          textAnchor="middle"
                        >
                          {p.stage}
                        </text>
                        <text
                          x={p.x}
                          y={p.y - 26}
                          fill={themeColors.effective}
                          fontSize="15.5"
                          fontWeight="bold"
                          fontFamily="Manrope, sans-serif"
                          textAnchor="middle"
                        >
                          {p.label}
                        </text>
                      </g>
                    ))}
                    <rect
                      x={effectiveChartData.margin.left}
                      y={effectiveChartData.margin.top}
                      width={CHART_WIDTH - effectiveChartData.margin.left - effectiveChartData.margin.right}
                      height={effectiveChartData.plotH}
                      fill="transparent"
                      onMouseMove={(e) => {
                        const svg = e.currentTarget.ownerSVGElement;
                        if (!svg || effectiveChartData.points.length === 0) return;
                        const rect = svg.getBoundingClientRect();
                        if (rect.width === 0) return;
                        const x = ((e.clientX - rect.left) / rect.width) * CHART_WIDTH;
                        const nearest = findNearestChartPoint(effectiveChartData.points, x);
                        if (!nearest) return;
                        setTooltip({
                          visible: true,
                          x: e.clientX,
                          y: e.clientY,
                          chartKey: 'effective',
                          stage: nearest.stageItem,
                          value: nearest.value,
                        });
                      }}
                      onMouseLeave={() => setTooltip(null)}
                    />
                    <ChartWatermark x={WATERMARK_X} y={WATERMARK_Y} fill={themeColors.axis} />
                  </svg>
                </div>
              </article>

              {/* 2. Pure HP Chart Card */}
              <article className={styles.chartCard} id="pure">
                <div className={styles.chartCardHeader}>
                  <h3 className={styles.chartCardTitle}>{copy.chartPure}</h3>
                  <div className={styles.actionGroup}>
                    <button
                      type="button"
                      className={styles.button}
                      onClick={() => handleDownloadPng('pure')}
                    >
                      {copy.downloadPng}
                    </button>
                    <button
                      type="button"
                      className={`${styles.button} ${styles.buttonSubtle}`}
                      onClick={() => handleDownloadCsv('pure')}
                    >
                      {copy.downloadCsv}
                    </button>
                  </div>
                </div>

                <div
                  className={styles.svgFrame}
                  tabIndex={0}
                  role="button"
                  aria-label={translateUiText("Click to zoom Pure HP chart", activeLocale)}
                  onClick={(e) =>
                    !isTextInteraction(e) &&
                    setZoomModal({
                      isOpen: true,
                      chartKey: 'pure',
                      scale: 1,
                      translateX: 0,
                      translateY: 0,
                      isDragging: false,
                      dragStartX: 0,
                      dragStartY: 0,
                    })
                  }
                >
                  <svg
                    ref={pureSvgRef}
                    viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
                    preserveAspectRatio="xMidYMid meet"
                  >
                    <rect width={CHART_WIDTH} height={CHART_HEIGHT} fill={themeColors.plotBg} />
                    <text x={CHART_WIDTH / 2} y="46" textAnchor="middle" fontFamily={CHART_FONT_FAMILY} fontSize={CHART_TITLE_FONT_SIZE} fontWeight={CHART_TITLE_FONT_WEIGHT} fill={themeColors.title}>{copy.chartPure}</text>
                    {pureChartData.gridLines.map((g, idx) => (
                      <g key={`grid-pure-${idx}`}>
                        <line
                          x1={pureChartData.margin.left}
                          y1={g.y}
                          x2={pureChartData.margin.left + pureChartData.plotW}
                          y2={g.y}
                          stroke={idx === 0 ? themeColors.gridMajor : themeColors.grid}
                          strokeWidth="1"
                        />
                        <text
                          x={pureChartData.margin.left - 14}
                          y={g.y + 4}
                          fill={themeColors.axis}
                          fontSize="18"
                          fontFamily="Manrope, sans-serif"
                          textAnchor="end"
                        >
                          {g.label}
                        </text>
                      </g>
                    ))}
                    {tooltip?.visible && tooltip.chartKey === 'pure' && (
                      <line
                        x1={pureChartData.points.find((p) => p.stage === tooltip.stage.stage)?.x}
                        x2={pureChartData.points.find((p) => p.stage === tooltip.stage.stage)?.x}
                        y1={pureChartData.margin.top}
                        y2={pureChartData.margin.top + pureChartData.plotH}
                        stroke={themeColors.axis}
                        strokeDasharray="5 6"
                        strokeOpacity="0.5"
                        pointerEvents="none"
                      />
                    )}
                    <line x1={pureChartData.margin.left} y1={pureChartData.margin.top + pureChartData.plotH} x2={CHART_WIDTH - pureChartData.margin.right} y2={pureChartData.margin.top + pureChartData.plotH} stroke={themeColors.baseline} strokeWidth="1.2" />
                    <path
                      d={pureChartData.pathD}
                      fill="none"
                      stroke={themeColors.pure}
                      strokeWidth="3.5"
                    />
                    {pureChartData.points.map((p) => (
                      <g key={`pure-p-${p.stage}`}>
                        <circle
                          cx={p.x}
                          cy={p.y}
                          r="8.5"
                          fill={themeColors.pure}
                          stroke={themeColors.pointStroke}
                          strokeWidth="2.6"
                        />

                        <text
                          x={p.x}
                          y={pureChartData.margin.top + pureChartData.plotH + 24}
                          fill={themeColors.axis}
                          fontSize="16"
                          fontFamily="Manrope, sans-serif"
                          textAnchor="middle"
                        >
                          {p.stage}
                        </text>
                        <text
                          x={p.x}
                          y={p.y - 26}
                          fill={themeColors.pure}
                          paintOrder="stroke"
                          stroke={themeColors.halo}
                          strokeWidth="3"
                          fontSize="15.5"
                          fontWeight="bold"
                          fontFamily="Manrope, sans-serif"
                          textAnchor="middle"
                        >
                          {p.label}
                        </text>
                      </g>
                    ))}
                    <rect
                      x={pureChartData.margin.left}
                      y={pureChartData.margin.top}
                      width={CHART_WIDTH - pureChartData.margin.left - pureChartData.margin.right}
                      height={pureChartData.plotH}
                      fill="transparent"
                      onMouseMove={(e) => {
                        const svg = e.currentTarget.ownerSVGElement;
                        if (!svg || pureChartData.points.length === 0) return;
                        const rect = svg.getBoundingClientRect();
                        if (rect.width === 0) return;
                        const x = ((e.clientX - rect.left) / rect.width) * CHART_WIDTH;
                        const nearest = findNearestChartPoint(pureChartData.points, x);
                        if (!nearest) return;
                        setTooltip({
                          visible: true,
                          x: e.clientX,
                          y: e.clientY,
                          chartKey: 'pure',
                          stage: nearest.stageItem,
                          value: nearest.value,
                        });
                      }}
                      onMouseLeave={() => setTooltip(null)}
                    />
                    <ChartWatermark x={WATERMARK_X} y={WATERMARK_Y} fill={themeColors.axis} />
                  </svg>
                </div>
              </article>

              {/* 3. Powercreep Chart Card */}
              <article className={styles.chartCard} id="powercreep">
                <div className={styles.chartCardHeader}>
                  <h3 className={styles.chartCardTitle}>{copy.chartPowercreep}</h3>
                  <div className={styles.actionGroup}>
                    <button
                      type="button"
                      className={styles.button}
                      onClick={() => handleDownloadPng('powercreep')}
                    >
                      {copy.downloadPng}
                    </button>
                    <button
                      type="button"
                      className={`${styles.button} ${styles.buttonSubtle}`}
                      onClick={() => handleDownloadCsv('powercreep')}
                    >
                      {copy.downloadCsv}
                    </button>
                  </div>
                </div>

                <div
                  className={styles.svgFrame}
                  tabIndex={0}
                  role="button"
                  aria-label={translateUiText("Click to zoom Powercreep chart", activeLocale)}
                  onClick={(e) =>
                    !isTextInteraction(e) &&
                    setZoomModal({
                      isOpen: true,
                      chartKey: 'powercreep',
                      scale: 1,
                      translateX: 0,
                      translateY: 0,
                      isDragging: false,
                      dragStartX: 0,
                      dragStartY: 0,
                    })
                  }
                >
                  <svg
                    ref={powercreepSvgRef}
                    viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
                    preserveAspectRatio="xMidYMid meet"
                  >
                    <rect width={CHART_WIDTH} height={CHART_HEIGHT} fill={themeColors.plotBg} />
                    <text x={CHART_WIDTH / 2} y="46" textAnchor="middle" fontFamily={CHART_FONT_FAMILY} fontSize={CHART_TITLE_FONT_SIZE} fontWeight={CHART_TITLE_FONT_WEIGHT} fill={themeColors.title}>{copy.chartPowercreep}</text>
                    {powercreepChartData.gridLines.map((g, idx) => (
                      <g key={`grid-pc-${idx}`}>
                        <line
                          x1={powercreepChartData.margin.left}
                          y1={g.y}
                          x2={powercreepChartData.margin.left + powercreepChartData.plotW}
                          y2={g.y}
                          stroke={idx === 0 ? themeColors.gridMajor : themeColors.grid}
                          strokeWidth="1"
                        />
                        <text
                          x={powercreepChartData.margin.left - 14}
                          y={g.y + 4}
                          fill={themeColors.axis}
                          fontSize="18"
                          fontFamily="Manrope, sans-serif"
                          textAnchor="end"
                        >
                          {g.label}
                        </text>
                      </g>
                    ))}
                    {tooltip?.visible && tooltip.chartKey === 'powercreep' && (
                      <line
                        x1={powercreepChartData.points.find((p) => p.stage === tooltip.stage.stage)?.x}
                        x2={powercreepChartData.points.find((p) => p.stage === tooltip.stage.stage)?.x}
                        y1={powercreepChartData.margin.top}
                        y2={powercreepChartData.margin.top + powercreepChartData.plotH}
                        stroke={themeColors.axis}
                        strokeDasharray="5 6"
                        strokeOpacity="0.5"
                        pointerEvents="none"
                      />
                    )}
                    <line x1={powercreepChartData.margin.left} y1={powercreepChartData.margin.top + powercreepChartData.plotH} x2={CHART_WIDTH - powercreepChartData.margin.right} y2={powercreepChartData.margin.top + powercreepChartData.plotH} stroke={themeColors.baseline} strokeWidth="1.2" />
                    <path
                      d={powercreepChartData.pathD}
                      fill="none"
                      stroke={themeColors.powercreep}
                      strokeWidth="3.5"
                    />
                    {powercreepChartData.points.map((p) => (
                      <g key={`pc-p-${p.stage}`}>
                        <circle
                          cx={p.x}
                          cy={p.y}
                          r="8.5"
                          fill={themeColors.powercreep}
                          stroke={themeColors.pointStroke}
                          strokeWidth="2.6"
                        />

                        <text
                          x={p.x}
                          y={powercreepChartData.margin.top + powercreepChartData.plotH + 24}
                          fill={themeColors.axis}
                          fontSize="16"
                          fontFamily="Manrope, sans-serif"
                          textAnchor="middle"
                        >
                          {p.stage}
                        </text>
                        <text
                          x={p.x}
                          y={p.y - 26}
                          fill={themeColors.powercreep}
                          paintOrder="stroke"
                          stroke={themeColors.halo}
                          strokeWidth="3"
                          fontSize="15.5"
                          fontWeight="bold"
                          fontFamily="Manrope, sans-serif"
                          textAnchor="middle"
                        >
                          {p.label}
                        </text>
                      </g>
                    ))}
                    <rect
                      x={powercreepChartData.margin.left}
                      y={powercreepChartData.margin.top}
                      width={CHART_WIDTH - powercreepChartData.margin.left - powercreepChartData.margin.right}
                      height={powercreepChartData.plotH}
                      fill="transparent"
                      onMouseMove={(e) => {
                        const svg = e.currentTarget.ownerSVGElement;
                        if (!svg || powercreepChartData.points.length === 0) return;
                        const rect = svg.getBoundingClientRect();
                        if (rect.width === 0) return;
                        const x = ((e.clientX - rect.left) / rect.width) * CHART_WIDTH;
                        const nearest = findNearestChartPoint(powercreepChartData.points, x);
                        if (!nearest) return;
                        setTooltip({
                          visible: true,
                          x: e.clientX,
                          y: e.clientY,
                          chartKey: 'powercreep',
                          stage: nearest.stageItem,
                          value: nearest.value,
                        });
                      }}
                      onMouseLeave={() => setTooltip(null)}
                    />
                    <ChartWatermark x={WATERMARK_X} y={WATERMARK_Y} fill={themeColors.axis} />
                  </svg>
                </div>
              </article>
            </div>
          </div>
        </section>

        {/* Data Table Section */}
        <section className={styles.section} id="data">
          <div className={styles.sectionInner}>
            <div className={styles.sectionHeader}>
              <div>
                <h2 className={styles.sectionTitle}>{copy.loadedTitle}</h2>
                <p className={styles.sectionBody}>{copy.loadedDescription}</p>
              </div>
            </div>

            <div className={styles.tableWrap} tabIndex={0}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>{copy.stage}</th>
                    <th>{copy.row}</th>
                    <th>{isRu ? 'Макс. ОЗ' : translateUiText('Max Health', currentLocale)}</th>
                    <th>{copy.effectiveHp}</th>
                    <th>{copy.statAtk}</th>
                    <th>{copy.statDef}</th>
                    <th>{copy.statCritResist}</th>
                    <th>{copy.powercreep}</th>
                    <th>{copy.mechanicsCol}</th>
                  </tr>
                </thead>
                <tbody>
                  {stages.map((s) => {
                    const bossName = isRu
                      ? s.enemyNameRu || s.name_ru
                      : s.enemyNameEn || s.name_en;
                    const portrait = s.portrait || '/datamine/shared/media/Hotta/Content/Resources/UI/void/boss/placeholder-boss.webp';

                    return (
                      <tr key={`stage-row-${s.stage}`}>
                        <td>
                          <strong>{s.stage}</strong>
                        </td>
                        <td>
                          <div className={styles.enemyCell}>
                            <button
                              type="button"
                              className={styles.enemyAvatarBtn}
                              onClick={() =>
                                setBossModal({
                                  isOpen: true,
                                  title: bossName || s.codename,
                                  image: portrait,
                                })
                              }
                              title={bossName || s.codename}
                            >
                              <img
                                src={portrait}
                                alt={bossName || s.codename}
                                className={styles.enemyAvatar}
                                loading="lazy"
                              />
                            </button>
                            {bossName ? (
                              <button
                                type="button"
                                className={styles.enemyNameBtn}
                                onClick={() =>
                                  setBossModal({
                                    isOpen: true,
                                    title: bossName,
                                    image: portrait,
                                  })
                                }
                              >
                                {bossName}
                              </button>
                            ) : (
                              <code>{s.codename}</code>
                            )}
                          </div>
                        </td>
                        <td>{formatInteger(s.maxHealth)}</td>
                        <td className={s.isMechanicsAdjusted ? styles.mechanicsAdjusted : ''}>
                          {formatInteger(s.effectiveHp)}
                          {s.isMechanicsAdjusted && ' *'}
                        </td>
                        <td>{s.atk ? formatInteger(s.atk) : '—'}</td>
                        <td>{s.def ? formatInteger(s.def) : '—'}</td>
                        <td>{formatCritResist(s.critResist)}</td>
                        <td>{formatPercent(s.powercreep)}</td>
                        <td>{s.mechanicsNote || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>

      {tooltip?.visible && (
        <ChartHoverCard
          x={tooltip.x}
          y={tooltip.y}
          eyebrow={`${copy.stage} ${tooltip.stage.stage}`}
          portrait={
            tooltip.stage.portrait ||
            '/datamine/shared/media/Hotta/Content/Resources/UI/void/boss/placeholder-boss.webp'
          }
          name={
            (isRu
              ? tooltip.stage.enemyNameRu || tooltip.stage.name_ru
              : tooltip.stage.enemyNameEn || tooltip.stage.name_en) || tooltip.stage.codename
          }
          value={
            tooltip.chartKey === 'powercreep'
              ? formatPercent(tooltip.stage.powercreep)
              : formatCompact(tooltip.value)
          }
          meta={
            tooltip.chartKey !== 'powercreep' && (
              <>
                {copy.powercreep}: {formatPercent(tooltip.stage.powercreep)}
                {tooltip.stage.isMechanicsAdjusted ? ' *' : ''}
              </>
            )
          }
          footer={getMechanicsNote(tooltip.stage, isRu, copy.mechanicsNote) || undefined}
        />
      )}

      {/* Full-Screen Zoom Modal */}
      {zoomModal.isOpen && (
        <div className={styles.modal}>
          <div
            className={styles.modalBackdrop}
            onClick={() => setZoomModal((prev) => ({ ...prev, isOpen: false }))}
          />
          <div
            className={styles.modalDialog}
            role="dialog"
            aria-modal="true"
            aria-label={copy.zoomEyebrow}
          >
            <div className={styles.modalHeader}>
              <div>
                <p className={styles.modalEyebrow}>{copy.zoomEyebrow}</p>
                <h3 className={styles.modalTitle}>
                  {zoomModal.chartKey === 'effective'
                    ? copy.chartEffective
                    : zoomModal.chartKey === 'pure'
                      ? copy.chartPure
                      : copy.chartPowercreep}
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

            <p className={styles.modalHint}>{copy.zoomHint}</p>

            <div
              className={styles.modalViewport}
              onWheel={handleZoomWheel}
              onMouseDown={handleZoomMouseDown}
              onMouseMove={handleZoomMouseMove}
              onMouseUp={handleZoomMouseUp}
            >
              <div
                className={styles.modalCanvasWrap}
                style={{
                  transform: `translate(${zoomModal.translateX}px, ${zoomModal.translateY}px) scale(${zoomModal.scale})`,
                }}
              >
                {zoomModal.chartKey === 'effective' ? (
                  <svg
                    viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
                    style={{ width: '100%', height: '100%' }}
                  >
                    <rect width={CHART_WIDTH} height={CHART_HEIGHT} fill={themeColors.plotBg} />
                    <ChartParamsBadge
                      rows={requiredParams}
                      right={CHART_WIDTH - effectiveChartData.margin.right}
                      top={12}
                      colors={themeColors}
                    />
                    {effectiveChartData.gridLines.map((g, idx) => (
                      <g key={`zoom-grid-${idx}`}>
                        <line
                          x1={effectiveChartData.margin.left}
                          y1={g.y}
                          x2={effectiveChartData.margin.left + effectiveChartData.plotW}
                          y2={g.y}
                          stroke={themeColors.grid}
                          strokeWidth="1"
                        />
                        <text
                          x={effectiveChartData.margin.left - 14}
                          y={g.y + 4}
                          fill={themeColors.axis}
                          fontSize="14"
                          fontFamily="Manrope, sans-serif"
                          textAnchor="end"
                        >
                          {g.label}
                        </text>
                      </g>
                    ))}
                    <path
                      d={effectiveChartData.pathD}
                      fill="none"
                      stroke={themeColors.effective}
                      strokeWidth="3.5"
                    />
                    {effectiveChartData.points.map((p) => (
                      <g key={`zoom-pt-${p.stage}`}>
                        <circle cx={p.x} cy={p.y} r="6" fill={themeColors.effective} />
                        <text x={p.x} y={p.y - 26} fill={themeColors.effective} fontSize="14" textAnchor="middle">{p.label}</text>
                        <text x={p.x} y={effectiveChartData.margin.top + effectiveChartData.plotH + 24} fill={themeColors.axis} fontSize="14" textAnchor="middle">{p.stage}</text>
                      </g>
                    ))}
                  </svg>
                ) : zoomModal.chartKey === 'pure' ? (
                  <svg
                    viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
                    style={{ width: '100%', height: '100%' }}
                  >
                    <rect width={CHART_WIDTH} height={CHART_HEIGHT} fill={themeColors.plotBg} />
                    {pureChartData.gridLines.map((g, idx) => (
                      <g key={`zoom-grid-pure-${idx}`}>
                        <line
                          x1={pureChartData.margin.left}
                          y1={g.y}
                          x2={pureChartData.margin.left + pureChartData.plotW}
                          y2={g.y}
                          stroke={themeColors.grid}
                          strokeWidth="1"
                        />
                        <text
                          x={pureChartData.margin.left - 14}
                          y={g.y + 4}
                          fill={themeColors.axis}
                          fontSize="14"
                          fontFamily="Manrope, sans-serif"
                          textAnchor="end"
                        >
                          {g.label}
                        </text>
                      </g>
                    ))}
                    <path
                      d={pureChartData.pathD}
                      fill="none"
                      stroke={themeColors.pure}
                      strokeWidth="3.5"
                    />
                    {pureChartData.points.map((p) => (
                      <g key={`zoom-pt-pure-${p.stage}`}>
                        <circle cx={p.x} cy={p.y} r="6" fill={themeColors.pure} />
                        <text x={p.x} y={p.y - 26} fill={themeColors.pure} fontSize="14" textAnchor="middle">{p.label}</text>
                        <text x={p.x} y={pureChartData.margin.top + pureChartData.plotH + 24} fill={themeColors.axis} fontSize="14" textAnchor="middle">{p.stage}</text>
                      </g>
                    ))}
                  </svg>
                ) : (
                  <svg
                    viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
                    style={{ width: '100%', height: '100%' }}
                  >
                    <rect width={CHART_WIDTH} height={CHART_HEIGHT} fill={themeColors.plotBg} />
                    {powercreepChartData.gridLines.map((g, idx) => (
                      <g key={`zoom-grid-pc-${idx}`}>
                        <line
                          x1={powercreepChartData.margin.left}
                          y1={g.y}
                          x2={powercreepChartData.margin.left + powercreepChartData.plotW}
                          y2={g.y}
                          stroke={themeColors.grid}
                          strokeWidth="1"
                        />
                        <text
                          x={powercreepChartData.margin.left - 14}
                          y={g.y + 4}
                          fill={themeColors.axis}
                          fontSize="14"
                          fontFamily="Manrope, sans-serif"
                          textAnchor="end"
                        >
                          {g.label}
                        </text>
                      </g>
                    ))}
                    <path
                      d={powercreepChartData.pathD}
                      fill="none"
                      stroke={themeColors.powercreep}
                      strokeWidth="3.5"
                    />
                    {powercreepChartData.points.map((p) => (
                      <g key={`zoom-pt-pc-${p.stage}`}>
                        <circle cx={p.x} cy={p.y} r="6" fill={themeColors.powercreep} />
                        <text x={p.x} y={p.y - 26} fill={themeColors.powercreep} fontSize="14" textAnchor="middle">{p.label}</text>
                        <text x={p.x} y={powercreepChartData.margin.top + powercreepChartData.plotH + 24} fill={themeColors.axis} fontSize="14" textAnchor="middle">{p.stage}</text>
                      </g>
                    ))}
                  </svg>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Boss Lightbox Modal */}
      {bossModal.isOpen && (
        <div className={styles.modal}>
          <div
            className={styles.modalBackdrop}
            onClick={() => setBossModal((prev) => ({ ...prev, isOpen: false }))}
          />
          <div className={styles.bossModalDialog} role="dialog" aria-modal="true">
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>{bossModal.title}</h3>
              <button
                type="button"
                className={`${styles.button} ${styles.buttonSubtle}`}
                onClick={() => setBossModal((prev) => ({ ...prev, isOpen: false }))}
              >
                ✕
              </button>
            </div>
            <img src={bossModal.image} alt={bossModal.title} className={styles.bossModalImg} />
          </div>
        </div>
      )}
      <SeqFormulaInfo
        isOpen={formulaOpen}
        onClose={() => setFormulaOpen(false)}
        locale={currentLocale}
        resistance={summaryResistance}
        resistanceConstant={resistanceConstant}
        resistIgnore={resistIgnore}
        damageBonus={damageBonus}
        supportLevel={supportLevel}
        supportMaxLevel={supportMaxLevel}
      />
    </div>
  );
}
