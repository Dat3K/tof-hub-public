'use client';

import React from 'react';
import styles from './pets.module.css';

export type PetModuleOwnerVariant = 'universal' | 'fire' | 'phys' | 'frost' | 'volt' | 'altered';
export type PetModuleTagPlacement = 'card' | 'modal' | 'detail';

interface PetModuleLoadTagProps {
  label: string;
  cost: number;
  placement: PetModuleTagPlacement;
  title?: string;
}

interface PetModuleOwnerTagProps {
  label: string;
  variant: PetModuleOwnerVariant;
  placement: PetModuleTagPlacement;
}

const ownerVariantClasses: Record<PetModuleOwnerVariant, string> = {
  universal: styles.moduleOwnerBadgeUniversal,
  fire: styles.moduleOwnerBadgeFire,
  phys: styles.moduleOwnerBadgePhys,
  frost: styles.moduleOwnerBadgeFrost,
  volt: styles.moduleOwnerBadgeVolt,
  altered: styles.moduleOwnerBadgeAltered,
};

export const PetModuleLoadTag: React.FC<PetModuleLoadTagProps> = ({ label, cost, placement, title }) => {
  const className =
    placement === 'card'
      ? styles.moduleLoadChip
      : placement === 'modal'
        ? styles.moduleLegacyLoadBadge
        : styles.moduleDetailLoadBadge;

  return (
    <span className={className} title={title}>
      <svg className={placement === 'card' ? styles.moduleLoadIcon : undefined} viewBox="0 0 24 24" aria-hidden="true">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
      <span className={placement === 'card' ? styles.moduleLoadLabel : undefined}>{label}</span>
      <strong className={placement === 'card' ? styles.moduleLoadValue : undefined}>{cost}</strong>
    </span>
  );
};

export const PetModuleOwnerTag: React.FC<PetModuleOwnerTagProps> = ({ label, variant, placement }) => {
  const baseClass =
    placement === 'card'
      ? styles.moduleOwnerBadge
      : placement === 'modal'
        ? styles.moduleLegacyOwnerBadge
        : styles.moduleDetailOwnerBadge;

  return <span className={`${baseClass} ${ownerVariantClasses[variant]}`}>{label}</span>;
};
