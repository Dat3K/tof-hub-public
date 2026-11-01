'use client';

import { GameRichText } from '@tof-hub/ui';
import { gameAsset } from '@tof-hub/game-assets';
import { HandbookTable, IconLabel, useHandbookText } from '../handbook/sections/handbook-ui';
import type { Localized } from '../contracts/handbook';
import { useEncounterIconPreview } from './inspectable-icon';
import styles from './encounter-effect-catalog.module.css';

export interface EncounterCatalogEffect {
  id: string;
  name: Localized | null;
  description: Localized | null;
  icon?: string | null;
}

/** Native disclosure shared by encounter pages; readable before client hydration. */
export function EncounterEffectCatalog({ effects }: { effects: EncounterCatalogEffect[] }) {
  const { t, name } = useHandbookText();
  const { action, lightbox } = useEncounterIconPreview();
  const title = t('All content effects', 'Все эффекты контента');
  return <><details className={`${styles.details} info-ui`}>
    <summary>{title}</summary>
    {effects.length ? <HandbookTable caption={title}
      columns={[{ label: t('Effect', 'Эффект') }, { label: t('Description', 'Описание'), align: 'start' }]}
      rows={effects.map(effect => ({ key: effect.id, cells: [
        <IconLabel key="name" icon={effect.icon} iconAction={action(effect.icon ? gameAsset(effect.icon) : null, name(effect.name, effect.id))}
          label={<span className={styles.name}>{name(effect.name, effect.id)}</span>} />,
        name(effect.description) ? <GameRichText key="description" density="compact" text={name(effect.description)} /> : t('Description unavailable', 'Описание недоступно'),
      ] }))} /> : <p className={styles.empty}>{t('No effects available.', 'Эффекты недоступны.')}</p>}
  </details>
    {lightbox}
  </>;
}
