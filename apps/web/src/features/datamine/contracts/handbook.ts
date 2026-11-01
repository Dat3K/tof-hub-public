import type { ServerMode } from '@tof-hub/ui';
import type { Localized as LocalizedCopy } from '@tof-hub/i18n';
import type { MmoBygoneDefenseEstimate, MmoBygoneHpScaling, MmoCurve } from '@tof-hub/game-domain';

/** Handbook data mode: the site's Gacha (Global) / MMO server mode. */
export type HandbookMode = ServerMode;

export type HandbookSectionId =
  | 'random-stats'
  | 'expansion'
  | 'titan'
  | 'cs'
  | 'enhancement'
  | 'supercomputer'
  | 'suppressor'
  | 'brainfield'
  | 'space-support'
  | 'combat-formulas'
  | 'servers';

/** Common header of every `game-data/handbook/<section>.json` (scripts/generators/build-handbook.cjs). */
export interface HandbookDataset {
  schemaVersion: number;
  /** Raw export path or `game-data/<file>` → SHA-256 of the input that was read. */
  sources: Record<string, { sha256: string }>;
}

/** What the page shell knows about one section before its own data is rendered. */
export interface HandbookSectionState {
  id: HandbookSectionId;
  /** The section's generated file was found (servers: `server-list.json`). */
  available: boolean;
  /** Input paths from the file's `sources`. */
  sources: string[];
}

export type Localized = LocalizedCopy<string | null>;
export type ItemCounts = Record<string, number>;
export interface HandbookItem { name: Localized; icon: string | null }

// ---- mmo-expansion.json (shared projection of build-mmo-card.cjs)
export interface HandbookExpansionCard {
  id: string;
  name: Localized | null;
  icon: string | null;
  quality: string;
  season: number;
  exclusive: boolean;
  maxStars: number;
  maxSuit: number;
  slots: string[];
  description: Localized | null;
  params: {value: number; curve: MmoCurve | null}[];
  stats: {prop: string; values: number[]}[];
  item: {id: string; name: Localized | null; icon: string | null; description: Localized | null; useDescription: Localized | null} | null;
  slotEvidence: {
    kind: 'configuration' | 'item-description' | 'unresolved';
    configured: string[];
    rawSlots: string[];
    described: string[];
    tokens: string[];
    sourceText: string;
    source: {path: string; row: string; field: string};
  };
  validSeasons: unknown[];
  exhibit: boolean | null;
  upgradeAmounts: number[];
  buffs: string[];
  source: {path: string; row: string};
}
export interface HandbookExpansionData extends HandbookDataset {
  cards: HandbookExpansionCard[];
  slots: {id: string; slot: string; name: Localized | null; icon: string | null; frame: string | null;
    iconSource?: {kind: 'shared-gear' | 'slot-config'; path: string; row: string; field: string};
    cardBanks: number; seasonCardBanks: number}[];
  attributes: Record<string, {name: Localized | null; icon: string | null; percent: boolean; description: Localized | null}>;
  coefficients: Record<string, MmoCurve>;
  seasons: {index: number; name: Localized | null}[];
  equipmentSeasons: {id: string; index: number; name: Localized | null}[];
  serverSeasons: {id: string; index: number; name: Localized | null}[];
  coverage: {cards: number; configuredSlots: number; describedSlots: number; missingSlots: string[];
    unknownSlotEnums: {card: string; values: string[]}[]; missingItems: string[]; missingMedia: string[]; descriptionSlotConflicts: string[]};
}
/** Gear slot art (build-gear-media.cjs): normal, augmented and Titan stage. */
export type SlotIcons = Record<string, { normal?: string; augmented?: string; titan?: string }>;

