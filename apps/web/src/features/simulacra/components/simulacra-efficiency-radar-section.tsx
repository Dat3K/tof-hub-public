"use client";

import React, { useMemo } from "react";
import type { SimulacraDatasetItemRaw } from "@tof-hub/contracts";
import type { Locale } from "@tof-hub/i18n";
import type { SimulacraStrings } from "../types";
import styles from "../simulacra.module.css";

interface RadarPoint {
  key?: string;
  label_en?: string;
  label_ru?: string;
  value?: number;
  max_value?: number;
}

interface RadarData {
  points?: RadarPoint[];
  max_value?: number;
}

interface SimulacraEfficiencyRadarSectionProps {
  character: SimulacraDatasetItemRaw;
  locale: Locale;
  strings: SimulacraStrings;
}

const CENTER_X = 160;
const CENTER_Y = 145;
const RADIUS = 75;
const LABEL_RADIUS = 102;
const RING_LEVELS = [0.25, 0.5, 0.75, 1];

function pointAt(radius: number, index: number, total: number) {
  const angle = -Math.PI / 2 + (2 * Math.PI * index) / total;
  return {
    angle,
    x: CENTER_X + radius * Math.cos(angle),
    y: CENTER_Y + radius * Math.sin(angle),
  };
}

function pointsAttribute(points: Array<{ x: number; y: number }>) {
  return points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
}

export const SimulacraEfficiencyRadarSection: React.FC<
  SimulacraEfficiencyRadarSectionProps
> = ({ character, locale, strings }) => {
  const radar = useMemo<RadarData | null>(() => {
    const raw = character as any;
    const candidate = raw.efficiency_radar ?? raw.radar_abilities;
    return candidate && Array.isArray(candidate.points) && candidate.points.length > 0
      ? candidate
      : null;
  }, [character]);

  if (!radar) return null;

  const points = radar.points || [];
  const maxValue = radar.max_value || 16;
  const outerPoints = points.map((_, index) => pointAt(RADIUS, index, points.length));
  const dataPoints = points.map((point, index) => {
    const value = typeof point.value === "number" ? point.value : 0;
    const pointMax = point.max_value || maxValue;
    const ratio = pointMax > 0 ? Math.min(Math.max(value / pointMax, 0), 1) : 0;
    return pointAt(RADIUS * ratio, index, points.length);
  });

  return (
    <details
      className={`${styles.simSection} ${styles.simRadarSection}`}
      id="sim-radar-section"
      data-panel-anchor="sim-radar-section"
      open
    >
      <summary className={styles.simSectionSummary}>
        <div className={styles.simSectionTitleLeft}>
          <span className={styles.simSectionTitle}>{strings.abilityRadarTitle}</span>
        </div>
        <span className={styles.simSectionArrow} aria-hidden="true">
          ▾
        </span>
      </summary>

      <div className={styles.simSectionBody}>
        <div className={styles.simRadarContainer}>
          <div className={styles.simRadarSvgWrap}>
            <svg
              className={styles.simRadarSvg}
              viewBox="0 0 320 300"
              role="img"
              aria-label={strings.abilityRadarTitle}
            >
              <g className={styles.simRadarWeb}>
                {RING_LEVELS.map((level) => (
                  <polygon
                    key={level}
                    points={pointsAttribute(
                      points.map((_, index) => pointAt(RADIUS * level, index, points.length)),
                    )}
                    fill="none"
                    stroke="rgba(148, 163, 184, 0.2)"
                    strokeWidth="1"
                  />
                ))}
                {outerPoints.map((point, index) => (
                  <line
                    key={points[index].key || index}
                    x1={CENTER_X}
                    y1={CENTER_Y}
                    x2={point.x}
                    y2={point.y}
                    stroke="rgba(148, 163, 184, 0.2)"
                    strokeWidth="1"
                  />
                ))}
              </g>

              <polygon className={styles.simRadarPoly} points={pointsAttribute(dataPoints)} />

              <g className={styles.simRadarDots}>
                {dataPoints.map((point, index) => {
                  const source = points[index];
                  const value = typeof source.value === "number" ? source.value : 0;
                  const pointMax = source.max_value || maxValue;
                  const label =
                    locale === "ru"
                      ? source.label_ru || source.label_en || source.key || "—"
                      : source.label_en || source.label_ru || source.key || "—";

                  return (
                    <circle
                      key={source.key || index}
                      className={styles.simRadarDot}
                      cx={point.x}
                      cy={point.y}
                      r="3.5"
                      fill="#38bdf8"
                      stroke="#0f172a"
                      strokeWidth="1.5"
                    >
                      {/* One text node: several would hydrate differently inside an SVG <title>. */}
                      <title>{`${label}: ${value} / ${pointMax}`}</title>
                    </circle>
                  );
                })}
              </g>

              <g className={styles.simRadarLabels}>
                {points.map((source, index) => {
                  const labelPoint = pointAt(LABEL_RADIUS, index, points.length);
                  const value = typeof source.value === "number" ? source.value : 0;
                  const label =
                    locale === "ru"
                      ? source.label_ru || source.label_en || source.key || "—"
                      : source.label_en || source.label_ru || source.key || "—";
                  const textAnchor =
                    Math.cos(labelPoint.angle) > 0.3
                      ? "start"
                      : Math.cos(labelPoint.angle) < -0.3
                        ? "end"
                        : "middle";
                  const dominantBaseline =
                    Math.sin(labelPoint.angle) < -0.7
                      ? "auto"
                      : Math.sin(labelPoint.angle) > 0.7
                        ? "hanging"
                        : "middle";

                  return (
                    <text
                      key={source.key || index}
                      className={styles.simRadarLabel}
                      x={labelPoint.x}
                      y={labelPoint.y}
                      textAnchor={textAnchor}
                      dominantBaseline={dominantBaseline}
                    >
                      {label}{" "}
                      <tspan fill="#38bdf8" fontWeight="700">
                        {value}
                      </tspan>
                    </text>
                  );
                })}
              </g>
            </svg>
          </div>

          <div className={styles.simRadarStatsGrid}>
            {points.map((source, index) => {
              const value = typeof source.value === "number" ? source.value : 0;
              const pointMax = source.max_value || maxValue;
              const ratio = pointMax > 0 ? Math.min(Math.max(value / pointMax, 0), 1) : 0;
              const label =
                locale === "ru"
                  ? source.label_ru || source.label_en || source.key || "—"
                  : source.label_en || source.label_ru || source.key || "—";

              return (
                <div className={styles.simRadarStatItem} key={source.key || index}>
                  <div className={styles.simRadarStatHeader}>
                    <span className={styles.simRadarStatName}>{label}</span>
                    <span className={styles.simRadarStatVal}>
                      {value} / {pointMax}
                    </span>
                  </div>
                  <div className={styles.simRadarBarTrack} aria-hidden="true">
                    <div
                      className={styles.simRadarBarFill}
                      style={{ width: `${Math.round(ratio * 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </details>
  );
};

SimulacraEfficiencyRadarSection.displayName = "SimulacraEfficiencyRadarSection";
