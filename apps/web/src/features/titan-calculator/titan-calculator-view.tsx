'use client';

import { useCallback, useEffect, useEffectEvent, useId, useMemo, useRef, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { localized } from '@tof-hub/i18n';
import { Button, Dialog, EmptyState, useToast } from '@tof-hub/ui';
import { RailGlyph, ToolRail } from '@/components/tool-rail/tool-rail';
import type { HandbookTitanData } from '@/features/datamine/contracts/handbook';
import { handbookHref } from '@/features/datamine/handbook/handbook-sections';
import { DRAFT_KEY } from '@/features/build/model';
import { useLocale } from '@/lib/i18n';
import { formatNumber } from '@/lib/i18n/format';
import { fillText, localeText } from '@/lib/i18n/text';
import {
  DAMAGE_CATEGORIES, NO_TITAN, TITAN_STATS, TITAN_STAT_KEYS, assignTitanLevels, buildTitanModel, categoryMultiplier, damageByTypeWithTitan, damageWithTitan,
  draftTitanLevels, editedTitanLevels, isLegalTitan, isTitanLevel, rankTitans, removeTitan, titanEffect, titanStatsByLevel,
  type DamageVector, type RankedTitan, type TitanAssignment, type TitanChoice, type TitanLevels, type TitanModel, type TitanOptions, type TitanStat,
} from './model';
import {
  ScreenshotDrop, ScreenshotPicker, ScreenshotPreview, WeaponTable,
  clipboardImages, confirmDamageRows, editWeaponRow, finalValue, fromParsedTable, type WeaponEntry,
} from './damage-table';
import { categoryLabel } from './damage-labels';
import { formatDamageValue, parseDamageReport, parseDamageTable, prepareDamageSidebar, prepareTableImage, prepareTitanPanel,
  readTitanLevels, readTitanLevelStrip, weaponSlot, type DamageReport } from './parse-table';
import { useScreenshotImport, type ScreenshotQueueTarget, type ScreenshotTarget } from './use-screenshot-import';
import { matchWeapon, type TitanCatalog } from './weapon-match';
import { TitanShareCard } from './titan-share-card';
import { TitanLevelSet, TitanRankResult, TitanStatLabel, TitanWornSet, type TitanStatInfo } from './titan-stat-label';
import { createTitanStatHints, type TitanStatHints } from './titan-stat-hints';
import { EXAMPLE_TITAN, EXAMPLE_WEAPONS } from './titan-example';
import { TitanHelp, titanHelpTitle } from './titan-help';
import { TitanScreenshotGuide, titanScreenshotGuideTitle } from './titan-screenshot-guide';
import styles from './titan-calculator.module.css';

type Text = ReturnType<typeof localeText>;
type ChartMode = 'clean' | 'recorded' | 'without-weak-point' | 'with-weak-point';
const WEAPON_COUNT = 3;
const RANK_PAGE_SIZE = 5;
const RESULT_FIXED_ROWS = 8;
const DEFAULT_CHOICE:TitanChoice = {rank:null,custom:null};
const hasValues = (weapon: WeaponEntry) => Object.values(weapon).some(row => Object.values(row.values).some(value => value.trim()));
const emptySlot = () => ({ weapon: {} as WeaponEntry, report: null as DamageReport | null, name: '' });
const completeLevels = (levels: Partial<TitanLevels>, limit: number) => TITAN_STAT_KEYS.every(key => isTitanLevel(levels[key] ?? NaN, limit));
const impossibleLevels = (t: Text) => t('These Titan levels cannot be assigned to the available equipment slots.', 'Эти уровни титанки нельзя распределить по доступным слотам экипировки.');
const noDamageRows=(text:string)=>DAMAGE_CATEGORIES.filter(category=>parseDamageTable(text).rows[category]?.final!=null).length<3;
const isTitanPanel=(text:string)=>/attack damage boost|point damage boost|titan.*parse|titan.*level|титан[а-яё]*\s+на момент парса/i.test(text);

export function TitanCalculatorView({ data, catalog, hasExampleMedia }: { data: HandbookTitanData; catalog: TitanCatalog; hasExampleMedia: boolean }) {
  const { locale } = useLocale();
  const t = localeText(locale);
  const {titanMark}=catalog;
  const model = useMemo(() => buildTitanModel(data), [data]);
  const [entries, setEntries] = useState(() => Array.from({ length: WEAPON_COUNT }, emptySlot));
  const latestEntries = useRef(entries);
  const weapons = useMemo(() => entries.map(entry => entry.weapon), [entries]);
  const [selectedSlot, setSelectedSlot] = useState<{ index: number; replace: boolean } | null>(null);
  const [others, setOthers] = useState<number|null>(null);
  const [worn, setWorn] = useState<TitanLevels>(NO_TITAN);
  const [wornConfirmed, setWornConfirmed] = useState(false);
  const [editWorn,setEditWorn]=useState(false);
  const [wornOrder,setWornOrder]=useState(TITAN_STAT_KEYS);
  const [chartMode, setChartMode] = useState<ChartMode>('clean');
  const [choices,setChoices] = useState([DEFAULT_CHOICE,DEFAULT_CHOICE]);
  const [visibleRanks,setVisibleRanks] = useState([RANK_PAGE_SIZE,RANK_PAGE_SIZE]);
  const [exampleRevision,setExampleRevision]=useState(0);
  const [activeDialog, setActiveDialog] = useState<'instructions' | 'screenshots' | 'example' | null>(null);
  const closeDialog = useCallback(() => setActiveDialog(null), []);
  const wornHeading = useRef<HTMLHeadingElement>(null);
  const { notify } = useToast();
  const noticeId = useId();
  const weaponNoticeId = useId();

  function setEntry(index: number, entry: (typeof entries)[number]) {
    latestEntries.current = latestEntries.current.map((current, position) => position === index ? entry : current);
    setEntries(latestEntries.current);
  }

  const readLevels=(text:string)=>({...readTitanLevels(text,data.rareValues),...readTitanLevelStrip(text,data.rareValues)});
  const { enqueue, pending, reserved, screenshots, showPreview, removePreview, report } = useScreenshotImport(locale, ({target,explicit,detectTitan}, text, extra, selected) => {
    const original=(target==='titan'||detectTitan)?readLevels(text):{};
    if (target === 'titan'||detectTitan&&(Object.keys(original).length>=3||isTitanPanel(text))) {
      const levels = extra ? {...original,...readLevels(extra)} : original;
      if (!Object.keys(levels).length) return false;
      setWorn({...NO_TITAN,...levels});
      setWornConfirmed(completeLevels(levels,data.rareValueLevelLimit));
      return 'titan';
    }
    const table = parseDamageTable(text);
    if(target==='others'||selected===3) {
      if(table.total===null||table.total<0||target==='others'&&selected!==null&&selected!==3)return false;
      setOthers(table.total);
      return 'others';
    }
    if (!DAMAGE_CATEGORIES.some(category => table.rows[category]?.final != null)) return false;
    const metadata = parseDamageReport(text,extra,selected);
    const matched = weaponSlot(metadata,table.total);
    const name = matched === null ? '' : metadata.weapons[matched]?.name ?? '';
    const current = latestEntries.current;
    const empty = (index: number) => !hasValues(current[index]!.weapon);
    const weaponMatch = matchWeapon(name,catalog.weapons);
    const sameWeapon = (existing: string) => existing && (
      existing.toLowerCase() === name.toLowerCase() ||
      (weaponMatch && matchWeapon(existing,catalog.weapons)?.id === weaponMatch.id)
    );
    if (!explicit && name && current.some((entry,index)=>!empty(index)&&sameWeapon(entry.name))) {
      return { error: t('This weapon already has a screenshot. Select its card to replace it.',
        'Скриншот этого оружия уже добавлен. Выберите его карточку для замены.') };
    }
    const destination = explicit && typeof target === 'number' ? target : matched!==null&&empty(matched) ? matched
      : typeof target === 'number' && empty(target) ? target : current.findIndex(entry=>!hasValues(entry.weapon));
    if(destination<0)return { error: t('All weapon slots are filled or queued. Choose a card to replace its screenshot.',
      'Все карточки заняты или в очереди. Выберите карточку, чтобы заменить скриншот.') };
    setEntry(destination,{weapon:fromParsedTable(table),report:metadata,name});
    const title = localized(weaponMatch?.weapon,locale) || name
      || fillText(t('Weapon {0}', 'Оружие {0}'), [destination + 1]);
    notify(fillText(t('Screenshot added to {0}', 'Скриншот добавлен · {0}'), [title]), { id: weaponNoticeId });
    setSelectedSlot(active=>{
      if(active?.index!==destination)return active;
      const next = [1,2].map(offset=>(destination+offset)%WEAPON_COUNT)
        .find(index=>!hasValues(latestEntries.current[index]!.weapon));
      return next===undefined ? active.replace ? active : null : {index:next,replace:false};
    });
    return destination;
  }, async ({target,detectTitan},file,text) => {
    const levels=(target==='titan'||detectTitan)?readLevels(text):{};
    const titan=target==='titan'||detectTitan&&(Object.keys(levels).length>=3||isTitanPanel(text));
    if(titan) {
      if(completeLevels(levels,data.rareValueLevelLimit))return null;
      const image=await prepareTitanPanel(file);
      return image?{image,selected:null,kind:'titan'}:null;
    }
    if(detectTitan&&noDamageRows(text)) {
      const prepared=await prepareDamageSidebar(file);
      return {image:await prepareTableImage(file),selected:prepared?.selected??null,kind:'damage'};
    }
    return prepareDamageSidebar(file);
  });

  function importFiles(files: File[], target?: ScreenshotTarget, detectTitan=false, replaceSelected=target!==undefined) {
    if (!files.length) return;
    if (target === 'titan'||target==='others') {
      enqueue([{ target, file: files[0]! }]);
      return;
    }
    const ordered = Array.from({length:WEAPON_COUNT},(_,index)=>(index+(target??0))%WEAPON_COUNT);
    const replace = replaceSelected && target!==undefined && !reserved.current.has(target);
    const targets: ScreenshotQueueTarget[] = ordered.filter(index => !reserved.current.has(index) && (
      (replace && index===target) || !hasValues(latestEntries.current[index]!.weapon)
    ));
    if (detectTitan && files.length > targets.length && !reserved.current.has('auto')) {
      targets.push('auto');
    }
    if (files.length > targets.length) {
      report(targets.length
        ? t('Extra images need an empty weapon slot.', 'Для остальных изображений нужна свободная карточка оружия.')
        : t('All weapon slots are filled or queued. Choose a card to replace its screenshot.', 'Все карточки заняты или в очереди. Выберите карточку, чтобы заменить скриншот.'));
    }
    enqueue(files.slice(0, targets.length).map((file, index) => ({ file, target: targets[index]!, explicit:index===0&&replace,detectTitan })));
  }

  function importAtSelection(files: File[]) {
    importFiles(files, selectedSlot?.index, true, selectedSlot?.replace ?? false);
  }

  const pasteScreenshot = useEffectEvent((event: ClipboardEvent) => {
    if (!model || event.defaultPrevented || document.querySelector('[role="dialog"]')) return;
    const files = clipboardImages(event.clipboardData);
    if (!files.length) return;
    const focus = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-paste-target]') : null;
    const hovered=document.querySelector<HTMLElement>('[data-paste-target]:hover')?.dataset.pasteTarget;
    const target=[focus?.dataset.pasteTarget,hovered].find(value=>value==='titan'||value==='others');
    event.preventDefault();
    if (target==='titan'||target==='others') importFiles(files,target,true);
    else importAtSelection(files);
  });
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => pasteScreenshot(event);
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, []);

  const parse = useMemo(() => {
    const sum: DamageVector = { normal: 0, dodge: 0, discharge: 0, passive: 0, skill: 0 };
    for (const category of DAMAGE_CATEGORIES) {
      for (const weapon of weapons) sum[category] += finalValue(weapon[category]) ?? 0;
    }
    return sum;
  }, [weapons]);
  const parseTotal = Object.values(parse).reduce((total, value) => total + value, 0);
  const invalid = !Number.isFinite(parseTotal) || weapons.some((weapon,index) => DAMAGE_CATEGORIES.some(category => {
    const row=weapon[category];
    const final=finalValue(row);
    return (row?.values.final.trim() && final === null)
      || (screenshots.has(index) && (final === null || row?.source?.status === 'check'));
  }));
  const invalidWorn = useMemo(() => model !== null && !isLegalTitan(worn, model), [model, worn]);
  const clean = useMemo(() => model ? removeTitan(parse, worn, model, { weakPoint: true }) : null, [model, parse, worn]);
  const requireWorn = [...screenshots.keys()].some(target=>target!=='titan') && !wornConfirmed;
  const ranking = useMemo(() => model && clean && !requireWorn && !invalidWorn && !invalid && parseTotal > 0
    ? [rankTitans(clean, model, { weakPoint: false },50), rankTitans(clean, model, { weakPoint: true },50)]
    : [], [model, clean, parseTotal, requireWorn, invalidWorn, invalid]);
  const displayedRanks = ranking.map((ranks,index)=>Math.min(ranks.length,visibleRanks[index]??RANK_PAGE_SIZE));
  const customAssignments = useMemo(() => choices.map(({custom}) =>
    model && custom ? assignTitanLevels(custom, model) : null), [choices, model]);

  if (!model || !clean) return <EmptyState title={t('Titan data is unavailable.', 'Данные титанки недоступны.')} />;

  const stats = Object.fromEntries(TITAN_STAT_KEYS.map(stat => [stat, {
    name: localized(data.rareValues.find(item => item.id === TITAN_STATS[stat])?.name, locale) ?? stat,
    icon: catalog.statIcons[stat],
  }])) as TitanStatInfo;
  const forecastIndex = chartMode === 'with-weak-point' ? 1 : 0;
  const forecastChoice = choices[forecastIndex] ?? DEFAULT_CHOICE;
  const forecastRanks = ranking[forecastIndex];
  const forecastRank = forecastRanks?.[forecastChoice.rank ?? 0] ?? forecastRanks?.[0];
  const forecastLevels = forecastChoice.custom ?? forecastRank?.levels;
  const forecast = chartMode === 'without-weak-point' || chartMode === 'with-weak-point';
  const chart = !forecast ? (chartMode === 'recorded' ? parse : clean)
    : forecastLevels && (!forecastChoice.custom || customAssignments[forecastIndex])
      ? damageByTypeWithTitan(clean, forecastLevels, model, {weakPoint: forecastIndex === 1})
      : null;
  const chartTotal = chart ? DAMAGE_CATEGORIES.reduce((total, category) => total + chart[category], 0) : null;
  const chartOrder = chart ?? clean;
  const totals = weapons.map(weapon => finalValue(weapon.total)).filter(total => total !== null && total > 0);
  const duplicate = new Set(totals).size < totals.length;
  const wornHints = invalidWorn ? undefined : createTitanStatHints(worn, model, locale, true, invalid || requireWorn ? null : clean);
  const roster = entries.find(entry=>entry.report?.weapons.length===WEAPON_COUNT)?.report;
  const weaponNames=entries.map((entry,index)=>{
    const source=entry.report;
    const sameParse=roster?.total&&source?.total&&source.selected===index&&Math.abs(source.total/roster.total-1)<=.01;
    return entry.name||(!hasValues(entry.weapon)||sameParse?roster?.weapons[index]?.name:'')||'';
  });
  const weaponDetails=weaponNames.map(name=>matchWeapon(name,catalog.weapons));
  const weaponTitle=(index:number)=>localized(weaponDetails[index]?.weapon,locale)||weaponNames[index]||fillText(t('Weapon {0}', 'Оружие {0}'),[index+1]);
  const usedWeapons = weapons.filter(weapon => DAMAGE_CATEGORIES.some(category => finalValue(weapon[category]) !== null)).length;
  const wornPreview = screenshots.get('titan');
  const wornPending = pending.get('titan');
  const extraPending = pending.get('auto');
  const showTitanStep = requireWorn && parseTotal > 0;
  const othersPreview = screenshots.get('others');
  const othersPending = pending.get('others');
  const phaseLabel = (phase: 'queued' | 'reading') => phase === 'queued'
    ? t('Queued', 'В очереди')
    : t('Reading screenshot…', 'Читаем скриншот…');

  function loadFromBuild() {
    let levels: TitanLevels | null = null;
    try {
      levels = draftTitanLevels(JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null'));
    } catch {
      // The browser may block storage access.
    }
    if (levels) {
      setWorn(levels);
      setWornConfirmed(true);
      removePreview('titan');
    } else {
      notify(t('No saved Build card was found in this browser.', 'В этом браузере нет сохранённой карточки билда.'), { id: noticeId, tone: 'error' });
    }
  }

  function loadExample() {
    if (reserved.current.size) return;
    const weapons = EXAMPLE_WEAPONS.map(({ name }) => ({ name, share: null }));
    const next = EXAMPLE_WEAPONS.map(({ name, table, image }, index) => {
      if (hasExampleMedia) showPreview(index, `/examples/titan/${image}`, image);
      else removePreview(index);
      return { weapon: fromParsedTable(parseDamageTable(table)), name,
        report: { total: null, othersShare: null, selected: index, weapons } };
    });
    latestEntries.current = next;
    setEntries(next);
    setSelectedSlot(null);
    setOthers(null);
    removePreview('others');
    if (hasExampleMedia) showPreview('titan', '/examples/titan/worn-titan.webp', 'worn-titan.webp');
    else removePreview('titan');
    setWorn(EXAMPLE_TITAN);
    setWornConfirmed(true);
    setEditWorn(false);
    setChartMode('clean');
    setChoices([DEFAULT_CHOICE,DEFAULT_CHOICE]);
    setVisibleRanks([RANK_PAGE_SIZE,RANK_PAGE_SIZE]);
    setExampleRevision(revision => revision + 1);
  }

  return <div className={styles.page}>
    <h1 className="sr-only">{t('Titan Calculator', 'Калькулятор титанки')}</h1>
    <ToolRail label={t('Titan calculator', 'Калькулятор титанки')} items={[
      { id: 'help', label: titanHelpTitle(t), icon: <RailGlyph name="formula"/>, onClick: () => setActiveDialog('instructions') },
      ...(hasExampleMedia ? [{
        id: 'screenshots',
        label: titanScreenshotGuideTitle(t),
        icon: <svg className="h-[1.1875rem] w-[1.1875rem]" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
          <circle cx="9" cy="9.5" r="1.25" />
          <path d="m4 16 4-4 3 3 4.5-4.5 4.5 4.5" />
        </svg>,
        onClick: () => setActiveDialog('screenshots'),
      }] : []),
    ]}/>
    {activeDialog === 'instructions' && <TitanHelp locale={locale} onClose={closeDialog} />}
    {activeDialog === 'screenshots' && <TitanScreenshotGuide locale={locale} stats={stats} onClose={closeDialog} />}
    <Dialog isOpen={activeDialog==='example'} onClose={closeDialog} appearance="table" type="warning"
      title={t('Replace the current parse?', 'Заменить текущий парс?')}
      description={t('The example will replace the screenshots, damage and Titan levels you entered.',
        'Пример заменит ваши скриншоты, значения урона и уровни титанки.')}
      cancelLabel={t('Cancel')} confirmLabel={t('Load example', 'Загрузить пример')} onConfirm={()=>{closeDialog();loadExample();}} />

    <section className={styles.board} aria-labelledby="titan-parse">
      <div className={styles.sectionHeader}>
        <div>
          <h2 id="titan-parse">1. {t('Weapon damage', 'Урон по оружию')}</h2>
          <p className={styles.hint}>{t('Use one screenshot per weapon or fill in Final DMG by hand.', 'Добавьте по скриншоту на оружие или заполните столбец итогового урона вручную.')}</p>
        </div>
        <div className={styles.parseSummary}>
          <span>{fillText(t('{0} / {1} weapons', 'Оружие: {0} из {1}'), [usedWeapons, WEAPON_COUNT])}</span>
          {parseTotal > 0 && Number.isFinite(parseTotal) && <strong>{formatDamageValue(parseTotal)}</strong>}
          <Link href={handbookHref('gacha','#titan/rare')} prefetch={false} target="_blank" rel="noopener" className={styles.handbookLink}
            aria-label={t('Titan Handbook (opens in a new tab)','Справочник по титанке (откроется в новой вкладке)')}>
            <RailGlyph name="rules"/>{t('Handbook','Справочник')}<span aria-hidden="true">↗</span>
          </Link>
          <Button variant="outline" size="sm" onClick={()=>{
            if (weapons.some(hasValues) || wornConfirmed || TITAN_STAT_KEYS.some(stat=>worn[stat]!==0) || screenshots.size) setActiveDialog('example');
            else loadExample();
          }} disabled={pending.size>0}>{t('Load example', 'Загрузить пример')}</Button>
        </div>
      </div>
      <ScreenshotDrop className={styles.uploadBar} onFiles={importAtSelection}>
        <div className={styles.uploadCopy}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 16V4m-5 5 5-5 5 5M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4" />
          </svg>
          <div>
            <b>{t('Paste or drop screenshots', 'Вставьте или перетащите скриншоты')} <kbd>{t('Ctrl+V / ⌘V', 'Ctrl+V / ⌘V')}</kbd></b>
            <p className={`${styles.hint} ${styles.uploadGuidance}`}>
              <span aria-hidden={showTitanStep}>{t('Click a weapon card to select it. You can paste a Titan screenshot anywhere.', 'Нажмите на карточку оружия, чтобы выбрать её. Скриншот титанки можно вставить в любом месте.')}</span>
              <a href="#titan-worn" aria-hidden={!showTitanStep}>{t('Add Titan levels', 'Добавить титанку')} <span aria-hidden="true">↓</span></a>
            </p>
            {extraPending && <p className={styles.hint} role="status">{phaseLabel(extraPending)}</p>}
          </div>
        </div>
        <ScreenshotPicker label={t('Choose screenshots', 'Выбрать скриншоты')} onFiles={importAtSelection} multiple primary />
      </ScreenshotDrop>
      <div className={styles.weapons}>
        {weapons.map((weapon, index) => {
          const title=weaponTitle(index),details=weaponDetails[index];
          const screenshot = screenshots.get(index);
          const phase = pending.get(index);
          return <article key={index} className={styles.weapon} data-paste-target={index} data-selected={selectedSlot?.index===index}
            onClick={event=>{
              if(event.target instanceof Element&&event.target.closest('button,a,select,[role="dialog"]'))return;
              setSelectedSlot({index,replace:true});
            }}>
            <ScreenshotDrop className={styles.weaponDrop} onFiles={files => importFiles(files, index)}>
              <header className={styles.weaponHeader}>
                <h3><button type="button" aria-pressed={selectedSlot?.index===index} onClick={()=>setSelectedSlot({index,replace:true})}>
                  {details?.icon&&<img src={details.icon} alt=""/>}<span>{title}</span>
                </button></h3>
                <div className={styles.cardActions}>
                  <ScreenshotPicker
                    label={screenshot ? t('Replace', 'Заменить') : t('Add image', 'Добавить фото')}
                    onFiles={files => {setSelectedSlot({index,replace:true});importFiles(files, index);}}
                    disabled={Boolean(phase)}
                  />
                  {hasValues(weapon) && <Button variant="ghost" size="sm" disabled={Boolean(phase)} onClick={() => {
                    setEntry(index,emptySlot());
                    removePreview(index);
                  }}>{t('Clear', 'Очистить')}</Button>}
                </div>
              </header>
              {screenshot && <ScreenshotPreview screenshot={screenshot} locale={locale} />}
              <div className={styles.readStatus} role="status">{phase && phaseLabel(phase)}</div>
              <WeaponTable weapon={weapon} title={title} locale={locale} imported={Boolean(screenshot)} pending={Boolean(phase)} selected={selectedSlot?.index===index}
                onEdit={(category, column, value) => setEntry(index,{...entries[index]!,weapon:editWeaponRow(weapon, category, column, value)})}
                onConfirm={()=>setEntry(index,{...entries[index]!,weapon:confirmDamageRows(weapon)})} />
            </ScreenshotDrop>
          </article>;
        })}
      </div>
      <details className={styles.othersImport} data-paste-target="others">
        <summary>{t('Other damage (optional)', 'Прочий урон (необязательно)')}{others!==null&&<b>{formatDamageValue(others)} · {percent(others/(parseTotal+others),locale,2)}</b>}</summary>
        <ScreenshotDrop className={styles.footerRow} onFiles={files=>importFiles(files,'others')}>
          <ScreenshotPicker label={t('Add image', 'Добавить фото')} onFiles={files=>importFiles(files,'others')} disabled={Boolean(othersPending)}/>
          {othersPreview&&<ScreenshotPreview screenshot={othersPreview} locale={locale}/>}
          {othersPreview&&<Button variant="ghost" size="sm" onClick={()=>{setOthers(null);removePreview('others');}}>{t('Clear', 'Очистить')}</Button>}
          {othersPending&&<span role="status">{phaseLabel(othersPending)}</span>}
          <p className={styles.hint}>{t('Others only affects the overall gain percentage.', 'Others учитывается только при расчёте общего прироста.')}</p>
        </ScreenshotDrop>
      </details>
      {duplicate && <p className={styles.warning} role="status">{t('Two tables have the same Total. Check that each weapon was entered once.', 'Итоги двух таблиц совпадают. Проверьте, что каждое оружие введено один раз.')}</p>}
      {invalid && <p className={styles.warning} role="status">{t('Review the marked Final DMG values to see the calculation.', 'Проверьте отмеченные значения итогового урона, чтобы увидеть расчёт.')}</p>}
    </section>

    <section className={styles.board} aria-labelledby="titan-worn" data-paste-target="titan">
      <ScreenshotDrop className={styles.wornDrop} onFiles={files => importFiles(files, 'titan')}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 ref={wornHeading} id="titan-worn" className={styles.titanHeading} tabIndex={-1}>{titanMark && <img src={titanMark} alt="" />}<span>2. {t('Titan worn during the parse', 'Титанка на момент парса')}</span></h2>
            <p className={styles.hint}>{t('Enter total levels. You can also paste a screenshot of the Titan stats here.', 'Укажите суммарные уровни. Сюда также можно вставить скриншот статов титанки.')}</p>
          </div>
          <div className={styles.actions}>
            <Button variant="outline" size="sm" onClick={loadFromBuild} disabled={Boolean(wornPending)}>{t('From Build', 'Из билдера')}</Button>
            <ScreenshotPicker label={t('Import Titan screenshot', 'Скриншот титанки')} onFiles={files => importFiles(files, 'titan')} disabled={Boolean(wornPending)} />
            <Button variant="ghost" size="sm" aria-expanded={editWorn} onClick={()=>{
              if(!editWorn)setWornOrder(titanStatsByLevel(worn));
              setEditWorn(!editWorn);
            }}>{t('Edit Titan levels', 'Изменить уровни титанки')}</Button>
            <Button variant="ghost" size="sm" disabled={Boolean(wornPending)} onClick={() => {
              setWorn(NO_TITAN);
              setWornConfirmed(false);
              removePreview('titan');
            }}>{t('Reset levels', 'Сбросить уровни')}</Button>
          </div>
        </div>
        {wornPreview && <ScreenshotPreview screenshot={wornPreview} locale={locale} />}
        <div className={styles.readStatus} role="status">{wornPending && phaseLabel(wornPending)}</div>
        {editWorn
          ? <LevelFields levels={worn} order={wornOrder} onChange={setWorn} model={model} stats={stats} hints={wornHints} locale={locale} prefix="worn" disabled={Boolean(wornPending)} />
          : <dl className={`${styles.levels} ${styles.wornSummary}`}>{titanStatsByLevel(worn).map(stat=><div key={stat} data-hint={wornHints?.(stat)}><dt><TitanStatLabel info={stats[stat]} hint={wornHints?.(stat)} focusable/></dt><dd><b>{worn[stat]>=0&&'+'}{worn[stat]}</b><small>{isTitanLevel(worn[stat],model.maxLevel) ? percent(titanEffect(model,stat,worn[stat]),locale,2) : '—'}</small></dd></div>)}</dl>}
        {invalidWorn && <p className={styles.warning} role="status">{impossibleLevels(t)}</p>}
        {showTitanStep && !invalidWorn && <div className={styles.confirmLevels}>
          <p className={styles.hint}>{t('Check all six levels. Use zeroes if you fought without Titan.',
            'Проверьте все шесть уровней. Оставьте нули, если сделали парс без титанки.')}</p>
          <Button size="sm" variant="outline" disabled={Boolean(wornPending)}
            onClick={()=>{wornHeading.current?.focus({preventScroll:true});setWornConfirmed(true);}}>{t('Confirm levels', 'Подтвердить уровни')}</Button>
        </div>}
      </ScreenshotDrop>
    </section>

    {!invalidWorn && (parseTotal <= 0 || invalid || requireWorn
      ? <section className={styles.board}><EmptyState title={invalid
        ? t('Check the damage values to continue.', 'Проверьте значения урона, чтобы продолжить.')
        : requireWorn ? t('Import or enter the Titan levels used in the parse.', 'Добавьте скриншот титанки или укажите её уровни на момент парса.')
        : t('Add damage to see the best Titan.', 'Добавьте урон, чтобы увидеть лучшую титанку.')} /></section>
      : <>
        <section className={styles.board} aria-labelledby="titan-share">
          <div className={`${styles.sectionHeader} ${styles.chartHeader}`}>
            <h2 id="titan-share">{t('Damage distribution', 'Распределение урона')}</h2>
            <strong className={styles.cleanTotal} aria-live="polite">{chartTotal === null ? '—' : formatDamageValue(chartTotal)}</strong>
            <p className={styles.hint}>{t('Compare the parse with damage before Titan bonuses and forecasts for the sets selected below.', 'Сравните парс с уроном без бонусов титанки и прогнозами для выбранных ниже наборов.')}</p>
          </div>
          <div className={`${styles.actions} ${styles.chartModes}`}>
            <div className={styles.chartModeGroup}>
              <Button size="sm" variant="ghost" aria-pressed={chartMode==='clean'} onClick={()=>setChartMode('clean')}>{t('Damage without Titan', 'Урон без титанки')}</Button>
              <Button size="sm" variant="ghost" aria-pressed={chartMode==='recorded'} onClick={()=>setChartMode('recorded')}>{t('Recorded damage', 'Урон из парса')}</Button>
            </div>
            <div className={styles.chartModeGroup} role="group" aria-labelledby="titan-forecast">
              <span id="titan-forecast">{t('Forecast', 'Прогноз')}</span>
              <Button size="sm" variant="ghost" aria-pressed={chartMode==='without-weak-point'} onClick={()=>setChartMode('without-weak-point')}>{t('Without Weak Point','Без уязвимых мест')}</Button>
              <Button size="sm" variant="ghost" aria-pressed={chartMode==='with-weak-point'} onClick={()=>setChartMode('with-weak-point')}>{t('With Weak Point','С уязвимыми местами')}</Button>
            </div>
          </div>
          <ol className={styles.damageChart}>
            {[...DAMAGE_CATEGORIES].sort((a,b)=>chartOrder[b]-chartOrder[a]).map(category => {
              const share=chart && chartTotal ? chart[category]/chartTotal : 0;
              return <li key={category} data-category={category}>
                <span className={styles.chartLabel}><i aria-hidden/>{categoryLabel(category,t)}</span>
                <span className={styles.chartTrack} aria-hidden><i style={{width:`${share*100}%`}}/></span>
                <strong>{chart?percent(share,locale,1):'—'}</strong><span>{chart?formatDamageValue(chart[category]):'—'}</span>
              </li>;
            })}
          </ol>
          {!chart && <p className={styles.warning} role="status">{impossibleLevels(t)}</p>}
        </section>

        <section className={styles.board} aria-labelledby="titan-result">
          <div className={styles.sectionHeader}>
            <div>
              <h2 id="titan-result" className={styles.titanHeading}>{titanMark && <img src={titanMark} alt="" />}{t('Best Titan builds', 'Лучшие сборки титанки')}</h2>
              <p className={styles.hint}>{t('Choose a set to see its levels and equipment slots. Select it again to return to the best.', 'Выберите набор, чтобы увидеть уровни и статы по слотам. Нажмите ещё раз, чтобы вернуться к лучшему.')}</p>
            </div>
          </div>
          <TitanWornSet title={t('Titan worn during the parse','Титанка на момент парса')} levels={worn} stats={stats} hints={wornHints}/>
          <div className={styles.results} style={{'--result-rows':Math.max(0,...displayedRanks)+RESULT_FIXED_ROWS} as CSSProperties}>
            {ranking.map((ranked, index) => <ResultColumn key={`${exampleRevision}-${index}`} ranked={ranked} weakPoint={index === 1}
              visible={displayedRanks[index]!} onMore={()=>setVisibleRanks(current=>current.map((value,position)=>position===index?value+RANK_PAGE_SIZE:value))}
              choice={choices[index]??DEFAULT_CHOICE} customAssignment={customAssignments[index]??null}
              onChoice={choice=>setChoices(current=>current.map((value,position)=>position===index?choice:value))}
              clean={clean} worn={worn} model={model} others={others ?? 0} data={data} stats={stats} locale={locale} t={t} />)}
          </div>
        </section>
        <TitanShareCard key={exampleRevision}
          weapons={weapons.map((weapon,index)=>({
            name:weaponTitle(index),details:weaponDetails[index],
            damage:removeTitan(Object.fromEntries(DAMAGE_CATEGORIES.map(category=>[category,finalValue(weapon[category])??0])) as DamageVector,worn,model,{weakPoint:true}),
          }))}
          clean={clean} catalog={catalog} ranked={ranking} model={model} choices={choices} locale={locale} stats={stats} />

      </>)}
  </div>;
}


