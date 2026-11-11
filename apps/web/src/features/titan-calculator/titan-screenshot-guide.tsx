import type { CSSProperties, ReactNode } from 'react';
import type { Locale } from '@tof-hub/i18n';
import { Tabs } from '@tof-hub/ui';
import { InfoCard, SectionHeading, ToolInfoModal } from '@/components/tool-rail/tool-info-modal';
import { fillText, localeText } from '@/lib/i18n/text';
import { categoryLabel } from './damage-labels';
import { DAMAGE_CATEGORIES, titanStatsByLevel, type TitanLevels } from './model';
import { formatDamageValue, parseDamageTable } from './parse-table';
import { EXAMPLE_TITAN, EXAMPLE_WEAPONS } from './titan-example';
import { TitanStatLabel, type TitanStatInfo } from './titan-stat-label';
import { TITAN_SCREENSHOT_MAX_MB } from './use-screenshot-import';
import styles from './titan-help.module.css';

type Text = ReturnType<typeof localeText>;
type Box = readonly [x: number, y: number, width: number, height: number];
type Screenshot = { file: string; width: number; height: number };
type Annotation = { title: string; description: string; boxes: readonly Box[] };

const weapon = EXAMPLE_WEAPONS[0];
const weaponScreenshot = { file: weapon.image, width: 516, height: 321 };
const gameTitanScreenshot = { file: 'worn-titan.webp', width: 482, height: 370 };
const weaponReadout = parseDamageTable(weapon.table);
const readDamage = (value: number | null | undefined) => value == null ? '—' : formatDamageValue(value);
const totalRow: Box = [140, 231, 366, 34];

export const titanScreenshotGuideTitle = (t: Text) => t('Screenshot examples', 'Примеры скриншотов');

export function TitanScreenshotGuide({ locale, stats, onClose }: { locale: Locale; stats: TitanStatInfo; onClose: () => void }) {
  const t = localeText(locale);
  return (
    <ToolInfoModal isOpen onClose={onClose} eyebrow={t('Titan calculator', 'Калькулятор титанки')}
      title={titanScreenshotGuideTitle(t)} closeLabel={t('Close')}
      intro={t('Use the numbered regions as a reference when taking your own screenshots.',
        'При съёмке своего скриншота ориентируйтесь на пронумерованные области.')}>
      <Tabs defaultValue="weapon" className={styles.tabs}>
        <Tabs.List variant="underline" className={styles.tabList} aria-label={t('Screenshot types', 'Виды скриншотов')}>
          <Tabs.Trigger value="weapon">{t('Weapon damage', 'Урон по оружию')}</Tabs.Trigger>
          <Tabs.Trigger value="game-titan">{t('In-game Titan', 'Титанка в игре')}</Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="weapon" className={styles.panel}>
          <InfoCard className={styles.sampleCard}>
            <ScreenshotExample screenshot={weaponScreenshot}
              title={t('Capture one table per weapon', 'Снимите таблицу каждого оружия')}
              alt={t('The in-game Total DMG screen with Rosebud selected', 'Экран Total DMG в игре, выбрано оружие Rosebud')}
              note={fillText(t('Use a sharp PNG, JPEG or WebP up to {0} MB. Keep the marked fields readable.',
                'Подойдёт чёткий PNG, JPEG или WebP до {0} МБ. Оставьте выделенные поля читаемыми.'), [TITAN_SCREENSHOT_MAX_MB])}
              annotations={[
                {
                  title: t('Selected weapon', 'Выбранное оружие'),
                  description: t('The weapon list and the Total DMG summary help match the screenshot to a card.',
                    'Список оружия и сводка Total DMG помогают подобрать нужную карточку.'),
                  boxes: [[4, 49, 130, 51]],
                },
                {
                  title: t('Final DMG', 'Итог. урон'),
                  description: t('The five values here feed the calculation. Base DMG and Multiplier help check the rows.',
                    'Пять значений отсюда идут в расчёт. Базовый урон и множитель помогают сверить строки.'),
                  boxes: [[311, 52, 98, 178]],
                },
                {
                  title: t('Total', 'Всего'),
                  description: t('The reader checks the sum of the five rows against this total.',
                    'Калькулятор сверяет сумму пяти строк с этим итогом.'),
                  boxes: [totalRow],
                },
              ]}
            />
            <ExampleReadout title={t('Recognized Final DMG in this example', 'Распознанный итоговый урон в этом примере')} values={[
              ...DAMAGE_CATEGORIES.map(category => ({ label: categoryLabel(category, t), value: readDamage(weaponReadout.rows[category]?.final) })),
              { label: t('Total', 'Всего'), value: readDamage(weaponReadout.total) },
            ]} />
          </InfoCard>
        </Tabs.Content>

        <Tabs.Content value="game-titan" className={styles.panel}>
          <InfoCard className={styles.sampleCard}>
            <ScreenshotExample screenshot={gameTitanScreenshot}
              title={t('Capture both columns of the Titan stats', 'Снимите обе колонки статов титанки')}
              alt={t('Two columns of Titan properties and levels in the game', 'Две колонки свойств и уровней титанки в игре')}
              annotations={[
                {
                  title: t('Left column', 'Левая колонка'),
                  description: t('Weak Point, Normal Attack, Dodge Attack and Skill. Keep each name and the number beneath it.',
                    'Weak Point, обычная атака, уклонение и навык. Оставьте видимыми название каждого свойства и число под ним.'),
                  boxes: [[53, 57, 194, 38], [53, 230, 206, 38], [53, 273, 202, 39], [53, 316, 154, 40]],
                },
                {
                  title: t('Right column', 'Правая колонка'),
                  description: t('Discharge and Damage Boost. Keep zero levels visible so you can check the import.',
                    'Разряд и Damage Boost. Оставьте видимыми и нулевые уровни, чтобы сверить результат импорта.'),
                  boxes: [[295, 13, 179, 38], [295, 57, 124, 38]],
                },
              ]}
            />
            <TitanReadout locale={locale} levels={EXAMPLE_TITAN} stats={stats} />
          </InfoCard>
        </Tabs.Content>

      </Tabs>
    </ToolInfoModal>
  );
}

