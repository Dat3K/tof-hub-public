'use client';

import { localized } from '@tof-hub/i18n';
import { type Locale } from '@tof-hub/i18n';
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { InfoCard, InfoRow, InfoRows, RulePoint, SectionHeading, ToolInfoModal } from '@/components/tool-rail/tool-info-modal';
import type { HandbookSectionId } from '../contracts/handbook';
import type { HandbookCopy } from './handbook-copy';
import styles from './handbook.module.css';

type Rule = [title: string, text: string];

/** How each section turns the source tables into what the page shows (docs/game-data/README.md). */
const METHOD: Record<HandbookSectionId, { en: Rule[]; ru: Rule[] }> = {
  expansion: {
    en: [
      ['Catalog.', 'The MMO equipment asset binds the card, slot, star-attribute and coefficient tables. Every exported card is retained, including historical and season-exclusive entries. Season indexes are not proof of current availability.'],
      ['Installation slots.', 'OwnSlotDatas is joined to the slot configuration by enum. When it is NONE, the source item description is matched to the source slot labels; these cards are marked “From item description”. Unknown or ambiguous slots stay unavailable.'],
      ['Effects.', 'Text parameters use Value × curve(number of equipped cards). Card stars do not select another effect curve in the export. Buff behavior and stacking are not simulated.'],
      ['Base stats.', 'Star-row factors × the level coefficient curve. Item descriptions state that stats scale with player level; numerical results and display rounding remain a model awaiting an in-game comparison. Upgrade amounts are shown as configured, with their material semantics unverified.'],
    ],
    ru: [
      ['Каталог.', 'MMO equipment asset связывает таблицы карт, слотов, статов по звёздам и коэффициентов. Сохраняются все карты выгрузки, включая исторические и сезонно-эксклюзивные. Индекс сезона не доказывает текущую доступность.'],
      ['Слоты установки.', 'OwnSlotDatas соединяется с конфигурацией слотов по enum. Для NONE исходное описание предмета сопоставляется с исходными названиями слотов; такие карты помечены «По описанию предмета». Неизвестные и неоднозначные слоты не подставляются.'],
      ['Эффекты.', 'Параметры текста = Value × кривая(число надетых карт). Звёзды карты не выбирают другую кривую эффекта в экспорте. Поведение бафов и стакание не симулируются.'],
      ['Базовые статы.', 'Факторы строки звезды × кривая коэффициента уровня. Описание предмета указывает рост с уровнем игрока; численные значения и округление остаются моделью до сверки с игрой. Значения улучшения показаны как в конфигурации; смысл материалов не подтверждён.'],
    ],
  },
  'random-stats': {
    en: [
      ['Ranges.', 'Base value, minimum and maximum roll per quality come from RandomPropDataTable (PropInitValue, PropMinValue, PropMaxValue). Percent stats are stored as fractions.'],
      ['Totals.', 'Average at 5 rolls = base + 5 × (min + max) / 2; maximum = base + 5 × max. The Gold rows are checked against the reference Stat ranges table on every run.'],
      ['Chances by slot.', 'Each item names its pool (EquipmentDataTable → RandomModifyData). One draw uses positive weights; -1 marks a guaranteed stat.'],
      ['Whole-item model.', 'On item / Without stat are exact calculations for four weighted draws without replacement. Guaranteed stats occupy slots first. The engine sampling algorithm and per-quality slot counts are not independently verified; these columns describe the stated four-stat model, not measured drop rates.'],
    ],
    ru: [
      ['Диапазоны.', 'База, минимальный и максимальный прок по качеству — из RandomPropDataTable (PropInitValue, PropMinValue, PropMaxValue). Процентные статы хранятся долями.'],
      ['Итоги.', 'Среднее за 5 проков = база + 5 × (мин. + макс.) / 2; максимум = база + 5 × макс. Gold-строки сверяются с эталонной таблицей диапазонов при каждом запуске.'],
      ['Шансы по слотам.', 'Каждая вещь указывает свой пул (EquipmentDataTable → RandomModifyData). Один выбор считается по положительным весам; -1 обозначает гарантированный стат.'],
      ['Модель готовой вещи.', '«Есть на вещи» / «Нет на вещи» — точный расчёт модели четырёх выборов по весам без повторов. Гарантированные статы занимают места первыми. Алгоритм движка и число строк для каждого качества отдельно не подтверждены: это расчёт указанной модели четырёх статов, а не измеренная частота дропа.'],
    ],
  },
  titan: {
    en: [
      ['Rare properties.', 'EquipUncommonModifyData: each entry becomes available once the augmentation count reaches TupoCountLimited; chance = Weight / sum of available weights.'],
      ['Roll chance.', 'EquipUncommonRateData.UncommonRate per augmentation-count row; counts between rows are not confirmed.'],
      ['Main-stat growth.', 'EquipRandomModifyData.TupoAddABSValueMap: five weighted bands per count; expected value assumes a uniform value inside a band.'],
      ['Added stats.', 'The ideal rule derived from captured items and used on the Tools pages (build-reference titanGrowth).'],
    ],
    ru: [
      ['Редкие свойства.', 'EquipUncommonModifyData: запись становится доступной, когда счётчик улучшений достигает TupoCountLimited; шанс = Weight / сумма доступных весов.'],
      ['Шанс выбора.', 'EquipUncommonRateData.UncommonRate по строкам счётчика; значения между строками не подтверждены.'],
      ['Рост основных статов.', 'EquipRandomModifyData.TupoAddABSValueMap: пять взвешенных диапазонов на счётчик; ожидаемое значение считает значение равномерным внутри диапазона.'],
      ['Добавленные статы.', 'Правило идеала, выведенное по захваченным вещам и используемое на страницах Tools (titanGrowth в build-reference).'],
    ],
  },
  cs: {
    en: [
      ['Weights.', 'AttributeStaticDataTable weight of every attribute, as used by the Build card CS rules.'],
      ['Other systems.', 'Weighted numeric attributes of each Supercomputer, Space Support and Suppressor level; buff-only effects are not scored and this is not proof of the native total.'],
    ],
    ru: [
      ['Веса.', 'Вес каждого атрибута из AttributeStaticDataTable, как в правилах CS Build card.'],
      ['Другие системы.', 'Взвешенные числовые атрибуты каждого уровня суперкомпьютера, Space Support и супрессора; эффекты-баффы не оцениваются, это не доказательство полного CS игры.'],
    ],
  },
  enhancement: {
    en: [
      ['Cost.', 'EquipStrengthenDataTable row N is the price of reaching +N (NeedItems, NeedGolds); a range is the sum of its rows.'],
      ['Main stats.', 'Base stats plus EquipStrengthenEffectPack growth and the stats unlocked every five levels, truncated like in the game.'],
      ['Success chance.', 'DT_EquipStrengthenSuccessRate has no rows in this export, so no chance is shown.'],
    ],
    ru: [
      ['Стоимость.', 'Строка N таблицы EquipStrengthenDataTable — цена получения +N (NeedItems, NeedGolds); диапазон — сумма строк.'],
      ['Основные статы.', 'Базовые статы плюс прирост EquipStrengthenEffectPack и статы, открываемые каждые пять уровней, с усечением как в игре.'],
      ['Шанс успеха.', 'В DT_EquipStrengthenSuccessRate этого экспорта нет строк, поэтому шанс не показан.'],
    ],
  },
  supercomputer: {
    en: [['Clicks.', 'EquipSlotEvolution tables: experience per level, click outcomes with weights and eligible experience ranges; expected clicks assume excess experience is lost.']],
    ru: [['Клики.', 'Таблицы EquipSlotEvolution: опыт уровня, исходы клика с весами и диапазонами опыта; ожидаемые клики считают, что лишний опыт сгорает.']],
  },
  suppressor: {
    en: [
      ['Versions.', 'Global and MMO DT_Suppressor rows: a row is the version you get, its cost fields are the price from the previous version; totals are cumulative.'],
      ['MMO combat buffs.', 'DT_Suppressor_MMO.SuppressorEffect is joined by row key to DT_SuppressorEffect_MMO.SuppressorEffect[]. Level bounds and damage multipliers are kept as stored; multiplier fractions are displayed as percentages. The table-key join is explicit in the fields, though the effect table is not a BP property binding.'],
    ],
    ru: [
      ['Версии.', 'Строки Global и MMO DT_Suppressor: строка — получаемая версия, поля цены задают переход с предыдущей; итоги накопительные.'],
      ['Боевые бафы MMO.', 'DT_Suppressor_MMO.SuppressorEffect соединяется по ключу строки с DT_SuppressorEffect_MMO.SuppressorEffect[]. Границы уровней и множители урона сохраняются как в raw; доли множителей отображаются в процентах. Связь по ключу явно задана в полях, но таблица эффектов не является BP property binding.'],
    ],
  },
  brainfield: {
    en: [
      ['Node and skill data.', 'DA_PlayerTalent binds the MMO config and group tables. Group membership sets order and maximum levels; every level row retains its direct additive stat, unlock requirements, item costs, and buff reference.'],
      ['Graph.', 'The 55 node widgets and 45 connection widgets in the static UMG tree provide panel placement and endpoint IDs. This is configured layout, not proof of runtime unlock or ownership state.'],
      ['Display values.', 'Raw fractional attributes remain unchanged and are formatted by the page. Screenshot integers such as 29,030 from 29,030.4 do not establish the client rounding rule.'],
      ['Special effects.', 'BuffObject and the localized descriptions are linked per level. Custom event behavior, stacking, and season gating are not computed from the buff assets.'],
    ],
    ru: [
      ['Данные узлов и навыков.', 'DA_PlayerTalent связывает MMO-таблицы конфигурации и групп. Состав группы задаёт порядок и максимальный уровень; для каждой строки уровня сохраняются прямой аддитивный стат, требования разблокировки, материалы и ссылка на баф.'],
      ['Граф.', '55 виджетов узлов и 45 виджетов соединений в статическом UMG-дереве задают панель, размещение и ID концов связей. Это конфигурация интерфейса, а не состояние разблокировки или владения игрока.'],
      ['Отображение значений.', 'Сырые дробные значения статов не изменяются; форматирование выполняет страница. Целые значения со скриншота, например 29 030 из 29 030,4, не доказывают правило округления клиента.'],
      ['Особые эффекты.', 'BuffObject и локализованные описания связаны с каждым уровнем. Поведение событий, накопление и сезонные ограничения по данным buff assets не вычисляются.'],
    ],
  },
  'space-support': {
    en: [
      ['Costs.', 'DT_OuterSpaceSupportModule: the row with Key = current level gives the price of the next level.'],
      ['System levels.', 'DT_OuterSpaceSupportSystemLevel: MaxModuleLevel, NeedAllModuleLevel (checked on base modules, as in legacy) and RollBackCD.'],
    ],
    ru: [
      ['Стоимость.', 'DT_OuterSpaceSupportModule: строка с Key = текущий уровень даёт цену следующего.'],
      ['Уровни системы.', 'DT_OuterSpaceSupportSystemLevel: MaxModuleLevel, NeedAllModuleLevel (проверяется по базовым модулям, как в legacy) и RollBackCD.'],
    ],
  },
  'combat-formulas': {
    en: [
      ['Crit.', 'CritFormula curves give the denominator D for each enemy level; chance = Crit / D.'],
      ['Resistance.', 'DefenceFormula curves give K for each level; reduction = RES / (RES + K). Ignore and shred follow the documented community model.'],
    ],
    ru: [
      ['Крит.', 'Кривые CritFormula дают знаменатель D для каждого уровня врага; шанс = Крит / D.'],
      ['Сопротивление.', 'Кривые DefenceFormula дают K для каждого уровня; снижение = СОПР / (СОПР + K). Игнор и срез — по задокументированной модели сообщества.'],
    ],
  },
  servers: {
    en: [['Servers.', 'The official server list the PC launcher downloads, plus China and Taiwan snapshots; the first digits of a UID are the server ID.']],
    ru: [['Серверы.', 'Официальный список серверов, который скачивает лаунчер ПК, плюс снимки Китая и Тайваня; первые цифры UID — ID сервера.']],
  },
};

