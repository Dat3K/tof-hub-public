export type SquadMode = 4 | 8;

export type SquadRole = 'tank' | 'healer' | 'dps' | 'balance';

/** Game server scope: standard roster by default, MMO-only roster in mmo. */
export type CompServer = 'standard' | 'mmo';

export interface SquadMatrixSlot {
  id: string | null;
  count: 2 | 4;
  stars: number | string; // 0..3 or arbitrary custom text
  customText?: string;
  id2?: string | null;
  count2?: 2;
  stars2?: number | string;
  customText2?: string;
}

export interface SquadWeaponSlot {
  skills?:string[];
  skills2?:string[];
  /** Gacha weapon settings from the weapon-options pipeline: skill mode and element form of each chip. */
  mode?:string;
  mode2?:string;
  element?:string;
  element2?:string;
  id: string | null;
  stars: number | string; // 0..6 standard, 0..15 MMO, or arbitrary custom text
  matrix: SquadMatrixSlot | null;
  customText?: string;
  id2?: string | null;
  stars2?: number | string; // 0..6 standard, 0..15 MMO, or arbitrary custom text
  customText2?: string;
}

export interface SquadRelicSlot {
  id: string | null;
  rank: number | string; // 0..5 (R0..R5) or arbitrary custom text
  customText?: string;
}

export interface SquadPlayer {
  id: string;
  name: string;
  role: SquadRole;
  customRole: SquadRole | null; // null = auto-detected resonance
  trait: string | null; // simulacrum ID or custom photo ID
  traitCustomText?: string;
  weaponMode?: 'active' | 'passive';
  weapons: SquadWeaponSlot[];
  relics: SquadRelicSlot[];
}

export interface SquadState {
  mode: SquadMode;
  server: CompServer;
  title: string;
  players: SquadPlayer[];
}

export interface PresetDefinition {
  id: string;
  name_en: string;
  name_ru: string;
  mode: SquadMode;
  server: CompServer;
  description_en: string;
  description_ru: string;
  players: SquadPlayer[];
}

export type PickerSlotType = 'trait' | 'weapon' | 'matrix' | 'relic';

export interface ActivePickerTarget {
  type: PickerSlotType;
  playerIndex: number;
  slotIndex: number;
  chipIndex?: 0 | 1;
}

export interface ActivePopoverTarget {
  type: 'role' | 'weaponStars' | 'matrixProps' | 'relicRank';
  playerIndex: number;
  slotIndex?: number;
  chipIndex?: 0 | 1;
  anchorRect: DOMRect;
}

export const CUSTOM_PHOTO_ID = '__CP__';
export const CUSTOM_TEXT_ID = '__TEXT__';

export function isCustomPhoto(id: string | null | undefined): boolean {
  return id === CUSTOM_PHOTO_ID;
}

export function isCustomText(id: string | null | undefined): boolean {
  return id === CUSTOM_TEXT_ID || id === '__EMPTY__';
}

/** Identifies one draggable table slot for slot-to-slot drag & drop. */
export interface SlotDragDescriptor {
  type: PickerSlotType;
  pIdx: number;
  sIdx: number;
}

/** Slot drag & drop handlers owned by the table, threaded into rows/slots. */
export interface SlotDnDHandlers {
  onDragStart: (e: React.DragEvent, desc: SlotDragDescriptor) => void;
  onDragOver: (e: React.DragEvent, desc: SlotDragDescriptor) => void;
  onDragLeave: (e: React.DragEvent, desc: SlotDragDescriptor) => void;
  onDrop: (e: React.DragEvent, desc: SlotDragDescriptor) => void;
  isDragging: (desc: SlotDragDescriptor) => boolean;
  isDropTarget: (desc: SlotDragDescriptor) => boolean;
}
