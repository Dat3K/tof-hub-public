import { useRef, useState, type CSSProperties } from 'react';
import { localized, type Locale } from '@tof-hub/i18n';
import { Button } from '@tof-hub/ui';
import { IconPick } from '@/features/build/build-fields';
import buildStyles from '@/features/build/build.module.css';
import { elementLabel } from '@/features/build/presentation';
import { activeRoleResonance, mainWeaponResonance } from '@/features/build/weapon-resonances';
import { carryOverInheritedCustomProperties, loadDomSnapshot, waitForDomSnapshotAssets } from '@/lib/dom-snapshot';
import { downloadPng } from '@/lib/download';
import { formatNumber } from '@/lib/i18n/format';
import { localeText } from '@/lib/i18n/text';
import { damageWithTitan, editedTitanLevels, isLegalTitan, sumDamage, type DamageVector, type RankedTitan, type TitanChoice, type TitanLevels, type TitanModel } from './model';
import { TitanDamageShareTable } from './titan-damage-share-table';
import { TitanLevelSet, TitanRankResult, TitanStatLabel, type TitanStatInfo } from './titan-stat-label';
import { createTitanStatHints } from './titan-stat-hints';
import type { TitanCatalog, TitanWeapon } from './weapon-match';
import styles from './titan-calculator.module.css';

interface ShareWeapon { name: string; details?: TitanWeapon; damage: DamageVector }

