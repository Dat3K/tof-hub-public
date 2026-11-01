'use client';

import type {ReactNode} from 'react';
import { InspectableIcon, useEncounterIconPreview } from './inspectable-icon';
import styles from '../oow/oow.module.css';

/** OoW's buff surface; each encounter supplies its own classification and text. */
export function EncounterBuffCard({name, icon, accent, badge, marker, description}: {
  name: string; icon?: string | null; accent: string; badge?: string; marker?: ReactNode; description?: ReactNode;
}) {
  const { action, lightbox } = useEncounterIconPreview();
  return <><article className={styles.affixCard} style={{borderLeftColor: accent}}>
    {marker}
    <div style={{display: 'flex', alignItems: 'center', gap: 10, minWidth: 0}}>
      <InspectableIcon key={icon} src={icon} action={action(icon, name)} imageClass={styles.affixIcon} gapClass={styles.affixIconGap} />
      <div style={{minWidth: 0}}><div className={styles.affixName}>{name}</div>
        {badge && <span className={styles.affixBadge} style={{color: accent, borderColor: `${accent}59`, background: `${accent}1f`}}>{badge}</span>}
      </div>
    </div>
    {description && <div className={styles.affixDesc}>{description}</div>}
  </article>{lightbox}</>;
}

export function EncounterRowChevron() {
  return <svg width="12" height="8" viewBox="0 0 12 8" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m2 2 4 4 4-4" /></svg>;
}
