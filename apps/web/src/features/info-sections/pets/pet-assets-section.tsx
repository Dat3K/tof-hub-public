'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { TransparencyCheckerboard } from '@tof-hub/ui';
import { gameAsset } from '@tof-hub/game-assets';
import { getElementLabel, getRoleLabel } from '@tof-hub/game-domain';
import type { Locale } from '@tof-hub/i18n';
import type { PetItem, PetModuleFamily, PetsStrings } from './types';
import { normalizePetElement } from './constants';
import styles from './pets.module.css';

type PetAssetCategory = 'all' | 'art' | 'token' | 'skill' | 'module' | 'element' | 'resonance';

interface PetAsset {
  id: string;
  category: Exclude<PetAssetCategory, 'all'>;
  title: string;
  path: string;
}

interface PetAssetsSectionProps {
  pet: PetItem;
  locale: Locale;
  strings: PetsStrings;
  moduleFamilies?: PetModuleFamily[];
  onOpenLightbox: (src: string, caption: string) => void;
}

export const PetAssetsSection: React.FC<PetAssetsSectionProps> = ({
  pet,
  locale,
  strings,
  moduleFamilies = [],
  onOpenLightbox,
}) => {
  const isRu = locale === 'ru';
  const [category, setCategory] = useState<PetAssetCategory>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  const assets = useMemo<PetAsset[]>(() => {
    const result: PetAsset[] = [];
    const seen = new Set<string>();
    const add = (id: string, kind: Exclude<PetAssetCategory, 'all'>, title: string, path?: string | null) => {
      if (!path || seen.has(path)) return;
      seen.add(path);
      result.push({ id, category: kind, title, path });
    };

    add('pet-art', 'art', strings.petAssetArt, pet.photo || pet.photo_thumb);
    add('pet-token', 'token', strings.petAssetToken, pet.token_icon || pet.token_icon_thumb);
    (pet.skills || []).forEach((skill, index) => {
      const title = isRu ? skill.name_ru || skill.name || skill.name_en : skill.name_en || skill.name || skill.name_ru;
      add(`skill-${index}`, 'skill', title || strings.petAssetSkillFallback.replace('{index}', String(index + 1)), skill.icon);
    });

    const elementId = normalizePetElement(pet.element_norm || pet.element);
    const elementSuffix = elementId === 'phys'
      ? 'wu'
      : elementId === 'fire'
        ? 'huo'
        : elementId === 'frost'
          ? 'bing'
          : elementId === 'volt'
            ? 'lei'
            : 'powers';
    const elementLabel = getElementLabel(elementId, locale, 'short');
    if (elementId !== 'all') {
      add(
        'pet-element',
        'element',
        `${elementLabel} (${strings.petFilterElement})`,
        `Hotta/Content/Resources/UI/wuqi/icon_element_${elementSuffix}`
      );
    }

    const roleText = (pet.role_norm || pet.role || '').toLowerCase();
    const roleIsTank = roleText.includes('tank') || roleText.includes('def');
    const roleLabel = getRoleLabel(roleIsTank ? 'tank' : 'dps', locale);
    add(
      'pet-resonance',
      'resonance',
      `${roleLabel} (${strings.petFilterResonance})`,
      `Hotta/Content/Resources/UI/wuqi/icon_${roleIsTank ? 'fangyu' : 'qianggong'}`
    );

    const petKeys = [pet.id, pet.name, pet.name_en, pet.name_ru]
      .filter(Boolean)
      .map((value) => String(value).toLowerCase().trim());
    moduleFamilies
      .filter((module) => {
        const owners = [module.owner_id, module.owner, module.owner_en, module.owner_ru]
          .filter(Boolean)
          .map((value) => String(value).toLowerCase().trim());
        return owners.length === 0 || owners.some((owner) => petKeys.includes(owner));
      })
      .forEach((module) => {
        const moduleName = isRu
          ? module.name_ru || module.name_en || module.name || module.family_id
          : module.name_en || module.name || module.family_id;
        const owners = [module.owner_id, module.owner, module.owner_en, module.owner_ru].filter(Boolean);
        const moduleType = owners.length > 0 ? strings.petModuleExclusive : strings.petModuleUniversal;
        (module.levels || []).forEach((level) => {
          add(
            `module-${module.family_id}-${level.level}`,
            'module',
            `${moduleName} ★${level.level} (${moduleType})`,
            level.icon || level.icon_thumb || module.icon || module.icon_thumb
          );
        });
      });
    return result;
  }, [isRu, moduleFamilies, pet]);

  const visibleAssets = category === 'all' ? assets : assets.filter((asset) => asset.category === category);
  const counts = {
    all: assets.length,
    art: assets.filter((asset) => asset.category === 'art').length,
    token: assets.filter((asset) => asset.category === 'token').length,
    skill: assets.filter((asset) => asset.category === 'skill').length,
    module: assets.filter((asset) => asset.category === 'module').length,
    element: assets.filter((asset) => asset.category === 'element').length,
    resonance: assets.filter((asset) => asset.category === 'resonance').length,
  };

  const copyPath = async (asset: PetAsset) => {
    if (!navigator.clipboard?.writeText) return;
    await navigator.clipboard.writeText(asset.path);
    setCopiedId(asset.id);
    window.setTimeout(() => setCopiedId((current) => (current === asset.id ? null : current)), 1400);
  };

  const updateSectionHash = () => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.searchParams.set('pet', pet.id);
    url.hash = 'pet-assets-section';
    window.history.replaceState(null, '', url.toString());
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const syncPanelState = () => setIsPanelOpen(window.location.hash.includes('pet-assets-section'));
    syncPanelState();
    window.addEventListener('hashchange', syncPanelState);
    return () => window.removeEventListener('hashchange', syncPanelState);
  }, [pet.id]);

  if (assets.length === 0) return null;

  const filters: Array<[PetAssetCategory, string]> = [
    ['all', strings.all],
    ['art', strings.petFilterArt],
    ['token', strings.petFilterToken],
    ['skill', strings.petFilterSkill],
    ['module', strings.petFilterModule],
    ['element', strings.petFilterElement],
    ['resonance', strings.petFilterResonance],
  ];

  return (
    <section className={styles.petInfoSection}>
      <details
        className={styles.petInfoCollapsible}
        id="pet-assets-section"
        open={isPanelOpen}
        onToggle={(event) => setIsPanelOpen(event.currentTarget.open)}
      >
        <summary className={styles.petInfoSummary} onClick={updateSectionHash}>
          <span className={styles.petInfoSummaryTitle}>
            <span aria-hidden="true">🎨</span>
            {strings.petAssetsTitle}
            <span className={styles.petInfoCount}>{assets.length}</span>
          </span>
          <span className={styles.petInfoChevron} aria-hidden="true">▾</span>
        </summary>
        <div className={styles.petInfoContent}>
          <p className={styles.petInfoDisclaimer}>
            {strings.petAssetsDisclaimer}
          </p>
          <div className={styles.petInfoFilters} role="tablist" aria-label={strings.petAssetsCategories}>
            {filters.map(([value, label]) => counts[value] > 0 ? (
              <button
                key={value}
                type="button"
                className={`${styles.petInfoFilter} ${category === value ? styles.petInfoFilterActive : ''}`}
                onClick={() => setCategory(value)}
              >
                {label} <span>{counts[value]}</span>
              </button>
            ) : null)}
          </div>
          <div className={styles.petAssetsGrid}>
            {visibleAssets.map((asset) => {
              const webpUrl = gameAsset(asset.path, 'webp');
              const pngUrl = gameAsset(asset.path, 'png');
              return (
                <article key={asset.id} className={styles.petAssetCard}>
                  <button
                    type="button"
                    className={styles.petAssetPreview}
                    onClick={() => onOpenLightbox(pngUrl, asset.title)}
                    aria-label={`${asset.title} — ${strings.petAssetOpen}`}
                  >
                    <TransparencyCheckerboard />
                    <img src={webpUrl} alt={asset.title} loading="lazy" decoding="async" />
                  </button>
                  <div className={styles.petAssetMeta}>
                    <strong>{asset.title}</strong>
                    <div className={styles.petAssetPathRow}>
                      <code title={asset.path}>{asset.path}</code>
                      <button type="button" onClick={() => void copyPath(asset)} aria-label={strings.petAssetCopyPath}>
                        {copiedId === asset.id ? '✓' : '⧉'}
                      </button>
                    </div>
                    <div className={styles.petAssetActions}>
                      <a href={pngUrl} target="_blank" rel="noreferrer">PNG</a>
                      <a href={webpUrl} target="_blank" rel="noreferrer">WebP</a>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </details>
    </section>
  );
};