// ---- random-stats.json
export interface HandbookStatRange { base: number; min: number; max: number; average?: number; maximum?: number }
export interface HandbookRandomStat {
  description?: Localized | null;
  type: string | null;
  name: Localized | null;
  icon: string | null;
  percent: boolean | null;
  /** This exact random-property row exists in the files but is absent from the mode's rollable gear pools. */
  unreleased?: boolean;
  maxPerItem: number;
  advanceWeight: number;
  ranges: Record<string, HandbookStatRange>;
}
export interface HandbookStatPool {
  pool: string;
  primary: boolean;
  /** First items using the pool (label sample) and how many use it in total. */
  items: string[];
  itemCount: number;
  origins: { id: string; name: Localized; kind: 'container' | 'hint'; presentation: HandbookStatPool['presentation'] }[];
  presentation: { name: Localized; variant: Localized; element: 'Physical' | 'Frost' | 'Flame' | 'Volt' | 'Altered'; icon: string | null } | null;
  selection: {
    category: 'standard' | 'promo' | 'premium';
    variant: HandbookStatPool['presentation'];
    order: number;
    guaranteedStats: string[];
  };
  weights: { stat: string; weight: number; chance: number; onItemChance: number | null; withoutStatChance: number | null }[];
}
export interface HandbookRandomStatsMode {
  itemChanceModel: {statCount: number; method: 'weighted-without-replacement'};
  rollsForTotals: number | null;
  qualities: string[];
  stats: Record<string, HandbookRandomStat>;
  /** slot id → quality → pools (primary first). */
  slots: Record<string, Record<string, HandbookStatPool[]>>;
}
export interface HandbookRandomStatsData {
  /** Global Gear stats order, shared across Handbook modes and sections. */
  statOrder?: string[];
  /** Presentation only: Global attribute labels/icons for ordinary stats absent from MMO Gear. */
  statPresentation?: Record<string, Pick<HandbookRandomStat, 'type' | 'name' | 'icon'>>;
  mode: HandbookRandomStatsMode;
  slotNames: Record<string, Localized>;
  slotIcons: SlotIcons;
  itemNames: Record<string, Localized | null>;
}

// ---- titan.json
export interface HandbookTitanPool {
  slot: string;
  titanItem: string;
  pack: string;
  properties: { id: string; name: Localized; icon: string | null; levels: { level: number; fromCount: number; weight: number }[] }[];
  brackets: { fromCount: number; toCount: number | null; totalWeight: number; chances: { id: string; level: number; chance: number }[] }[];
}
export interface HandbookTitanGrowth {
  stat: string;
  type: string | null;
  name: Localized | null;
  icon: string | null;
  percent: boolean | null;
  algorithm: string;
  coefficient: number;
  /** Added absolute value per Titan count (weighted bands summarised on the server). */
  levels: { count: number; min: number; expected: number; max: number }[];
}
export interface HandbookTitanData {
  rareValueLevelLimit: number;
  slotStats: Record<string, string[]>;
  pools: HandbookTitanPool[];
  rareValues: { id: string; name: Localized; description: Localized | null; icon: string | null; values: { level: number; value: number }[] }[];
  triggerRates: { count: number; rate: number }[];
  mainGrowth: HandbookTitanGrowth[];
  addedStats: { maxAddedStats: number; addedStatShare: number; priorities: Record<string, string[]>; fallbacks: Record<string, string[]>; source: string };
  slotNames: Record<string, Localized>;
  slotIcons: SlotIcons;
}

// ---- enhancement.json
export interface HandbookEnhancementLevel {
  level: number;
  gold: number;
  items: ItemCounts;
  needPlayerLevel: number;
  needSuppressorLevel: string | null;
  cumulative: ItemCounts;
}
export interface HandbookEnhancementData {
  costGroups?: {id: string; slotCount: number; levels: HandbookEnhancementLevel[]}[];
  items: Record<string, HandbookItem>;
  families: Record<string, { slots?: string[]; levels: HandbookEnhancementLevel[] }>;
  allSlotsMaxTotal: ItemCounts | null;
  stars: Record<string, { targetStar: number; requiredExp: number; cumulativeExp: number }[]> | null;
  /** Main stats at every fifth level (Gacha only). */
  stats: { slot: string; stages: Record<string, { level: number; stats: { type: string; value: number }[] }[]> }[] | null;
  slotNames: Record<string, Localized>;
  slotIcons: SlotIcons;
  statNames: Record<string, Localized>;
  statIcons: Record<string, string | null>;
}

