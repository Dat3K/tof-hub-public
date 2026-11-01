'use client';

import { type Locale, translateUiText} from '@tof-hub/i18n';
import { getPlayerRoleLabel, PLAYER_ROLE_LABELS } from '@tof-hub/game-domain';
import React from 'react';
import type {WeaponOptionsCatalog} from '../../info-sections/common/weapon-options';
import type { SquadPlayer, SquadRole, SlotDnDHandlers, SlotDragDescriptor } from '../types';
import type { CompCatalogView } from '../data';
import { resolveCompRoleIcon } from '../data';
import { getPlayerActiveRole } from '../state';
import { CompSlot } from './CompSlot';
import { getCompStrings } from '../copy';
import styles from '../comp.module.css';

interface CompPlayerRowProps {
  weaponOptions?:WeaponOptionsCatalog|null;
  player: SquadPlayer;
  playerIndex: number;
  totalActive: number;
  catalog: CompCatalogView;
  locale: Locale;
  server: 'standard' | 'mmo';
  onPlayerNameChange: (index: number, name: string) => void;
  onWeaponModeChange: (index: number, mode: 'active' | 'passive') => void;
  onOpenRolePopover: (e: React.MouseEvent, pIdx: number) => void;
  onOpenPicker: (type: 'trait' | 'weapon' | 'matrix' | 'relic', pIdx: number, sIdx?: number, cIdx?: 0 | 1) => void;
  onOpenStarsPopover: (e: React.MouseEvent, type: 'weapon' | 'matrix', pIdx: number, sIdx: number, cIdx?: 0 | 1) => void;
  onOpenRankPopover: (e: React.MouseEvent, pIdx: number, sIdx: number) => void;
  onToggleWeaponSplit: (pIdx: number, sIdx: number) => void;
  onMoveUp: (pIdx: number) => void;
  onMoveDown: (pIdx: number) => void;
  onClearPlayer: (pIdx: number) => void;
  onCustomTextChange: (type: 'trait' | 'weapon' | 'matrix' | 'relic', pIdx: number, sIdx: number, text: string) => void;
  onDragStart?: (e: React.DragEvent, pIdx: number) => void;
  onDragOver?: (e: React.DragEvent, pIdx: number) => void;
  onDrop?: (e: React.DragEvent, pIdx: number) => void;
  isDraggingRow?: boolean;
  isDropTargetRow?: boolean;
  slotDnD?: SlotDnDHandlers;
  onSlotPhotoAction?: (action: 'change' | 'remove', desc: SlotDragDescriptor) => void;
}

/** Role chip colours of a squad row; the names are PLAYER_ROLE_LABELS of @tof-hub/game-domain. */
const ROLE_LABELS: Record<SquadRole, { en: string; ru: string; color: string; bg: string }> = {
  tank: { ...PLAYER_ROLE_LABELS.tank, color: '#fde047', bg: 'rgba(245, 158, 11, 0.25)' },
  healer: { ...PLAYER_ROLE_LABELS.healer, color: '#6ee7b7', bg: 'rgba(16, 185, 129, 0.25)' },
  dps: { ...PLAYER_ROLE_LABELS.dps, color: '#fca5a5', bg: 'rgba(239, 68, 68, 0.25)' },
  balance: { ...PLAYER_ROLE_LABELS.balance, color: '#e2e8f0', bg: 'rgba(148, 163, 184, 0.25)' },
};

