import {z} from 'zod';
import {AccountCountersSchema} from './build-capture';

/**
 * What one observation says about a game character. Everything except the identity is optional:
 * a Personal Card capture of oneself fills most fields, while inspecting someone else may bring only their gear.
 * Absent fields never erase stored values.
 */
const id=z.string().min(1).max(120);
const finite=z.number().finite();
const stat=z.object({type:z.string().min(1).max(60),value:finite}).strict();

export const PlayerSnapshotSourceSchema=z.enum(['self','inspect']);
const PlayerGearCountersSchema=z.object({
  augmentationSpent:z.number().int().min(0).nullable(),
  equippedAugmentationSpent:z.number().int().min(0).nullable(),
  equippedPieceCount:z.number().int().min(0),
  backpackAugmentationSpent:z.number().int().min(0).nullable(),
  backpackPieceCount:z.number().int().min(0),
}).strict();
export const PlayerSnapshotGearSchema=z.object({
  /** Build slot id (helmet, spaulders, …, reactor). */
  slot:z.string().regex(/^[a-z]{3,16}$/),
  itemId:id,
  /** Game item instance id when the capture has one; otherwise a fingerprint identifies the piece. */
  instanceId:id.optional(),
  stars:z.number().int().min(0).max(5),
  enhancement:z.number().int().min(0).max(200),
  titan:z.boolean(),
  augmented:z.boolean(),
  rareId:id.nullable(),
  rareLevel:z.number().int().min(0).max(100).nullable(),
  /** Current random stats in build-card units (fractions for percentages). */
  stats:z.array(stat).max(4),
  /** Values before Titan in the same order, when known. */
  statsBeforeTitan:z.array(finite.nullable()).max(4).nullable(),
  augments:z.array(stat).max(4),
  /** Titan clicks (Augmentation Count) when the capture read the item's inventory record (own captures only). */
  augmentCount:z.number().int().min(0).max(100000).nullable().optional(),
}).strict();

export const PlayerSnapshotSchema=z.object({
  source:PlayerSnapshotSourceSchema,
  capturedAt:z.string().datetime(),
  player:z.object({
    uid:z.string().regex(/^\d{1,24}$/).optional(),
    roleId:z.string().regex(/^\d{1,24}$/).optional(),
    nickname:z.string().min(1).max(64).optional(),
    level:z.number().int().min(0).max(200).optional(),
    crew:z.string().max(64).optional(),
    titleId:id.optional(),
    avatarId:id.optional(),
    avatarFrameId:id.optional(),
    combatScore:z.number().int().min(0).optional(),
    maxCombatScore:z.number().int().min(0).optional(),
    /** The game's date of this max combat score (HistoryMaxGSChangeTime, own character only; civil time read as UTC). */
    maxCombatScoreAt:z.string().datetime({offset:true}).optional(),
    totalRecharge:z.number().int().min(0).optional(),
    /** Own account counters from a `.tofbuild`, shown on Build and the player directory. */
    account:AccountCountersSchema.optional(),
    /** Aggregates from the captured equipped set and backpack, when present. */
    gearCounters:PlayerGearCountersSchema.optional(),
  }).strict().refine(player=>player.uid||player.roleId,{message:'uid or roleId is required'}),
  /** The equipped set as observed; slots not listed keep their previous gear. */
  gear:z.array(PlayerSnapshotGearSchema).max(12).optional(),
  /**
   * Titan backpack pieces of an own `.tofbuild` (not equipped). The store keeps only those that beat every known piece
   * of their slot in at least one track; the rest are never written.
   */
  backpack:z.array(PlayerSnapshotGearSchema).max(2000).optional(),
  /** Present for a full build card capture only. */
  build:z.object({draft:z.unknown(),combatScore:z.number().int().min(0).nullable(),element:z.string().max(20).nullable(),role:z.string().max(20).nullable()}).strict().optional(),
}).strict().superRefine((snapshot,context)=>{
  const slots=snapshot.gear?.map(item=>item.slot)??[];
  if(new Set(slots).size!==slots.length)context.addIssue({code:'custom',message:'Duplicate gear slot',path:['gear']});
});
export type PlayerSnapshot=z.infer<typeof PlayerSnapshotSchema>;
export type PlayerSnapshotGear=z.infer<typeof PlayerSnapshotGearSchema>;
