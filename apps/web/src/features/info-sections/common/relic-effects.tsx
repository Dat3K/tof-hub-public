import { localeText } from '@/lib/i18n/text';
import { localized } from '@tof-hub/i18n';
import {GameRichText} from '@tof-hub/ui';
import type {Locale} from '@tof-hub/i18n';
import styles from './relic-effects.module.css';

export interface RelicEffectsProps {
  item:{description?:Partial<Record<Locale,string>>;effects?:{level:number;description:Partial<Record<Locale,string>>}[]};
  stars:number;
  locale:Locale;
}

/** Relic advancements remain cumulative, alongside their base effect. */
export function RelicEffects({item,stars,locale}:RelicEffectsProps) {
  return <div className={styles.effects}>
    {localized(item.description, locale)&&<div><strong>{localeText(locale)('Base effect')}</strong><GameRichText density="compact" text={localized(item.description, locale)}/></div>}
    {item.effects?.filter(effect=>effect.level<=stars).map(effect=><div key={effect.level}><strong>★{effect.level}</strong><GameRichText density="compact" text={localized(effect.description, locale)??''}/></div>)}
  </div>;
}
