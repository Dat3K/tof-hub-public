import { z } from 'zod';

// ==========================================
// 1. FCE (Frontier Clash Evolution) Schemas
// ==========================================

export const FceMechanicItemRawSchema = z.object({
  index: z.string(),
  html: z.string(),
}).passthrough();

export const FceIndexBossRawSchema = z.object({
  slug: z.string(),
  order: z.number().int().optional(),
  boss_id: z.string(),
  boss_num: z.number().int(),
  name: z.string(),
  name_ru: z.string(),
  name_color: z.string().optional(),
  art: z.string(),
  preview: z.string(),
  displayWebpUrl: z.string().optional(),
  cardThumbnail: z.string().optional(),
  downloadPngUrl: z.string().optional(),
  lineupPortrait: z.string().optional(),
  lineupPortraitThumb: z.string().optional(),
  detailImage: z.string().optional(),
  mechanics_count: z.number().int().nonnegative().optional(),
  ladder_level: z.number().int().optional(),
  ladder_key: z.string().optional(),
  art_object_position: z.string().optional(),
  mechanics: z.array(FceMechanicItemRawSchema).optional(),
}).passthrough();

export const FceIndexDatasetSchema = z.object({
  bosses: z.array(FceIndexBossRawSchema),
}).passthrough();

export const FceBossDetailDatasetSchema = z.object({
  slug: z.string(),
  order: z.number().int().optional(),
  boss_id: z.string(),
  name_color: z.string(),
  art: z.string(),
  art_object_position: z.string().optional(),
  source_psd: z.string().optional(),
  preview: z.string().optional(),
  en: z.object({
    name: z.string(),
    mechanics: z.array(FceMechanicItemRawSchema),
  }),
  ru: z.object({
    name: z.string(),
    mechanics: z.array(FceMechanicItemRawSchema),
  }),
});

// ==========================================
// 2. OoW (Origin of War) Schemas
// ==========================================

export const OowSeasonSummaryRawSchema = z.object({
  season: z.number().int(),
  title: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  startISO: z.string().optional(),
  endISO: z.string().optional(),
  floorCount: z.number().int().optional(),
  bossName: z.string().optional(),
  bossNameRu: z.string().optional(),
  bossImage: z.string().optional(),
  bossImageThumb: z.string().optional(),
  totalSeasonHp: z.number().optional(),
  totalSeasonEffectiveHp: z.number().optional(),
});

export const OowCurrentSummaryDatasetSchema = z.object({
  statIcons: z.object({ hp: z.string(), atk: z.string(), armor: z.string(), crit: z.string() }).optional(),
  schemaVersion: z.number().optional(),
  meta: z.object({
    generatedAt: z.string().optional(),
    standardActiveSeason: z.number().int().optional(),
    mmoActiveSeason: z.number().int().optional(),
  }).passthrough().optional(),
  recentSeasons: z.array(OowSeasonSummaryRawSchema).optional(),
  mmoRecentSeasons: z.array(OowSeasonSummaryRawSchema).optional(),
  currentSeason: OowSeasonSummaryRawSchema.optional(),
  mmoCurrentSeason: OowSeasonSummaryRawSchema.optional(),
  buffs: z.record(z.string(), z.unknown()).optional(),
}).passthrough();

export const OowEnemyRawSchema = z.object({
  wave: z.number().int().optional(),
  mob: z.number().int().optional(),
  key: z.string(),
  nameEn: z.string().optional(),
  nameRu: z.string().optional(),
  codeName: z.string().optional(),
  bossId: z.string().nullable().optional(),
  monsterType: z.string().optional(),
  count: z.number().int().optional(),
  level: z.number().int().optional(),
  mode: z.string().optional(),
  season: z.number().int().optional(),
  floor: z.number().int().optional(),
  hp: z.number().optional(),
  combinedHp: z.number().optional(),
  effectiveHp: z.number().optional(),
  effHp: z.number().optional(),
  atk: z.number().optional(),
  def: z.number().optional(),
  image: z.string().nullable().optional(),
  imagePng: z.string().nullable().optional(),
  detailImagePng: z.string().nullable().optional(),
  imageThumb: z.string().nullable().optional(),
}).passthrough();