/** "?" in a section header: opens the shared tool explanation dialog with the method and the data's source files. */
export function SourceInfo({ id, sources, copy, locale, portal = false }: { id: HandbookSectionId; sources: string[]; copy: HandbookCopy; locale: Locale; portal?: boolean }) {
  const [open, setOpen] = useState(false);
  const raw = sources.filter((source) => !source.startsWith('game-data/'));
  const fileName = (source: string) => source.split('/').pop()!.replace(/\.json$/, '');
  const dialog = <ToolInfoModal
        isOpen={open}
        onClose={() => setOpen(false)}
        eyebrow={`${copy.eyebrow} · ${copy.sections[id].nav}`}
        title={copy.sourceTitle}
        intro={copy.sourceIntro}
        closeLabel={copy.close}
      >
        <InfoCard>
          <SectionHeading>{copy.methodTitle}</SectionHeading>
          <ul className="mt-3 space-y-2 text-xs leading-relaxed text-slate-400 [overflow-wrap:anywhere]">
            {localized(METHOD[id], locale).map(([title, text]) => <RulePoint key={title} title={title} text={text} />)}
          </ul>
        </InfoCard>
        {raw.length > 0 && (
          <InfoCard>
            <SectionHeading>{copy.rawFilesTitle}</SectionHeading>
            <InfoRows>
              {raw.map((source) => <InfoRow key={source} title={fileName(source)}>{source}</InfoRow>)}
            </InfoRows>
          </InfoCard>
        )}
      </ToolInfoModal>;
  return <>
    <button type="button" className={styles.sourceButton} aria-label={copy.sourceTitle} aria-haspopup="dialog" onClick={() => setOpen(true)}>?</button>
    {portal ? open && createPortal(dialog, document.body) : dialog}
  </>;
}
