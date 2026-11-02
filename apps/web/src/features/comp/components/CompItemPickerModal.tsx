'use client';
import { localeText } from '@/lib/i18n/text';

import { localized } from '@tof-hub/i18n';
import { type Locale } from '@tof-hub/i18n';
import React, { useState, useMemo, useRef } from 'react';
import type { PickerSlotType } from '../types';
import type {
  CompCatalogView,
  CompSimulacrumView,
  CompWeaponView,
  CompMatrixView,
  CompRelicView,
} from '../data';
import {
  scoreAndMatchEntity,
  normalizeCompact,
  resolveCompTraitIcon,
  resolveCompWeaponIcon,
  resolveCompMatrixIcon,
  resolveCompRelicIcon,
  resolveCompPropertyIcon,
  resolveCompElementIcon,
  resolveCompRoleIcon,
  compareCompItemsByNewest,
  getLocalizedText,
} from '../data';
import { processUploadedImageFile } from '../custom-photos';
import { getCompStrings } from '../copy';
import { Button,CatalogSearch,EntityCard,EntityGrid,GameBadge,Modal,useToast,type ElementVariant,type RarityVariant,type PropertyVariant, PickerActionCard } from '@tof-hub/ui';
import { gameAsset } from '@tof-hub/game-assets';
import {compareSimulacraRelease} from '../../info-sections/common/catalog-release-order';
import {LoadoutBadges,LoadoutFilters} from '../../info-sections/common/loadout-filters';
import { getDualElementIconPath } from '@/features/info-sections/common/element-icons';
import { PLAYER_ROLE_LABELS, getElementShortLabel, matchesPrimaryElement } from '@tof-hub/game-domain';
import styles from '../comp.module.css';

interface CompItemPickerModalProps {
  isOpen: boolean;
  type: PickerSlotType;
  playerIndex: number;
  slotIndex: number;
  chipIndex?: 0 | 1;
  catalog: CompCatalogView;
  locale: Locale;
  server: 'standard' | 'mmo';
  onClose: () => void;
  onSelectItem: (itemId: string, customText?: string) => void;
  onClearSlot: () => void;
  onUploadCustomPhoto: (dataUrl: string) => void;
}

function matrixOwners(matrix:CompMatrixView,catalog:CompCatalogView,locale:Locale,server:'standard'|'mmo') {
  const suitKey=String(matrix.id||'').toLowerCase().replace(/^suit_/,'');
  const ownerName=matrix.simName?getLocalizedText(matrix.simName,locale).toLowerCase():'';
  return catalog.simulacra.filter(sim=>{
    if (server === 'mmo' ? sim.serverMode !== 'mmo' : sim.serverMode === 'mmo') return false;
    const key=String(sim.matrixSuitId||'').toLowerCase().replace(/^suit_/,'');
    return !!((key&&key===suitKey)||sim.id===matrix.simulacrumId||(ownerName&&getLocalizedText(sim.name,locale).toLowerCase()===ownerName));
  });
}
function matrixElements(matrix:CompMatrixView,owners:CompSimulacrumView[]) {
  const carriers=(matrix.carriers??[]).map(carrier=>carrier.element).filter(Boolean);
  return [...new Set(carriers.length?carriers:owners.map(owner=>owner.element).filter(Boolean))];
}
function matrixLoadouts(matrix:CompMatrixView,owners:CompSimulacrumView[]) {
  const carriers=(matrix.carriers??[]).filter(carrier=>carrier.element);
  const loadouts=carriers.length?carriers.map(carrier=>{
    const owner=owners.find(owner=>owner.id===carrier.id)??owners.find(owner=>owner.element===carrier.element);
    return {
      elements:[carrier.element,owner?.elementSecondary].filter((element):element is NonNullable<typeof element>=>!!element),
      role:matrixResonance(owner?.role??carrier.role),
    };
  }):owners.map(owner=>({
    elements:[owner.element,owner.elementSecondary].filter((element):element is NonNullable<typeof element>=>!!element),
    role:matrixResonance(owner.role),
  }));
  return [...new Map(loadouts.map(loadout=>[`${loadout.elements.join('-')}:${loadout.role}`,loadout])).values()];
}

function matrixResonance(role?:string|null) {
  const normalized=role?.toLowerCase();
  return normalized==='support'||normalized==='healer'?'benediction':normalized??'';
}

