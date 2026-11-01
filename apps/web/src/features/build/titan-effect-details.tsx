import { localized, translateUiText} from '@tof-hub/i18n';
import {InspectionHeading} from './build-inspection';
import {BonusValue} from './stat-bonuses';
import type {BuildCatalog,BuildLocale} from './types';
import {titanRareEffect} from './model';
import styles from './build.module.css';
import {formatNumber} from '@/lib/i18n/format';

const effectLabels:Record<string,{en:string;ru:string}>={
  EvadeAtkAggravatingInjury:{en:'Direct dodge attack damage',ru:'Прямой урон атак уклонения'},
  CommonAtkAggravatingInjury:{en:'Direct normal attack damage',ru:'Прямой урон обычных атак'},
  SkillAtkAggravatingInjury:{en:'Direct skill damage',ru:'Прямой урон навыков'},
  ChangeSkillAtkAggravatingInjury:{en:'Direct discharge damage',ru:'Прямой урон разрядки'},
  CommonAggravatingInjury:{en:'Damage dealt',ru:'Наносимый урон'},
  CommonWeaknessIncreaseInjury:{en:'Damage against elemental weakness',ru:'Урон по стихийной слабости'},
  CommonReduceInjuries:{en:'Damage reduction',ru:'Снижение входящего урона'},
  FinalRigidity:{en:'Healing dealt',ru:'Исходящее лечение'},
  CommonBlockMult:{en:'Block chance',ru:'Шанс блокирования'},
  SlowMult:{en:'Enemy movement and attack speed reduction',ru:'Снижение скорости движения и атак врага'},
  AutoRestoreHPMult:{en:'Max HP recovered every 5 s (out of combat)',ru:'Восстановление макс. HP за 5 с (вне боя)'},
  CommonDamageRecoverHPMult:{en:'Lifesteal',ru:'Вампиризм'},
};

/** Level is the combined equipped Titan property level, never one item’s level. */
export function TitanEffectDetails({id,level,locale,catalog}:{id:string;level:number;locale:BuildLocale;catalog:BuildCatalog}) {
  const effect=titanRareEffect(id,level,catalog);
  const item=catalog.reference.titanRare.items.find(item=>item.id===id);
  const name=item?(locale === 'ru' ? item.nameRu : translateUiText(item.nameEn, locale)):'—';
  const label=localized(effectLabels[id], locale)??name;
  const percent=effect?formatNumber(effect.displayValue,locale,{style:'percent',maximumFractionDigits:3}):'—';
  return <div>
    <InspectionHeading title={name} trailing={<span className={styles.inspectionMeta} data-titan-level><span data-meta-value>+{level}</span></span>}/>
    <div><span className={styles.titanEffectLabel}>{label}:</span> <BonusValue tone="neutral">{effect?'+':''}{percent}</BonusValue></div>
  </div>;
}
