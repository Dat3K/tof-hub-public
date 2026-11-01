'use client';

import { translateUiText } from '@tof-hub/i18n';
import React, { useCallback, useEffect, useState } from 'react';
import { intlLocale } from '@/lib/i18n/format';
import { GameBadge as Badge } from '@tof-hub/ui';
import type { ElementVariant, RoleVariant } from '@tof-hub/ui';
import { gameAsset, gameAssetPng, gameAssetWebp } from '@tof-hub/game-assets';
import { getRoleLabel } from '@tof-hub/game-domain';
import { RichTextDisplay } from '../common/format-rich-text';
import { InfoLightbox } from '../common/info-lightbox';
import { useAnimatedDetails } from '../common/use-animated-details';
import type { PetItem, PetModuleFamily, PetServantModalProps } from './types';
import { normalizePetElement } from './constants';
import { SimulacraAssetsSection } from '../../simulacra/components/simulacra-assets-section';
import { SimulacraDevSection } from '../../simulacra/components/simulacra-dev-section';
import { STAT_ICONS } from '../../simulacra/constants';
import { DetailNavigation } from '../common/detail-navigation';
import { createPetDevData, createPetSimulacraData, getPetSimulacraStrings } from './pet-simulacra-adapter';
import { PetModuleLoadTag, PetModuleOwnerTag } from './pet-module-tags';
import { buildRankedModuleDescription, getModuleRank } from './pet-module-text';
import styles from './pets.module.css';

const getModuleName = (module: PetModuleFamily, isRu: boolean) =>
  isRu ? module.name_ru || module.name_en || module.name || module.family_id : module.name_en || module.name || module.family_id;

const petSkillAnchor = (index: number) => `pet-skill-${index + 1}`;
const petModuleAnchor = (familyId: string) =>
  `pet-module-${familyId.replace(/[^a-zA-Z0-9_:-]/g, '-')}`;

