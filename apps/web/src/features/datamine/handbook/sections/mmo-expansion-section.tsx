'use client';
import { fillText } from '@/lib/i18n/text';

import React, { useRef, useState } from 'react';
import { CatalogControls, EmptyState, GameBadge, GameRichText } from '@tof-hub/ui';
import { gameAsset } from '@tof-hub/game-assets';
import { fillMmoText, mmoCardParams, mmoCardStats } from '@tof-hub/game-domain';
import type { HandbookExpansionCard, HandbookExpansionData } from '../../contracts/handbook';
import { useEncounterIconPreview } from '../../components/inspectable-icon';
import { HandbookStatLabel, useHandbookStatPresentation } from '../handbook-stat-presentation';
import { ChoiceChips, Controls, HandbookTable, IconLabel, Note, RangeField, SubTabs, useHandbookText } from './handbook-ui';
import shared from './sections.module.css';
import styles from './expansion.module.css';

export function MmoExpansionSection({ data, sourceAction }: {data: HandbookExpansionData; sourceAction?: React.ReactNode}) {
  const {t, name, num, pct, locale} = useHandbookText();
  const {compareStats} = useHandbookStatPresentation();
  const preview = useEncounterIconPreview();
  const detail = useRef<HTMLElement>(null);
  const [query, setQuery] = useState('');
  const [slot, setSlot] = useState('all');
  const [quality, setQuality] = useState('all');
  const [season, setSeason] = useState('all');
  const [selectedId, setSelectedId] = useState(data.cards[0]?.id ?? '');
  const [stars, setStars] = useState(0);
  const [equipped, setEquipped] = useState(1);
  const levelKeys = Object.values(data.coefficients).filter(keys => keys.length);
  const minLevel = Math.ceil(Math.max(1, ...levelKeys.map(keys => keys[0]![0])));
  const maxLevel = levelKeys.length ? Math.max(minLevel, Math.floor(Math.min(...levelKeys.map(keys => keys.at(-1)![0])))) : minLevel;
  // The same editorial level example as the Build editor; bounds come from raw curves.
  const [level, setLevel] = useState(Math.min(maxLevel, Math.max(minLevel, 80)));
  const qualityOrder: Record<string, number> = {rare: 0, epic: 1, legendry: 2};
  const qualities = [...new Set(data.cards.map(card => card.quality))]
    .sort((a, b) => (qualityOrder[a] ?? Infinity) - (qualityOrder[b] ?? Infinity));
  const filtered = data.cards.filter(card =>
    (!query.trim() || `${name(card.name)} ${card.id}`.toLocaleLowerCase(locale).includes(query.trim().toLocaleLowerCase(locale)))
    && (slot === 'all' || (slot === 'unknown' ? !card.slots.length : card.slots.includes(slot)))
    && (quality === 'all' || card.quality === quality)
    && (season === 'all' || (season === 'exclusive' ? card.exclusive : String(card.season) === season)));
  const selected = filtered.find(card => card.id === selectedId) ?? filtered[0];
  const qualityLabel = (value: string) => ({legendry: t('Legendary', 'Легендарное'),
    epic: t('Epic', 'Эпическое'), rare: t('Rare', 'Редкое')}[value] ?? value);
  const variant = (value: string) => ({legendry: 'ssr', epic: 'sr', rare: 'r'} as const)[value as 'legendry' | 'epic' | 'rare'];
  const seasonLabel = (index: number) => {
    const label = name(data.seasons.find(entry => entry.index === index)?.name);
    return label || fillText(t('Season index {0}', 'Индекс сезона {0}'), [index]);
  };
  const reset = () => {setQuery(''); setSlot('all'); setQuality('all'); setSeason('all');};
  const slotLabels = (card: HandbookExpansionCard) => card.slots.length
    ? <span className={styles.slotList}>{card.slots.map(id => {
      const entry = data.slots.find(value => value.id === id);
      return <IconLabel key={id} size="sm" icon={entry?.icon} label={name(entry?.name, id)} />;
    })}</span> : <span className={shared.muted}>{t('Installation slot unknown', 'Слот установки неизвестен')}</span>;
  const value = (prop: string, amount: number | null | undefined) => amount == null ? '—'
    : data.attributes[prop]?.percent ? pct(amount, 3) : num(amount, 2);
  const statLabel = (prop: string) => <HandbookStatLabel type={prop} size="sm"
    icon={data.attributes[prop]?.icon} label={name(data.attributes[prop]?.name, prop)} />;
  const allStats = [...new Set(filtered.flatMap(card => card.stats.map(stat => stat.prop)))].sort(compareStats);
  const maxStars = Math.max(0, ...data.cards.map(card => card.maxStars));
  const statControls = <Controls>
    <RangeField compact label={t('Stars', 'Звёзды')} min={0} max={maxStars} value={stars} onChange={setStars} display={`${stars} ★`} />
    <RangeField compact label={t('Player level', 'Уровень игрока')} min={minLevel} max={maxLevel} value={level} onChange={setLevel} />
  </Controls>;
  const modelNote = t('Calculated stats are a model; exact values and rounding still need an in-game comparison.',
    'Статы рассчитаны по модели; точные значения и округление ещё требуют сверки с игрой.');
  const select = (id: string) => {
    setSelectedId(id);
    if (window.matchMedia('(max-width: 760px)').matches) detail.current?.scrollIntoView({block: 'start'});
  };

  const inspector = selected && (() => {
    const count = Math.min(Math.max(1, equipped), Math.max(1, selected.maxSuit));
    const currentStars = Math.min(stars, selected.maxStars);
    const stats = mmoCardStats(selected.stats, currentStars, data.coefficients, level).sort((a, b) => compareStats(a.prop, b.prop));
    const hasScaling = /\{\d+\}/.test(name(selected.description)) && selected.maxSuit > 1
      && selected.params.some(param => param.curve && new Set(param.curve.map(key => key[1])).size > 1);
    return <section ref={detail} id="expansion-detail" aria-label={t('Selected expansion pack', 'Выбранный пакет расширения')}
      className={styles.inspector}>
      <div className={styles.detailHeading}>
        <IconLabel size="lg" icon={selected.icon} label={<h3>{name(selected.name, selected.id)}</h3>}
          iconAction={preview.action(selected.icon, name(selected.name, selected.id))} />
        <GameBadge variant={variant(selected.quality)}>{qualityLabel(selected.quality)}</GameBadge>
      </div>
      <div className={styles.detailSlots}>
        <span className={styles.label}>{t('Installation slots', 'Слоты установки')}</span>
        {slotLabels(selected)}
        {selected.slotEvidence.kind === 'item-description' && <small>{t('From item description', 'По описанию предмета')}</small>}
      </div>
      <p className={styles.metadata}>{seasonLabel(selected.season)}{selected.exclusive ? ` · ${t('Season-exclusive', 'Сезонный эксклюзив')}` : ''}</p>
      {hasScaling && <RangeField compact label={t('Equipped packs', 'Надето пакетов')} min={1} max={selected.maxSuit} value={count} onChange={setEquipped} />}
      <section aria-label={t('Expansion effect', 'Эффект расширения')} className={styles.effectPanel}>
        <GameRichText className={styles.effect} text={fillMmoText(name(selected.description), mmoCardParams(selected.params, count))} />
      </section>
      {selected.item?.useDescription && <section aria-label={t('Item description', 'Описание предмета')} className={styles.description}>
        <h4>{t('Item description', 'Описание предмета')}</h4>
        <GameRichText className={styles.descriptionText} rank={count - 1} text={name(selected.item.useDescription).replace(/\r?\n/g, '<br />')} />
      </section>}
      <div className={styles.statPanel}>
        <span className={styles.label}>{t('Base stats', 'Базовые статы')}</span>
        <RangeField compact label={t('Stars', 'Звёзды')} min={0} max={selected.maxStars} value={currentStars} onChange={setStars} display={`${currentStars} ★`} />
        <RangeField compact label={t('Player level', 'Уровень игрока')} min={minLevel} max={maxLevel} value={level} onChange={setLevel} />
        <dl className={styles.statList}>{stats.map(stat => <div key={stat.prop}>
          <dt>{statLabel(stat.prop)}</dt><dd>{value(stat.prop, stat.value)}</dd>
        </div>)}</dl>
        <Note>{modelNote}</Note>
      </div>
    </section>;
  })();

  return <div className={`info-ui ${shared.block}`}>
    <CatalogControls ariaLabel={t('Expansion pack filters', 'Фильтры пакетов расширения')}>
      <CatalogControls.Top className={styles.searchRow}>
        <div className={styles.searchField}><CatalogControls.Search value={query} onChange={setQuery}
          placeholder={t('Search expansion packs', 'Поиск пакетов расширения')} clearAriaLabel={t('Clear search', 'Очистить поиск')} /></div>
        <span className={styles.sourceAction}>{sourceAction}</span>
      </CatalogControls.Top>
      <CatalogControls.Middle><CatalogControls.Left>
      <ChoiceChips label={t('Slot', 'Слот')} value={slot} onChange={setSlot} options={[
        {value: 'all', label: t('All', 'Все')},
        ...data.slots.map(entry => ({value: entry.id, label: name(entry.name, entry.id), icon: entry.icon})),
        ...(data.coverage.missingSlots.length ? [{value: 'unknown', label: t('Unknown', 'Не определён')}] : []),
      ]} />
      <ChoiceChips label={t('Quality', 'Качество')} value={quality} onChange={setQuality} options={[
        {value: 'all', label: t('All', 'Все')}, ...qualities.map(entry => ({value: entry, label: qualityLabel(entry), variant: variant(entry)})),
      ]} />
      <ChoiceChips label={t('Season', 'Сезон')} value={season} onChange={setSeason} options={[
        {value: 'all', label: t('All', 'Все')}, ...data.seasons.map(entry => ({value: String(entry.index), label: seasonLabel(entry.index)})),
        {value: 'exclusive', label: t('Season-exclusive', 'Сезонные эксклюзивные')},
      ]} />
      </CatalogControls.Left></CatalogControls.Middle>
      <CatalogControls.Bottom>
        <CatalogControls.Counter count={filtered.length} total={data.cards.length} entityLabel={t('packs', 'пакетов')} />
        <CatalogControls.Reset visible={Boolean(query || slot !== 'all' || quality !== 'all' || season !== 'all')}
          onClick={reset} label={t('Reset filters', 'Сбросить фильтры')} />
      </CatalogControls.Bottom>
    </CatalogControls>
    <SubTabs label={t('Expansion pack views', 'Представления пакетов расширения')} tabs={[
      {id: 'catalog', label: t('Catalog', 'Каталог'), content: filtered.length ? <div className={styles.catalog}>
        <div className={styles.grid} role="group" aria-label={t('Expansion packs', 'Пакеты расширения')}>
          {filtered.map(card => <button type="button" key={card.id} className={styles.card} data-quality={card.quality}
            aria-pressed={selected?.id === card.id} aria-controls="expansion-detail" onClick={() => select(card.id)}>
            {card.icon ? <img className={styles.cardIcon} src={gameAsset(card.icon)} alt="" loading="lazy" decoding="async" />
              : <span className={styles.cardIcon} aria-hidden="true" />}
            <span className={styles.cardBody}><strong>{name(card.name, card.id)}</strong>
              <span className={styles.cardQuality}>{qualityLabel(card.quality)}{card.exclusive ? ` · ${t('Exclusive', 'Эксклюзив')}` : ''}</span>
              {slotLabels(card)}
            </span>
          </button>)}
        </div>{inspector}
      </div> : <EmptyState title={t('No packs found', 'Пакеты не найдены')} description={t('Change or reset the filters above.', 'Измените или сбросьте фильтры выше.')} />},
      {id: 'stats', label: t('Base stats', 'Базовые статы'), note: t('Star-row factors × player-level curve.', 'Факторы строки звезды × кривая уровня игрока.'), content: <>
        {statControls}<Note>{modelNote}</Note>
        <HandbookTable compact caption={t('Expansion pack base stats', 'Базовые статы пакетов расширения')}
          columns={[{label: t('Pack', 'Пакет'), width: 260, pinned: true}, ...allStats.map(prop => ({label: statLabel(prop), width: 130}))]}
          rows={filtered.map(card => {
            const stats = new Map(mmoCardStats(card.stats, stars, data.coefficients, level).map(stat => [stat.prop, stat.value]));
            return {key: card.id, cells: [<IconLabel key={card.id} icon={card.icon} label={name(card.name, card.id)} />,
              ...allStats.map(prop => value(prop, stats.get(prop)))]};
          })} />
      </>},
      {id: 'slots', label: t('Slots and stars', 'Слоты и звёзды'), content: <>
        <HandbookTable caption={t('Packs by gear slot', 'Пакеты по слотам гира')}
          columns={[{label: t('Gear slot', 'Слот гира'), width: 170, pinned: true}, {label: t('Packs', 'Пакеты'), width: 70},
            {label: t('Available packs', 'Доступные пакеты'), width: 600, align: 'start'}]}
          rows={data.slots.map(entry => {
            const cards = filtered.filter(card => card.slots.includes(entry.id));
            return {key: entry.id, cells: [<IconLabel key={entry.id} icon={entry.icon} label={name(entry.name, entry.id)} />,
              num(cards.length), cards.map(card => name(card.name, card.id)).join(' · ') || '—']};
          })} />
        <Note>{t('Upgrade amounts are raw values for successive stars; the required material has not been verified. Slot matches from item descriptions are marked below.',
          'Значения улучшения взяты из конфигурации для последовательных звёзд; материал пока не подтверждён. Слоты из описаний предметов отмечены ниже.')}</Note>
        <HandbookTable compact caption={t('Expansion pack slots and upgrades', 'Слоты и улучшения пакетов расширения')}
          columns={[{label: t('Pack', 'Пакет'), width: 240, pinned: true}, {label: t('Installation slots', 'Слоты установки'), width: 340, align: 'start'},
            {label: t('Max stars', 'Макс. звёзд'), width: 100}, {label: t('Upgrade amounts', 'Значения улучшения'), width: 180}]}
          rows={filtered.map(card => ({key: card.id, cells: [<IconLabel key={card.id} icon={card.icon} label={name(card.name, card.id)} />,
            <div key="slots">{slotLabels(card)}{card.slotEvidence.kind === 'item-description' && <small className={styles.evidence}>{t('From item description', 'По описанию предмета')}</small>}</div>,
            `${card.maxStars} ★`, card.upgradeAmounts.map(amount => num(amount)).join(' / ') || '—']}))} />
      </>},
    ]} />
    {preview.lightbox}
  </div>;
}
