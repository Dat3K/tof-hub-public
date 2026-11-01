'use client';

import {useCallback, useState} from 'react';
import {GameRichText, Lightbox, Modal} from '@tof-hub/ui';
import {gameAsset} from '@tof-hub/game-assets';
import {useSiteHeaderInset} from '@/components/site-shell/use-site-header-inset';
import type {HandbookBiochemicalMedia} from '../contracts/handbook';
import {useHandbookText} from '../handbook/sections/handbook-ui';
import {EnemyDetailsHeader, EnemyElementStats, EnemyPrimaryStats, type CombatStatIcons} from '../components/enemy-combat-details';
import {knownEnemyValue, sequentialEnemyKind, sequentialEnemyMedia, sequentialEnemyPortrait, type SequentialEnemy, type SequentialPod} from './mmo-sequential-enemy';
import resistanceIcons from '../../../../public/game-data/relic-resistance-icons.json';
import oow from '../oow/oow.module.css';
import styles from './mmo-sequential.module.css';

/** All values are the pod's exported base fields, rather than OoW-scaled combat values. */
export function MmoSequentialEnemyDetails({pod, enemy, media, icons, onClose}: {
  pod: SequentialPod; enemy: SequentialEnemy; media?: HandbookBiochemicalMedia | null; icons?: CombatStatIcons; onClose: () => void;
}) {
  const {locale, t, name, num, pct} = useHandbookText();
  const [zoom, setZoom] = useState(false);
  const closeZoom = useCallback(() => setZoom(false), []);
  const headerInset = useSiteHeaderInset(!zoom);
  const title = name(enemy.name, t('Unidentified enemy', 'Неопределённый противник'));
  const entry = sequentialEnemyMedia(pod, enemy, media);
  const portrait = sequentialEnemyPortrait(pod, enemy, media);
  const kind = sequentialEnemyKind(enemy);
  const kindLabel = kind === 'boss' ? t('Boss', 'Босс') : kind === 'elite' ? t('Elite', 'Элитный') : t('Regular', 'Обычный');
  const stats = enemy.stats;
  const criticalResistance = knownEnemyValue(stats?.critDefense) ? pct(stats.critDefense) : t('Unknown', 'Неизвестно');
  const value = (input: number | null | undefined) => knownEnemyValue(input) ? num(input) : t('Unknown', 'Неизвестно');
  const compact = (input: number | null | undefined) => knownEnemyValue(input)
    ? new Intl.NumberFormat(locale, {notation: 'compact', maximumFractionDigits: 2}).format(input) : t('Unknown', 'Неизвестно');
  return <>
    <Modal isOpen={!zoom} onClose={onClose} ariaLabel={title} viewportTopInset={headerInset} size="lg"
      className={`${oow.modalCard} ${oow[kind === 'boss' ? 'modalCardBoss' : kind === 'elite' ? 'modalCardElite' : 'modalCardNormal']} ${styles.enemyDialog}`}>
      <EnemyDetailsHeader name={title} kind={kind} kindLabel={kindLabel} onClose={onClose} closeLabel={t('Close enemy details', 'Закрыть карточку противника')}
        portrait={portrait ? <button type="button" className={`${oow.modalBossImg} ${styles.dialogPortrait}`} onClick={() => setZoom(true)} aria-label={t('Open enemy artwork', 'Открыть изображение противника')}>
          <img src={gameAsset(portrait)} data-fit={entry?.portraitFit ?? 'contain'} alt="" />
        </button> : <span className={`${oow.modalBossImg} ${styles.dialogPortrait}`} role="img" aria-label={t('Artwork unavailable', 'Изображение отсутствует')}>?</span>}
        badges={<>{enemy.level != null && <span className={oow.modalLevelTag}>{t('Lv.', 'Ур.')} {num(enemy.level)}</span>}{enemy.count != null && <span className={oow.modalLevelTag}>×{num(enemy.count)}</span>}</>}
        context={<>{name(pod.name, pod.id)} · {t('Wave', 'Волна')} {enemy.wave}</>}
        stats={[
          {label: t('Base HP', 'Базовые ОЗ'), value: compact(stats?.maxHealth), tone: 'hp'},
          {label: t('Base ATK', 'Базовая атака'), value: value(stats?.attack)},
          {label: t('Base armor', 'Базовая броня'), value: value(stats?.armor), tone: 'resistance'},
        ]} />
      <div className={oow.modalBody}>
        <p className={styles.enemyStatNote}>{t('Exported base attributes before level, difficulty and combat effects.', 'Исходные базовые характеристики до масштабирования уровня, сложности и боевых эффектов.')}</p>
        <section aria-label={t('Primary combat stats', 'Основные боевые характеристики')}>
          <EnemyPrimaryStats heading={t('Primary combat stats', 'Основные боевые характеристики')} stats={[
            {label: t('Base HP', 'Базовые ОЗ'), value: compact(stats?.maxHealth), sub: value(stats?.maxHealth), tone: 'hp', icon: icons?.hp},
            {label: t('Base ATK', 'Базовая атака'), value: value(stats?.attack), tone: 'atk', icon: icons?.atk},
            {label: t('Base armor', 'Базовая броня'), value: value(stats?.armor), sub: 'ArmorBase', tone: 'armor', icon: icons?.armor},
            {label: t('Crit resistance', 'Сопр. крит. ударам'), value: criticalResistance, tone: 'crit', icon: icons?.crit},
          ]} />
        </section>
        <section aria-label={t('Base elemental defense', 'Базовая защита от стихий')}>
          <EnemyElementStats heading={t('Base elemental defense', 'Базовая защита от стихий')} context={t('Raw DEF values', 'Исходные значения защиты')}
            stats={([
              ['physical', 'Physical', t('Physical', 'Физическая'), resistanceIcons.phys],
              ['flame', 'Flame', t('Flame', 'Огонь'), resistanceIcons.flame],
              ['frost', 'Frost', t('Frost', 'Лёд'), resistanceIcons.frost],
              ['volt', 'Volt', t('Volt', 'Электричество'), resistanceIcons.volt],
              ['altered', 'Altered', t('Altered', 'Изменённая'), resistanceIcons.altered],
            ] as const).map(([key, element, label, icon]) => ({name: label, element, icon, value: value(stats?.resistances[key]), sub: 'DEF'}))} />
        </section>
        {pod.buffs.length > 0 && <section className={oow.modalMechanicsSection} aria-label={t('Culture Pod effects', 'Эффекты инкубатора')}>
          <div className={oow.modalMechanicsHeader}><div className={oow.modalMechanicsTitleGroup}>
            <h3 className={oow.modalMechanicsTitle}>{t('Culture Pod effects', 'Эффекты инкубатора')}</h3><span className={oow.modalMechanicsBadge}>{pod.buffs.length}</span>
          </div></div>
          <div className={oow.modalMechanicsList}>{pod.buffs.map((buff, index) => <div className={oow.modalMechanicsItem} key={buff.id}>
            <span className={oow.modalMechanicsNum}>{index + 1}.</span><div className={oow.modalMechanicsText}>
              <strong>{name(buff.name, buff.id)}</strong><GameRichText density="compact" text={name(buff.description)} />
            </div>
          </div>)}</div>
        </section>}
      </div>
    </Modal>
    {portrait && <Lightbox isOpen={zoom} onClose={closeZoom} src={gameAsset(portrait)} webpSrc={gameAsset(portrait)} alt={title} title={title}
      locale={locale} showPngDownload={false} downloadName={entry?.source?.actorKey ?? enemy.attributeId ?? pod.id} downloadWebpLabel={t('Download WebP', 'Скачать WebP')} />}
  </>;
}
