'use client';

import React from 'react';
import type { SimulacraDatasetItemRaw } from '@tof-hub/contracts';
import type { Locale } from '@tof-hub/i18n';
import type { SimulacraStrings } from '../types';
import { DetailNavigation } from '../../info-sections/common/detail-navigation';

interface SimulacraDetailNavProps {
  character: SimulacraDatasetItemRaw;
  roster: SimulacraDatasetItemRaw[];
  locale: Locale;
  strings: SimulacraStrings;
  onBack: () => void;
  onSelectCharacter: (id: string) => void;
}

export const SimulacraDetailNav: React.FC<SimulacraDetailNavProps> = ({
  character,
  roster,
  locale,
  strings,
  onBack,
  onSelectCharacter,
}) => {
  return (
    <DetailNavigation
      currentId={character.id}
      items={roster}
      getItemName={(item) =>
        locale === 'ru' ? item.name_ru || item.name || item.name_en || item.id : item.name_en || item.name || item.id
      }
      labels={{
        navigation: 'Character navigation header',
        pager: 'Character roster pager',
        back: strings.backToGrid,
        previous: strings.prevCharacter,
        next: strings.nextCharacter,
      }}
      onBack={onBack}
      onSelect={onSelectCharacter}
      ids={{ back: 'sim-back-btn', previous: 'sim-prev-char-btn', next: 'sim-next-char-btn' }}
    />
  );
};

SimulacraDetailNav.displayName = 'SimulacraDetailNav';
