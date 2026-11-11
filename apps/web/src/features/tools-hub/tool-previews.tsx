import React from 'react';
import { gameAsset } from '@tof-hub/game-assets';
import type { CompSimulacrumView } from '@tof-hub/game-domain';
import { localized, type Locale } from '@tof-hub/i18n';
import type { HubCompEntry, HubSummaryStripItem } from '@/lib/hub-summary';
import { localeText } from '@/lib/i18n/text';
import { resolveCompTraitIcon } from '@/features/comp/data';
import { TITAN_STAT_KEYS } from '@/features/titan-calculator/model';
import { TitanDamageShareTable } from '@/features/titan-calculator/titan-damage-share-table';
import { TitanLevelSet, type TitanStatInfo } from '@/features/titan-calculator/titan-stat-label';
import type { CompPreviewRow } from './comp-preview';
import type { ToolsHubCopy } from './copy';
import type { TitanPreviewData } from './titan-preview';
import styles from './tools-hub.module.css';

// Miniatures of the tool pages: the real page layout drawn with real game icons. Grey bars stand in for
// values; they never carry numbers, so nothing here claims a game fact.

const Bar = ({ width, tone }: { width: number; tone?: 'gold' }) => (
  <span className={styles.miniBar} data-tone={tone} style={{ width: `${width}%` }} />
);

const Icon = ({ image, className }: { image: string | null | undefined; className?: string }) => (
  <span className={`${styles.miniIcon} ${className ?? ''}`}>
    {image ? <img src={gameAsset(image)} alt="" loading="lazy" decoding="async" /> : null}
  </span>
);

/** Build card: header, weapons column, combat stats, the 4×3 equipment grid and the bottom strip. */
export function BuildPreview({ gear, simulacra, copy }: {
  gear: readonly HubSummaryStripItem[];
  simulacra: readonly HubCompEntry[];
  copy: ToolsHubCopy['build'];
}) {
  if (gear.length === 0) return null;
  const weapons = simulacra.slice(0, 3);
  return (
    <div className={`${styles.mini} ${styles.miniBuild}`} aria-hidden="true">
      <div className={styles.miniHeader}>
        <Icon image={simulacra[0]?.image} className={styles.miniAvatar} />
        <span className={styles.miniLines}>
          <Bar width={58} />
          <Bar width={36} />
        </span>
        <span className={styles.miniChip} />
      </div>
      <div className={styles.miniBuildBody}>
        <div className={styles.miniColumn}>
          <span className={styles.miniLabel}>{copy.weapons}</span>
          {weapons.map((entry) => (
            <span key={entry.id} className={styles.miniWeapon}>
              <Icon image={entry.weaponIcon} />
              <span className={styles.miniLines}>
                <Bar width={70} />
                <span className={styles.miniDots}>
                  <i />
                  <i />
                  <i />
                  <i />
                </span>
              </span>
            </span>
          ))}
        </div>
        <div className={styles.miniColumn}>
          <span className={styles.miniLabel}>{copy.stats}</span>
          <span className={styles.miniStat}>
            <Bar width={44} />
            <Bar width={30} tone="gold" />
          </span>
          {[82, 64, 74, 56, 68].map((width, index) => <Bar key={index} width={width} />)}
        </div>
        <div className={styles.miniColumn}>
          <span className={styles.miniLabel}>{copy.equipment}</span>
          <span className={styles.miniGear}>
            {gear.map((item) => (
              <span key={item.id} className={styles.miniGearCell}>
                <Icon image={item.image} />
                <Bar width={60} />
              </span>
            ))}
          </span>
        </div>
      </div>
    </div>
  );
}

/** Optimizer: the stat-weights table (stat, min / max roll, PRV) with the attribute glyphs. */
export function OptimizerPreview({ stats, copy }: { stats: readonly HubSummaryStripItem[]; copy: ToolsHubCopy['optimizer'] }) {
  if (stats.length === 0) return null;
  return (
    <div className={`${styles.mini} ${styles.miniOptimizer}`} aria-hidden="true">
      <span className={styles.miniLabel}>{copy.weights}</span>
      <div className={styles.miniTable}>
        <span className={styles.miniTableHead}>
          <span>{copy.stat}</span>
          <span>{copy.minRoll}</span>
          <span>PRV</span>
          <span>{copy.maxRoll}</span>
          <span>PRV</span>
        </span>
        {stats.map((item, index) => (
          <span key={item.id} className={styles.miniTableRow}>
            <span className={styles.miniStatName}>
              <Icon image={item.image} className={styles.miniGlyph} />
              <Bar width={[64, 52, 40, 58][index % 4]!} />
            </span>
            <Bar width={62} />
            <Bar width={44} tone="gold" />
            <Bar width={62} />
            <Bar width={44} tone="gold" />
          </span>
        ))}
      </div>
    </div>
  );
}

/** Comp: rows of the Comp page's default squad, tinted by role like the page, with its portraits, weapons, matrices and relics. */
export function CompPreview({ rows, copy }: { rows: readonly CompPreviewRow[]; copy: ToolsHubCopy }) {
  if (rows.length === 0) return null;
  return (
    <div className={`${styles.mini} ${styles.miniComp}`} aria-hidden="true">
      {rows.map((row, index) => (
        <span key={index} className={styles.miniCompRow} data-role={row.role}>
          <span className={styles.miniCompIndex}>{String(index + 1).padStart(2, '0')}</span>
          <span className={styles.miniCompRole}>{copy.roles[row.role]}</span>
          <span className={`${styles.miniIcon} ${styles.miniPortrait}`}>
            {row.trait ? <img src={resolveCompTraitIcon(row.trait as CompSimulacrumView)} alt="" loading="lazy" decoding="async" /> : null}
          </span>
          <span className={styles.miniSlots}>
            {row.weapons.map((image, slot) => <Icon key={slot} image={image} />)}
          </span>
          <span className={styles.miniSlots} data-kind="matrix">
            {row.matrices.map((image, slot) => <Icon key={slot} image={image} />)}
          </span>
          <span className={styles.miniSlots} data-kind="relic">
            {row.relics.map((image, slot) => <Icon key={slot} image={image} />)}
          </span>
        </span>
      ))}
    </div>
  );
}

export function TitanPreview({ data, locale }: { data: TitanPreviewData | null; locale: Locale }) {
  if (!data) return null;
  const t = localeText(locale);
  const weapons = data.weapons.map(({ name, icon, damage }) => ({ name: localized(name, locale), icon, damage }));
  const stats = Object.fromEntries(TITAN_STAT_KEYS.map((stat) => [stat, {
    name: localized(data.stats[stat].name, locale), icon: data.stats[stat].icon ?? undefined,
  }])) as TitanStatInfo;

  return (
    <div className={styles.titanPreview}>
      <TitanDamageShareTable weapons={weapons} clean={data.clean} locale={locale} variant="preview" />
      <div className={styles.titanBest}>
        <span>{t('Best', 'Лучшая')} · {t('Without Weak Point', 'Без уязвимых мест')}</span>
        <TitanLevelSet levels={data.bestWithoutWeakPoint} stats={stats} compact />
      </div>
    </div>
  );
}