export const CompPlayerRow: React.FC<CompPlayerRowProps> = ({
  player,
  weaponOptions,
  playerIndex,
  totalActive,
  catalog,
  locale,
  server,
  onPlayerNameChange,
  onWeaponModeChange,
  onOpenRolePopover,
  onOpenPicker,
  onOpenStarsPopover,
  onOpenRankPopover,
  onToggleWeaponSplit,
  onMoveUp,
  onMoveDown,
  onClearPlayer,
  onCustomTextChange,
  onDragStart,
  onDragOver,
  onDrop,
  isDraggingRow = false,
  isDropTargetRow = false,
  slotDnD,
  onSlotPhotoAction,
}) => {
  const strings = getCompStrings(locale);
  const activeRole = getPlayerActiveRole(player, catalog);
  const supportsWeaponMode =
    activeRole === 'tank' || activeRole === 'healer' || player.role === 'tank' || player.role === 'healer';
  const roleMeta = ROLE_LABELS[activeRole] || ROLE_LABELS.dps;
  const roleIcon = resolveCompRoleIcon(activeRole);

  const rowRoleClass =
    activeRole === 'tank'
      ? styles.rowTank
      : activeRole === 'healer'
      ? styles.rowHealer
      : activeRole === 'balance'
      ? styles.rowBalance
      : styles.rowDps;

  return (
    <div
      className={`${styles.row} ${server === 'mmo' ? styles.rowMmo : ''} ${rowRoleClass} ${isDraggingRow ? styles.rowDragging : ''} ${isDropTargetRow ? styles.rowDropTarget : ''}`}
      draggable
      onDragStart={(e) => onDragStart?.(e, playerIndex)}
      onDragOver={(e) => onDragOver?.(e, playerIndex)}
      onDrop={(e) => onDrop?.(e, playerIndex)}
      role="row"
      aria-label={`${strings.playerRowAria.replace('{n}', String(playerIndex + 1))}: ${player.name}`}
    >
      {/* Col 1: Player & Role Info */}
      <div className={styles.colPlayer}>
        <span className={styles.dragHandle} aria-label={strings.dragReorderTitle} aria-hidden="true">
          ⋮⋮
        </span>
        <span className={styles.playerIndex}>{String(playerIndex + 1).padStart(2, '0')}</span>
        <div className={styles.playerMeta}>
          <button
            type="button"
            className={styles.roleBadge}
            style={{ backgroundColor: roleMeta.bg, color: roleMeta.color }}
            onClick={(e) => onOpenRolePopover(e, playerIndex)}
            aria-label={strings.changeRoleTitle}
          >
            {roleIcon && (
              <img
                src={roleIcon}
                alt=""
                className="w-3.5 h-3.5 object-contain inline-block"
                aria-hidden="true"
              />
            )}
            <span>{getPlayerRoleLabel(activeRole, locale)}</span>
          </button>
          <input
            type="text"
            className={styles.playerNameInput}
            value={/^Player \d+$/.test(player.name) ? (locale === 'ru' ? 'Игрок {0}' : translateUiText('Player {0}', locale)).replace('{0}', player.name.slice(7)) : player.name}
            onChange={(e) => onPlayerNameChange(playerIndex, e.target.value)}
            maxLength={28}
            aria-label={strings.playerNameAria.replace('{n}', String(playerIndex + 1))}
          />
        </div>
      </div>

      {/* Col 2: Awakening Trait Slot (Circular) */}
      {server === 'mmo' ? (
        <div className={styles.colTrait} aria-hidden="true" />
      ) : (
        <div className={styles.colTrait}>
          <CompSlot
            type="trait"
            playerIndex={playerIndex}
            traitId={player.trait}
            catalog={catalog}
            locale={locale}
            onOpenPicker={onOpenPicker}
            dragDescriptor={{ type: 'trait', pIdx: playerIndex, sIdx: 0 }}
            slotDnD={slotDnD}
            onSlotPhotoAction={onSlotPhotoAction}
            traitCustomText={player.traitCustomText}
            customTextValue={player.traitCustomText ?? ''}
            onCustomTextChange={(text) => onCustomTextChange('trait', playerIndex, 0, text)}
          />
        </div>
      )}

      {/* Col 3: Weapons (3 Slots) */}
      <div className={styles.colWeapons}>
        {[0, 1, 2].map((wIdx) => (
          <div key={wIdx} className={styles.configuredWeapon}><CompSlot
            key={wIdx}
            type="weapon"
            playerIndex={playerIndex}
            slotIndex={wIdx}
            weaponSlot={player.weapons[wIdx]}
            weaponElementForms={server==='standard'?([[player.weapons[wIdx]?.id,player.weapons[wIdx]?.element],[player.weapons[wIdx]?.id2,player.weapons[wIdx]?.element2]] as const)
              .map(([id,form])=>id&&form?weaponOptions?.weapons[id]?.selectableElements?.find(option=>option.id===form)?.elements:undefined) as [string[]|undefined,string[]|undefined]:undefined}
            catalog={catalog}
            locale={locale}
            onOpenPicker={onOpenPicker}
            onOpenStarsPopover={onOpenStarsPopover}
            onToggleWeaponSplit={onToggleWeaponSplit}
            dragDescriptor={{ type: 'weapon', pIdx: playerIndex, sIdx: wIdx }}
            slotDnD={slotDnD}
            onSlotPhotoAction={onSlotPhotoAction}
            customTextValue={player.weapons[wIdx]?.customText ?? ''}
            onCustomTextChange={(text) => onCustomTextChange('weapon', playerIndex, wIdx, text)}
          /></div>
        ))}
      </div>

      {/* MMO weapon mode occupies the matrix column so weapon and relic slots keep their own columns. */}
      {server === 'mmo' && (
        <div className={styles.colWeaponMode}>
          {supportsWeaponMode && (
            <div className={styles.weaponModeControl} role="group" aria-label={strings.weaponModeAria.replace('{n}', String(playerIndex + 1))}>
              {(['active', 'passive'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={`${styles.weaponModeButton} ${(player.weaponMode ?? 'active') === mode ? styles.weaponModeButtonActive : ''}`}
                  aria-pressed={(player.weaponMode ?? 'active') === mode}
                  onClick={() => onWeaponModeChange(playerIndex, mode)}
                >
                  {mode === 'active' ? strings.weaponModeActive : strings.weaponModePassive}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Col 4: Matrix Chipsets (3 Sets) */}
      {server !== 'mmo' && <div className={styles.colMatrices}>
        {[0, 1, 2].map((mIdx) => (
          <CompSlot
            key={mIdx}
            type="matrix"
            playerIndex={playerIndex}
            slotIndex={mIdx}
            matrixSlot={player.weapons[mIdx]?.matrix}
            catalog={catalog}
            locale={locale}
            onOpenPicker={onOpenPicker}
            onOpenStarsPopover={onOpenStarsPopover}
            dragDescriptor={{ type: 'matrix', pIdx: playerIndex, sIdx: mIdx }}
            slotDnD={slotDnD}
            onSlotPhotoAction={onSlotPhotoAction}
            customTextValue={player.weapons[mIdx]?.matrix?.customText ?? ''}
            onCustomTextChange={(text) => onCustomTextChange('matrix', playerIndex, mIdx, text)}
          />
        ))}
      </div>}

      {/* Col 5: Relics (2 Slots) */}
      <div className={styles.colRelics}>
        {[0, 1].map((rIdx) => (
          <CompSlot
            key={rIdx}
            type="relic"
            playerIndex={playerIndex}
            slotIndex={rIdx}
            relicSlot={player.relics[rIdx]}
            catalog={catalog}
            locale={locale}
            onOpenPicker={onOpenPicker}
            onOpenRankPopover={onOpenRankPopover}
            dragDescriptor={{ type: 'relic', pIdx: playerIndex, sIdx: rIdx }}
            slotDnD={slotDnD}
            onSlotPhotoAction={onSlotPhotoAction}
            customTextValue={player.relics[rIdx]?.customText ?? ''}
            onCustomTextChange={(text) => onCustomTextChange('relic', playerIndex, rIdx, text)}
          />
        ))}
      </div>

      {/* Col 6: Order Actions (Move Up, Move Down, Clear Player) */}
      <div className={styles.colActions}>
        <div className={styles.orderBtns}>
          <button
            type="button"
            className={styles.actionBtn}
            disabled={playerIndex === 0}
            onClick={() => onMoveUp(playerIndex)}
            aria-label={strings.moveUp}
          >
            ▲
          </button>
          <button
            type="button"
            className={styles.actionBtn}
            disabled={playerIndex === totalActive - 1}
            onClick={() => onMoveDown(playerIndex)}
            aria-label={strings.moveDown}
          >
            ▼
          </button>
        </div>
        <button
          type="button"
          className={`${styles.actionBtn} ${styles.actionBtnClear}`}
          onClick={() => onClearPlayer(playerIndex)}
          aria-label={strings.clearPlayer}
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
};