// ---- supercomputer.json
export interface HandbookSupercomputerData {
  items: Record<string, HandbookItem>;
  nodes: { slot: string; icon: string | null; maxLevel: number; allowedStats: string[];
    effects: { id: string; name: Localized; icon: string | null; levels: {level: number; value: number; percentage: boolean}[] }[] }[];
  levels: {
    level: number;
    requiredExp: number;
    cumulativeExp: number;
    itemsPerClick: ItemCounts;
    outcomes: { kind: string; exp: number; chance: number }[];
    segments: {fromExp: number; toExp: number; chances: {kind: string; exp: number; chance: number}[]}[];
    expectedClicks: number;
    cumulativeExpectedClicks: number;
    maxClicks: number;
  }[];
  slotNames: Record<string, Localized>;
  slotIcons: SlotIcons;
}

// ---- suppressor.json
export interface HandbookSuppressorData {
  items: Record<string, HandbookItem>;
  statNames: Record<string, Localized>;
  statIcons: Record<string, string | null>;
  levels: { row: string; version: string; icon: string | null; items: ItemCounts; cumulative: ItemCounts; needPlayerLevel: number; needScore: number; stats?: {type: string; value: number}[];
    effectKey?: string | null; effects?: {sourceIndex: number; minLevel: number; maxLevel: number; attackDamageMulti: number; beAttackedDamageReduceMulti: number}[] }[];
  total: ItemCounts;
}

// ---- biochemical-collapse.json (MMO Culture Pods)
export interface HandbookBiochemicalStatBlock {
  maxHealth: number | null;
  attack: number | null;
  resistances: Record<'physical' | 'flame' | 'volt' | 'frost' | 'altered', number | null>;
  armor: number | null;
  critDefense: number | null;
  /** Raw offset-level fields; formulas that apply them in combat are unresolved. */
  modifyMaxHpOffsetLevel: number | null;
  modifyAttackOffsetLevel: number | null;
}
export interface HandbookBiochemicalBuff {
  id: string;
  name: Localized | null;
  description: Localized;
  descriptionId: number | null;
  descriptionArgs: unknown[];
  icon: string | null;
  isDisadvantage: boolean | null;
  targetsSelf: boolean | null;
  score: number | null;
  assessment: string | null;
  /** Raw class reference; its implementation asset is not part of this display export. */
  classPath: string | null;
}
export interface HandbookBiochemicalDate { year: number; month: number; day: number; hour: number; minute: number; second: number }
export interface HandbookBiochemicalData {
  /** All BalanceServer entry rows, including definitions not referenced by current activity rows. */
  buffCatalog: HandbookBiochemicalBuff[];
  seasons: {
    id: string;
    /** Parsed from the localized season name; null when the raw row has no season label. */
    seasonNumber: number | null;
    name: Localized | null;
    start: HandbookBiochemicalDate | null;
    end: HandbookBiochemicalDate | null;
    /** Unconverted regional overrides, keyed by the exported service-region enum. */
    regionalPeriods?: {region: string; start: HandbookBiochemicalDate | null; end: HandbookBiochemicalDate | null}[];
    weaponLimit: number | null;
    joinsGroupRank: boolean | null;
    levels: {
      id: string;
      name: Localized | null;
      featuredName: Localized | null;
      bossName: Localized | null;
      slotIcon: string | null;
      bossIcon: string | null;
      /** Localized grade string; ranks are qualitative and are not converted to numeric stats. */
      enemyGrades: Localized | null;
      waves: { index: number; enemies: {
        name: Localized | null;
        level: number | null;
        type: string | null;
        count: number | null;
        attributeId: string | null;
        buffIds: string[];
        stats: HandbookBiochemicalStatBlock | null;
      }[] }[];
      buffs: HandbookBiochemicalBuff[];
      timeLimitSeconds: number | null;
      baseScore: number | null;
      bonusObjectives: { description: Localized | null; type: string | null; target: number | null; score: number | null; hiddenProgress: boolean | null }[];
    }[];
    awardTiers: { targetScore: number | null; dropId: string | null }[];
  }[];
}