export const OowFloorRawSchema = z.object({
  floor: z.number().int(),
  unlockDay: z.number().int().optional(),
  mobCount: z.number().int().optional(),
  totalHp: z.number().optional(),
  effectiveHp: z.number().optional(),
  effHp: z.number().optional(),
  enemies: z.array(OowEnemyRawSchema).optional(),
  dropBuffs: z.array(z.string()).optional(),
}).passthrough();

export const OowSeasonDatasetSchema = z.object({
  season: z.number().int(),
  title: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  floorCount: z.number().int().optional(),
  floors: z.array(OowFloorRawSchema),
}).passthrough();

// ==========================================
// 3. Bygone Phantasm Schemas
// ==========================================

export const BygoneFloorRawSchema = z.object({
  floor: z.number().int(),
  is_boss_floor: z.boolean(),
  monster_level: z.number().int().optional(),
  round_gs: z.number().optional(),
  hp_multiplier: z.number().optional(),
  atk_multiplier: z.number().optional(),
  final_hp: z.number().optional(),
  final_atk: z.number().optional(),
  computed_stats: z.record(z.string(), z.unknown()).optional(),
  weakness: z.array(z.record(z.string(), z.unknown())).optional(),
  primary_enemy: z.record(z.string(), z.unknown()).nullable().optional(),
  monsters: z.array(z.record(z.string(), z.unknown())).optional(),
}).passthrough();

export const BygoneDatasetSchema = z.object({
  schemaVersion: z.number().optional(),
  generatedAt: z.string().optional(),
  totalFloors: z.number().int().nonnegative(),
  floors: z.array(BygoneFloorRawSchema),
  monsterPools: z.array(z.record(z.string(), z.unknown())).optional(),
}).passthrough();

// ==========================================
// 4. Sequential Phantasm Schemas
// ==========================================

export const SeqStageRawSchema = z.object({
  stage: z.number().int(),
  codename: z.string(),
  enemyCode: z.string().optional(),
  enemyNameEn: z.string().nullable().optional(),
  enemyNameRu: z.string().nullable().optional(),
  name_en: z.string().nullable().optional(),
  name_ru: z.string().nullable().optional(),
  maxHealth: z.number(),
  effectiveHp: z.number(),
  atk: z.number().optional(),
  def: z.number().optional(),
  crit: z.number().optional(),
  critResist: z.number().optional(),
  element: z.string().optional(),
  portrait: z.string().nullable().optional(),
  mechanics: z.union([z.string(), z.array(z.string())]).nullable().optional(),
}).passthrough();

export const SeqCacheDatasetSchema = z.object({
  meta: z.record(z.string(), z.unknown()).optional(),
  rows: z.record(z.string(), z.number()).optional(),
  stages: z.array(SeqStageRawSchema),
}).passthrough();

// ==========================================
// 5. Item Datamine Schemas
// ==========================================

export const DatamineItemRawSchema = z.object({
  id: z.string(),
  name: z.string(),
  original: z.string(),
  rename: z.string().optional(),
  quality: z.string(),
  icon: z.string(),
  description_en: z.string().optional(),
  description_ru: z.string().optional(),
}).passthrough();

export const DatamineItemsDatasetSchema = z.record(z.string(), DatamineItemRawSchema);

// ==========================================
// 6. Multype Schemas
// ==========================================

export const MultypeRenamesDatasetSchema = z.object({
  version: z.number().optional(),
  sourceFile: z.string().optional(),
  /** Game client of the owner-run Advanced Multype scan; independent of the site release version. */
  scan: z.object({
    gameVersion: z.string().nullable(),
    generatedAt: z.string().nullable(),
  }).optional(),
  mainRenames: z.record(z.string(), z.string()).optional(),
  subRenames: z.record(z.string(), z.string()).optional(),
  valueRenames: z.record(z.string(), z.string()).optional(),
  groupRenames: z.record(z.string(), z.string()).optional(),
  aiGuesses: z.record(z.string(), z.object({
    sourceKey: z.string(),
    candidates: z.array(z.object({
      label: z.string(),
      labelRu: z.string().optional(),
      entityType: z.string(),
      entityId: z.string(),
      confidence: z.number().min(0).max(1),
      evidence: z.array(z.string()),
    })),
  })).optional(),
}).passthrough();

