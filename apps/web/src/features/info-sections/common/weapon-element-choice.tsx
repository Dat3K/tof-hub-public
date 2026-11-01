'use client';
import { localeText } from '@/lib/i18n/text';
import { type Locale } from '@tof-hub/i18n';
import {gameAsset} from '@tof-hub/game-assets';
import {getElementShortLabel} from '@tof-hub/game-domain';
import {getDualElementIconPath} from './element-icons';
import {ELEMENT_FILTER_OPTIONS} from '../../simulacra/constants';
import styles from './weapon-skill-choices.module.css';

const label=(elements:string[],locale:Locale)=>elements.map(element=>getElementShortLabel(element,locale)).join(' / ');
function icon(elements:string[]) {
  const pair=elements.length===2?getDualElementIconPath(elements[0],elements[1]):undefined;
  const single=ELEMENT_FILTER_OPTIONS.find(option=>option.id===elements[0]?.toLowerCase())?.iconPath;
  return pair?gameAsset(pair):single?gameAsset(single):undefined;
}

/** Element form of a weapon with selectable elements (generated `selectableElements`), as a compact icon select. */
export function WeaponElementChoice({options,value,onChange,locale}:{options:{id:string;elements:string[]}[];value?:string;onChange:(id:string)=>void;locale:Locale}) {
  const selected=options.find(option=>option.id===value);
  const name=localeText(locale)('Weapon element', 'Стихия оружия');
  return <div className={styles.slots} data-presentation="icons" data-kind="element" aria-label={name}>
    <div className={styles.slot} title={selected?label(selected.elements,locale):name}>
      {selected&&icon(selected.elements)&&<img src={icon(selected.elements)} alt=""/>}
      {!selected&&<span className={styles.empty}>?</span>}
      <select aria-label={name} value={selected?.id??''} onChange={event=>onChange(event.target.value)}>
        <option value="">{name} · —</option>
        {options.map(option=><option key={option.id} value={option.id}>{label(option.elements,locale)}</option>)}
      </select>
    </div>
  </div>;
}
