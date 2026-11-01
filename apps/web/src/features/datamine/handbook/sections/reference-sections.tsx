'use client';
import { fillText } from '@/lib/i18n/text';

import React, { useMemo, useState } from 'react';
import { Tooltip } from '@tof-hub/ui';

import type { HandbookCsData, HandbookServer } from '../../contracts/handbook';
import { curveValue, serverForUid, serversByTab, type ServerGroup } from '../handbook-domain';
import { ChoiceChips, Controls, HandbookTable, IconLabel, Note, SubTabs, useHandbookText } from './handbook-ui';
import styles from './sections.module.css';
import { HandbookStatLabel, useHandbookStatPresentation } from '../handbook-stat-presentation';

export function CsSection({ data }: { data: HandbookCsData }) {
  const { compareStats, compareTitan } = useHandbookStatPresentation();
  const { t, name, num, pct } = useHandbookText();
  const computing = data.systems.supercomputer[0];
  const attributeName = (type: string) => {
    const attribute = data.attributes.find((a) => a.type === type);
    return attribute ? `${name(attribute.name, type)}${type.endsWith('%') ? ' %' : ''}` : type;
  };
  // Fixed DMG% weight per fraction 1.0 (AttributeStaticDataTable via csRules); content modules borrow it.
  const dmgWeight = data.attributes.find((a) => a.base === 'fixedPercent' && a.type.endsWith('Damage %'))?.weight ?? 0;
  const supportRows = data.systems.spaceSupport.map((module) => ({
    id: module.id,
    max: module.levels.at(-1),
  }));

  const weights = (
    <>
      <div className={styles.formulaExplanation}>
        <strong className={styles.formulaEquation}>{t('CS = Σ (stat value × weight) + Titan property CS', 'CS = Σ (значение стата × вес) + CS свойства Titan')}</strong>
        <div><strong>{t('Percent stats. ', 'Процентные статы. ')}</strong>{t('Multiply the weight by the percentage and its base. HP%, RES% and ATK% use the matching flat stat; Crit Rate% and DMG% use a fixed base of 1.', 'Умножаем вес на процент и его базу. ОЗ%, сопротивление% и АТК% используют соответствующий плоский стат; шанс крита% и урон% — фиксированную базу 1.')}</div>
        <div><strong>{t('Titan.', 'Titan.')} </strong>{t('The rare property adds a separate CS contribution based on its level on this item.', 'Редкое свойство даёт отдельный вклад в CS по своему уровню на этой вещи.')}</div>
      </div>
      <HandbookTable
        compact="dense"
        caption={t('Attribute weights', 'Веса атрибутов')}
        columns={[{ label: t('Stat', 'Стат') }, { label: t('Weight', 'Вес') }, { label: t('Base', 'База') },
          { label: t('Example', 'Пример') }, { label: t('Example CS', 'CS примера') }]}
        rows={[...data.attributes].sort((a, b) => compareStats(a.type, b.type)).map((a) => {
          // Round illustrative inputs, not game defaults or player stats.
          const amount = a.base ? 0.1 : 1000;
          const base = a.base && a.base !== 'fixedPercent' ? 10000 : 1;
          const example = a.base ? '10%' : num(amount);
          const cs = amount * base * a.weight;
          const calculation = `${example}${base !== 1 ? ` × ${num(base)}` : ''} × ${num(a.weight, 3)} = ${num(cs)} ${t('CS', 'CS')}`;
          return {
            key: a.type,
            cells: [<HandbookStatLabel key="a" type={a.type} icon={a.icon} label={attributeName(a.type)} />, num(a.weight, a.weight < 1 && a.weight > 0 ? 3 : undefined),
              a.base === 'fixedPercent' ? t('fixed', 'фикс.') : a.base ? attributeName(a.base) : '—',
              `+${example}`,
              <Tooltip key="example" portal content={<div className={styles.propertyDescription}>
                <strong>{attributeName(a.type)}: +{example}</strong>
                {a.base && a.base !== 'fixedPercent' && <span>{t('Example base before percentages', 'Условная база до процентов')}: {num(base)} {attributeName(a.base)}.</span>}
                {a.base === 'fixedPercent' && <span>{t('This stat uses a fixed base of 1.', 'Для этого стата используется фиксированная база 1.')}</span>}
                <span className={styles.formulaEquation}>{calculation}</span>
                <span>{t('Illustrative values; actual CS uses your build’s base stats.', 'Условный пример; реальный CS использует базы вашего билда.')}</span>
              </div>}><span tabIndex={0} className={styles.ruleHint}>{num(cs)}</span></Tooltip>],
          };
        })}
      />
    </>
  );

  const titan = (
    <HandbookTable
      compact="dense"
      caption={t('Titan rare property weights', 'Веса редких свойств Titan')}
      columns={[{ label: t('Property', 'Свойство') }, { label: t('Weight', 'Вес') },
        ...[1, 18].flatMap(level => [{ label: fillText(t('Lv. {0}', 'Ур. {0}'), [level]) }, { label: fillText(t('CS at Lv. {0}', 'CS на ур. {0}'), [level]) }]) ]}
      rows={[...data.titanRare].sort((a, b) => compareTitan(a.id, b.id)).map((r) => ({ key: r.id, cells: [
        <HandbookStatLabel key="r" type={r.id} kind="titan" icon={r.icon} label={name(r.name, r.id)} />, num(r.weight),
        ...[1, 18].flatMap(level => {
          const value = curveValue(r.values, level);
          if (value === null) return ['—', '—'];
          const cs = value * r.weight;
          return [pct(value, 3), <Tooltip key={level} portal content={<div className={styles.propertyDescription}>
            <strong>{name(r.name, r.id)} · {fillText(t('Lv. {0}', 'Ур. {0}'), [level])}</strong>
            <span className={styles.formulaEquation}>{pct(value, 3)} × {num(r.weight)} = {num(cs)} {t('CS', 'CS')}</span>
            <span>{t('Uses the game’s displayed property value, as in Tools Build. This is the contribution of one item’s property level.', 'Используется отображаемое игровое значение, как в Tools Build. Это вклад свойства одной вещи на указанном уровне.')}</span>
          </div>}><span tabIndex={0} className={styles.ruleHint}>{num(cs)}</span></Tooltip>];
        }),
      ] }))}
    />
  );

  const systems = (
    <>
      <div className={styles.columns}>
        <div className={styles.block}>
          {computing && (
            <>
              <HandbookTable
                compact
                caption={t('Supercomputer CS', 'CS суперкомпьютера')}
                columns={[{ label: t('Supercomputer', 'Суперкомпьютер') }, { label: t('CS', 'CS') }]}
                rows={computing.levels.filter((l) => l.level % 5 === 0 || l.level === 1).map((l) => ({ key: String(l.level), cells: [num(l.level),
                  <Tooltip key="cs" portal content={<div className={styles.propertyDescription}>
                    <strong>{fillText(t('Supercomputer · Lv. {0}', 'Суперкомпьютер · ур. {0}'), [l.level])}</strong>
                    <span className={styles.formulaEquation}>5 × {pct(l.cs / 5 / dmgWeight, 1)} × {num(dmgWeight)} = {num(l.cs)} {t('CS', 'CS')}</span>
                    <span>{t('DMG% of five elements with a fixed base; the same for every node. The node’s ATK% / RES%, healing and Shatter are not scored: weighting ATK% / RES% by the build’s bases exceeds the unexplained remainder of captured total CS.', 'Урон% пяти стихий с фиксированной базой; одинаков для всех узлов. АТК% / сопротивление%, лечение и разрушение щита узла не оцениваются: при взвешивании АТК% / сопротивления% по базам билда они превышают необъяснённый остаток итогового CS захватов.')}</span>
                  </div>}><span tabIndex={0} className={styles.ruleHint}>{num(l.cs, 0)}</span></Tooltip>] }))}
              />
            </>
          )}
          <HandbookTable
            compact
            caption={t('Suppressor CS', 'CS супрессора')}
            columns={[{ label: t('Suppressor', 'Супрессор') }, { label: t('CS', 'CS') }]}
            rows={data.systems.suppressor.filter((s, i, all) => s.cs > 0 && (s.row.endsWith('_5') || i === all.length - 1)).map((s) => ({
              key: s.row, cells: [`V${Number(s.row.split('_')[0])}.${s.row.split('_')[1]}`, num(s.cs, 0)],
            }))}
          />
        </div>
        <HandbookTable
          compact
          caption={t('Space Support CS', 'CS Space Support')}
          columns={[{ label: t('Space Support module', 'Модуль Space Support') }, { label: t('Max. level CS', 'CS на макс. уровне') }]}
          rows={supportRows.map((m) => ({ key: m.id, cells: [<IconLabel key="m" icon={data.spaceSupportIcons[m.id]} label={name(data.spaceSupportNames[m.id], m.id)} />,
            !m.max ? '—' : !m.max.estimate ? num(m.max.cs, 0) : <Tooltip key="estimate" portal content={<div className={styles.propertyDescription}>
              <strong>{name(data.spaceSupportNames[m.id], m.id)} · {fillText(t('Lv. {0}', 'Ур. {0}'), [m.max.level])}</strong>
              <span>{t('A content-specific final DMG buff: twice the DMG of a base DMG module of the same level.', 'Бафф финального урона для отдельного режима: вдвое больше урона базового модуля урона того же уровня.')}</span>
              <span className={styles.formulaEquation}>{pct(m.max.cs / dmgWeight, 0)} × {num(dmgWeight)} = {num(m.max.cs)} {t('CS', 'CS')}</span>
              <span>{t('The game weight of this attribute is zero, so the DMG% weight is a model assumption. It fits captured total CS but has no paired measurement.', 'Игровой вес этого атрибута равен нулю, поэтому вес урона% — допущение модели. Оно согласуется с итоговым CS захватов, но не проверено парным замером.')}</span>
            </div>}><span tabIndex={0} className={styles.ruleHint}>{num(m.max.cs, 0)}</span></Tooltip>] }))}
        />
      </div>
    </>
  );

  return (
    <SubTabs label={t('Combat Score', 'Боевой рейтинг')} tabs={[
      { id: 'weights', label: t('Formula and weights', 'Формула и веса'), content: weights },
      { id: 'titan', label: t('Titan properties', 'Свойства Titan'), content: titan },
      { id: 'systems', label: t('Other systems', 'Другие системы'), content: systems,
        note: t('CS from numeric attributes of each level, as in Tools Build. Supercomputer ATK% and RES% are not scored; dashed content-module values are estimates.', 'CS по числовым атрибутам уровня, как в Tools Build. АТК% и сопротивление% суперкомпьютера не оцениваются; пунктирные значения модулей режимов — оценки.') },
    ]} />
  );
}