export const MultypeMappingDatasetSchema = z.record(
  z.string(),
  z.record(z.string(), z.record(z.string(), z.unknown()))
);

// ==========================================
// 7. Team Raid Schemas
// ==========================================

const TeamRaidLocalizationStatusSchema = z.object({
  status: z.enum(['resolved', 'source_fallback', 'codename_fallback', 'unresolved']).optional(),
  resolvedLocale: z.string().nullable().optional(),
}).passthrough();

const TeamRaidBilingualLocalizationSchema = z.object({
  en: TeamRaidLocalizationStatusSchema,
  ru: TeamRaidLocalizationStatusSchema,
}).passthrough();

export const TeamRaidMechanicSchema = z.object({
  index: z.number().int().positive(),
  key: z.string(),
  text: z.string(),
  localizationRef: z.object({
    tableId: z.string().nullable(),
    namespace: z.string().nullable(),
    key: z.string(),
  }).passthrough().optional(),
  source: z.object({ field: z.string(), imageField: z.string() }).passthrough().optional(),
  localization: TeamRaidBilingualLocalizationSchema.optional(),
  image: z.object({
    assetRef: z.string(),
    rawExportPath: z.string(),
    url: z.string(),
  }).passthrough().nullable(),
}).passthrough();

export const TeamRaidBossSchema = z.object({
  id: z.string(),
  sourceIds: z.array(z.string()),
  name: z.string(),
  localizationKey: z.string().optional(),
  nameJoinMethod: z.enum(['exact-boss-id', 'boss-id-prefix-fallback', 'unresolved']).optional(),
  localization: TeamRaidBilingualLocalizationSchema.optional(),
}).passthrough();

export const TeamRaidBossTipSchema = z.object({
  key: z.string(),
  bossId: z.string(),
  text: z.string(),
  localization: TeamRaidBilingualLocalizationSchema.optional(),
  joinMethod: z.literal('boss-id-prefix'),
}).passthrough();

export const TeamRaidGuideSchema = z.object({
  id: z.string(),
  namespace: z.string().nullable(),
  key: z.string(),
  baseText: z.string(),
  text: z.string(),
  baseLocalization: TeamRaidBilingualLocalizationSchema.optional(),
  localization: TeamRaidBilingualLocalizationSchema.optional(),
  selectedOverride: z.object({
    region: z.string(),
    regionKey: z.string(),
    serverMode: z.string(),
    serverModeKey: z.string(),
    tableId: z.string().nullable(),
    key: z.string(),
  }).passthrough().nullable(),
  regionalReferences: z.array(z.object({
    region: z.string(),
    regionKey: z.string(),
    serverMode: z.string(),
    serverModeKey: z.string(),
    tableId: z.string().nullable(),
    key: z.string(),
  }).passthrough()),
  relatedBossIds: z.array(z.string()),
  associationMethod: z.string(),
  source: z.object({ path: z.string(), row: z.string(), field: z.string(), overridesField: z.string() }).passthrough().nullable(),
}).passthrough();