function ScreenshotExample({ screenshot, title, alt, annotations, note }: {
  screenshot: Screenshot;
  title: string;
  alt: string;
  annotations: readonly Annotation[];
  note?: string;
}) {
  const { file, width, height } = screenshot;
  const source = `/examples/titan/${file}`;
  return (
    <>
      <SectionHeading>{title}</SectionHeading>
      <div className={styles.sampleLayout}>
        <figure className={styles.screenshot} style={{ maxInlineSize: width, '--shot-ratio': width / height } as CSSProperties}>
          <img src={source} width={width} height={height} alt={alt} />
          {annotations.map(({ boxes }, index) => boxes.map(([x, y, w, h], boxIndex) => (
            <span key={`${index}-${boxIndex}`} aria-hidden="true" className={styles.annotationBox} style={{
              left: `${x / width * 100}%`, top: `${y / height * 100}%`, width: `${w / width * 100}%`, height: `${h / height * 100}%`,
            }}>
              {boxIndex === 0 && <span className={styles.annotationNumber}>{index + 1}</span>}
            </span>
          )))}
        </figure>
        <div>
          <ol className={styles.legend} role="list">
            {annotations.map(({ title, description }, index) => (
              <li key={title}>
                <span className={styles.annotationNumber} aria-hidden="true">{index + 1}</span>
                <div><strong>{title}</strong><p>{description}</p></div>
              </li>
            ))}
          </ol>
          {note && <p className={styles.sampleNote}>{note}</p>}
        </div>
      </div>
    </>
  );
}

function TitanReadout({ locale, stats, levels }: { locale: Locale; stats: TitanStatInfo; levels: TitanLevels }) {
  const t = localeText(locale);
  return <ExampleReadout title={t('Recognized Titan levels in this example', 'Распознанные уровни титанки в этом примере')}
    values={titanStatsByLevel(levels).map(stat => ({ label: <TitanStatLabel info={stats[stat]} />, value: `+${levels[stat]}` }))} />;
}

function ExampleReadout({ title, values }: { title: string; values: readonly { label: ReactNode; value: string }[] }) {
  return <div>
    <h4 className="text-xs font-semibold text-slate-200">{title}</h4>
    <dl className={styles.readout}>
      {values.map(({ label, value }, index) => (
        <div key={index}><dt>{label}</dt><dd>{value}</dd></div>
      ))}
    </dl>
  </div>;
}
