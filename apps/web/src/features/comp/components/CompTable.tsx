'use client';

import { type Locale } from '@tof-hub/i18n';
import {useWeaponOptions} from '../../info-sections/common/use-weapon-options';
import React, { startTransition, useState, useMemo, ViewTransition } from 'react';
import type { SquadState, SlotDragDescriptor, SlotDnDHandlers } from '../types';
import type { CompCatalogView } from '../data';
import { CompPlayerRow } from './CompPlayerRow';
import { getCompStrings } from '../copy';
import styles from '../comp.module.css';

interface CompTableProps {
  state: SquadState;
  catalog: CompCatalogView;
  locale: Locale;
  onPlayerNameChange: (index: number, name: string) => void;
  onWeaponModeChange: (index: number, mode: 'active' | 'passive') => void;
  onOpenRolePopover: (e: React.MouseEvent, pIdx: number) => void;
  onOpenPicker: (type: 'trait' | 'weapon' | 'matrix' | 'relic', pIdx: number, sIdx?: number, cIdx?: 0 | 1) => void;
  onOpenStarsPopover: (e: React.MouseEvent, type: 'weapon' | 'matrix', pIdx: number, sIdx: number, cIdx?: 0 | 1) => void;
  onOpenRankPopover: (e: React.MouseEvent, pIdx: number, sIdx: number) => void;
  onToggleWeaponSplit: (pIdx: number, sIdx: number) => void;
  onMovePlayer: (fromIdx: number, toIdx: number) => void;
  onClearPlayer: (pIdx: number) => void;
  onSwapSlots: (a: SlotDragDescriptor, b: SlotDragDescriptor) => void;
  onSlotPhotoAction: (action: 'change' | 'remove', desc: SlotDragDescriptor) => void;
  onCustomTextChange: (type: 'trait' | 'weapon' | 'matrix' | 'relic', pIdx: number, sIdx: number, text: string) => void;
}