export const TeamRaidVariantSchema = z.object({
  id: z.string(),
  targetName: z.string(),
  name: z.string(),
  nameLocalization: TeamRaidBilingualLocalizationSchema.optional(),
  cloneIndex: z.number().nullable(),
  bossIds: z.array(z.string()),
  recommendedScore: z.object({
    baseValue: z.number().nullable(),
    regionalOverrides: z.array(z.object({
      region: z.string(),
      serverMode: z.string(),
      value: z.number().nullable(),
    }).passthrough()),
    mmoOverridesRaw: z.array(z.unknown()),
  }).passthrough(),
  challengeTimeRaw: z.object({
    value: z.number().nullable(),
    regionalOverrides: z.array(z.object({
      region: z.string(),
      serverMode: z.string(),
      value: z.number().nullable(),
    }).passthrough()),
  }).passthrough(),
  requiredLevel: z.object({
    baseRange: z.object({ lower: z.number().nullable(), upper: z.number().nullable() }).passthrough().nullable(),
    regionalOverrides: z.array(z.object({
      region: z.string(),
      serverMode: z.string(),
      range: z.object({ lower: z.number().nullable(), upper: z.number().nullable() }).passthrough().nullable(),
    }).passthrough()),
  }).passthrough(),
  team: z.object({
    minPlayers: z.number().nullable(),
    maxPlayers: z.number().nullable(),
    roleCounts: z.object({ attack: z.number().nullable(), defense: z.number().nullable(), assist: z.number().nullable() }),
  }).passthrough(),
  rewardPackIds: z.record(z.string(), z.unknown()),
  rewardDetails: z.array(z.object({
    packId: z.string(),
    roles: z.array(z.string()),
    groups: z.array(z.object({
      id: z.string(),
      sequenceId: z.string().nullable(),
      level: z.object({ min: z.number().nullable(), max: z.number().nullable(), type: z.string() }).passthrough(),
      modifyNumRaw: z.number().nullable(),
      modifyCountRaw: z.number().nullable(),
      entries: z.array(z.object({
        rowId: z.string(),
        itemId: z.string(),
        numberType: z.string(),
        num: z.number().nullable(),
        minNum: z.number().nullable(),
        maxNum: z.number().nullable(),
        weight: z.number().nullable(),
        limitLevel: z.string(),
        notBindPercent: z.number().nullable(),
        sourcePath: z.string(),
      }).passthrough()),
      source: z.object({ groupPath: z.string(), groupRow: z.string(), sequencePaths: z.array(z.string()) }).passthrough(),
    }).passthrough()),
  }).passthrough()),
  availability: z.record(z.string(), z.unknown()),
  mechanics: z.array(TeamRaidMechanicSchema),
  source: z.object({
    configPath: z.string(),
    configRow: z.string(),
    teamConfigPath: z.string(),
    teamConfigRow: z.string(),
  }).passthrough(),
}).passthrough();

export const TeamRaidsDatasetSchema = z.object({
  schemaVersion: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  variantsTotal: z.number().int().nonnegative(),
  mechanicsTotal: z.number().int().nonnegative(),
  guide: z.object({
    key: z.string(),
    namespace: z.string(),
    text: z.string(),
    localization: TeamRaidBilingualLocalizationSchema.optional(),
    poolEntries: z.array(z.object({
      index: z.number().int().positive(),
      name: z.string(),
      matchedRaidId: z.string().nullable(),
      localizationJoinMethod: z.string(),
      associationMethod: z.string(),
      source: z.record(z.string(), z.unknown()).nullable().optional(),
    }).passthrough()).optional(),
  }).passthrough().nullable().optional(),
  catalogCoverage: z.object({
    candidateRowsTotal: z.number().int().nonnegative(),
    unsupportedTeam8pIds: z.array(z.string()),
    unsupportedLevyCloneIds: z.array(z.string()).optional(),
  }).passthrough().optional(),
  raids: z.array(z.object({
    id: z.string(),
    index: z.number().int().positive(),
    bosses: z.array(TeamRaidBossSchema),
    bossTips: z.array(TeamRaidBossTipSchema),
    guides: z.array(TeamRaidGuideSchema).optional(),
    variants: z.array(TeamRaidVariantSchema),
  }).passthrough()),
  source: z.record(z.string(), z.unknown()).optional(),
}).passthrough();

