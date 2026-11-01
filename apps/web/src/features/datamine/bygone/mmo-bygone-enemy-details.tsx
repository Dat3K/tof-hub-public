'use client';

import {useCallback, useState} from 'react';
import {Lightbox, Modal} from '@tof-hub/ui';
import {gameAsset} from '@tof-hub/game-assets';
import {useSiteHeaderInset} from '@/components/site-shell/use-site-header-inset';
import type {HandbookMmoBygoneData, HandbookMmoBygoneEnemy, HandbookMmoBygoneMedia} from '../contracts/handbook';
import {EnemyDetailsHeader, EnemyPrimaryStats, EnemyElementStats, type CombatStatIcons} from '../components/enemy-combat-details';
import resistanceIcons from '../../../../public/game-data/relic-resistance-icons.json';
import {formatHpG} from './bygone-domain';
import oow from '../oow/oow.module.css';
import {useHandbookText} from '../handbook/sections/handbook-ui';
import styles from './mmo-bygone.module.css';

export type MmoEnemyInspection = {enemy: HandbookMmoBygoneEnemy & {count: number; sourceSlots: number[]}; floor: number; pool: number | null; defenseCurveValue?: number | null; hpScaling?: HandbookMmoBygoneData['rounds'][number]['rounds'][number]['hpScaling']};

export function mmoEnemyCode(inspection: MmoEnemyInspection, identity?: NonNullable<HandbookMmoBygoneMedia['identities']>[string]) {
  return identity?.codeName ?? inspection.enemy.classPath?.split('/').at(-1)?.split('.')[0]
    ?? `pool_${inspection.pool ?? inspection.floor}_slot_${inspection.enemy.sourceSlots.join('_')}`;
}