export const PetServantModal: React.FC<PetServantModalProps> = ({
  isOpen,
  onClose,
  pet,
  locale,
  strings,
  roster = [],
  onSelectPet,
  onSelectModuleFamily,
  moduleFamilies = [],
}) => {
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [lightboxWebpSrc, setLightboxWebpSrc] = useState<string | null>(null);
  const [lightboxCaption, setLightboxCaption] = useState('');
  const [selectedModuleLevels, setSelectedModuleLevels] = useState<Record<string, number>>({});

  if (!pet) return null;

  const isRu = locale === 'ru';
  const name = isRu ? pet.name_ru || pet.name || pet.name_en || pet.id : pet.name_en || pet.name || pet.id;
  const quality = (pet.quality?.toLowerCase() === 'sr' ? 'sr' : 'ssr') as 'ssr' | 'sr';
  const artPath = pet.photo || pet.photo_thumb || pet.icon || pet.icon_thumb || pet.token_icon;
  const artUrl = artPath ? gameAssetWebp(artPath) : '/datamine/favicon.svg';
  const artPngUrl = artPath ? gameAssetPng(artPath) : artUrl;
  const tokenPath = pet.token_icon || pet.token_icon_thumb;
  const tokenUrl = tokenPath ? gameAssetWebp(tokenPath) : null;
  const tokenPngUrl = tokenPath ? gameAssetPng(tokenPath) : null;

  const openLightbox = (src: string, caption?: string, webpSrc?: string) => {
    setLightboxSrc(src);
    setLightboxWebpSrc(webpSrc || null);
    setLightboxCaption(caption || '');
    setIsLightboxOpen(true);
  };

  const elemId = normalizePetElement(pet.element_norm || pet.element);
  const elementVariant: ElementVariant | undefined =
    elemId === 'phys'
      ? 'phys'
      : elemId === 'fire'
      ? 'flame'
      : elemId === 'frost'
      ? 'frost'
      : elemId === 'volt'
      ? 'volt'
      : elemId === 'altered'
      ? 'altered'
      : undefined;
  const elementIconSuffix =
    elemId === 'phys' ? 'wu' : elemId === 'fire' ? 'huo' : elemId === 'frost' ? 'bing' : elemId === 'volt' ? 'lei' : 'powers';
  const elementIconUrl = gameAsset(`Hotta/Content/Resources/UI/wuqi/icon_element_${elementIconSuffix}`);

  const roleText = (pet.role_norm || pet.role || '').toLowerCase();
  const roleVariant: RoleVariant = roleText.includes('tank') || roleText.includes('def') ? 'tank' : 'dps';
  const roleLabel = getRoleLabel(roleVariant, locale).toUpperCase();
  const roleIconUrl = gameAsset(
    `Hotta/Content/Resources/UI/wuqi/icon_${roleVariant === 'tank' ? 'fangyu' : 'qianggong'}`
  );

  const starsList = Array.isArray(pet.stars) ? pet.stars : [];
  const petKeys = [pet.id, pet.name_en, pet.name, pet.name_ru]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase().trim());
  const isMmo = pet.source_edition === 'mmo' || pet.id.toLowerCase().startsWith('mmo_');
  const simulacraPet = createPetSimulacraData(pet, isMmo ? [] : moduleFamilies);
  const petDevData = createPetDevData(pet, isMmo ? [] : moduleFamilies, locale);
  const simulacraStrings = getPetSimulacraStrings(locale);
  const exclusiveModules = isMmo
    ? []
    : moduleFamilies.filter((module) => {
        const ownerKeys = [module.owner_id, module.owner_en, module.owner, module.owner_ru]
          .filter(Boolean)
          .map((value) => String(value).toLowerCase().trim());
        return ownerKeys.some((owner) => petKeys.includes(owner));
      });
  const universalModules = isMmo
    ? []
    : moduleFamilies.filter((module) => !module.owner_id && !module.owner_en && !module.owner && !module.owner_ru);
  const petTextLinks = (() => {
    const links = new Map<string, { label: string; href: string }>();
    const addLink = (label: string | null | undefined, href: string) => {
      const normalized = String(label || '').trim();
      if (normalized) links.set(normalized.toLowerCase(), { label: normalized, href });
    };

    (pet.skills || []).forEach((skill, index) => {
      const href = `#${petSkillAnchor(index)}`;
      addLink(skill.name_en, href);
      addLink(skill.name_ru, href);
      addLink(skill.name, href);
    });
    [...exclusiveModules, ...universalModules].forEach((module) => {
      const href = `#${petModuleAnchor(module.family_id)}`;
      addLink(module.name_en, href);
      addLink(module.name_ru, href);
      addLink(module.name, href);
    });

    return [...links.values()];
  })();
  const lore = isRu
    ? pet.desc_ru || pet.desc || pet.description || pet.desc_en
    : pet.desc_en || pet.desc || pet.description || pet.desc_ru;
  const maxPetLevel = pet.stats_progression?.max_level ?? 100;
  const maxPetStats = pet.stats_progression?.levels?.[String(maxPetLevel)];
  const petStatLevel = maxPetStats?.level ?? maxPetLevel;
  const firstPetStats = pet.stats_progression?.levels?.['1'] || Object.values(pet.stats_progression?.levels || {})[0];
  const displayedPetStats = isMmo
    ? firstPetStats || { level: 1, atk: 200, crit: 500, crit_dmg: 0.5 }
    : maxPetStats;
  const displayedPetStatLevel = isMmo ? displayedPetStats?.level ?? 1 : petStatLevel;
  const numberFormatter = new Intl.NumberFormat(intlLocale(locale));
  const formatPetNumber = (value?: number) =>
    typeof value === 'number' ? numberFormatter.format(value) : '—';
  const formatPetPercent = (value?: number) =>
    typeof value === 'number' ? `${Math.round(value * 100)}%` : '—';

  const updatePanelHash = useCallback((details: HTMLDetailsElement) => {
    if (typeof window === 'undefined') return;
    const anchor = details.dataset.panelAnchor || details.id;
    if (!anchor) return;
    const url = new URL(window.location.href);
    url.searchParams.set('pet', pet.id);
    url.hash = anchor;
    window.history.replaceState(null, '', url.toString());
  }, [pet.id]);

  useAnimatedDetails({
    containerSelector: '[aria-labelledby="pet-detail-title"]',
    dependencyKey: pet.id,
    detailsSelector: 'details[data-panel-anchor], #sim-assets-section > details, #sim-dev-section > details',
    onSummaryClick: updatePanelHash,
  });

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') return;
    const syncSectionFromHash = () => {
      const rawHash = window.location.hash.replace(/^#/, '').trim();
      const anchor = rawHash.includes('--') ? rawHash.split('--').slice(1).join('--') : rawHash;
      if (!anchor.startsWith('pet-')) return;
      const target = document.getElementById(anchor);
      if (!target) return;
      const details = target instanceof HTMLDetailsElement ? target : target.closest('details');
      if (details) details.open = true;
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const frame = window.requestAnimationFrame(syncSectionFromHash);
    window.addEventListener('hashchange', syncSectionFromHash);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('hashchange', syncSectionFromHash);
    };
  }, [isOpen, pet.id]);

  const openModule = (module: PetModuleFamily) => {
    if (!onSelectModuleFamily) return;
    onClose();
    onSelectModuleFamily(module.family_id || module.id);
  };

  const renderModuleCard = (module: PetModuleFamily, exclusive: boolean) => {
    const levels = Array.isArray(module.levels) ? module.levels : [];
    const fallbackLevel = levels[levels.length - 1]?.level ?? module.level ?? 4;
    const selectedLevel = selectedModuleLevels[module.family_id] ?? fallbackLevel;
    const activeLevel = levels.find((level) => level.level === selectedLevel) || levels[levels.length - 1];
    const moduleName = getModuleName(module, isRu);
    const moduleIcon = activeLevel?.icon || activeLevel?.icon_thumb || module.icon || module.icon_thumb;
    const moduleDescription = buildRankedModuleDescription(levels, isRu, selectedLevel);
    const load = activeLevel?.need_load ?? module.need_load ?? 5;
    const ownerName = isRu ? pet.name_ru || pet.name_en || name : pet.name_en || name;
    const ownerVariant =
      !exclusive
        ? 'universal'
        : elemId === 'fire'
          ? 'fire'
          : elemId === 'phys'
            ? 'phys'
            : elemId === 'frost'
              ? 'frost'
              : elemId === 'volt'
                ? 'volt'
                : elemId === 'altered'
                  ? 'altered'
                  : 'universal';

    return (
      <article
        key={module.family_id}
        id={petModuleAnchor(module.family_id)}
        data-panel-anchor={petModuleAnchor(module.family_id)}
        className={styles.petDetailModuleCard}
        role={onSelectModuleFamily ? 'button' : undefined}
        tabIndex={onSelectModuleFamily ? 0 : undefined}
        onClick={() => openModule(module)}
        onKeyDown={(event) => {
          if (onSelectModuleFamily && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            openModule(module);
          }
        }}
      >
        <div className={styles.petDetailModuleHeader}>
          <div className={styles.petDetailModuleIdentity}>
            <div className={styles.petDetailModuleIcon}>
              {moduleIcon ? <img src={gameAsset(moduleIcon)} alt="" loading="lazy" /> : null}
            </div>
            <div className={styles.petDetailModuleTitleBlock}>
              <h4>{moduleName}</h4>
              <div className={styles.petDetailModuleMeta}>
                <PetModuleLoadTag
                  label={strings.petLoadTag}
                  cost={load}
                  placement="detail"
                  title={strings.loadCost.replace('{load}', String(load))}
                />
                {exclusive ? (
                  <PetModuleOwnerTag
                    label={`${strings.moduleExclusive}: ${ownerName}`}
                    variant={ownerVariant}
                    placement="detail"
                  />
                ) : null}
              </div>
            </div>
          </div>
          <div className={styles.petDetailModuleStars} role="group" aria-label={strings.starAdvancements}>
            {[1, 2, 3, 4].map((level) => (
              <button
                key={level}
                type="button"
                className={level === selectedLevel ? styles.petDetailModuleStarActive : styles.petDetailModuleStar}
                onClick={(event) => {
                  event.stopPropagation();
                  setSelectedModuleLevels((current) => ({ ...current, [module.family_id]: level }));
                }}
                aria-label={strings.levelLabel.replace('{level}', String(level))}
              >
                ★{level}
              </button>
            ))}
          </div>
        </div>
        {moduleDescription ? (
          <RichTextDisplay
            text={moduleDescription}
            links={petTextLinks}
            rank={getModuleRank(levels, selectedLevel)}
            className={styles.petDetailModuleDescription}
          />
        ) : null}
      </article>
    );
  };

  const renderSkill = (skill: NonNullable<typeof pet.skills>[number], index: number) => {
    const skillName = isRu ? skill.name_ru || skill.name || skill.name_en : skill.name_en || skill.name;
    const skillDescription = isRu
      ? skill.description_ru || skill.description || skill.description_en
      : skill.description_en || skill.description;
    const skillIcon = skill.icon ? gameAsset(skill.icon) : null;

    return (
      <article
        key={`${skillName}-${index}`}
        id={petSkillAnchor(index)}
        data-panel-anchor={petSkillAnchor(index)}
        className={styles.petDetailSkillCard}
      >
        <div className={styles.petDetailSkillIcon}>
          {skillIcon ? <img src={skillIcon} alt="" loading="lazy" /> : null}
        </div>
        <div className={styles.petDetailSkillBody}>
          <h4>{skillName}</h4>
          <RichTextDisplay
            text={skillDescription}
            links={petTextLinks}
            className={styles.petDetailSkillDescription}
          />
        </div>
      </article>
    );
  };

  return (
    <>
      <article className={styles.petDetailPage} aria-labelledby="pet-detail-title">
        <DetailNavigation
          currentId={pet.id}
          items={roster}
          getItemName={(item) =>
            isRu ? item.name_ru || item.name_en || item.name || item.id : item.name_en || item.name || item.id
          }
          labels={{
            navigation: strings.petNavNavigation,
            pager: strings.petNavPager,
            back: strings.petNavBack,
            previous: strings.petNavPrevious,
            next: strings.petNavNext,
          }}
          onBack={onClose}
          onSelect={onSelectPet}
          ids={{ back: 'pets-back-btn', previous: 'pets-prev-btn', next: 'pets-next-btn' }}
        />

        <div className={styles.petDetailModalBody}>
          <div className={`${styles.petDetailLayout} ${isMmo ? styles.petDetailLayoutMmo : ''}`}>
            <section className={styles.petDetailHero} aria-labelledby="pet-detail-title">
              <div
                className={styles.petDetailHeroArt}
                onClick={() => openLightbox(artPngUrl, `${name} (${pet.quality || 'SSR'})`, artUrl)}
              >
                <div className={styles.petDetailHeroBadges}>
                  {elementVariant ? (
                    <Badge
                      presentation="icon"
                      variant={elementVariant}
                      size="sm"
                      icon={<img src={elementIconUrl} alt="" className={styles.badgeIcon} />}
                    >
                      {strings[
                        elementVariant === 'phys'
                          ? 'elemPhys'
                          : elementVariant === 'flame'
                          ? 'elemFlame'
                          : elementVariant === 'frost'
                          ? 'elemFrost'
                          : elementVariant === 'volt'
                          ? 'elemVolt'
                          : 'elemAltered'
                      ]}
                    </Badge>
                  ) : null}
                  <Badge
                    presentation="icon"
                    variant={roleVariant}
                    size="sm"
                    icon={<img src={roleIconUrl} alt="" className={styles.badgeIcon} />}
                  >
                    {roleLabel}
                  </Badge>
                </div>
                <Badge variant={quality} size="sm" className={styles.petDetailHeroRarity}>
                  {pet.quality || 'SSR'}
                </Badge>
                <img src={artUrl} alt={name} className={styles.petDetailHeroImage} loading="eager" />
                {tokenUrl ? (
                  <button
                    type="button"
                    className={styles.petDetailTokenArt}
                    onClick={(event) => {
                      event.stopPropagation();
                      openLightbox(tokenPngUrl || tokenUrl, `${name} — Token Art`, tokenUrl || undefined);
                    }}
                    aria-label={`${name} — ${translateUiText('Token Art', locale)}`}
                    title={`${name} — ${translateUiText('Token Art', locale)}`}
                  >
                    <img src={tokenUrl} alt={translateUiText("Token Art", locale)} loading="lazy" />
                  </button>
                ) : null}
              </div>
              <div className={styles.petDetailHeroBody}>
                <h1 id="pet-detail-title">{name}</h1>
                <div className={styles.simBaseStatsGrid}>
                  <div className={`${styles.simStatBox} ${styles.simStatBoxAtk}`}>
                    <div className={styles.simStatBoxLabel}>
                      <img className={styles.simStatBoxIcon} src={gameAsset(STAT_ICONS.atk)} alt="" />
                      <span>{strings.petStatAtkLevel.replace('{level}', String(displayedPetStatLevel))}</span>
                    </div>
                    <div className={styles.simStatBoxVal}>{formatPetNumber(displayedPetStats?.atk)}</div>
                  </div>
                  <div className={`${styles.simStatBox} ${styles.simStatBoxCrit}`}>
                    <div className={styles.simStatBoxLabel}>
                      <img className={styles.simStatBoxIcon} src={gameAsset(STAT_ICONS.crit)} alt="" />
                      <span>{strings.petStatCritLevel.replace('{level}', String(displayedPetStatLevel))}</span>
                    </div>
                    <div className={styles.simStatBoxVal}>{formatPetNumber(displayedPetStats?.crit)}</div>
                  </div>
                  <div className={`${styles.simStatBox} ${styles.simStatBoxCrit}`}>
                    <div className={styles.simStatBoxLabel}>
                      <img className={styles.simStatBoxIcon} src={gameAsset(STAT_ICONS.crit)} alt="" />
                      <span>{strings.petStatCritDmg}</span>
                    </div>
                    <div className={styles.simStatBoxVal}>{formatPetPercent(displayedPetStats?.crit_dmg)}</div>
                  </div>
                </div>
                {isMmo ? (
                  <div className={styles.petDetailInheritance}>
                    <span className={styles.petDetailInheritanceLabel}>
                      <span aria-hidden="true">⚔</span>
                      {strings.atkInherit}
                    </span>
                    <strong className={styles.petDetailInheritanceValue}>100%</strong>
                  </div>
                ) : null}
              </div>
            </section>

            {!isMmo ? (
              <div className={styles.petDetailColumn}>
                <details className={styles.petDetailSection} id="pet-advancements-section" data-panel-anchor="pet-advancements-section" open>
                  <summary className={styles.petDetailSectionHeader}>
                    <h3>{strings.starAdvancements}</h3>
                  </summary>
                  {starsList.length > 0 ? (
                    <div className={styles.petDetailAdvancementList}>
                      {starsList.map((star) => (
                        <details
                          key={star.star}
                          className={styles.petDetailAdvancement}
                          id={`pet-star-${star.star}`}
                          data-panel-anchor={`pet-star-${star.star}`}
                          open
                        >
                          <summary>
                            <span className={styles.petDetailStarBadge}>★{star.star}</span>
                            <span className={styles.petDetailAdvancementTitle}>
                              {strings.starLevel.replace('{star}', String(star.star))}
                            </span>
                            <span className={styles.petDetailAdvancementChips}>
                              {star.atk_inheritance ? <span>{translateUiText('ATK', locale)}: {star.atk_inheritance}</span> : null}
                              {star.module_slots ? <span>{translateUiText('Slots', locale)}: {star.module_slots}</span> : null}
                              {star.module_load ? <span>{translateUiText('Load', locale)}: {star.module_load}</span> : null}
                            </span>
                            <span className={styles.petDetailChevron}>▾</span>
                          </summary>
                          <div className={styles.petDetailAdvancementBody}>
                            <RichTextDisplay
                              text={star.desc || star.description}
                              links={petTextLinks}
                            />
                          </div>
                        </details>
                      ))}
                    </div>
                  ) : (
                    <p className={styles.petDetailEmpty}>—</p>
                  )}
                </details>
              </div>
            ) : null}

            {isMmo ? (
              <>
                <div className={styles.petDetailColumn}>
                  <details className={styles.petDetailSection} id="pet-skills-section" data-panel-anchor="pet-skills-section" open>
                    <summary className={styles.petDetailSectionHeader}>
                      <h3>{strings.combatSkills}</h3>
                    </summary>
                    <div className={styles.petDetailSkills}>{(pet.skills || []).map(renderSkill)}</div>
                  </details>
                </div>
                <div className={styles.petDetailColumn}>
                  {lore ? (
                    <details className={styles.petDetailSection} id="pet-lore-section" data-panel-anchor="pet-lore-section" open>
                      <summary className={styles.petDetailSectionHeader}>
                        <h3>{strings.loreTitle}</h3>
                      </summary>
                      <div className={styles.petDetailLore}>
                        <RichTextDisplay text={lore} links={petTextLinks} />
                      </div>
                    </details>
                  ) : null}
                </div>
              </>
            ) : (
              <div className={styles.petDetailColumn}>
                {lore ? (
                  <details className={styles.petDetailSection} id="pet-lore-section" data-panel-anchor="pet-lore-section" open>
                    <summary className={styles.petDetailSectionHeader}>
                      <h3>{strings.loreTitle}</h3>
                    </summary>
                    <div className={styles.petDetailLore}>
                      <RichTextDisplay text={lore} links={petTextLinks} />
                    </div>
                  </details>
                ) : null}

                <details className={styles.petDetailSection} id="pet-skills-section" data-panel-anchor="pet-skills-section" open>
                  <summary className={styles.petDetailSectionHeader}>
                    <h3>{strings.combatSkills}</h3>
                  </summary>
                  <div className={styles.petDetailSkills}>{(pet.skills || []).map(renderSkill)}</div>
                </details>
              </div>
            )}
          </div>

          {!isMmo && (exclusiveModules.length > 0 || universalModules.length > 0) ? (
            <div className={styles.petDetailModules}>
              {exclusiveModules.length > 0 ? (
                <details className={styles.petDetailSection} id="pet-exclusive-modules-section" data-panel-anchor="pet-exclusive-modules-section" open>
                  <summary className={styles.petDetailSectionHeader}>
                    <h3>{strings.exclusiveModules}</h3>
                  </summary>
                  <div className={styles.petDetailModuleGrid}>
                    {exclusiveModules.map((module) => renderModuleCard(module, true))}
                  </div>
                </details>
              ) : null}
              {universalModules.length > 0 ? (
                <details className={styles.petDetailSection} id="pet-universal-modules-section" data-panel-anchor="pet-universal-modules-section" open>
                  <summary className={styles.petDetailSectionHeader}>
                    <h3>{strings.universalModules}</h3>
                  </summary>
                  <div className={styles.petDetailModuleGrid}>
                    {universalModules.map((module) => renderModuleCard(module, false))}
                  </div>
                </details>
              ) : null}
            </div>
          ) : null}

          <SimulacraAssetsSection
            character={simulacraPet}
            locale={locale}
            strings={simulacraStrings}
            onOpenLightbox={openLightbox}
          />
          <SimulacraDevSection character={simulacraPet} locale={locale} strings={simulacraStrings} devData={petDevData} hideRawJson />
        </div>
      </article>

      <InfoLightbox
        isOpen={isLightboxOpen}
        onClose={() => setIsLightboxOpen(false)}
        src={lightboxSrc || artPngUrl}
        webpSrc={lightboxWebpSrc || artUrl}
        caption={lightboxCaption || `${name} (${pet.quality || 'SSR'})`}
        isRu={isRu}
      />
    </>
  );
};