const GROUPS: { id: ServerGroup; label: [string, string] }[] = [
  { id: 'global', label: ['Global', 'Global'] },
  { id: 'korea', label: ['Korea', 'Корея'] },
  { id: 'taiwan', label: ['Taiwan', 'Тайвань'] },
  { id: 'ps', label: ['PlayStation', 'PlayStation'] },
  { id: 'warp', label: ['Warp', 'Warp'] },
  { id: 'china', label: ['China', 'Китай'] },
];

export function ServersSection({ data }: { data: HandbookServer[] }) {
  const { t } = useHandbookText();
  const [group, setGroup] = useState<ServerGroup>('global');
  const [uid, setUid] = useState('');
  const visibleServers = useMemo(() => data.filter(server => server.kind !== 'test'), [data]);
  const match = useMemo(() => serverForUid(visibleServers, uid), [visibleServers, uid]);
  const tabs = serversByTab(data, group);
  const columns = tabs.flatMap(({tab, servers}) => {
    if (tabs.length !== 1 || servers.length <= 30) return [{title: tab, servers}];
    const size = Math.ceil(servers.length / 5);
    return Array.from({length: Math.ceil(servers.length / size)}, (_, index) => ({
      title: `${tab} · ${index * size + 1}–${Math.min((index + 1) * size, servers.length)}`,
      servers: servers.slice(index * size, (index + 1) * size),
    }));
  });
  const groups = GROUPS.filter((g) => serversByTab(data, g.id).length);

  return (
    <div className={styles.block}>
      <Note>{t('The first digits of a UID are the server ID.', 'Первые цифры UID — это ID сервера.')}</Note>
      <div className={styles.serverToolbar}>
        <ChoiceChips label={t('Servers', 'Серверы')} value={group} onChange={setGroup} options={groups.map((g) => ({ value: g.id, label: t(...g.label) }))} />
        <label className={`${styles.field} ${styles.serverSearch}`}>
          UID
          <input type="text" inputMode="numeric" value={uid} placeholder="120010000000" onChange={(event) => {
            setUid(event.target.value);
            const found = serverForUid(visibleServers, event.target.value);
            if (found) setGroup(GROUPS.find((g) => serversByTab([found], g.id).length)?.id ?? 'global');
          }} />
        </label>
      </div>
        {uid.replace(/\D/g, '').length >= 5 && <p className={styles.note} aria-live="polite">
          {uid.replace(/\D/g, '').length >= 5
            ? match ? <><strong>{match.name}</strong> · {match.tab} · ID {match.id}</> : t('No server with this ID prefix.', 'Сервера с таким префиксом ID нет.')
            : t('Enter a UID to find its server.', 'Введите UID, чтобы найти сервер.')}
        </p>}
      <div className={styles.serverColumns}>
        {columns.map(({ title, servers }) => (
          <HandbookTable
            key={title}
            compact="dense"
            caption={title}
            heading={<h3 className={styles.serverHeading} data-region={servers[0]?.regionCode}>{title}</h3>}
            columns={[{ label: t('Server name', 'Название сервера') }, { label: 'ID' }]}
            rows={servers.map((server) => ({ key: server.id, highlight: server.id === match?.id, cells: [server.name, server.id] }))}
          />
        ))}
      </div>
    </div>
  );
}
