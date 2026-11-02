'use client';

import { type Locale, translateUiText} from '@tof-hub/i18n';
import { fillText, localeText } from '@/lib/i18n/text';
import React from 'react';
import {Tooltip} from '@tof-hub/ui';
import {RelicEffects} from '../../info-sections/common/relic-effects';
import {COMP_TRAIT_IMAGE_SCALE} from '../image-layout';
import type {
  SquadWeaponSlot,
  SquadMatrixSlot,
  SquadRelicSlot,
  SlotDragDescriptor,
  SlotDnDHandlers,
} from '../types';
import type { CompCatalogView, CompSimulacrumView, CompWeaponView, CompMatrixView, CompRelicView } from '../data';
import {
  resolveCompTraitIcon,
  resolveCompWeaponIcon,
  resolveCompMatrixIcon,
  resolveCompRelicIcon,
  resolveCompPropertyIcon,
  resolveCompWeaponElementBadge,
  getLocalizedText,
} from '../data';
import { getCustomPhoto } from '../custom-photos';
import { getCompStrings } from '../copy';
import { formatRelicRank, formatStars, parseSlotNumber } from '../format';
import styles from '../comp.module.css';

interface CompSlotProps {
  type: 'trait' | 'weapon' | 'matrix' | 'relic';
  playerIndex: number;
  slotIndex?: number;
  chipIndex?: 0 | 1;
  traitId?: string | null;
  weaponSlot?: SquadWeaponSlot;
  /** Chosen element form of each weapon chip (gacha `selectableElements`); overrides the catalog badge. */
  weaponElementForms?: [string[] | undefined, string[] | undefined];
  matrixSlot?: SquadMatrixSlot | null;
  relicSlot?: SquadRelicSlot;
  catalog: CompCatalogView;
  locale: Locale;
  onOpenPicker: (type: 'trait' | 'weapon' | 'matrix' | 'relic', pIdx: number, sIdx?: number, cIdx?: 0 | 1) => void;
  onOpenStarsPopover?: (e: React.MouseEvent, type: 'weapon' | 'matrix', pIdx: number, sIdx: number, cIdx?: 0 | 1) => void;
  onOpenRankPopover?: (e: React.MouseEvent, pIdx: number, sIdx: number) => void;
  onToggleWeaponSplit?: (pIdx: number, sIdx: number) => void;
  dragDescriptor?: SlotDragDescriptor;
  slotDnD?: SlotDnDHandlers;
  onSlotPhotoAction?: (action: 'change' | 'remove', desc: SlotDragDescriptor) => void;
  traitCustomText?: string | null;
  customTextValue?: string;
  onCustomTextChange?: (text: string) => void;
}