function LevelFields({levels,order=TITAN_STAT_KEYS,onChange,model,stats,hints,locale,prefix,disabled=false}:{levels:TitanLevels;order?:readonly TitanStat[];onChange:(levels:TitanLevels)=>void;model:TitanModel;stats:TitanStatInfo;hints?:TitanStatHints;locale:ReturnType<typeof useLocale>['locale'];prefix:string;disabled?:boolean}) {
  return <div className={styles.levels}>
    {order.map(stat=><label key={stat} className={styles.field} data-hint={hints?.(stat)}>
      <TitanStatLabel info={stats[stat]}/>
      <span className={styles.levelInput}>
        <input className={styles.input} id={`${prefix}-${stat}`} type="number" min={0} max={model.maxLevel} step={1} disabled={disabled} value={levels[stat]} aria-invalid={!isTitanLevel(levels[stat],model.maxLevel)} onChange={event=>{
          const level=Number.isFinite(event.target.valueAsNumber)?event.target.valueAsNumber:0;
          onChange({...levels,[stat]:level});
        }}/>
        <b>{isTitanLevel(levels[stat],model.maxLevel)?`+${percent(titanEffect(model,stat,levels[stat]),locale,2)}`:'—'}</b>
      </span>
    </label>)}
  </div>;
}

