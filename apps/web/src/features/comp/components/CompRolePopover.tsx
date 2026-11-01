'use client';

import { localeText } from '@/lib/i18n/text';
import { localized } from '@tof-hub/i18n';
import { type Locale } from '@tof-hub/i18n';
import React from 'react';
import {PLAYER_ROLE_LABELS} from '@tof-hub/game-domain';
import { CompPopover } from './CompPopover';
import type { SquadRole } from '../types';
import { resolveCompRoleIcon } from '../data';
import { getCompStrings } from '../copy';
import styles from '../comp.module.css';

interface CompRolePopoverProps {
  currentRole: SquadRole | null; // null = auto
  autoRole: SquadRole;
  anchorRect: DOMRect;
  locale: Locale;
  onSelectRole: (role: SquadRole | null) => void;
  onClose: () => void;
}

export const CompRolePopover: React.FC<CompRolePopoverProps> = ({
  currentRole,
  autoRole,
  anchorRect,
  locale,
  onSelectRole,
  onClose,
}) => {
  const strings = getCompStrings(locale);

  const roleOptions: { id: SquadRole | null; label: string; icon: string }[] = [
    {
      id: null,
      label: `${strings.roleAuto} (${localized(PLAYER_ROLE_LABELS[autoRole], locale)})`,
      icon: resolveCompRoleIcon(autoRole),
    },
    { id: 'tank', label: localeText(locale)('Tank (Fortitude)', 'Танк (Защита)'), icon: resolveCompRoleIcon('tank') },
    {
      id: 'healer',
      label: localeText(locale)('Healer (Benediction)', 'Хил (Благословение)'),
      icon: resolveCompRoleIcon('healer'),
    },
    { id: 'dps', label: localeText(locale)('DPS (Attack)'), icon: resolveCompRoleIcon('dps') },
    { id: 'balance', label: localeText(locale)('Balance', 'Баланс'), icon: resolveCompRoleIcon('balance') },
  ];

  return (
    <CompPopover anchorRect={anchorRect} width={270} ariaLabel={strings.roleSelectorAria} onClose={onClose}
      title={strings.playerRole} subtitle={currentRole ? strings.roleCustom : strings.roleAuto}>
      <div className={styles.popSection}>
        {roleOptions.map((opt) => {
          const isSelected = opt.id === currentRole || (opt.id === null && currentRole === null);
          return (
            <button
              key={String(opt.id)}
              type="button"
              aria-pressed={isSelected}
              className={`${styles.popBtn} ${styles.popRoleBtn} ${isSelected ? styles.popBtnActive : ''}`}
              onClick={() => {
                onSelectRole(opt.id);
                onClose();
              }}
            >
              {opt.icon && <img src={opt.icon} alt="" aria-hidden="true" />}
              <span>{opt.label}</span>
            </button>
          );
        })}
      </div>
    </CompPopover>
  );
};