export const CompItemPickerModal: React.FC<CompItemPickerModalProps> = ({
  isOpen,
  type,
  playerIndex,
  slotIndex,
  chipIndex = 0,
  catalog,
  locale,
  server,
  onClose,
  onSelectItem,
  onClearSlot,
  onUploadCustomPhoto,
}) => {
  const strings = getCompStrings(locale);
  const uploadNotice=useToast();
  const [query, setQuery] = useState('');
  const [selectedElements, setSelectedElements] = useState<string[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedQuality, setSelectedQuality] = useState<'all' | 'SSR' | 'SR'>('all');
  const [selectedProperties, setSelectedProperties] = useState<string[]>([]);
  const [customTextInput, setCustomTextInput] = useState('');
  const [showCustomTextInput, setShowCustomTextInput] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter items based on active criteria
  const filteredItems = useMemo(() => {
    const rawQuery = query.toLowerCase().trim();
    const compactQuery = normalizeCompact(rawQuery);
    const compareNewest = (a: any, b: any) => {
      if ((type === 'weapon'||type === 'trait') && server === 'mmo') return compareSimulacraRelease(a,b,true);
      return compareCompItemsByNewest(a, b);
    };

    const sortList = <T,>(list: T[]): T[] => {
      if (!rawQuery) {
        return [...list].sort(compareNewest);
      }
      return [...list].sort((a, b) => {
        const scoreA = scoreAndMatchEntity(a, rawQuery, compactQuery).score;
        const scoreB = scoreAndMatchEntity(b, rawQuery, compactQuery).score;
        if (scoreB !== scoreA) return scoreB - scoreA;
        return compareNewest(a, b);
      });
    };

    if (type === 'trait') {
      const list = (catalog.simulacra || []).filter((sim: CompSimulacrumView) => {
        if (server === 'mmo' ? sim.serverMode !== 'mmo' : sim.serverMode === 'mmo') return false;
        // Element filter
        if (selectedElements.length > 0) {
          if (!matchesPrimaryElement(sim.element, selectedElements)) return false;
        }
        // Role filter
        if (selectedRoles.length > 0) {
          const r = sim.role?.toLowerCase();
          const normRoles = selectedRoles.map((x) => (x === 'healer' ? 'benediction' : x.toLowerCase()));
          if (!normRoles.includes(r)) return false;
        }
        // Search query
        if (rawQuery) {
          return scoreAndMatchEntity(sim, rawQuery, compactQuery).match;
        }
        return true;
      });
      return sortList(list);
    }

    if (type === 'weapon') {
      const list = (catalog.weapons || []).filter((w: CompWeaponView) => {
        if (server === 'mmo' ? w.serverMode !== 'mmo' : w.serverMode === 'mmo') return false;
        if (selectedElements.length > 0) {
          if (!matchesPrimaryElement(w.element, selectedElements)) return false;
        }
        if (selectedRoles.length > 0) {
          const rawRole = (w.canonicalRole || w.role)?.toLowerCase();
          const r = rawRole === 'support' || rawRole === 'healer' ? 'benediction' : rawRole;
          const normRoles = selectedRoles.map((x) => (x === 'healer' ? 'benediction' : x.toLowerCase()));
          if (!normRoles.includes(r)) return false;
        }
        if (rawQuery) {
          return scoreAndMatchEntity(w, rawQuery, compactQuery).match;
        }
        return true;
      });
      return sortList(list);
    }

    if (type === 'matrix') {
      const list = (catalog.matrices || []).filter((m: CompMatrixView) => {
        if (selectedQuality !== 'all') {
          if ((m.quality || '').toUpperCase() !== selectedQuality) return false;
        }
        const associatedSimulacra=matrixOwners(m,catalog,locale,server);
        if (selectedElements.length > 0) {
          const hasElement=matrixElements(m,associatedSimulacra).some(element=>matchesPrimaryElement(element,selectedElements));
          if (!hasElement) return false;
        }
        if (selectedRoles.length > 0) {
          const selectedRoleKeys = selectedRoles.map((role) =>
            role === 'healer' ? 'benediction' : role.toLowerCase()
          );
          const matchesRole = (role?: string | null) => {
            const normalizedRole = (role || '').toLowerCase();
            const key = normalizedRole === 'support' || normalizedRole === 'healer'
              ? 'benediction'
              : normalizedRole;
            return selectedRoleKeys.includes(key);
          };
          const carrierHasRole = (m.carriers || []).some((carrier) => matchesRole(carrier.role));
          const simulacrumHasRole = associatedSimulacra.some((sim) => matchesRole(sim.role));
          if (!carrierHasRole && !simulacrumHasRole) return false;
        }
        if (rawQuery) {
          return scoreAndMatchEntity(m, rawQuery, compactQuery).match;
        }
        return true;
      });
      return sortList(list);
    }

    if (type === 'relic') {
      const list = (catalog.relics || []).filter((r: CompRelicView) => {
        if (server === 'mmo' ? r.serverMode !== 'mmo' : r.serverMode === 'mmo') return false;
        if (selectedQuality !== 'all') {
          if ((r.quality || '').toUpperCase() !== selectedQuality) return false;
        }
        if (selectedProperties.length > 0) {
          const p = (r.property || '').toLowerCase();
          const normProps = selectedProperties.map((x) => x.toLowerCase());
          if (!normProps.includes(p)) return false;
        }
        if (rawQuery) {
          return scoreAndMatchEntity(r, rawQuery, compactQuery).match;
        }
        return true;
      });
      return sortList(list);
    }

    return [];
  }, [type, catalog, query, selectedElements, selectedRoles, selectedQuality, selectedProperties, server]);

  const handleFileUpload = async(e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const accepted=await processUploadedImageFile(file, (dataUrl) => {
        onUploadCustomPhoto(dataUrl);
        onSelectItem('__CP__');
        onClose();
      });
      if(!accepted)uploadNotice.notify(localeText(locale)('Use a PNG, JPEG or WebP up to 6 MB and 25 megapixels.', 'Нужен PNG, JPEG или WebP до 6 МБ и 25 мегапикселей.'));
    }
  };

  const slotSuffix = `${slotIndex + 1}${chipIndex === 1 ? ' [2]' : ''}`;
  const modalTitle =
    type === 'trait'
      ? strings.pickerTraitTitle
      : type === 'weapon'
        ? strings.pickerWeaponTitle.replace('{slot}', slotSuffix)
        : type === 'matrix'
          ? strings.pickerMatrixTitle.replace('{slot}', slotSuffix)
          : strings.pickerRelicTitle.replace('{slot}', String(slotIndex + 1));

  const renderElemBadge=(element?:string|null,secondary?:string|null,combo?:string|null)=>{
    if(!element)return null;
    const icon=combo||getDualElementIconPath(element,secondary)||resolveCompElementIcon(element);
    return <GameBadge variant={element.toLowerCase() as ElementVariant} secondaryElement={secondary?.toLowerCase() as ElementVariant|undefined}
      presentation="icon" size="sm" icon={<img src={gameAsset(icon)} alt="" loading="lazy"/>}>{[element,secondary].filter((item):item is string=>!!item).map(item=>getElementShortLabel(item,locale)).join(' / ')}</GameBadge>;
  };
  const renderRoleBadge=(role?:string|null,canonicalRole?:string|null)=>{
    const raw=(canonicalRole||role||'').toLowerCase();
    const icon=resolveCompRoleIcon(canonicalRole||role||'');
    if(!icon)return null;
    const kind=raw.includes('tank')||raw.includes('fort')?'tank':raw.includes('heal')||raw.includes('bene')||raw.includes('supp')?'benediction':raw.includes('bal')?'balance':'dps';
    const label=kind==='benediction'?{en:'Benediction',ru:'Благословение'}:PLAYER_ROLE_LABELS[kind];
    return <GameBadge variant={kind==='balance'?'default':kind} presentation="icon" size="sm" icon={<img src={icon} alt="" loading="lazy"/>}>{localized(label, locale)}</GameBadge>;
  };

  // The shared tool picker dialog (as in Build): focus stays inside and returns to the slot on close.
  return (
    <Modal appearance="tool" size="picker" isOpen={isOpen} onClose={onClose} ariaLabel={modalTitle} className="info-ui">
      <Modal.Header actions={<Button variant="outline" className="tool-panel-remove" onClick={() => { onClearSlot(); onClose(); }}>{strings.removeItem}</Button>}>
        <Modal.Title>{modalTitle}</Modal.Title>
        <p className={styles.pickerSubtitle}>
          {strings.pickerSubtitle.replace('{player}', String(playerIndex + 1)).replace('{slot}', String(slotIndex + 1))}
        </p>
      </Modal.Header>

      <Modal.Controls className="info-ui">
          {/* Search Input */}
          <CatalogSearch
            value={query}
            onChange={setQuery}
            placeholder={strings.pickerSearch}
            debounceMs={150}
          />

          {/* Dynamic Filter Rows */}
          <div className={`${styles.pickerTabs} info-ui`}>
          <LoadoutFilters locale={locale} labels={{element:strings.filterElement,role:strings.filterRole,rarity:strings.filterRarity,property:strings.filterProperty,all:strings.filterAll}}
            elements={type==='trait'||type==='weapon'||(type==='matrix'&&server!=='mmo')?{selected:selectedElements,onChange:setSelectedElements}:undefined}
            roles={type==='trait'||type==='weapon'||(type==='matrix'&&server!=='mmo')?{selected:selectedRoles,onChange:setSelectedRoles}:undefined}
            quality={type==='relic'||(type==='matrix'&&server!=='mmo')?{selected:selectedQuality,onChange:value=>setSelectedQuality(value as 'all'|'SSR'|'SR')}:undefined}
            properties={type==='relic'?{selected:selectedProperties,onChange:setSelectedProperties}:undefined}
          />
        </div>

        {showCustomTextInput && (
          <div className={styles.pickerCustomPanel}>
            <input
              type="text"
              className={styles.pickerCustomInput}
              placeholder={strings.customPlaceholder}
              value={customTextInput}
              onChange={(e) => setCustomTextInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && customTextInput.trim()) {
                  onSelectItem('__TEXT__', customTextInput.trim());
                  onClose();
                }
              }}
            />
            <button
              type="button"
              className={styles.pickerApplyBtn}
              disabled={!customTextInput.trim()}
              onClick={() => {
                onSelectItem('__TEXT__', customTextInput.trim());
                onClose();
              }}
            >
              {strings.apply}
            </button>
          </div>
        )}
      </Modal.Controls>

      <Modal.Body>
        <EntityGrid columns={5} gap="sm">
          {/* Custom text card FIRST */}
          <PickerActionCard className="min-h-[12.8125rem]" icon="✎" title={strings.customText} description={strings.customTextSub}
            ariaLabel={strings.customText} onClick={() => setShowCustomTextInput((v) => !v)} />
          {/* Custom photo upload card SECOND */}
          <PickerActionCard className="min-h-[12.8125rem]" icon="📷" title={strings.uploadPhoto} description={strings.uploadPhotoSub}
            ariaLabel={strings.uploadPhoto} onClick={() => fileInputRef.current?.click()} />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            tabIndex={-1}
            aria-hidden="true"
            onChange={handleFileUpload}
          />
          {filteredItems.length === 0 ? (
            <div className={styles.pickEmpty}>{strings.noMatches}</div>
          ) : (
            filteredItems.map((item: any) => {
              const select=()=>{onSelectItem(item.id);onClose();};
              const quality=type==='weapon'||type==='trait'?item.rarity:item.quality;
              const raritySlot=quality?<GameBadge variant={quality.toLowerCase() as RarityVariant} size="sm">{quality}</GameBadge>:undefined;
              if (type === 'trait') {
                const sim=item as CompSimulacrumView;
                return <EntityCard key={sim.id} presentation="picker" title={getLocalizedText(sim.name,locale)} subtitle={getLocalizedText(sim.weaponName,locale)||undefined}
                  image={resolveCompTraitIcon(sim)} artZoom={1} artPosition="center" raritySlot={raritySlot}
                  badges={[<React.Fragment key="loadout">{renderElemBadge(sim.element,sim.elementSecondary,sim.elementComboIcon)}{renderRoleBadge(sim.role)}</React.Fragment>]}
                  onClick={select} dataId={sim.id}/>;
              }
              if (type === 'weapon') {
                const w=item as CompWeaponView;
                return <EntityCard key={w.id} presentation="picker" title={getLocalizedText(w.name,locale)} subtitle={getLocalizedText(w.simName,locale)||undefined}
                  image={resolveCompWeaponIcon(w)} artZoom={1} artPosition="center" raritySlot={raritySlot}
                  badges={[<React.Fragment key="loadout">{renderElemBadge(w.element,w.elementSecondary,w.elementComboIcon)}{renderRoleBadge(w.role,w.canonicalRole)}</React.Fragment>]}
                  onClick={select} dataId={w.id}/>;
              }
              if (type === 'matrix') {
                const m=item as CompMatrixView;
                return <EntityCard key={m.id} presentation="picker" title={getLocalizedText(m.name,locale)} subtitle={getLocalizedText(m.simName,locale)||m.quality}
                  image={resolveCompMatrixIcon(m)} artZoom={1} artPosition="center" raritySlot={raritySlot} badges={matrixLoadouts(m,matrixOwners(m,catalog,locale,server)).map(({elements,role})=><LoadoutBadges key={`${elements.join('-')}:${role}`} elements={elements} role={role} locale={locale}/>)} onClick={select} dataId={m.id}/>;
              }
              if (type === 'relic') {
                const r=item as CompRelicView;
                return <EntityCard key={r.id} presentation="picker" title={getLocalizedText(r.name,locale)} subtitle={r.property}
                  image={resolveCompRelicIcon(r)} artZoom={1} artPosition="center" raritySlot={raritySlot}
                  badges={[<GameBadge key="property" variant={r.property.toLowerCase() as PropertyVariant} size="sm" presentation="icon" icon={<img src={resolveCompPropertyIcon(r.property)} alt="" loading="lazy"/>}>{r.property}</GameBadge>]}
                  onClick={select} dataId={r.id}/>;
              }

              return null;
            })
          )}
        </EntityGrid>
      </Modal.Body>
    </Modal>
  );
};
