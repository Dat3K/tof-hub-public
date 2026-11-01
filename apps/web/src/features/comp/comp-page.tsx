'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocale } from '@/lib/i18n';
import { localeText } from '@/lib/i18n/text';
import {
  useCompCatalog,
  type SquadState,
  type SquadMode,
  type SquadRole,
  type ActivePickerTarget,
  type ActivePopoverTarget,
  type SlotDragDescriptor,
  loadSquadPreset,
  setSquadMode,
  movePlayer,
  swapWeaponSlots,
  swapMatrixSlots,
  swapRelicSlots,
  swapTraits,
  swapCustomPhotos,
  clearCustomPhoto,
  processUploadedImageFile,
  clearPlayer,
  clearSquad,
  clearPlayerSlot,
  splitMatrix2Plus2,
  getLocalizedText,
  copyShareLink,
  exportCompToPng,
  deserializeSquadState,
  serializeSquadState,
  getWeaponCanonicalRole,
  detectResonance,
  PRESET_LIST,
  PRESET_MMO_8P,
  PRESET_FROST_8P,
  setCustomPhoto,
} from '@/features/comp';
import {
  CompToolbar,
  CompTable,
  CompTooltip,
  CompItemPickerModal,
  CompRolePopover,
  CompStarPopover,
  CompRankPopover,
  CompToast,
} from '@/features/comp/components';
import { LoadingState } from '@/components/site-shell';
import { getCompStrings } from '@/features/comp/copy';
import styles from '@/features/comp/comp.module.css';

function readSquadStateFromUrl(): SquadState | null {
  if (typeof window === 'undefined') return null;

  const searchParams = new URLSearchParams(window.location.search);
  const hasQueryState = searchParams.has('c') || searchParams.has('comp');
  const payload = hasQueryState
    ? window.location.search
    : window.location.hash && window.location.hash.length > 1
      ? window.location.hash
      : '';

  return payload ? deserializeSquadState(payload) : null;
}