/** Full artwork keyed by the exact pod / wave / enemy slot in the combat snapshot. */
export interface HandbookBiochemicalMedia extends HandbookDataset {
  pods: Record<string, {portrait: string | null; portraitFit: 'contain' | 'cover'; enemies: Record<string, {
    name: Localized | null; portrait: string; portraitFit: 'contain' | 'cover';
    source?: {file: string; row: string; field: string; actorKey: string; classPath: string | null};
  }>}>;
}

// ---- mmo-bygone.json (MMO BigSecret / Bygone Phantasm)
export interface HandbookMmoBygoneRange {
  min: number | null;
  max: number | null;
  minInclusive: boolean;
  maxInclusive: boolean;
}
export interface HandbookMmoBygoneStats {
  maxHealth: number | null;
  attack: number | null;
  physical: number | null;
  flame: number | null;
  volt: number | null;
  frost: number | null;
  altered: number | null;
  armor: number | null;
  crit: number | null;
  critDefense: number | null;
  critDamage: number | null;
  finalCritDefense: number | null;
}
export interface HandbookMmoBygoneEnemy {
  type: string | null;
  count: number | null;
  classPath: string | null;
  name: Localized | null;
  localizedNameKey: string | null;
  attributeId: string | null;
  stats: HandbookMmoBygoneStats | null;
  /** Generated floor HP; stats.maxHealth remains the source baseline. */
  hp?: number | null;
  /** Assumed additive stack model, explicitly not verified runtime defense. */
  defenseEstimate?: MmoBygoneDefenseEstimate | null;
  source?: {classFile: string; attributeTable: string; attributeRow: string | null} | null;
}
export interface HandbookMmoBygoneMedia extends HandbookDataset {
  portraits: Record<string, {thumbnail: string; full: string}>;
  identities?: Record<string, {codeName: string; actorKey: string | null; name: Localized | null}>;
}
export interface HandbookMmoBygoneData extends HandbookDataset {
  hpModel?: 'base-plus-whole-hp-stacks';
  config: { playerLevelLimit: number | null; revives: number | null; roundLimitSeconds: number | null;
    maxRoundCount: number | null; bossRound: number | null; jumpRound: number | null } | null;
  rounds: {
    id: string;
    start: string | null;
    end: string | null;
    balanceMaxRound: number | null;
    configuredRoundCount: number;
    rounds: {
      index: number | null;
      isBossRound: boolean;
      isSaveRound: boolean;
      subSceneType: number | null;
      subLevelIds: string[];
      monsterLevelCurveValue: number | null;
      curveValues: Record<string, number | null>;
      hpScaling?: MmoBygoneHpScaling | null;
      configuredRound: { time: number | null; playerBuffs: unknown[]; monsterBuffs: unknown[];
        playerDefaultBuffs: unknown[]; monsterDefaultBuffs: unknown[]; recommendedWeapons: Localized | null;
        monsterFeatures: unknown[] } | null;
      common: { serverMode: string | null; recommendedCombatScore: number | null; aiCombatIntensity: number | null;
        aiCombatIntensityGroup: string | null; checkCombatScore: number | null; checkWeaponStars: number | null;
        checkMatrixStars: number | null } | null;
      pool: { id: number | null; rawMonsterLevel: number | null; type: string | null;
        descriptionTitle: Localized | null; description: Localized | null; effectiveStart: string | null;
        effectiveEnd: string | null; monsters: HandbookMmoBygoneEnemy[] } | null;
      poolMatchCount: number;
    }[];
  }[];
  rewards: { id: string; round: number | null; serverLevelRange: HandbookMmoBygoneRange; awardId: string | null;
    rewardBegin: string | null; rewardEnd: string | null; groups: { table: string; rowId: string; sequenceId: string | null;
      sequence: { table: string; rowId: string; itemId: string | null; sequenceNumberType: string | null;
        count: number | null; minCount: number | null; maxCount: number | null }[] | null;
      serverLevelRange: HandbookMmoBygoneRange; sequenceWeight: number | null; modifyCount: number | null;
      modifyNum: number | null }[] }[];
  roundBuffers: { id: string; groupType: string | null; serverLevelRange: HandbookMmoBygoneRange;
    monsterLevelCurve: string | null; buffs: { key: string | null; curve: string | null; curveTable?: string | null; abilityClass: string | null;
      useSceneLevel: boolean | null; count: number | null }[] }[];
  curves: Record<string, { interpolation: string | null; defaultValue: number | null;
    keys: { time: number | null; value: number | null }[] }>;
}

