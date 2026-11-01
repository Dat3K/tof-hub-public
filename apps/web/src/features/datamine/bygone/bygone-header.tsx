'use client';

import { localized } from '@tof-hub/i18n';
import { useI18n } from '@/lib/i18n';
import { EncounterModeSwitcher } from '../components/encounter-ui';
import { BYGONE_COPY } from './bygone-copy';
import styles from './bygone.module.css';

export function BygoneHeader({mode}: {mode: 'gacha' | 'mmo'}) {
  const {locale} = useI18n();
  const copy = localized(BYGONE_COPY, locale);
  return <section className={styles.hero} id="overview">
    <div className={styles.heroContent}>
      <p className={styles.heroEyebrow}>{copy.eyebrow}</p>
      <h1 className={styles.heroTitle}>{copy.title}</h1>
    </div>
    <EncounterModeSwitcher mode={mode} path="/datamine/bygone/" />
  </section>;
}
