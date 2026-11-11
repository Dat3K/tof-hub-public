import type { Locale } from '@tof-hub/i18n';
import { formatNumber } from '@/lib/i18n/format';
import { localeText } from '@/lib/i18n/text';
import { categoryLabel } from './damage-labels';
import { DAMAGE_CATEGORIES, sumDamage, type DamageVector } from './model';
import styles from './titan-damage-share-table.module.css';

interface DamageShareWeapon {
  name: string;
  icon?: string;
  damage: DamageVector;
}

type TitanDamageShareTableProps = {
  weapons: readonly DamageShareWeapon[];
  locale: Locale;
  clean: DamageVector;
  variant?: 'summary' | 'preview';
};

export function TitanDamageShareTable({ weapons, clean, locale, variant = 'summary' }: TitanDamageShareTableProps) {
  const t = localeText(locale);
  const preview = variant === 'preview';
  const rows = weapons.map((weapon) => ({ ...weapon, total: sumDamage(weapon.damage) })).filter((weapon) => weapon.total > 0);
  const total = sumDamage(clean);
  if (!Number.isFinite(total) || total <= 0) return null;

  const percent = (damage: number) => formatNumber(damage / total, locale, { style: 'percent', maximumFractionDigits: 2 });

  return (
    <div className={preview ? `${styles.shareTable} ${styles.preview}` : styles.shareTable}>
      <table>
        {preview ? (
          <caption>{t('Example', 'Пример')} · {t('Damage without Titan', 'Урон без титанки')}</caption>
        ) : null}
        <thead className={preview ? 'sr-only' : undefined}>
          <tr>
            <th scope="col">{t('Weapons', 'Оружие')}</th>
            <th scope="col">{t('Damage', 'Урон')}</th>
            {preview ? null : DAMAGE_CATEGORIES.map((category) => <th scope="col" key={category}>{categoryLabel(category, t)}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((weapon, index) => (
            <tr key={index}>
              <th scope="row">
                <span>{weapon.icon ? <img src={weapon.icon} alt="" /> : null}<span>{weapon.name}</span></span>
              </th>
              <td><b>{percent(weapon.total)}</b></td>
              {preview ? null : DAMAGE_CATEGORIES.map((category) => <td key={category}>{percent(weapon.damage[category])}</td>)}
            </tr>
          ))}
        </tbody>
        {preview ? null : (
          <tfoot>
            <tr>
              <th scope="row">{t('Total', 'Итого')}</th><td>100%</td>
              {DAMAGE_CATEGORIES.map((category) => <td key={category}>{percent(clean[category])}</td>)}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