export const MmoTeamRaidsDatasetSchema = z.object({
  schemaVersion: z.number().int().positive(),
  totalStages: z.number().int().nonnegative(),
  totalScheduleRows: z.number().int().nonnegative(),
  totalScheduleLinks: z.number().int().nonnegative(),
  stageMatchedScheduleLinks: z.number().int().nonnegative(),
  scheduleVariantIdsWithoutStageRows: z.array(z.string()),
  stages: z.array(z.object({
    id: z.string(),
    stageNumber: z.number().nullable(),
    floorEnum: z.string(),
    difficultyEnum: z.string(),
    bosses: z.array(z.object({ id: z.string(), actorKey: z.string() }).passthrough()),
    requiredLevel: z.object({
      baseRange: z.object({ lower: z.number().nullable(), upper: z.number().nullable() }).passthrough().nullable(),
      regionalOverrides: z.array(z.object({
        region: z.string(), serverMode: z.string(),
        range: z.object({ lower: z.number().nullable(), upper: z.number().nullable() }).passthrough().nullable(),
      }).passthrough()),
    }).passthrough(),
    mechanics: z.array(z.object({ index: z.number().int().positive(), image: z.unknown().nullable() }).passthrough()),
    scheduleRows: z.array(z.string()),
    rewards: z.record(z.string(), z.array(z.unknown())),
    source: z.record(z.string(), z.unknown()),
  }).passthrough()),
  schedules: z.array(z.object({
    id: z.string(),
    beginRaw: z.string(),
    endRaw: z.string(),
    linkedLevels: z.array(z.object({ serverLevel: z.string(), variantId: z.string(), stageRowPresent: z.boolean() }).passthrough()),
    source: z.record(z.string(), z.unknown()),
  }).passthrough()),
  source: z.record(z.string(), z.unknown()),
  unresolved: z.record(z.string(), z.string()),
}).passthrough();

export const MmoBuildDatasetSchema = z.object({
  schemaVersion: z.number().int().positive(),
  // Interchange data carries a culture tag; the site validates its supported registry.
  locale: z.string().regex(/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/),
  summary: z.object({
    equipmentItems: z.number().int().nonnegative(),
    equipmentSlots: z.record(z.string(), z.number().int().nonnegative()),
    equipmentSeasons: z.record(z.string(), z.number().int().nonnegative()),
    modCardSlotConfigs: z.number().int().nonnegative(),
    regularCardBanksPerSlot: z.array(z.number().nonnegative()),
    seasonCardBanksPerSlot: z.array(z.number().nonnegative()),
    modCards: z.number().int().nonnegative(),
    cardQualities: z.record(z.string(), z.number().int().nonnegative()),
    cardSeasons: z.record(z.string(), z.number().int().nonnegative()),
    modCardAttributeRows: z.number().int().nonnegative(),
    statThresholdTracks: z.number().int().nonnegative(),
    curveTables: z.number().int().nonnegative(),
  }).passthrough(),
  tables: z.array(z.object({
    id: z.string(),
    rawExportPath: z.string(),
    rowCount: z.number().int().nonnegative(),
    rows: z.array(z.object({ id: z.string(), raw: z.unknown() }).passthrough()),
  }).passthrough()),
  localizedTexts: z.array(z.object({
    table: z.string(), row: z.string(), field: z.string(),
    text: z.string(),
    localization: z.object({ status: z.string(), resolvedLocale: z.string().nullable() }).passthrough(),
  }).passthrough()),
  mediaAssets: z.array(z.object({ assetRef: z.string(), rawExportPath: z.string() }).passthrough()),
  source: z.record(z.string(), z.unknown()),
  unresolved: z.record(z.string(), z.string()),
}).passthrough();

// Inferred Types
export type FceIndexDataset = z.infer<typeof FceIndexDatasetSchema>;
export type FceBossDetailDataset = z.infer<typeof FceBossDetailDatasetSchema>;
export type OowCurrentSummaryDataset = z.infer<typeof OowCurrentSummaryDatasetSchema>;
export type OowSeasonDataset = z.infer<typeof OowSeasonDatasetSchema>;
export type BygoneDataset = z.infer<typeof BygoneDatasetSchema>;
export type SeqCacheDataset = z.infer<typeof SeqCacheDatasetSchema>;
export type DatamineItemsDataset = z.infer<typeof DatamineItemsDatasetSchema>;
export type MultypeRenamesDataset = z.infer<typeof MultypeRenamesDatasetSchema>;
export type TeamRaidsDataset = z.infer<typeof TeamRaidsDatasetSchema>;
export type MmoTeamRaidsDataset = z.infer<typeof MmoTeamRaidsDatasetSchema>;
export type MmoBuildDataset = z.infer<typeof MmoBuildDatasetSchema>;