export const CompTable: React.FC<CompTableProps> = ({
  state,
  catalog,
  locale,
  onPlayerNameChange,
  onWeaponModeChange,
  onOpenRolePopover,
  onOpenPicker,
  onOpenStarsPopover,
  onOpenRankPopover,
  onToggleWeaponSplit,
  onMovePlayer,
  onClearPlayer,
  onSwapSlots,
  onSlotPhotoAction,
  onCustomTextChange,
}) => {
  const weaponOptions=useWeaponOptions(state.server==='standard');
  const strings = getCompStrings(locale);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  // Slot-to-slot drag & drop (mirrors legacy draggable slots).
  const [draggedSlot, setDraggedSlot] = useState<SlotDragDescriptor | null>(null);
  const [dropTarget, setDropTarget] = useState<SlotDragDescriptor | null>(null);

  const sameSlot = (a: SlotDragDescriptor | null, b: SlotDragDescriptor) =>
    Boolean(a && a.type === b.type && a.pIdx === b.pIdx && a.sIdx === b.sIdx);

  const slotDnD: SlotDnDHandlers = useMemo(
    () => ({
      onDragStart: (e, desc) => {
        setDraggedSlot(desc);
        setDropTarget(null);
        e.dataTransfer.effectAllowed = 'move';
        try {
          e.dataTransfer.setData('text/plain', `${desc.type}:${desc.pIdx}:${desc.sIdx}`);
        } catch (_) {}
      },
      onDragOver: (e, desc) => {
        if (!draggedSlot || draggedSlot.type !== desc.type || sameSlot(draggedSlot, desc)) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
        setDropTarget((prev) => (sameSlot(prev, desc) ? prev : desc));
      },
      onDragLeave: (e, desc) => {
        e.stopPropagation();
        setDropTarget((prev) => (sameSlot(prev, desc) ? null : prev));
      },
      onDrop: (e, desc) => {
        e.preventDefault();
        e.stopPropagation();
        setDropTarget(null);
        if (!draggedSlot || draggedSlot.type !== desc.type || sameSlot(draggedSlot, desc)) {
          setDraggedSlot(null);
          return;
        }
        onSwapSlots(draggedSlot, desc);
        setDraggedSlot(null);
      },
      isDragging: (desc) => sameSlot(draggedSlot, desc),
      isDropTarget: (desc) => sameSlot(dropTarget, desc),
    }),
    [onSwapSlots, draggedSlot, dropTarget]
  );

  const activePlayers = state.players.slice(0, state.mode);

  const handleDragStart = (e: React.DragEvent, pIdx: number) => {
    setDraggedIndex(pIdx);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(pIdx));
  };

  const movePlayer = (fromIdx: number, toIdx: number) => {
    startTransition(() => onMovePlayer(fromIdx, toIdx));
  };

  const handleDragOver = (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTargetIndex((current) => (current === targetIdx ? current : targetIdx));
  };

  const handleDrop = (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== targetIdx) {
      movePlayer(draggedIndex, targetIdx);
    }
    setDraggedIndex(null);
    setDropTargetIndex(null);
  };

  return (
    <section
      className={styles.tableCard}
      aria-label={strings.tableAria}
      onDragEndCapture={() => {
        setDraggedIndex(null);
        setDropTargetIndex(null);
        setDraggedSlot(null);
        setDropTarget(null);
      }}
    >
      <div className={styles.tableScroll}>
        {/* Table Column Headers */}
        <div className={`${styles.tableHead} ${state.server === 'mmo' ? styles.tableHeadMmo : ''}`} role="row">
          <div className={styles.tableHeadTh}>
            {strings.colRolePlayer}
          </div>
          {state.server === 'mmo' ? (
            <div className={styles.tableHeadTh} aria-hidden="true" />
          ) : (
            <div className={`${styles.tableHeadTh} ${styles.tableHeadThCenter}`}>
              {strings.colTrait}
            </div>
          )}
          <div className={`${styles.tableHeadTh} ${styles.tableHeadThCenter}`}>
            {strings.colWeapons}
          </div>
          {state.server === 'mmo' ? <div className={`${styles.tableHeadTh} ${styles.tableHeadThCenter}`}>
            {strings.colWeaponMode}
          </div> : <div className={`${styles.tableHeadTh} ${styles.tableHeadThCenter}`}>
            {strings.colMatrices}
          </div>}
          <div className={`${styles.tableHeadTh} ${styles.tableHeadThCenter}`}>
            {strings.colRelics}
          </div>
          <div className={`${styles.tableHeadTh} ${styles.tableSignature}`}>
            @kritik
          </div>
        </div>

        {/* Table Rows */}
        <div className={`${styles.tableBody} ${state.server === 'mmo' ? styles.tableBodyMmo : ''}`} role="rowgroup">
          {activePlayers.map((player, pIdx) => (
            <ViewTransition key={player.id || pIdx} default="comp-row-move">
              <CompPlayerRow
                player={player}
                playerIndex={pIdx}
                totalActive={activePlayers.length}
                catalog={catalog}
                locale={locale}
                server={state.server}
                onPlayerNameChange={onPlayerNameChange}
                onWeaponModeChange={onWeaponModeChange}
                weaponOptions={weaponOptions}
                onOpenRolePopover={onOpenRolePopover}
                onOpenPicker={onOpenPicker}
                onOpenStarsPopover={onOpenStarsPopover}
                onOpenRankPopover={onOpenRankPopover}
                onToggleWeaponSplit={onToggleWeaponSplit}
                onMoveUp={(idx) => movePlayer(idx, idx - 1)}
                onMoveDown={(idx) => movePlayer(idx, idx + 1)}
                onClearPlayer={onClearPlayer}
                onCustomTextChange={onCustomTextChange}
                slotDnD={slotDnD}
                onSlotPhotoAction={onSlotPhotoAction}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                isDraggingRow={draggedIndex === pIdx}
                isDropTargetRow={draggedIndex !== null && dropTargetIndex === pIdx && draggedIndex !== pIdx}
              />
            </ViewTransition>
          ))}
        </div>
      </div>
    </section>
  );
};
