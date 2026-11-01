import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { ExportButton } from '@tof-hub/ui';
import { gameAsset } from '@tof-hub/game-assets';
import { getElementLabel } from '@tof-hub/game-domain';
import resistanceIcons from '../../../../public/game-data/relic-resistance-icons.json';
import { useHandbookText } from '../handbook/sections/handbook-ui';
import styles from './boss-defenses.module.css';

/** Card order, icon key and `getElementLabel` key of the element resistances (as on the Origin of War enemy panel). */
const ELEMENTS = [['physical', 'phys', 'phys'], ['flame', 'flame', 'fire'], ['frost', 'frost', 'frost'], ['volt', 'volt', 'volt'], ['altered', 'altered', 'altered']] as const;

/** One decimal at most, `80%` rather than `80.0%` (resists come out as 79.99… from the formula). */
const percent = (value: number | null | undefined) => value == null ? '—' : `${Number(value.toFixed(1))}%`;

const HIDDEN_KEY = 'tof-boss-stats-hidden';

/** Whether the stat plate is shown on boss cards (and in their PNG); remembered per browser, shown by default. */
export function useBossStatsVisible() {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    try { if (localStorage.getItem(HIDDEN_KEY) === '1') setVisible(false); } catch { /* storage unavailable */ }
  }, []);
  const toggle = useCallback(() => {
    const next = !visible;
    setVisible(next);
    try { localStorage.setItem(HIDDEN_KEY, next ? '0' : '1'); } catch { /* storage unavailable */ }
  }, [visible]);
  return { visible, toggle };
}

/** Button beside Download PNG that hides or shows the stat plate. */
export function BossStatsToggle({ visible, onToggle }: { visible: boolean; onToggle: () => void }) {
  const { t } = useHandbookText();
  return <ExportButton tone="sky" aria-pressed={!visible} onClick={onToggle}
    icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />{visible ? <circle cx="12" cy="12" r="3" /> : <path d="M4 4l16 16" />}</svg>}>
    {visible ? t('Hide stats', 'Скрыть статы') : t('Show stats', 'Показать статы')}
  </ExportButton>;
}

export interface BossDefensesData {
  /** Element → percent, `X / (X + K(level))` computed by the pipeline. */
  resistPct: Record<string, number | null>;
  finalCritDefPct: number | null;
  /** Raw `MaxHealth`. */
  maxHealth: number | null;
}

/** Phase, HP in G (`MaxHealth / 1e7`, as on Origin of War), resistances (one chip when equal) and crit resistance. */
export function BossDefenses({ data, phase, hpIcon, critIcon, className, style, label }: {
  data: BossDefensesData;
  phase?: number | null;
  hpIcon?: string | null;
  critIcon?: string | null;
  className?: string;
  style?: CSSProperties;
  label: string;
}) {
  const { locale, t } = useHandbookText();
  const resistValues = [...new Set(ELEMENTS.map(([key]) => percent(data.resistPct[key])))];
  return <ul className={`${styles.plate} ${className ?? ''}`} style={style} aria-label={label}>
    {phase != null && <li className={styles.phase}><span>{t('Phase', 'Фаза')} {phase}</span></li>}
    {data.maxHealth != null && <li title={data.maxHealth.toLocaleString(locale)}>
      {hpIcon && <img src={gameAsset(hpIcon)} alt="" />}<span>{t('HP', 'HP')}</span><b>{`${Number((data.maxHealth / 1e7).toFixed(2))} G`}</b>
    </li>}
    {resistValues.length === 1
      ? <li><img src={gameAsset(resistanceIcons.phys)} alt="" /><span>{t('Resists', 'Резисты')}</span><b>{resistValues[0]}</b></li>
      : ELEMENTS.map(([key, icon, elementLabel]) => <li key={key} title={getElementLabel(elementLabel, locale)}>
        <img src={gameAsset(resistanceIcons[icon])} alt={getElementLabel(elementLabel, locale)} /><b>{percent(data.resistPct[key])}</b>
      </li>)}
    {data.finalCritDefPct != null && <li title={t('Crit resistance (FinalCritDef)', 'Сопротивление криту (FinalCritDef)')}>
      {critIcon && <img className={styles.critIcon} src={gameAsset(critIcon)} alt="" />}<span>{t('Crit RES', 'Крит рез')}</span><b>{percent(data.finalCritDefPct)}</b>
    </li>}
  </ul>;
}
