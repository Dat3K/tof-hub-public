'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { getStandardPetStatsAtLevel } from '@tof-hub/game-domain';
import type { Locale } from '@tof-hub/i18n';
import type { PetItem, PetsStrings } from './types';
import { normalizePetElement } from './constants';
import styles from './pets.module.css';

type DevCategory = 'all' | 'identifiers' | 'stats' | 'stars' | 'skills';

interface PetDevSectionProps {
  pet: PetItem;
  locale: Locale;
  strings: PetsStrings;
}

const valueOrDash = (value: unknown) => value === undefined || value === null || value === '' ? '—' : String(value);

export const PetDevSection: React.FC<PetDevSectionProps> = ({ pet, locale, strings }) => {
  const isRu = locale === 'ru';
  const isMmo = pet.source_edition === 'mmo' || pet.id.toLowerCase().startsWith('mmo_');
  const [category, setCategory] = useState<DevCategory>('all');
  const [isPanelOpen, setIsPanelOpen] = useState(isMmo);
  const maxLevel = isMmo ? 1 : pet.stats_progression?.max_level ?? 100;
  const levels = pet.stats_progression?.levels || {};
  const levelOne = isMmo
    ? levels['1'] || Object.values(levels)[0] || { level: 1, atk: 200, crit: 500, crit_dmg: 0.5 }
    : getStandardPetStatsAtLevel(1);
  const maxStats = isMmo ? levelOne : getStandardPetStatsAtLevel(maxLevel);
  const labels = {
    all: strings.devCatAll,
    identifiers: strings.devCatIdentifiers,
    stats: strings.devCatStats,
    stars: strings.devCatStars,
    skills: strings.devCatSkills,
  };

  const counts = useMemo(() => ({
    all: 4 + (pet.stars?.length || 0) + (pet.skills?.length || 0),
    identifiers: 4,
    stats: 1,
    stars: pet.stars?.length || 0,
    skills: pet.skills?.length || 0,
  }), [pet.skills, pet.stars]);

  const show = (item: DevCategory) => category === 'all' || category === item;
  const element = normalizePetElement(pet.element_norm || pet.element);
  const localizedName = (en?: string, ru?: string, fallback?: string) => isRu ? ru || en || fallback : en || ru || fallback;

  const updateSectionHash = () => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.searchParams.set('pet', pet.id);
    url.hash = 'pet-dev-data';
    window.history.replaceState(null, '', url.toString());
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
      const syncPanelState = () => setIsPanelOpen(isMmo || window.location.hash.includes('pet-dev-data'));
    syncPanelState();
    window.addEventListener('hashchange', syncPanelState);
    return () => window.removeEventListener('hashchange', syncPanelState);
  }, [isMmo, pet.id]);

  return (
    <section className={styles.petInfoSection}>
      <details
        className={styles.petInfoCollapsible}
        id="pet-dev-data"
        open={isPanelOpen}
        onToggle={(event) => setIsPanelOpen(event.currentTarget.open)}
      >
        <summary className={styles.petInfoSummary} onClick={updateSectionHash}>
          <span className={styles.petInfoSummaryTitle}>
            <span aria-hidden="true">{isMmo ? '🔧' : '⌘'}</span>
            {isMmo ? strings.petDevTitle : strings.petDevTitleShort}
            {!isMmo ? <span className={styles.petInfoCount}>{counts.all}</span> : null}
          </span>
          <span className={styles.petInfoChevron} aria-hidden="true">▾</span>
        </summary>
        <div className={`${styles.petInfoContent} ${styles.petDevContent}`}>
          <p className={styles.petInfoDisclaimer}>
            {strings.petDevDisclaimer}
          </p>
          <div className={styles.petInfoFilters} role="tablist" aria-label={strings.petDevCategories}>
            {(Object.keys(labels) as DevCategory[]).map((value) => counts[value] > 0 ? (
              <button
                key={value}
                type="button"
                className={`${styles.petInfoFilter} ${category === value ? styles.petInfoFilterActive : ''}`}
                onClick={() => setCategory(value)}
              >
                {labels[value]} <span>{counts[value]}</span>
              </button>
            ) : null)}
          </div>

          {show('identifiers') ? (
            <div className={styles.petDevBlock}>
              <h4>{labels.identifiers}</h4>
              <dl className={styles.petDevGrid}>
                {[
                  [strings.devTechId, pet.id],
                  [strings.devLabelCategory, pet.category],
                  [strings.devLabelQuality, pet.quality],
                  [strings.devColSource, pet.source_edition],
                  [strings.devLabelElement, element],
                  [strings.devLabelRole, pet.role_norm || pet.role],
                ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{valueOrDash(value)}</dd></div>)}
              </dl>
            </div>
          ) : null}

          {show('stats') ? (
            <div className={styles.petDevBlock}>
              <h4>{labels.stats}</h4>
              <div className={styles.petDevTable}>
                <div><span>{strings.devTechLevel}</span><strong>{maxLevel}</strong></div>
                <div><span>{strings.devTechAtk}</span><strong>{valueOrDash(levelOne?.atk)} → {valueOrDash(maxStats?.atk)}</strong></div>
                <div><span>{strings.devTechCrit}</span><strong>{valueOrDash(levelOne?.crit)} → {valueOrDash(maxStats?.crit)}</strong></div>
                <div><span>{strings.devTechCritDmg}</span><strong>{valueOrDash(levelOne?.crit_dmg)} → {valueOrDash(maxStats?.crit_dmg)}</strong></div>
              </div>
            </div>
          ) : null}

          {!isMmo && show('stars') ? (
            <div className={styles.petDevBlock}>
              <h4>{labels.stars}</h4>
              <div className={styles.petDevRows}>
                {(pet.stars || []).map((star) => (
                  <details key={star.star} className={styles.petDevRow}>
                    <summary><strong>★{star.star}</strong><span>{strings.devTechAtk} {valueOrDash(star.atk_inheritance)}</span><span>{strings.devTechSlots} {valueOrDash(star.module_slots)}</span><span>{strings.devTechLoad} {valueOrDash(star.module_load)}</span></summary>
                    <p>{star.desc || star.description || '—'}</p>
                  </details>
                ))}
              </div>
            </div>
          ) : null}

          {show('skills') ? (
            <div className={styles.petDevBlock}>
              <h4>{labels.skills}</h4>
              <div className={styles.petDevRows}>
                {(pet.skills || []).map((skill, index) => (
                  <details key={`${skill.name || skill.name_en || index}-${index}`} className={styles.petDevRow}>
                    <summary><strong>{localizedName(skill.name_en, skill.name_ru, skill.name) || strings.petAssetSkillFallback.replace('{index}', String(index + 1))}</strong><span>{skill.icon || '—'}</span></summary>
                    <p>{localizedName(skill.description_en, skill.description_ru, skill.description) || '—'}</p>
                  </details>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </details>
    </section>
  );
};