/** Generated floor HP is separate from source stats and resistance-adjusted EHP. */
export function MmoBygoneEnemyDetails({inspection, media, icons, onClose}: {
  inspection: MmoEnemyInspection; media: Pick<HandbookMmoBygoneMedia, 'identities' | 'portraits'>; icons?: CombatStatIcons; onClose: () => void;
}) {
  const {locale, t, name, num, pct} = useHandbookText();
  const [zoom, setZoom] = useState(false);
  const headerInset = useSiteHeaderInset(!zoom);
  const closeZoom = useCallback(() => setZoom(false), []);
  const {enemy, floor} = inspection;
  const identity = enemy.classPath ? media.identities?.[enemy.classPath] : undefined;
  const portrait = enemy.classPath ? media.portraits[enemy.classPath] : undefined;
  const title = name(identity?.name ?? enemy.name, t('Unidentified enemy', 'Неопределённый противник'));
  const code = mmoEnemyCode(inspection, identity);
  const kind = enemy.type?.endsWith('_BOSS') ? 'boss' : enemy.type?.endsWith('_ELITE') ? 'elite' : 'normal';
  const kindLabel = kind === 'boss' ? t('Boss', 'Босс') : kind === 'elite' ? t('Elite', 'Элитный') : t('Regular', 'Обычный');
  const stats = enemy.stats;
  const defense = enemy.defenseEstimate;
  const value = (input: number | null | undefined) => input != null && Number.isFinite(input) ? num(input, input !== 0 && Math.abs(input) < .01 ? 6 : undefined) : t('Unknown', 'Неизвестно');
  const compact = (input: number | null | undefined) => input != null && Number.isFinite(input)
    ? formatHpG(input, 'hp', 2) : t('Unknown', 'Неизвестно');
  return <>
    <Modal isOpen={!zoom} onClose={onClose} size="lg" ariaLabel={title} viewportTopInset={headerInset}
      className={`${oow.modalCard} ${oow[kind === 'boss' ? 'modalCardBoss' : kind === 'elite' ? 'modalCardElite' : 'modalCardNormal']} ${styles.enemyDialog}`}>
      <EnemyDetailsHeader name={title} kind={kind} kindLabel={kindLabel} onClose={onClose} closeLabel={t('Close enemy details', 'Закрыть карточку противника')}
        portrait={portrait ? <button type="button" className={`${oow.modalBossImg} ${styles.detailPortrait}`} onClick={() => setZoom(true)} aria-label={t('Open enemy artwork', 'Открыть изображение противника')}>
          <img src={gameAsset(portrait.thumbnail)} alt="" onError={event => {event.currentTarget.style.visibility = 'hidden';}} />
        </button> : <span className={`${oow.modalBossImg} ${styles.detailPortrait}`} role="img" aria-label={t('Artwork unavailable', 'Изображение отсутствует')}>?</span>}
        badges={enemy.count > 1 && <span className={oow.modalLevelTag}>×{num(enemy.count)}</span>}
        context={<><span>{t('Blueprint ID', 'Кодовое имя')}: {code}</span><span> · {t('Floor', 'Этаж')} {floor}</span></>}
        stats={[
          {label: t('HP', 'ОЗ'), value: compact(enemy.hp), tone: 'hp'},
          {label: t('Base ATK', 'Базовая атака'), value: value(stats?.attack)},
          {label: t('Base armor', 'Базовая броня'), value: value(stats?.armor), tone: 'resistance'},
        ]} />
      <div className={oow.modalBody}>
        {stats ? <>
          <section aria-label={t('Primary combat stats', 'Основные боевые характеристики')}>
            <EnemyPrimaryStats heading={t('Primary combat stats', 'Основные боевые характеристики')} stats={[
              {label: t('HP after floor buffs', 'ОЗ с бафами этажа'), value: compact(enemy.hp), sub: <>{value(enemy.hp)}<br />{t('Base HP', 'Базовые ОЗ')}: {value(stats.maxHealth)}<br />{t('Floor HP stacks', 'Стаки HP этажа')}: {value(inspection.hpScaling?.stacks)}</>, tone: 'hp', icon: icons?.hp},
              {label: t('Base ATK', 'Базовая атака'), value: value(stats.attack), tone: 'atk', icon: icons?.atk},
              {label: t('Base armor', 'Базовая броня'), value: value(stats.armor), tone: 'armor', icon: icons?.armor},
              {label: t('Crit resistance', 'Сопр. крит. ударам'), value: stats.finalCritDefense != null ? pct(stats.finalCritDefense) : t('Unknown', 'Неизвестно'), tone: 'crit', icon: icons?.crit},
            ]} />
          </section>
          <section aria-label={t('Elemental defense', 'Защита от стихий')}>
            <EnemyElementStats heading={t('Elemental defense', 'Защита от стихий')} context={t('Estimated · floor stacks', 'Оценка · со стаками этажа')}
              stats={([
                ['physical', 'Physical', t('Physical', 'Физическая'), resistanceIcons.phys],
                ['flame', 'Flame', t('Flame', 'Огонь'), resistanceIcons.flame],
                ['frost', 'Frost', t('Frost', 'Лёд'), resistanceIcons.frost],
                ['volt', 'Volt', t('Volt', 'Электричество'), resistanceIcons.volt],
                ['altered', 'Altered', t('Altered', 'Изменённая'), resistanceIcons.altered],
              ] as const).map(([key, element, label, icon]) => ({name: label, element, icon, value: value(defense?.values[key]), sub: `${t('Base DEF', 'Базовый DEF')}: ${value(stats[key])}`}))} />
            <p className={styles.defenseNote}>{t('Floor DEF stacks', 'Стаки защиты этажа')}: <b>{value(defense?.stacks)}</b> · {t('Curve', 'Кривая')}: {value(inspection.defenseCurveValue)}<br />
              {t('Estimate: base DEF + whole stacks. Runtime scaling is unconfirmed.', 'Оценка: базовый DEF + целые стаки. Применение в игре пока не подтверждено.')}</p>
          </section>
        </> : <p className={styles.detailEmpty}>{t('Identity and attributes are unavailable for this enemy.', 'Имя и характеристики этого противника недоступны.')}</p>}
      </div>
    </Modal>
    {portrait && <Lightbox isOpen={zoom} onClose={closeZoom} src={gameAsset(portrait.full)} webpSrc={gameAsset(portrait.full)} alt={title} title={title} downloadName={code} locale={locale} zoomable={false} showPngDownload={false} downloadWebpLabel={t('Download WebP', 'Скачать WebP')} />}
  </>;
}
