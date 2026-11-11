import type { Locale } from '@tof-hub/i18n';
import { formatNumber } from '@/lib/i18n/format';
import { fillText, localeText } from '@/lib/i18n/text';
import { categoryLabel } from './damage-labels';
import { categoryMultiplier, damageWithTitan, isTitanLevel, type DamageVector, type TitanLevels, type TitanModel, type TitanStat } from './model';

export type TitanStatHints = (stat:TitanStat, removedLevels?:number) => string | undefined;

export function createTitanStatHints(levels:TitanLevels, model:TitanModel, locale:Locale, weakPoint:boolean, clean:DamageVector|null):TitanStatHints {
  const t=localeText(locale);
  const options={weakPoint};
  const total=clean?damageWithTitan(clean,levels,model,options):0;
  const percent=(value:number)=>formatNumber(value,locale,{style:'percent',maximumFractionDigits:2,signDisplay:'exceptZero'});
  return (stat, removedLevels=levels[stat])=>{
    if(!isTitanLevel(levels[stat],model.maxLevel))return;
    const base={...levels,[stat]:Math.max(0,levels[stat]-removedLevels)};
    const all=stat==='dmgBoost'||stat==='weakPoint';
    const category=all?'passive':stat;
    const ratio=categoryMultiplier(category,levels,model,options)/categoryMultiplier(category,base,model,options)-1;
    const parts=[`${all?t('All damage types','Все типы урона'):categoryLabel(category,t)} ${percent(ratio)}`];
    if(clean&&total>0) {
      const without=damageWithTitan(clean,base,model,options);
      if(without>0)parts.push(fillText(t('{0} to total build damage','{0} к общему урону билда'),[percent(total/without-1)]));
    }
    if(stat==='weakPoint')parts.push(weakPoint?t('With Weak Point','С уязвимыми местами'):t('Without Weak Point','Без уязвимых мест'));
    return parts.join(' · ');
  };
}