export default function CompPage() {
  const { locale } = useLocale();
  const currentLocale = locale;
  const strings = getCompStrings(currentLocale);
  const { catalog, isLoading, error } = useCompCatalog({ locale: currentLocale });

  // Decode shared builds before the first client render so an MMO link never
  // briefly displays the default Standard preset while the catalog is loading.
  const [initialLinkedState] = useState<SquadState | null>(readSquadStateFromUrl);

  // Squad State
  const [squadState, setSquadState] = useState<SquadState>(() => {
    if (initialLinkedState) return initialLinkedState;
    return loadSquadPreset(PRESET_FROST_8P.id);
  });

  const [activePreset, setActivePreset] = useState<string>(
    initialLinkedState ? '' : PRESET_FROST_8P.id
  );
  const [activePicker, setActivePicker] = useState<ActivePickerTarget | null>(null);
  const [activePopover, setActivePopover] = useState<ActivePopoverTarget | null>(null);
  const [toastMessage, setToastMessage] = useState<string>('');
  const [showToast, setShowToast] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Mirror legacy syncStateToUrl: persist every squad mutation to ?c=
  // via replaceState (no history entries), so refresh keeps the squad and
  // the address bar is always a shareable link.
  useEffect(() => {
    if (typeof window === 'undefined' || !catalog) return;
    try {
      const serialized = serializeSquadState(squadState);
      if (!serialized) return;
      const params = new URLSearchParams(window.location.search);
      if (params.get('c') === serialized) return;
      const pathname = window.location.pathname.endsWith('/comp')
        ? `${window.location.pathname}/`
        : window.location.pathname;
      window.history.replaceState(null, '', `${pathname}?c=${serialized}`);
    } catch (_) {}
  }, [squadState, catalog]);

  const showToastNotification = useCallback((msg: string) => {
    setToastMessage(msg);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  }, []);

  // Mode change handler (4p <-> 8p)
  const handleModeChange = useCallback((newMode: SquadMode) => {
    if (newMode === squadState.mode) return;

    const server = squadState.server ?? 'standard';
    const preset = PRESET_LIST.find(
      (item) => item.mode === newMode && (item.server ?? 'standard') === server
    );

    if (preset) {
      setSquadState(loadSquadPreset(preset.id));
      setActivePreset(preset.id);
      return;
    }

    setSquadState((prev) => setSquadMode(prev, newMode));
    setActivePreset('');
  }, [squadState.mode, squadState.server]);

  // Each server mode starts with a matching example composition.
  const handleServerChange = useCallback((server: 'standard' | 'mmo') => {
    const preset = server === 'mmo' ? PRESET_MMO_8P : PRESET_FROST_8P;
    setSquadState({
      mode: preset.mode,
      server: preset.server ?? server,
      title: preset.name_en,
      players: JSON.parse(JSON.stringify(preset.players)),
    });
    setActivePreset(preset.id);
  }, []);

  // Preset selection handler
  const handlePresetSelect = useCallback((presetId: string) => {
    setActivePreset(presetId);
    const newState = loadSquadPreset(presetId);
    setSquadState(newState);
  }, []);

  // Share Comp handler
  const handleShareComp = useCallback(async () => {
    try {
      const url = await copyShareLink(squadState);
      // Synchronize URL query in browser address bar without reloading
      if (typeof window !== 'undefined' && window.history) {
        window.history.replaceState(null, '', url);
      }
      showToastNotification(strings.linkCopied);
    } catch (_) {
      showToastNotification(strings.linkCopyError);
    }
  }, [squadState, currentLocale, strings, showToastNotification]);

  // Export PNG handler
  const handleExportPng = useCallback(async () => {
    if (!catalog) return;
    setIsExporting(true);
    try {
      const filename = await exportCompToPng(squadState, catalog, { locale: currentLocale });
      showToastNotification(strings.exportedFile.replace('{file}', filename));
    } catch (_) {
      showToastNotification(strings.exportError);
    } finally {
      setIsExporting(false);
    }
  }, [squadState, catalog, currentLocale, strings, showToastNotification]);

  // Clear whole squad handler
  const handleClearSquad = useCallback(() => {
    setSquadState((prev) => clearSquad(prev));
    setActivePreset('');
    showToastNotification(strings.squadCleared);
  }, [currentLocale, strings, showToastNotification]);

  // Player Name change handler
  const handlePlayerNameChange = useCallback((index: number, name: string) => {
    setSquadState((prev) => {
      const players = [...prev.players];
      players[index] = { ...players[index], name };
      return { ...prev, players };
    });
  }, []);

  const handleWeaponModeChange = useCallback((index: number, mode: 'active' | 'passive') => {
    setSquadState((prev) => {
      const players = [...prev.players];
      players[index] = { ...players[index], weaponMode: mode };
      return { ...prev, players };
    });
    setActivePreset('');
  }, []);

  // Player Reorder handler
  const handleMovePlayer = useCallback((fromIdx: number, toIdx: number) => {
    setSquadState((prev) => movePlayer(prev, fromIdx, toIdx));
  }, []);

  // Custom photo slot target for the hidden file input (mirrors legacy upload-custom-photo)
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [photoTarget, setPhotoTarget] = useState<SlotDragDescriptor | null>(null);
  const [, setPhotoTick] = useState(0);

  const handleSlotPhotoFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file || !photoTarget) return;
      processUploadedImageFile(file, (dataUrl) => {
        setCustomPhoto(photoTarget.pIdx, photoTarget.type, photoTarget.sIdx, 0, dataUrl);
        setPhotoTick((tick) => tick + 1);
      });
    },
    [photoTarget]
  );

  // Slot custom photo actions (mirrors legacy upload/clear-custom-photo)
  const handleSlotPhotoAction = useCallback((action: 'change' | 'remove', desc: SlotDragDescriptor) => {
    if (action === 'remove') {
      clearCustomPhoto(desc.pIdx, desc.type, desc.sIdx);
      setPhotoTick((tick) => tick + 1);
      return;
    }
    setPhotoTarget(desc);
    photoInputRef.current?.click();
  }, []);

  // Slot-to-slot swap handler (mirrors legacy slot drag & drop)
  const handleSwapSlots = useCallback((a: SlotDragDescriptor, b: SlotDragDescriptor) => {
    if (a.type !== b.type) return;
    setSquadState((prev) => {
      if (a.type === 'weapon') return swapWeaponSlots(prev, a.pIdx, a.sIdx, b.pIdx, b.sIdx);
      if (a.type === 'matrix') return swapMatrixSlots(prev, a.pIdx, a.sIdx, b.pIdx, b.sIdx);
      if (a.type === 'relic') return swapRelicSlots(prev, a.pIdx, a.sIdx, b.pIdx, b.sIdx);
      return swapTraits(prev, a.pIdx, b.pIdx);
    });
    swapCustomPhotos(a.pIdx, a.type, a.sIdx, b.pIdx, b.sIdx);
  }, []);

  // Clear single player handler
  const handleClearPlayer = useCallback((playerIdx: number) => {
    setSquadState((prev) => clearPlayer(prev, playerIdx));
  }, []);

  // Weapon 2+2 split toggle handler
  const handleToggleWeaponSplit = useCallback((pIdx: number, sIdx: number) => {
    setSquadState((prev) => {
      const players = [...prev.players];
      const player = { ...players[pIdx], weapons: [...players[pIdx].weapons] };
      const w = { ...player.weapons[sIdx] };

      if (w.id2) {
        // Remove secondary
        w.id2 = null;
        w.stars2 = 6;
        w.customText2 = '';
      } else {
        // Enable secondary
        w.id2 = '__EMPTY__';
        w.stars2 = 6;
        w.customText2 = '';
      }
      player.weapons[sIdx] = w;
      players[pIdx] = player;
      return { ...prev, players };
    });
  }, []);

  // Open Picker Modal
  const handleOpenPicker = useCallback(
    (type: ActivePickerTarget['type'], pIdx: number, sIdx = 0, cIdx: 0 | 1 = 0) => {
      setActivePopover(null);
      setActivePicker({ type, playerIndex: pIdx, slotIndex: sIdx, chipIndex: cIdx });
    },
    []
  );

  // Picker item select handler
  const handlePickerSelectItem = useCallback(
    (itemId: string, customText?: string) => {
      if (!activePicker) return;
      const { type, playerIndex, slotIndex, chipIndex = 0 } = activePicker;

      setSquadState((prev) => {
        const players = [...prev.players];
        const player = { ...players[playerIndex] };

        if (type === 'trait') {
          player.trait = itemId;
          player.traitCustomText = customText || '';
        } else if (type === 'weapon') {
          const weapons = [...player.weapons];
          const w = { ...weapons[slotIndex] };
          if (chipIndex === 1) {
            delete w.skills2; delete w.mode2; delete w.element2;
            w.id2 = itemId;
            w.customText2 = customText || '';
          } else {
            delete w.skills; delete w.mode; delete w.element;
            w.id = itemId;
            w.customText = customText || '';
          }
          weapons[slotIndex] = w;
          player.weapons = weapons;
          player.customRole = null;
          player.role = detectResonance(weapons, catalog);
        } else if (type === 'matrix') {
          const weapons = [...player.weapons];
          const w = { ...weapons[slotIndex] };
          const m = w.matrix ? { ...w.matrix } : { id: null, count: (4 as 2 | 4), stars: 3 };
          if (chipIndex === 1) {
            m.id2 = itemId;
            m.count = 2;
            m.count2 = 2;
            m.customText2 = customText || '';
          } else {
            m.id = itemId;
            m.customText = customText || '';
          }
          w.matrix = m;
          weapons[slotIndex] = w;
          player.weapons = weapons;
        } else if (type === 'relic') {
          const relics = [...player.relics];
          relics[slotIndex] = {
            id: itemId,
            rank: 5,
            customText: customText || '',
          };
          player.relics = relics;
        }

        players[playerIndex] = player;
        return { ...prev, players };
      });
      setActivePreset('');
    },
    [activePicker]
  );

  // Clear slot handler from picker modal
  const handleClearCurrentSlot = useCallback(() => {
    if (!activePicker) return;
    const { type, playerIndex, slotIndex, chipIndex = 0 } = activePicker;
    setSquadState((prev) => clearPlayerSlot(prev, playerIndex, type, slotIndex, chipIndex));
    setActivePreset('');
  }, [activePicker]);

  // Inline custom-text handler for empty slots (mirrors legacy custom inputs)
  const handleCustomTextChange = useCallback(
    (type: 'trait' | 'weapon' | 'matrix' | 'relic', pIdx: number, sIdx: number, text: string) => {
      setSquadState((prev) => {
        const players = [...prev.players];
        const player = { ...players[pIdx] };
        if (type === 'trait') {
          player.traitCustomText = text;
        } else if (type === 'weapon') {
          const weapons = [...player.weapons];
          weapons[sIdx] = { ...weapons[sIdx], customText: text };
          player.weapons = weapons;
        } else if (type === 'matrix') {
          const weapons = [...player.weapons];
          const w = { ...weapons[sIdx] };
          w.matrix = { ...(w.matrix ?? { id: null, count: 4 as const, stars: 3 }), customText: text };
          weapons[sIdx] = w;
          player.weapons = weapons;
        } else {
          const relics = [...player.relics];
          relics[sIdx] = { ...relics[sIdx], customText: text };
          player.relics = relics;
        }
        players[pIdx] = player;
        return { ...prev, players };
      });
      setActivePreset('');
    },
    []
  );

  // Open Popovers
  const handleOpenRolePopover = useCallback(
    (e: React.MouseEvent, pIdx: number) => {
      e.stopPropagation();
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setActivePopover({ type: 'role', playerIndex: pIdx, anchorRect: rect });
    },
    []
  );

  const handleOpenStarsPopover = useCallback(
    (e: React.MouseEvent, type: 'weapon' | 'matrix', pIdx: number, sIdx: number, cIdx: 0 | 1 = 0) => {
      e.stopPropagation();
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setActivePopover({
        type: type === 'weapon' ? 'weaponStars' : 'matrixProps',
        playerIndex: pIdx,
        slotIndex: sIdx,
        chipIndex: cIdx,
        anchorRect: rect,
      });
    },
    []
  );

  const handleOpenRankPopover = useCallback((e: React.MouseEvent, pIdx: number, sIdx: number) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setActivePopover({
      type: 'relicRank',
      playerIndex: pIdx,
      slotIndex: sIdx,
      anchorRect: rect,
    });
  }, []);

  // Update Stars from Popover (per chip; mirrors legacy steppers/inputs)
  const handleSelectStars = useCallback(
    (stars: number | string, chipIdx: 0 | 1 = 0) => {
      if (!activePopover || activePopover.slotIndex === undefined) return;
      const { type, playerIndex, slotIndex } = activePopover;

      setSquadState((prev) => {
        const players = [...prev.players];
        const player = { ...players[playerIndex], weapons: [...players[playerIndex].weapons] };
        const w = { ...player.weapons[slotIndex] };

        if (type === 'weaponStars') {
          if (chipIdx === 1) w.stars2 = stars;
          else w.stars = stars;
        } else if (type === 'matrixProps' && w.matrix) {
          const m = { ...w.matrix };
          if (chipIdx === 1) m.stars2 = stars;
          else m.stars = stars;
          w.matrix = m;
        }

        player.weapons[slotIndex] = w;
        players[playerIndex] = player;
        return { ...prev, players };
      });
    },
    [activePopover]
  );

  // Update Matrix count (2pc vs 4pc) from Popover; collapses an open 2+2 split
  const handleSelectMatrixCount = useCallback(
    (count: 2 | 4) => {
      if (!activePopover || activePopover.slotIndex === undefined) return;
      const { playerIndex, slotIndex } = activePopover;

      setSquadState((prev) => {
        const players = [...prev.players];
        const player = { ...players[playerIndex], weapons: [...players[playerIndex].weapons] };
        const w = { ...player.weapons[slotIndex] };
        if (w.matrix) {
          const { id2: _droppedId2, count2: _droppedCount2, stars2: _droppedStars2, ...rest } = w.matrix;
          w.matrix = { ...rest, count };
        }
        player.weapons[slotIndex] = w;
        players[playerIndex] = player;
        return { ...prev, players };
      });
    },
    [activePopover]
  );

  // Split a matrix set into 2+2 (mirrors legacy popover button)
  const handleSelectMatrixSplit = useCallback(() => {
    if (!activePopover || activePopover.slotIndex === undefined) return;
    const { playerIndex, slotIndex } = activePopover;
    setSquadState((prev) => splitMatrix2Plus2(prev, playerIndex, slotIndex));
    setActivePreset('');
  }, [activePopover]);

  // Update Relic Rank from Popover
  const handleSelectRelicRank = useCallback(
    (rank: number | string) => {
      if (!activePopover || activePopover.slotIndex === undefined) return;
      const { playerIndex, slotIndex } = activePopover;

      setSquadState((prev) => {
        const players = [...prev.players];
        const player = { ...players[playerIndex], relics: [...players[playerIndex].relics] };
        player.relics[slotIndex] = { ...player.relics[slotIndex], rank };
        players[playerIndex] = player;
        return { ...prev, players };
      });
    },
    [activePopover]
  );

  // Update Player Role override from Popover
  const handleSelectRole = useCallback(
    (customRole: SquadRole | null) => {
      if (!activePopover) return;
      const { playerIndex } = activePopover;

      setSquadState((prev) => {
        const players = [...prev.players];
        players[playerIndex] = { ...players[playerIndex], customRole };
        return { ...prev, players };
      });
    },
    [activePopover]
  );

  if (isLoading) {
    return (
      <main className={styles.compContainer}>
        <LoadingState
          message={strings.catalogLoading}
          submessage=""
          variant="spinner"
          fullPage
        />
      </main>
    );
  }

  if (error || !catalog) {
    return (
      <main className={styles.compContainer}>
        <div className="bg-red-950/40 border border-red-500/30 rounded-lg p-6 text-center">
          <h2 className="text-xl font-bold text-red-400 mb-2">
            {strings.catalogError}
          </h2>
          <p className="text-slate-400 text-sm">{error?.message || localeText(locale)('Unknown error')}</p>
        </div>
      </main>
    );
  }

  // Popover context (resolved after catalog guard, so catalog is loaded)
  const popoverWeapon =
    activePopover?.type === 'weaponStars' && activePopover.slotIndex !== undefined
      ? squadState.players[activePopover.playerIndex]?.weapons[activePopover.slotIndex]
      : undefined;
  const popoverMatrix =
    activePopover?.type === 'matrixProps' && activePopover.slotIndex !== undefined
      ? squadState.players[activePopover.playerIndex]?.weapons[activePopover.slotIndex]?.matrix
      : undefined;

  const resolvePopoverWeaponName = (id: string | null | undefined, customText: string | undefined, fallback: string) => {
    if (!id) return customText || fallback;
    const found = (catalog?.weapons || []).find((w) => w.id === id);
    return found ? getLocalizedText(found.name, currentLocale) : customText || fallback;
  };
  const resolvePopoverMatrixName = (id: string | null | undefined, customText: string | undefined, fallback: string) => {
    if (!id) return customText || fallback;
    const found = (catalog?.matrices || []).find((m) => m.id === id);
    return found ? getLocalizedText(found.name, currentLocale) : customText || fallback;
  };

  return (
    <main className={styles.compContainer} data-testid="comp-page">
      {/* Toolbar (Mode switcher, preset listbox, actions) */}
      <CompToolbar
        state={squadState}
        locale={currentLocale}
        activePreset={activePreset}
        onModeChange={handleModeChange}
        onServerChange={handleServerChange}
        onPresetSelect={handlePresetSelect}
        onShare={handleShareComp}
        onExportPng={handleExportPng}
        onClear={handleClearSquad}
        isExporting={isExporting}
      />

      {/* Main Squad Composition Table */}
      <CompTable
        state={squadState}
        catalog={catalog}
        locale={currentLocale}
        onWeaponModeChange={handleWeaponModeChange}
        onPlayerNameChange={handlePlayerNameChange}
        onOpenRolePopover={handleOpenRolePopover}
        onOpenPicker={handleOpenPicker}
        onOpenStarsPopover={handleOpenStarsPopover}
        onOpenRankPopover={handleOpenRankPopover}
        onToggleWeaponSplit={handleToggleWeaponSplit}
        onMovePlayer={handleMovePlayer}
        onClearPlayer={handleClearPlayer}
        onSwapSlots={handleSwapSlots}
        onSlotPhotoAction={handleSlotPhotoAction}
        onCustomTextChange={handleCustomTextChange}
      />
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        tabIndex={-1}
        aria-hidden="true"
        onChange={handleSlotPhotoFile}
      />

      {/* Item Picker Modal Drawer */}
      {activePicker && (
        <CompItemPickerModal
          isOpen={Boolean(activePicker)}
          type={activePicker.type}
          playerIndex={activePicker.playerIndex}
          slotIndex={activePicker.slotIndex}
          chipIndex={activePicker.chipIndex}
          catalog={catalog}
          locale={currentLocale}
          server={squadState.server}
          onClose={() => setActivePicker(null)}
          onSelectItem={handlePickerSelectItem}
          onClearSlot={handleClearCurrentSlot}
          onUploadCustomPhoto={(dataUrl) => {
            if (activePicker) {
              setCustomPhoto(
                activePicker.playerIndex,
                activePicker.type,
                activePicker.slotIndex,
                activePicker.chipIndex || 0,
                dataUrl
              );
            }
          }}
        />
      )}

      {/* Popovers */}
      {activePopover?.type === 'role' && (
        <CompRolePopover
          currentRole={squadState.players[activePopover.playerIndex]?.customRole || null}
          autoRole={detectResonance(squadState.players[activePopover.playerIndex]?.weapons ?? [], catalog)}
          anchorRect={activePopover.anchorRect}
          locale={currentLocale}
          onSelectRole={handleSelectRole}
          onClose={() => setActivePopover(null)}
        />
      )}

      {activePopover?.type === 'weaponStars' && activePopover.slotIndex !== undefined && (
        <CompStarPopover
          type="weapon"
          currentStars={
            activePopover.chipIndex === 1 ? (popoverWeapon?.stars2 ?? 6) : (popoverWeapon?.stars ?? 6)
          }
          chipIndex={activePopover.chipIndex === 1 ? 1 : 0}
          secondStars={popoverWeapon?.id2 ? (popoverWeapon?.stars2 ?? 6) : undefined}
          chipNames={
            popoverWeapon?.id2
              ? [
                  resolvePopoverWeaponName(popoverWeapon?.id, popoverWeapon?.customText, strings.weaponLabel),
                  resolvePopoverWeaponName(popoverWeapon?.id2, popoverWeapon?.customText2, strings.weaponLabel),
                ]
              : undefined
          }
          anchorRect={activePopover.anchorRect}
          locale={currentLocale}
          server={squadState.server}
          onSelectStars={handleSelectStars}
          onPickChip={(cIdx) =>
            handleOpenPicker('weapon', activePopover.playerIndex, activePopover.slotIndex as number, cIdx)
          }
          onRemoveSecondary={
            popoverWeapon?.id2
              ? () => handleToggleWeaponSplit(activePopover.playerIndex, activePopover.slotIndex as number)
              : undefined
          }
          onClose={() => setActivePopover(null)}
        />
      )}

      {activePopover?.type === 'matrixProps' && activePopover.slotIndex !== undefined && (
        <CompStarPopover
          type="matrix"
          currentStars={popoverMatrix?.stars ?? 3}
          chipIndex={0}
          isSplit={Boolean(popoverMatrix?.id2)}
          secondStars={popoverMatrix?.id2 ? (popoverMatrix?.stars2 ?? 3) : undefined}
          chipNames={
            popoverMatrix?.id2
              ? [
                  resolvePopoverMatrixName(popoverMatrix?.id, popoverMatrix?.customText, strings.matrixLabel),
                  resolvePopoverMatrixName(popoverMatrix?.id2, popoverMatrix?.customText2, strings.matrixLabel),
                ]
              : undefined
          }
          currentCount={popoverMatrix?.count ?? 4}
          anchorRect={activePopover.anchorRect}
          locale={currentLocale}
          onSelectStars={handleSelectStars}
          onSelectCount={handleSelectMatrixCount}
          onSelectSplit={handleSelectMatrixSplit}
          onPickChip={(cIdx) =>
            handleOpenPicker('matrix', activePopover.playerIndex, activePopover.slotIndex as number, cIdx)
          }
          onClose={() => setActivePopover(null)}
        />
      )}

      {activePopover?.type === 'relicRank' && activePopover.slotIndex !== undefined && (
        <CompRankPopover
          currentRank={
            squadState.players[activePopover.playerIndex]?.relics[activePopover.slotIndex]?.rank ?? 5
          }
          anchorRect={activePopover.anchorRect}
          locale={currentLocale}
          onSelectRank={handleSelectRelicRank}
          onClose={() => setActivePopover(null)}
        />
      )}

      {/* Toast Notification */}
      <CompToast message={toastMessage} visible={showToast} />
      <CompTooltip suppressed={Boolean(activePicker) || Boolean(activePopover)} />
    </main>
  );
}