// ---- mmo-brainfield.json (MMO PlayerTalent / Neuron Chain)
export interface HandbookBrainfieldData extends HandbookDataset {
  groups: {
    rowKey: string;
    index: number;
    name: Localized | null;
    resettable: boolean | null;
    unlockConditions: unknown[];
    maximumLevelTotal: number;
    members: {id: string; maxLevel: number}[];
    nodes: {
      id: string;
      kind: 'attribute' | 'skill';
      groupIndex: number;
      maxLevel: number;
      name: Localized | null;
      description: Localized | null;
      icons: {activated: string | null; unactivated: string | null; blink: string | null};
      layout: {panel: string | null; offsets: Record<string, number> | null; anchors: unknown; alignment: unknown} | null;
      levels: {
        level: number;
        rowKey: string;
        unlockConditions: unknown[];
        attribute: {isTag: boolean | null; propName: string | null; propValue: number | null; modifierOp: string | null};
        buffClass: string | null;
        buffDescription: Localized | null;
        descriptionParams: unknown[];
        materials: {id: string; count: number | null; name: Localized | null; icon: string | null}[];
        bannedLevels: number[];
      }[];
    }[];
    connections: {from: string | null; to: string | null; layout: {
      panel: string | null; offsets: Record<string, number> | null; anchors: unknown; alignment: unknown
    } | null}[];
  }[];
  totals: {configRows: number; nodes: number; skills: number; graphNodes: number; graphConnections: number; unlistedConfigRows: number};
}

// ---- mmo-raids.json (normalized MMO LevyClone stage/schedule catalog)
export interface HandbookMmoRaidData extends HandbookDataset {
  totalStages: number;
  totalScheduleRows: number;
  totalScheduleLinks: number;
  stageMatchedScheduleLinks: number;
  scheduleVariantIdsWithoutStageRows: string[];
  stages: {
    id: string;
    stageNumber: number | null;
    floorEnum: string | null;
    difficultyEnum: string | null;
    titleKey: string | null;
    name: Localized;
    nameLocalization: unknown;
    bosses: {id: string; actorKey: string | null; name: Localized; localization: unknown}[];
    recommendedScore: {baseValue: number | null; regionalOverrides: unknown[]; mmoOverrides: unknown[]} | null;
    requiredLevel: {baseRange: {lower: number | null; upper: number | null} | null;
      regionalOverrides: {region: string; serverMode: string; range: {lower: number | null; upper: number | null} | null}[]} | null;
    team: {minPlayers: number | null; maxPlayers: number | null; roleCounts: Record<string, number | null>} | null;
    challengeTimeRaw: {value: number | null; regionalOverrides: unknown[]} | null;
    mechanics: {index: number; text: Localized; localization: unknown; icon: string | null}[];
    stageImages: {small: string | null; title: string | null};
    dropRefs: Record<string, string | null> | null;
    rewards: Record<'normal' | 'poor' | 'display', {id: string; modifyNum: number | null; modifyCount: number | null;
      minLevel: number | null; maxLevel: number | null; levelType: string | null;
      items: {id: string; name: Localized; icon: string | null; count: number | null; minCount: number | null;
        maxCount: number | null; weight: number | null}[]}[]>;
    scheduleRows: string[];
  }[];
  schedules: {
    id: string;
    beginRaw: string | null;
    endRaw: string | null;
    timeLimited: boolean | null;
    shownInClient: boolean | null;
    jointOperationLevelType: string | null;
    bossBuffIds: string[];
    playerBuffIds: string[];
    extraDropId: string | null;
    balanceBossBuffId: string | null;
    bossDebuff: {description: Localized; icon: string | null} | null;
    linkedLevels: {serverLevel: string | null; variantId: string; stageRowPresent: boolean; name: Localized}[];
  }[];
  unresolved: Record<string, string>;
}

