import {localeText} from '@/lib/i18n/text';
import {formatNumber} from '@/lib/i18n/format';
import {Inspect} from './build-inspection';
import {augmentationTotalValue,totalAugmentationSpent} from './model';
import type {BuildDraft,BuildLocale,GearDraft} from './types';
import styles from './build.module.css';

/**
 * Breakdown rows of the total Titan clicks (Augmentation Count) spent on all of the user's gear: the equipped twelve
 * plus every backpack piece, including pieces no ranking would pick. Null when the card is not from a .tofbuild file.
 */
export function AugmentationTotalRows({draft,backpack,locale}:{draft:BuildDraft;backpack?:Pick<GearDraft,'augmentCount'>[];locale:BuildLocale}) {
  if(draft.captureSource?.kind!=='file')return null;
  const t=localeText(locale);
  const spent=totalAugmentationSpent(draft,backpack);
  return <>
    <div className={styles.detailRow}><strong>{t('Equipped')}</strong><b>{formatNumber(spent.equipped,locale)} · {spent.equippedPieces}</b></div>
    <div className={styles.detailRow}><strong>{t('Backpack')}</strong>{spent.backpackKnown
      ?<b>{formatNumber(spent.backpack,locale)} · {spent.backpackPieces}</b>
      :<span>{t('Not in this file')}</span>}</div>
    {spent.unknown>0&&<div className={styles.detailRow}><strong>{t('Without a count')}</strong><span>{spent.unknown}</span></div>}
  </>;
}

/**
 * Total Titan clicks in the profile header next to CS; shown only for cards imported from a .tofbuild file.
 * `backpack` is absent when the file has no backpack inventory.
 */
export function AugmentationTotal({draft,backpack,locale}:{draft:BuildDraft;backpack?:Pick<GearDraft,'augmentCount'>[];locale:BuildLocale}) {
  if(draft.captureSource?.kind!=='file')return null;
  const t=localeText(locale);
  const title=t('Augmentation spent');
  const value=augmentationTotalValue(draft,backpack);
  const breakdown=<div className={styles.itemEffects}><AugmentationTotalRows draft={draft} backpack={backpack} locale={locale}/></div>;
  return <Inspect title={title} tooltipDetails={breakdown} details={breakdown} placement="bottom">
    <span>{t('Total Aug')} <b>{value===null?'—':formatNumber(value,locale)}</b></span>
  </Inspect>;
}