export function TitanShareCard({weapons,clean,catalog,ranked,model,choices,locale,stats}:{
  weapons:readonly ShareWeapon[]; clean:DamageVector; catalog:TitanCatalog; ranked:RankedTitan[][];
  model:TitanModel; choices:readonly TitanChoice[]; locale:Locale; stats:TitanStatInfo;
}) {
  const t=localeText(locale);
  const card=useRef<HTMLDivElement>(null);
  const [exporting,setExporting]=useState(false);
  const [failed,setFailed]=useState(false);
  const [element,setElement]=useState('');
  const loadout={weapons:weapons.flatMap(({details})=>details?[{id:details.id,stars:0}]:[])};
  const complete=new Set(loadout.weapons.map(weapon=>weapon.id)).size===weapons.length;
  const resonance=complete?mainWeaponResonance(loadout,catalog):undefined;
  const role=complete&&catalog.roleResonances?activeRoleResonance(loadout,{weapons:catalog.weapons,roleResonances:catalog.roleResonances}):null;
  const leading=[...weapons].sort((a,b)=>sumDamage(b.damage)-sumDamage(a.damage))[0]?.details;
  const leadingElement=!leading?.selectableElements?.length&&!leading?.elementFromResonance?leading?.elements[0]:undefined;
  const inferredElement=resonance?.element??leadingElement;
  const selected=element||inferredElement||'';
  const elementIcon=catalog.elementIcons[selected]?.icon;
  const selectedLabel=selected?elementLabel(selected,locale):'—';
  const autoLabel=resonance?t('Auto · build resonance','Авто · резонанс билда'):t('Auto','Авто');
  const elementChoices=Object.entries(catalog.elementIcons).map(([id,{icon}])=>({
    id,icon,name:{en:elementLabel(id,'en'),ru:elementLabel(id,'ru')},
  }));
  const elementDisplay=<span className={`build-element ${styles.elementChoice}`}>
    {elementIcon&&<img src={elementIcon} alt=""/>}<span title={selectedLabel}>{selectedLabel}</span>
  </span>;
  const percentage=(value:number)=>formatNumber(value,locale,{style:'percent',maximumFractionDigits:2});
  const comparison = ranked.map((list,index)=>{
    const choice=choices[index];
    const selected=choice?.rank??null;
    const custom=choice?editedTitanLevels(choice,list):null;
    const entries:{place:number|null;levels:TitanLevels;damage:number;chosen:boolean}[]=list.slice(0,3).map((entry,place)=>({
      place, levels:entry.levels, damage:entry.damage, chosen:!custom&&place===selected,
    }));
    if(custom&&isLegalTitan(custom,model)) {
      entries.push({place:null,levels:custom,damage:damageWithTitan(clean,custom,model,{weakPoint:index===1}),chosen:true});
    } else if(!custom&&selected!==null&&selected>=entries.length) {
      const entry=list[selected];
      if(entry)entries.push({place:selected,levels:entry.levels,damage:entry.damage,chosen:true});
    }
    return {entries,best:list[0]!.damage};
  });
  const rankRows=Math.max(...comparison.map(({entries})=>entries.length));

  async function exportCard() {
    const source=card.current;
    if(!source)return;
    setExporting(true);setFailed(false);
    const container=document.createElement('div');
    container.style.cssText='position:fixed;left:-12000px;top:0;width:1040px;pointer-events:none;';
    const clone=source.cloneNode(true) as HTMLDivElement;
    const picker=clone.querySelector('[data-titan-element-picker]');
    const display=picker?.querySelector('button .build-element');
    if(picker&&display)picker.replaceWith(display);
    carryOverInheritedCustomProperties(source,clone);
    container.append(clone);document.body.append(container);
    try {
      const library=await loadDomSnapshot();
      await waitForDomSnapshotAssets(clone);
      downloadPng(await library.toPng(clone,{pixelRatio:2,width:1040,cacheBust:false}),'tof-titan-summary.png');
    } catch {
      setFailed(true);
    } finally {
      container.remove();setExporting(false);
    }
  }

  return <section className={styles.board} aria-labelledby="titan-export-title">
    <div className={styles.sectionHeader}>
      <h2 id="titan-export-title">{t('Parse summary','Сводка парса')}</h2>
      <Button size="sm" variant="outline" disabled={exporting} onClick={()=>void exportCard()}>{t('Download PNG','Скачать PNG')}</Button>
    </div>
    {failed&&<p className={styles.warning} role="alert">{t('PNG export failed. Try again after the images have loaded.')}</p>}
    <div ref={card} className={styles.shareCard}>
      <header className={styles.shareHeader}>
        <div><small className={styles.titanHeading}>{catalog.titanMark&&<img src={catalog.titanMark} alt=""/>}TOF HUB / TITAN</small><h3>{t('Damage without Titan','Урон без титанки')}</h3></div>
        <div className={`${buildStyles.buildTitle} ${styles.shareIdentity}`}>
          {role&&<>
            <span className="build-role" title={t('Resonance')}><img src={role.icon} alt=""/>{localized(role.name,locale)}</span>
            <span className="build-focus-separator" aria-hidden="true">/</span>
          </>}
          {elementChoices.length>0?<div data-titan-element-picker>
            <IconPick label={t('Element','Стихия')} inline hint={false} items={elementChoices}
              value={element} onChange={setElement} locale={locale} emptyLabel={{en:autoLabel,ru:autoLabel}} display={elementDisplay}/>
          </div>:elementDisplay}
        </div>
      </header>
      <TitanDamageShareTable weapons={weapons.map(({name, details, damage}) => ({name, icon: details?.icon, damage}))}
        clean={clean} locale={locale} />
      <div className={styles.shareRanks} style={{'--rank-rows':rankRows,'--rank-section-rows':rankRows+1} as CSSProperties}>
        {comparison.map(({entries,best},index)=><section key={index}>
            <h4><TitanStatLabel info={index===1?stats.weakPoint:stats.dmgBoost} name={index?t('With Weak Point','С уязвимыми местами'):t('Without Weak Point','Без уязвимых мест')}/></h4>
            <ol>{entries.map(({place,levels,damage,chosen})=><li key={place??'custom'} data-best={place===0||undefined} data-selected={chosen||undefined}>
              <span className={styles.rankNumber}>{place===null?'':`#${place+1}`}</span>
              <TitanLevelSet levels={levels} stats={stats} hints={createTitanStatHints(levels,model,locale,index===1,clean)}/>
              <TitanRankResult value={place===0?t('Best','Лучшая'):percentage(damage/best-1)}
                choice={chosen?t('Your choice','Ваш выбор'):undefined}/>
            </li>)}</ol>
          </section>)}
      </div>
      <footer className={styles.shareFooter}><span className={buildStyles.cardWatermark}>@kritik</span></footer>
    </div>
  </section>;
}