// ---- team-raids.json (normalized Original/Global Team8P catalog)
export interface HandbookTeamRaidData extends HandbookDataset {
  total: number;
  variantsTotal: number;
  mechanicsTotal: number;
  /** DT_Title acquisition conditions via the normalized EN/RU cosmetics catalog. */
  rankingTitles?: {seasonId: string; titles: {
    id: string; minRank: number; maxRank: number; name: Localized; description: Localized; color: string | null;
  }[]}[];
  guide: {
    key: string;
    namespace: string;
    text: Localized;
    localization: unknown;
    poolEntries?: {index: number; name: Localized; matchedRaidId: string | null; localizationJoinMethod: string; associationMethod: string; source: Record<string, unknown> | null}[];
  } | null;
  catalogCoverage: {candidateRowsTotal: number; unsupportedTeam8pIds: string[]};
  /** Editorial page media resolved by the Handbook generator. */
  presentation?: {cardBackground: {url: string | null; reference: string | null; expected: string | null} | null};
  raids: {
    id: string;
    index: number;
    bosses: {id: string; sourceIds: string[]; localizationKey: string | null; nameJoinMethod: string; name: Localized;
      /** Raw DT_MonsterStaticData rows whose key holds the boss number and "8P". */
      stats?: {rowId: string; selection: string; sourcePath: string; fields: Record<string, number | string>;
        /** Computed by build-team-raids: resist % = X / (X + K(level)) per element, FinalCritDef as percent. */
        derived: {formulaLevel: number; resistK: number; resistPct: Record<string, number | null>; finalCritDefPct: number | null}}[]}[];
    bossTips: {key: string; bossId: string; joinMethod: string; text: Localized}[];
    guides: {
      id: string;
      namespace: string | null;
      key: string;
      baseText: Localized;
      text: Localized;
      baseLocalization: unknown;
      localization: unknown;
      selectedOverride: {region: string; regionKey: string; serverMode: string; serverModeKey: string; tableId: string | null; key: string} | null;
      regionalReferences: {region: string; regionKey: string; serverMode: string; serverModeKey: string; tableId: string | null; key: string}[];
      relatedBossIds: string[];
      associationMethod: string;
      source: Record<string, unknown> | null;
    }[];
    variants: {
      id: string;
      targetName: string;
      artwork?: {
        thumbnail: string | null; title: string | null;
        references: {thumbnail: string | null; title: string | null};
        expected: {thumbnail: string | null; title: string | null};
        source: {file: string; row: string; thumbnailField: string; titleField: string} | null;
      };
      name: Localized;
      nameLocalization: unknown;
      cloneIndex: number | null;
      bossIds: string[];
      recommendedScore: {baseValue: number | null; regionalOverrides: {region: string; serverMode: string; value: number | null}[]; mmoOverridesRaw: unknown[]} | null;
      challengeTimeRaw: {value: number | null; regionalOverrides: unknown[]} | null;
      requiredLevel: {baseRange: {lower: number | null; upper: number | null} | null; regionalOverrides: {region: string; serverMode: string; range: {lower: number | null; upper: number | null} | null}[]} | null;
      team: {minPlayers: number | null; maxPlayers: number | null; roleCounts: Record<string, number | null>} | null;
      rewardPackIds: Record<string, unknown> | null;
      rewardDetails: {packId: string; roles: string[]; groups: {id: string; sequenceId: string | null; level: unknown; modifyNumRaw: number | null; modifyCountRaw: number | null; entries: {rowId: string; itemId: string; itemName: Localized; itemIcon: string | null; numberType: string; num: number | null; minNum: number | null; maxNum: number | null; weight: number | null; limitLevel: string; notBindPercent: number | null; sourcePath: string}[]}[]}[];
      availability: {activityType: string | null; openWeekDays: unknown[]; openAfterUtcTimes: unknown[]; timeWindowsRaw: {begin: string | null; beginRegionOverrides: unknown[]; end: string | null; endRegionOverrides: unknown[]; initValueRaw: unknown}[]} | null;
      mechanics: {index: number; key: string; text: Localized; localization: unknown; localizationRef: {tableId: string | null; namespace: string | null; key: string}; source: {field: string; imageField: string}; icon: string | null; assetRef: string | null}[];
      source: Record<string, unknown> | null;
    }[];
  }[];
}

