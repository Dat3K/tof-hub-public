/** Persistence used by PlayerStoreService. Prisma in production, an in-memory map in tests. */
export interface StoredPlayer {
  id:string;uid:string|null;roleId:string|null;nickname:string|null;serverId:string|null;region:string|null;level:number|null;crew:string|null;
  titleId:string|null;avatarId:string|null;avatarFrameId:string|null;combatScore:number|null;maxCombatScore:number|null;totalRecharge:bigint|null;
  /** The game's date of the current maxCombatScore (HistoryMaxGSChangeTime, own character only). */
  maxCombatScoreAt?:Date|null;
  /** Own sealed profile received, independently of the provenance of the current best gear set. */
  selfCaptureAt?:Date|null;
  firstSeenAt:Date;lastSeenAt:Date;
  /** Own account counters (raw) and when they were captured. */
  accountStats:Record<string,number|null>|null;accountStatsAt:Date|null;
}
export type PlayerFields=Partial<Omit<StoredPlayer,'id'>>;
export interface StoredGear {
  id:string;playerId:string;slot:string;itemId:string;instanceId:string|null;fingerprint:string;stars:number;enhancement:number;titan:boolean;
  rareId:string|null;rareLevel:number|null;stats:{type:string;value:number}[];statsBeforeTitan:(number|null)[]|null;augments:{type:string;value:number}[];
  equipped:boolean;source:string;firstSeenAt:Date;lastSeenAt:Date;augmented:boolean;
  /** Titan clicks (Augmentation Count), own captures only; an observation without it keeps the stored value. */
  augmentCount:number|null;
}
export type GearWrite=Omit<StoredGear,'id'|'firstSeenAt'>&{seenAt:Date};
/** `sourceTrack`: the stored track a precomputed best row (ranking/best-tracks.ts) came from. */
export interface TrackScore {track:string;score:number;maxScore:number;sourceTrack?:string;
  /** Current gear points used only to select the best track; not a persisted percentage. */
  selectionValue?:number;
  /** Player totals: the pieces behind the score. */
  gearIds?:string[]}
export interface UploadWrite {kind:string;fileSha256:string;exporterName:string;exporterVersion:string;ipHash:string;ip?:string|null;playerId:string}

export interface PlayerStoreRepository {
  transaction<T>(work:(repository:PlayerStoreRepository)=>Promise<T>):Promise<T>;
  findPlayer(identity:{uid?:string;roleId?:string}):Promise<StoredPlayer|null>;
  createPlayer(fields:PlayerFields&{firstSeenAt:Date;lastSeenAt:Date}):Promise<StoredPlayer>;
  updatePlayer(id:string,fields:PlayerFields):Promise<StoredPlayer>;
  touchName(playerId:string,nickname:string,seenAt:Date):Promise<void>;
  /** Null when the same file was already accepted (unique kind + SHA-256). */
  createUpload(upload:UploadWrite):Promise<string|null>;
  upsertGear(gear:GearWrite,uploadId:string|null):Promise<StoredGear>;
  /** Unequip the player's other pieces in these slots. */
  replaceEquipped(playerId:string,slots:string[],equippedIds:string[]):Promise<void>;
  listEquipped(playerId:string):Promise<StoredGear[]>;
  /** Every stored player and their gear, for a rescore after a scoring change. */
  listPlayers():Promise<StoredPlayer[]>;
  listGear(playerId:string):Promise<StoredGear[]>;
  saveGearScores(gear:StoredGear,region:string|null,scores:TrackScore[]):Promise<void>;
  /** Overwrites a stored piece's fields (a later observation of the same piece). */
  updateGear(id:string,fields:Partial<Omit<StoredGear,'id'|'playerId'>>):Promise<StoredGear>;
  /** `absorbed` were the same piece as `survivorId`: build links point at the survivor, the rows are deleted. */
  absorbGear(survivorId:string,absorbed:string[]):Promise<void>;
  /** Per-track scores of the player's gear (best rows included). */
  listGearScores(playerId:string):Promise<{gearId:string;track:string;score:number}[]>;
  /** Gear ids used by the player's current captured build; historical captures do not pin gear. */
  listCurrentBuildGearIds(playerId:string):Promise<string[]>;
  /** Pieces behind the player's stored totals (`player_scores.gear_ids` of every role and track). */
  listScoredGearIds(playerId:string):Promise<string[]>;
  deleteGear(ids:string[]):Promise<void>;
  createBuild(build:{playerId:string;uploadId:string|null;capturedAt:Date;combatScore:number|null;element:string|null;role:string|null;draft:unknown;gear:{slot:string;gearId:string}[]}):Promise<string>;
  savePlayerScores(playerId:string,region:string|null,buildId:string|null,scores:TrackScore[]):Promise<void>;
}