export const CompSlot: React.FC<CompSlotProps> = ({
  type,
  playerIndex,
  slotIndex = 0,
  traitId,
  weaponSlot,
  weaponElementForms,
  matrixSlot,
  relicSlot,
  catalog,
  locale,
  onOpenPicker,
  onOpenStarsPopover,
  onOpenRankPopover,
  onToggleWeaponSplit,
  dragDescriptor,
  slotDnD,
  onSlotPhotoAction,
  traitCustomText,
  customTextValue,
  onCustomTextChange,
}) => {
  const strings = getCompStrings(locale);
  // Slot-to-slot drag & drop (parity with legacy draggable slots).
  const dndActive = Boolean(dragDescriptor && slotDnD);
  const dndClass =
    dndActive && dragDescriptor && slotDnD
      ? slotDnD.isDragging(dragDescriptor)
        ? ` ${styles.slotDrag}`
        : slotDnD.isDropTarget(dragDescriptor)
          ? ` ${styles.slotDropTarget}`
          : ''
      : '';
  const dndProps =
    dndActive && dragDescriptor && slotDnD
      ? {
          draggable: true as const,
          onDragStart: (e: React.DragEvent) => {
            // Keep row reorder from hijacking slot drags.
            e.stopPropagation();
            slotDnD.onDragStart(e, dragDescriptor);
          },
          onDragOver: (e: React.DragEvent) => slotDnD.onDragOver(e, dragDescriptor),
          onDragLeave: (e: React.DragEvent) => slotDnD.onDragLeave(e, dragDescriptor),
          onDrop: (e: React.DragEvent) => slotDnD.onDrop(e, dragDescriptor),
        }
      : {};
  // Custom photo tag + hover actions (parity with legacy custom slots).
  const renderPhotoExtras = (
    isPhoto: boolean,
    customText: string | null | undefined,
    desc: SlotDragDescriptor
  ) => (
    <>
      {customText ? <div className={styles.customTag}>{customText}</div> : null}
      {isPhoto && onSlotPhotoAction ? (
        <div className={styles.customActions}>
          <button
            type="button"
            className={styles.customActionBtn}
            aria-label={strings.changePhoto}
            onClick={(e) => {
              e.stopPropagation();
              onSlotPhotoAction('change', desc);
            }}
          >
            ✎
          </button>
          <button
            type="button"
            className={styles.customActionBtn}
            aria-label={strings.removePhoto}
            onClick={(e) => {
              e.stopPropagation();
              onSlotPhotoAction('remove', desc);
            }}
          >
            ×
          </button>
        </div>
      ) : null}
    </>
  );
  // Inline custom-text input + photo upload inside empty slots (legacy parity).
  const renderCustomRow = (desc: SlotDragDescriptor) =>
    onCustomTextChange ? (
      <div className={styles.slotCustomRow} onClick={(e) => e.stopPropagation()}>
        <input
          type="text"
          className={styles.slotCustomInput}
          value={customTextValue ?? ''}
          onChange={(e) => onCustomTextChange(e.target.value.slice(0, 24))}
          placeholder={strings.customPlaceholder}
          maxLength={24}
          aria-label={strings.customText}
        />
        {onSlotPhotoAction ? (
          <button
            type="button"
            className={styles.slotCustomUploadBtn}
            aria-label={strings.uploadPhoto}
            onClick={(e) => {
              e.stopPropagation();
              onSlotPhotoAction('change', desc);
            }}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          </button>
        ) : null}
      </div>
    ) : null;
  // Weapon element badge (legacy parity): combo icon, dual pair, or single icon.
  const renderWeaponElementBadge = (w: CompWeaponView | null | undefined, chip = false, form?: string[]) => {
    const badge = resolveCompWeaponElementBadge(w && form?.length ? { element: form[0] as CompWeaponView['element'], elementSecondary: form[1] as CompWeaponView['elementSecondary'], elementComboIcon: undefined } : w);
    if (badge.kind === 'none') return null;
    const base = chip ? styles.chipElemBadge : styles.elementBadge;
    const dual = badge.kind === 'dual' ? ` ${chip ? styles.chipElemBadgeDual : styles.elemBadgeDual}` : '';
    return (
      <span className={`${base}${dual}`}>
        {badge.icons.map((src) => (
          <img key={src} src={src} alt="" aria-hidden="true" loading="lazy" />
        ))}
      </span>
    );
  };
  // 1. TRAIT SLOT
  if (type === 'trait') {
    const isCp = traitId === '__CP__';
    const photoUrl = isCp ? getCustomPhoto(playerIndex, 'trait', 0) : null;
    const sim = traitId && !isCp ? catalog.simulacra.find((s: CompSimulacrumView) => s.id === traitId) : null;

    if (traitId) {
      const traitIcon = isCp ? (photoUrl || '') : sim ? resolveCompTraitIcon(sim) : '';
      const charName = sim ? getLocalizedText(sim.name, locale) : strings.customPhoto;
      const traitTip = sim ? JSON.stringify({
        title:charName,
        subtitle:`${strings.traitPrefix}: ${getLocalizedText(sim.traitName,locale)}`,
        desc:translateUiText(getLocalizedText(sim.traitDesc,locale),locale),
      }) : undefined;

      return (
        <div
          data-comp-tip={traitTip}
          className={`${styles.traitAvatar}${dndClass}`}
          {...dndProps}
          onClick={() => onOpenPicker('trait', playerIndex, 0)}
          role="button"
          tabIndex={0}
          aria-label={fillText(localeText(locale)('{0} Trait','Талант персонажа: {0}'),[charName])}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onOpenPicker('trait', playerIndex, 0);
            }
          }}
        >
          {traitIcon ? (
            <img src={traitIcon} alt={charName} className="w-full h-full object-cover" style={{transform:`scale(${COMP_TRAIT_IMAGE_SCALE})`}} loading="lazy" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[0.625rem] text-slate-400 font-mono">CP</div>
          )}
          {renderPhotoExtras(isCp, traitCustomText ?? null, {
            type: 'trait',
            pIdx: playerIndex,
            sIdx: 0,
          })}
        </div>
      );
    }

    return (
      <div
        className={`${styles.traitEmpty}${dndClass}`}
        {...dndProps}
        onClick={() => onOpenPicker('trait', playerIndex, 0)}
        role="button"
        tabIndex={0}
        aria-label={translateUiText("Equip Trait", locale)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpenPicker('trait', playerIndex, 0);
          }
        }}
      >
        <span className="text-base font-bold">+</span>
        <span>{strings.traitPrefix}</span>
        {renderCustomRow({ type: 'trait', pIdx: playerIndex, sIdx: 0 })}
      </div>
    );
  }

  // 2. WEAPON SLOT
  if (type === 'weapon') {
    const w = weaponSlot;
    const hasPrimary = Boolean(w && (w.id || w.customText));
    const hasSecondary = Boolean(w && (w.id2 || w.customText2));

    if (hasSecondary) {
      // 2+2 overlapping weapon split
      const isCp1 = w?.id === '__CP__';
      const isCp2 = w?.id2 === '__CP__';
      const photoUrl1 = isCp1 ? getCustomPhoto(playerIndex, 'weapon', slotIndex, 0) : null;
      const photoUrl2 = isCp2 ? getCustomPhoto(playerIndex, 'weapon', slotIndex, 1) : null;
      const w1 = w?.id && !isCp1 ? (catalog.weapons || []).find((cw: CompWeaponView) => cw.id === w.id) : null;
      const w2 = w?.id2 && !isCp2 ? (catalog.weapons || []).find((cw: CompWeaponView) => cw.id === w.id2) : null;
      const thumb1 = isCp1 ? photoUrl1 : w1 ? resolveCompWeaponIcon(w1) : '';
      const thumb2 = isCp2 ? photoUrl2 : w2 ? resolveCompWeaponIcon(w2) : '';
      const name1 = w1 ? getLocalizedText(w1.name, locale) : w?.customText || strings.weaponFallback1;
      const name2 = w2 ? getLocalizedText(w2.name, locale) : w?.customText2 || strings.weaponFallback2;
      const weaponSplitTip = JSON.stringify({
        title: `${name1} / ${name2}`,
        subtitle: `${formatStars(w?.stars, 6)} / ${formatStars(w?.stars2, 6)}`,
        desc: `Back: ${name1} (${formatStars(w?.stars, 6)})\nFront: ${name2} (${formatStars(w?.stars2, 6)})`,
      });

      return (
        <div
          className={`${styles.slot} ${styles.slot2Plus2}${dndClass}`}
          {...dndProps}
          data-comp-tip={weaponSplitTip}
        >
          {/* Back Chip (legacy diagonal: bottom-left) */}
          <div
            className={styles.chipBackWeapon}
            onClick={() => onOpenPicker('weapon', playerIndex, slotIndex, 0)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onOpenPicker('weapon', playerIndex, slotIndex, 0);
              }
            }}
          >
            {thumb1 && <img src={thumb1} alt={name1} className={styles.slotImg} loading="lazy" />}
            {!thumb1 && w?.customText ? (
              <span className="absolute inset-0 flex items-center justify-center gap-0.5 text-[0.5625rem] text-slate-300 font-bold px-1 text-center leading-tight">
                <span>✎</span>
                <span className="truncate">{w.customText}</span>
              </span>
            ) : null}
            {renderWeaponElementBadge(w1, true, weaponElementForms?.[0])}
            <span
              className={styles.chipStar}
              onClick={(e) => {
                e.stopPropagation();
                onOpenStarsPopover?.(e, 'weapon', playerIndex, slotIndex, 0);
              }}
            aria-label={strings.weaponStars}
            >
              {formatStars(w?.stars, 6)}
            </span>
          </div>

          {/* Front Chip (legacy diagonal: top-right) */}
          <div
            className={styles.chipFrontWeapon}
            onClick={() => onOpenPicker('weapon', playerIndex, slotIndex, 1)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onOpenPicker('weapon', playerIndex, slotIndex, 1);
              }
            }}
          >
            {thumb2 && <img src={thumb2} alt={name2} className={styles.slotImg} loading="lazy" />}
            {!thumb2 && w?.customText2 ? (
              <span className="absolute inset-0 flex items-center justify-center gap-0.5 text-[0.5625rem] text-slate-300 font-bold px-1 text-center leading-tight">
                <span>✎</span>
                <span className="truncate">{w.customText2}</span>
              </span>
            ) : null}
            {renderWeaponElementBadge(w2, true, weaponElementForms?.[1])}
            <span
              className={styles.chipStar}
              onClick={(e) => {
                e.stopPropagation();
                onOpenStarsPopover?.(e, 'weapon', playerIndex, slotIndex, 1);
              }}
            aria-label={strings.weaponStars}
            >
              {formatStars(w?.stars2, 6)}
            </span>
          </div>

          {/* Collapse 2+2 Button */}
          {onToggleWeaponSplit && (
            <button
              type="button"
              className={`${styles.splitBtn} ${styles.splitBtnCollapse}`}
              onClick={(e) => {
                e.stopPropagation();
                onToggleWeaponSplit(playerIndex, slotIndex);
              }}
            aria-label={strings.removeSecondary}
            >
              &minus;
            </button>
          )}
        </div>
      );
    }

    if (hasPrimary) {
      const isCp = w?.id === '__CP__';
      const photoUrl = isCp ? getCustomPhoto(playerIndex, 'weapon', slotIndex, 0) : null;
      const weapon = w?.id && !isCp ? (catalog.weapons || []).find((cw: CompWeaponView) => cw.id === w.id) : null;
      const thumb = isCp ? photoUrl : weapon ? resolveCompWeaponIcon(weapon) : '';
      const name = weapon ? getLocalizedText(weapon.name, locale) : w?.customText || strings.weaponFallback;
      const weaponTip = weapon
        ? JSON.stringify({
            title: name,
            subtitle: `${translateUiText(String(weapon.element), locale)} • ${translateUiText(String(weapon.canonicalRole || weapon.role), locale)} (${weapon.rarity || 'SSR'})`,
            desc: translateUiText('Equipped at {0} advancement.', locale).replace('{0}', formatStars(w?.stars, 6)),
          })
        : undefined;

      return (
        <div
          className={`${styles.slot} ${styles.slotEquippedWeapon}${dndClass}`}
          {...dndProps}
          data-comp-tip={weaponTip}
          onClick={() => onOpenPicker('weapon', playerIndex, slotIndex, 0)}
          role="button"
          tabIndex={0}
          aria-label={name}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onOpenPicker('weapon', playerIndex, slotIndex, 0);
            }
          }}
        >
          {thumb ? (
            <img src={thumb} alt={name} className={styles.slotImg} loading="lazy" />
          ) : (
            <span className="text-xs text-slate-300 font-bold px-1 truncate">
              {w?.customText ? (
                <>
                  <span>✎</span>
                  <span>{w.customText}</span>
                </>
              ) : (
                'W'
              )}
            </span>
          )}
          {renderPhotoExtras(isCp, w?.customText ?? null, {
            type: 'weapon',
            pIdx: playerIndex,
            sIdx: slotIndex,
          })}

          {/* Element Badge (combo / dual / single, legacy parity) */}
          {renderWeaponElementBadge(weapon, false, weaponElementForms?.[0])}

          {/* Stars Badge */}
          <span
            className={styles.starBadge}
            onClick={(e) => {
              e.stopPropagation();
              onOpenStarsPopover?.(e, 'weapon', playerIndex, slotIndex, 0);
            }}
            aria-label={strings.advStarsWeapon}
          >
            {formatStars(w?.stars, 6)}
          </span>

          {/* Toggle 2+2 Split Button */}
          {onToggleWeaponSplit && (
            <button
              type="button"
              className={styles.splitBtn}
              onClick={(e) => {
                e.stopPropagation();
                onToggleWeaponSplit(playerIndex, slotIndex);
              }}
            aria-label={strings.addSecondary}
            >
              +
            </button>
          )}
        </div>
      );
    }

    // Empty Weapon Slot
    return (
      <div
        className={`${styles.slot}${dndClass}`}
        {...dndProps}
        onClick={() => onOpenPicker('weapon', playerIndex, slotIndex, 0)}
        role="button"
        tabIndex={0}
        aria-label={fillText(localeText(locale)('Equip Weapon {0}'), [slotIndex + 1])}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpenPicker('weapon', playerIndex, slotIndex, 0);
          }
        }}
      >
        <div className={styles.slotEmpty}>
          <span className="text-base font-bold">+</span>
          <span>{strings.weaponLabel}</span>
          {renderCustomRow({ type: 'weapon', pIdx: playerIndex, sIdx: slotIndex })}
        </div>
      </div>
    );
  }

  // 3. MATRIX SLOT
  if (type === 'matrix') {
    const m = matrixSlot;
    const hasPrimary = Boolean(m && (m.id || m.customText));
    const hasSecondary = Boolean(m && (m.id2 || m.customText2));

    if (hasSecondary) {
      // 2+2 matrix split
      const isCp1 = m?.id === '__CP__';
      const isCp2 = m?.id2 === '__CP__';
      const photoUrl1 = isCp1 ? getCustomPhoto(playerIndex, 'matrix', slotIndex, 0) : null;
      const photoUrl2 = isCp2 ? getCustomPhoto(playerIndex, 'matrix', slotIndex, 1) : null;
      const m1 = m?.id && !isCp1 ? catalog.matrices.find((cm: CompMatrixView) => cm.id === m.id) : null;
      const m2 = m?.id2 && !isCp2 ? catalog.matrices.find((cm: CompMatrixView) => cm.id === m.id2) : null;
      const thumb1 = isCp1 ? photoUrl1 : m1 ? resolveCompMatrixIcon(m1) : '';
      const thumb2 = isCp2 ? photoUrl2 : m2 ? resolveCompMatrixIcon(m2) : '';
      const name1 = m1 ? getLocalizedText(m1.name, locale) : strings.chipFallback1;
      const name2 = m2 ? getLocalizedText(m2.name, locale) : strings.chipFallback2;
      const matrixSplitTip = JSON.stringify({
        sections:[
          {title:name1,subtitle:`2pc · ${formatStars(m?.stars,3)}`,desc:m1?getLocalizedText(m1.desc2p,locale):'',rank:parseSlotNumber(m?.stars) ?? undefined},
          {title:name2,subtitle:`2pc · ${formatStars(m?.stars2,3)}`,desc:m2?getLocalizedText(m2.desc2p,locale):'',rank:parseSlotNumber(m?.stars2) ?? undefined},
        ],
      });

      return (
        <div
          data-comp-tip={matrixSplitTip}
          className={`${styles.slot} ${styles.slot2Plus2}${dndClass}`}
          {...dndProps}
        >
          <div
            className={styles.chipBack}
            onClick={() => onOpenPicker('matrix', playerIndex, slotIndex, 0)}
            aria-label={`2pc ${name1} (${formatStars(m?.stars, 3)})`}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onOpenPicker('matrix', playerIndex, slotIndex, 0);
              }
            }}
          >
            {thumb1 && <img src={thumb1} alt={name1} className={styles.slotImg} loading="lazy" />}
            {!thumb1 && m?.customText ? (
              <span className="absolute inset-0 flex items-center justify-center gap-0.5 text-[0.5625rem] text-slate-300 font-bold px-1 text-center leading-tight">
                <span>✎</span>
                <span className="truncate">{m.customText}</span>
              </span>
            ) : null}
            <span
              className={`${styles.chipStar} ${styles.chipStarBack}`}
              onClick={(e) => {
                e.stopPropagation();
                onOpenStarsPopover?.(e, 'matrix', playerIndex, slotIndex, 0);
              }}
            aria-label={strings.matrixStars}
            >
              {formatStars(m?.stars, 3)}
            </span>
          </div>
          <div
            className={styles.chipFront}
            onClick={() => onOpenPicker('matrix', playerIndex, slotIndex, 1)}
            aria-label={`2pc ${name2} (${formatStars(m?.stars2, 3)})`}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onOpenPicker('matrix', playerIndex, slotIndex, 1);
              }
            }}
          >
            {thumb2 && <img src={thumb2} alt={name2} className={styles.slotImg} loading="lazy" />}
            {!thumb2 && m?.customText2 ? (
              <span className="absolute inset-0 flex items-center justify-center gap-0.5 text-[0.5625rem] text-slate-300 font-bold px-1 text-center leading-tight">
                <span>✎</span>
                <span className="truncate">{m.customText2}</span>
              </span>
            ) : null}
            <span
              className={styles.chipStar}
              onClick={(e) => {
                e.stopPropagation();
                onOpenStarsPopover?.(e, 'matrix', playerIndex, slotIndex, 1);
              }}
            aria-label={strings.matrixStars}
            >
              {formatStars(m?.stars2, 3)}
            </span>
          </div>
          <span
            className={styles.badge2Plus2}
            onClick={(e) => {
              e.stopPropagation();
              onOpenStarsPopover?.(e, 'matrix', playerIndex, slotIndex, 0);
            }}
            aria-label={strings.setBonus}
          >
            2+2
          </span>
        </div>
      );
    }

    if (hasPrimary) {
      const isCp = m?.id === '__CP__';
      const photoUrl = isCp ? getCustomPhoto(playerIndex, 'matrix', slotIndex, 0) : null;
      const matrix = m?.id && !isCp ? catalog.matrices.find((cm: CompMatrixView) => cm.id === m.id) : null;
      const thumb = isCp ? photoUrl : matrix ? resolveCompMatrixIcon(matrix) : '';
      const name = matrix ? getLocalizedText(matrix.name, locale) : m?.customText || strings.matrixFallback;
      const setDesc = matrix
        ? getLocalizedText(m?.count === 2 ? matrix.desc2p : matrix.desc4p, locale)
        : '';
      const matrixTip = matrix ? JSON.stringify({
        title:name,
        subtitle:`${m?.count ?? 4}pc Set Bonus · ${formatStars(m?.stars,3)} (${matrix.quality || 'SSR'})`,
        desc:setDesc || strings.fullSetEffect,
        rank:parseSlotNumber(m?.stars) ?? undefined,
      }) : undefined;

      return (
        <div
          data-comp-tip={matrixTip}
          className={`${styles.slot} ${styles.slotEquippedMatrix}${dndClass}`}
          {...dndProps}
          onClick={() => onOpenPicker('matrix', playerIndex, slotIndex, 0)}
          role="button"
          tabIndex={0}
          aria-label={name}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onOpenPicker('matrix', playerIndex, slotIndex, 0);
            }
          }}
        >
          {thumb ? (
            <img src={thumb} alt={name} className={styles.slotImg} loading="lazy" />
          ) : (
            <span className="text-xs text-slate-300 font-bold px-1 truncate">
              {m?.customText ? (
                <>
                  <span>✎</span>
                  <span>{m.customText}</span>
                </>
              ) : (
                'M'
              )}
            </span>
          )}
          {renderPhotoExtras(isCp, m?.customText ?? null, {
            type: 'matrix',
            pIdx: playerIndex,
            sIdx: slotIndex,
          })}

          {/* 2pc / 4pc Badge */}
          <span
            className={styles.matrixCountBadge}
            onClick={(e) => {
              e.stopPropagation();
              onOpenStarsPopover?.(e, 'matrix', playerIndex, slotIndex, 0);
            }}
            aria-label={strings.setBonus}
          >
            {m?.count ?? 4}pc
          </span>

          {/* Stars Badge */}
          <span
            className={styles.starBadge}
            onClick={(e) => {
              e.stopPropagation();
              onOpenStarsPopover?.(e, 'matrix', playerIndex, slotIndex, 0);
            }}
            aria-label={strings.advStarsMatrix}
          >
            {formatStars(m?.stars, 3)}
          </span>
        </div>
      );
    }

    // Empty Matrix Slot
    return (
      <div
        className={`${styles.slot}${dndClass}`}
        {...dndProps}
        onClick={() => onOpenPicker('matrix', playerIndex, slotIndex, 0)}
        role="button"
        tabIndex={0}
        aria-label={fillText(localeText(locale)('Equip Matrix {0}'), [slotIndex + 1])}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpenPicker('matrix', playerIndex, slotIndex, 0);
          }
        }}
      >
        <div className={styles.slotEmpty}>
          <span className="text-base font-bold">+</span>
          <span>{strings.matrixLabel}</span>
          {renderCustomRow({ type: 'matrix', pIdx: playerIndex, sIdx: slotIndex })}
        </div>
      </div>
    );
  }

  // 4. RELIC SLOT
  if (type === 'relic') {
    const r = relicSlot;
    if (r && (r.id || r.customText)) {
      const isCp = r.id === '__CP__';
      const photoUrl = isCp ? getCustomPhoto(playerIndex, 'relic', slotIndex) : null;
      const relic = r.id && !isCp ? catalog.relics.find((cr: CompRelicView) => cr.id === r.id) : null;
      const thumb = isCp ? photoUrl : relic ? resolveCompRelicIcon(relic) : '';
      const name = relic ? getLocalizedText(relic.name, locale) : r.customText || strings.relicFallback;
      const relicRank = r.rank ?? 5;
      const numRank = typeof relicRank === 'number'
        ? relicRank
        : parseInt(String(relicRank).replace(/\D/g, ''), 10);
      const relicDetails = relic ? <>
        <strong className={styles.slotTipTitle}>{name}</strong>
        <div className={styles.tipSubtitle}>★{Number.isFinite(numRank)?numRank:5} · {relic.quality || 'SSR'}</div>
        <RelicEffects locale={locale} stars={Number.isFinite(numRank)?numRank:5} item={{
          description:{en:getLocalizedText(relic.desc,'en'),ru:getLocalizedText(relic.desc,'ru')},
          effects:relic.stars.map(effect=>({level:effect.star,description:{en:getLocalizedText(effect.desc,'en'),ru:getLocalizedText(effect.desc,'ru')}})),
        }}/>
      </> : null;
      const relicQualityCls = relic
        ? (relic.quality || 'SSR').toUpperCase() === 'SSR'
          ? ` ${styles.relicSsr}`
          : ` ${styles.relicSr}`
        : '';
      const relicRankCls =
        relicRank === 5 || numRank === 5 || String(relicRank).toUpperCase() === 'MAX'
          ? styles.relicRankR5
          : numRank === 4
            ? styles.relicRankR4
            : numRank === 3
              ? styles.relicRankR3
              : numRank === 2
                ? styles.relicRankR2
                : numRank === 1
                  ? styles.relicRankR1
                  : numRank === 0
                    ? styles.relicRankR0
                    : styles.relicRankR5;

      return (
        <Tooltip portal dismissOnAction disabled={!relic} className={styles.slotTooltip} content={relicDetails}><div
          className={`${styles.slot}${dndClass}${relicQualityCls}`}
          {...dndProps}
          onClick={() => onOpenPicker('relic', playerIndex, slotIndex)}
          role="button"
          tabIndex={0}
          aria-label={name}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onOpenPicker('relic', playerIndex, slotIndex);
            }
          }}
        >
          {thumb ? (
            <img src={thumb} alt={name} className={styles.slotImg} loading="lazy" />
          ) : (
            <span className="text-xs text-slate-300 font-bold px-1 truncate">
              {r.customText ? (
                <>
                  <span>✎</span>
                  <span>{r.customText}</span>
                </>
              ) : (
                'R'
              )}
            </span>
          )}
          {renderPhotoExtras(isCp, r.customText, {
            type: 'relic',
            pIdx: playerIndex,
            sIdx: slotIndex,
          })}

          {/* Rank Badge */}
          <span
            className={`${styles.relicRankBadge} ${relicRankCls}`}
            onClick={(e) => {
              e.stopPropagation();
              onOpenRankPopover?.(e, playerIndex, slotIndex);
            }}
            aria-label={strings.relicRank}
          >
            {formatRelicRank(r.rank, 5)}
          </span>
        </div></Tooltip>
      );
    }

    // Empty Relic Slot
    return (
      <div
        className={`${styles.slot}${dndClass}`}
        {...dndProps}
        onClick={() => onOpenPicker('relic', playerIndex, slotIndex)}
        role="button"
        tabIndex={0}
        aria-label={fillText(localeText(locale)('Equip Relic {0}'), [slotIndex + 1])}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpenPicker('relic', playerIndex, slotIndex);
          }
        }}
      >
        <div className={styles.slotEmpty}>
          <span className="text-base font-bold">+</span>
          <span>{strings.relicLabel}</span>
          {renderCustomRow({ type: 'relic', pIdx: playerIndex, sIdx: slotIndex })}
        </div>
      </div>
    );
  }

  return null;
};