// ---- space-support.json
export interface HandbookSpaceSupportData {
  item: Record<string, HandbookItem>;
  systemLevels: { level: number; name: Localized | null; icon?: string | null; maxModuleLevel: number; needAllModuleLevel: number; resetCooldownDays: number }[];
  modules: {
    id: string;
    name: Localized;
    icon: string | null;
    base: boolean;
    maxLevel: number;
    levels: { level: number; cost: number; cumulative: number; effect: Localized; attribute: string | null; value: number }[];
  }[];
  totalAllModules: number;
}

// ---- cs.json
export interface HandbookCsData {
  attributes: { type: string; stat: string; weight: number; base: string | null; name: Localized | null; icon: string | null }[];
  titanRare: { id: string; weight: number; name: Localized | null; icon: string | null; values: {level: number; value: number}[] }[];
  rounding: string;
  scope: string;
  systems: {
    supercomputer: { slot: string; levels: { level: number; cs: number }[] }[];
    /** estimate: content module whose final-DMG attribute borrows the DMG% weight (model hypothesis). */
    spaceSupport: { id: string; levels: { level: number; cs: number; estimate: boolean }[] }[];
    suppressor: { row: string; cs: number }[];
  };
  limitations: string[];
  spaceSupportNames: Record<string, Localized>;
  spaceSupportIcons: Record<string, string | null>;
  slotNames: Record<string, Localized>;
  slotIcons: SlotIcons;
}

// ---- combat-formulas.json
export interface HandbookFormulasData {
  crit: { source: string; denominators: Record<string, number> };
  resistance: { source: string; constants: Record<string, number>; expression: string; levelBasis: string };
}

// ---- server-list.json
export interface HandbookServer { id: string; name: string; region: string; regionCode: string; tab: string; kind?: string; platform?: string }

/** Section payloads for one mode; a missing key means the section's file was not found. */
export interface HandbookSectionsData {
  'random-stats'?: HandbookRandomStatsData;
  expansion?: HandbookExpansionData;
  titan?: HandbookTitanData;
  cs?: HandbookCsData;
  enhancement?: HandbookEnhancementData;
  supercomputer?: HandbookSupercomputerData;
  suppressor?: HandbookSuppressorData;
  brainfield?: HandbookBrainfieldData;
  'space-support'?: HandbookSpaceSupportData;
  'combat-formulas'?: HandbookFormulasData;
  servers?: HandbookServer[];
}
