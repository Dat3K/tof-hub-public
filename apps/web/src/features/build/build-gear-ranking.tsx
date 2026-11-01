import type {EquippedBuildRanking} from '@tof-hub/contracts';
import {localeText} from '@/lib/i18n/text';
import {BuildTooltip} from './build-inspection';
import type {BuildLocale} from './types';
import {formatBuildDate} from './presentation';
import styles from './build.module.css';

export function BuildGearRanking({ranking,locale,edited=false}:{ranking?:EquippedBuildRanking;locale:BuildLocale;edited?:boolean}) {
  const t=localeText(locale);
  const global=ranking?.global,region=ranking?.region;
  if(!edited&&(!ranking?.available||!global))return null;
  const content=edited?<div className="flex flex-col gap-1">
    <span>{t('Build edited. Ranking is not calculated.')}</span>
  </div>:<div className="flex flex-col gap-1">
    <span>{t('Rank of this equipped set by GRV.')}</span>
    <span>{t('It replaces your best result.')}</span>
    {ranking?.calculatedAt&&<span>{t('Calculated')}: {formatBuildDate(ranking.calculatedAt,'instant')}</span>}
  </div>;
  return <BuildTooltip portal content={content}><div className={styles.gearRanking} data-edited={edited||undefined} tabIndex={0} aria-label={edited?t('Build edited. Ranking is not calculated.'):t('Gear ranking')}>
    <span className={styles.gearRankingLabel}>{t('Gear ranking')}</span>
    {edited?<span className={styles.gearRankingStatus}>{t('Build edited · no ranking')}</span>:<div className={styles.gearRankingValues}>
      {region&&<span className={styles.gearRankingValue} data-region={region.code}><span>{region.code}</span><b>#{region.rank.toLocaleString(locale)}</b></span>}
      <span className={styles.gearRankingValue}><span>{t('GLOBAL')}</span><b>#{global!.toLocaleString(locale)}</b></span>
    </div>}
  </div></BuildTooltip>;
}