function ResultColumn({ranked,weakPoint,visible,onMore,choice,customAssignment,onChoice,clean,worn,model,others,data,stats,locale,t}:{ranked:RankedTitan[];weakPoint:boolean;visible:number;onMore:()=>void;choice:TitanChoice;customAssignment:TitanAssignment|null;onChoice:(choice:TitanChoice)=>void;clean:DamageVector;worn:TitanLevels;model:TitanModel;others:number;data:HandbookTitanData;stats:TitanStatInfo;locale:ReturnType<typeof useLocale>['locale'];t:Text}) {
  const options:TitanOptions={weakPoint};
  const customId=useId();
  const ranksId=useId();
  const {custom}=choice;
  const best=ranked[0]!,chosen=ranked[choice.rank??0]??best;
  const edited=editedTitanLevels(choice,ranked);
  const levels=custom??chosen.levels;
  const valid=!custom||customAssignment!==null;
  const damage=custom&&valid?damageWithTitan(clean,custom,model,options):chosen.damage;
  const current=damageWithTitan(clean,worn,model,options);
  const hints=createTitanStatHints(valid?levels:chosen.levels,model,locale,weakPoint,clean);
  return <article className={styles.result} data-weak-point={weakPoint} style={{'--visible-ranks':visible} as CSSProperties}>
    <header className={styles.resultHeader}>
      <h3><TitanStatLabel info={weakPoint?stats.weakPoint:stats.dmgBoost} name={weakPoint?t('With Weak Point','С уязвимыми местами'):t('Without Weak Point','Без уязвимых мест')}/></h3>
      <div className={styles.resultActions}>
        <Button size="sm" variant="ghost" disabled={visible>=ranked.length} onClick={onMore}>{t('Show next 5','Показать ещё 5')}</Button>
        <Button size="sm" variant="outline" aria-expanded={custom!==null} aria-controls={customId} onClick={()=>onChoice({rank:choice.rank,custom:custom?null:{...chosen.levels}})}>
          {t('Edit this set','Изменить этот набор')}
        </Button>
      </div>
    </header>
    <div className={styles.resultMetric}>
      <p className={styles.gainCaption}>
        <strong className={styles.gain} data-negative={valid&&damage<current}>{valid?signedPercent(damage/current-1,locale):'—'}</strong>
        <span>{t('Compared with worn Titan','К вашей титанке')}</span>
      </p>
      {others>0 && <p className={styles.otherGain}>{t('With Others','С Others')} <b>{valid?signedPercent((damage-current)/(current+others),locale):'—'}</b></p>}
    </div>
    <LevelChips levels={valid?levels:chosen.levels} stats={stats} hints={hints}/>
    <div className={styles.rankHeading}>
      <h4 id={ranksId}>{t('Best level sets','Лучшие наборы уровней')}</h4>
      <span>{t('Behind best','Отставание от лучшего')}</span>
    </div>
    <ol className={styles.top} aria-labelledby={ranksId} role="list">
      {ranked.slice(0,visible).map((item,index)=>{
        const selected=!edited&&index===choice.rank;
        const usedInParse=TITAN_STAT_KEYS.every(stat=>item.levels[stat]===worn[stat]);
        return <li key={index} data-best={index===0||undefined} data-selected={selected}>
          <button type="button" aria-pressed={selected} onClick={()=>onChoice(selected?DEFAULT_CHOICE:{rank:index,custom:null})}>
            <span className={styles.rankNumber}>#{index+1}</span>
            <TitanLevelSet levels={item.levels} stats={stats} hints={createTitanStatHints(item.levels,model,locale,weakPoint,clean)}>
              {usedInParse&&<span className={styles.rankWorn}>{t('Used in parse','Было в парсе')}</span>}
            </TitanLevelSet>
            <TitanRankResult value={index?signedPercent(item.damage/best.damage-1,locale):t('Best','Лучшая')}
              choice={selected?t('Your choice','Ваш выбор'):undefined}/>
          </button>
        </li>;
      })}
    </ol>
    {custom&&<div id={customId} className={styles.customSet}>
      <h4>{edited?t('Your choice','Ваш выбор'):t('Compare your own levels','Сравнить свои уровни')}</h4>
      <LevelFields levels={custom} onChange={levels=>onChoice({rank:choice.rank,custom:levels})} model={model} stats={stats} hints={valid?hints:undefined} locale={locale} prefix={weakPoint?'custom-wp':'custom'}/>
      {valid
        ? <p aria-live="polite">{signedPercent(damage/chosen.damage-1,locale)} {t('vs. selected set','к выбранному набору')} · {signedPercent(damage/best.damage-1,locale)} {t('vs. best','к лучшей')}</p>
        : <p className={styles.warning} role="status">{impossibleLevels(t)}</p>}
    </div>}
    <h4 className={styles.slotHeading}>{t('Stats by equipment slot','Статы по слотам экипировки')}</h4>
    <ul className={styles.slots}>
      {model.slots.map(({slot,options})=>{
        const roll=edited?customAssignment?.[slot]:options.find(item=>item.stat===chosen.assignment[slot]);
        const icon=data.slotIcons[slot]?.titan;
        return <li key={slot}>
          {icon?<img src={icon} alt="" loading="lazy"/>:<span className={styles.slotIcon} aria-hidden/>}
          <span>
            <b>{localized(data.slotNames[slot],locale)??slot}</b>
            {roll?<TitanStatLabel info={stats[roll.stat]} level={roll.level} hint={hints(roll.stat,roll.level)} focusable/>
              : <span>{valid?t('Empty slot','Пустой слот'):'—'}</span>}
          </span>
        </li>;
      })}
    </ul>
    {valid && <details className={styles.details}>
      <summary>{t('Multiplier by damage type','Множитель по типам урона')}</summary>
      <ul>{DAMAGE_CATEGORIES.map(category=><li key={category}>
        {category==='passive'?categoryLabel(category,t):<TitanStatLabel info={stats[category]} name={categoryLabel(category,t)} hint={hints(category)}/>} <b>×{formatNumber(categoryMultiplier(category,levels,model,options),locale,{minimumFractionDigits:3,maximumFractionDigits:3})}</b>
      </li>)}</ul>
    </details>}
  </article>;
}

function LevelChips({levels,stats,hints}:{levels:TitanLevels;stats:TitanStatInfo;hints:TitanStatHints}) {
  return <ul className={styles.chips}>
    {titanStatsByLevel(levels).filter(stat=>levels[stat]).map(stat=><li key={stat}><TitanStatLabel info={stats[stat]} level={levels[stat]} hint={hints(stat)} focusable/></li>)}
  </ul>;
}

function percent(value:number,locale:ReturnType<typeof useLocale>['locale'],digits:number) {
  return formatNumber(Number.isFinite(value)?value:0,locale,{style:'percent',minimumFractionDigits:digits,maximumFractionDigits:digits});
}
function signedPercent(value:number,locale:ReturnType<typeof useLocale>['locale']) {
  const finite=Number.isFinite(value)?value:0;
  return `${finite>=0?'+':''}${percent(finite,locale,2)}`;
}
