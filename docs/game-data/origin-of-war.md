# Origin of War

Seasonal floor ladder for both editions. Each floor has a wave lineup, fixed stage effects, drop buffs and a difficulty curve.

| | |
| --- | --- |
| Processor | `scripts/game-processors/processors/build-user-stats.ts` |
| Season shards | `scripts/game-processors/processors/shard-oow-data.ts` → `datamine/oow/data/seasons/{sNN,mmo_sNN}.json` |
| Normalizer | `scripts/normalize-game-data/adapters/oow.ts` |
| Output | `game-data/<culture>/oow/seasons/*.json`, `oow/effects.json` |
| Page | `/datamine/oow/` (`?mode=mmo` for MMO) |

## MMO sources

All under `Resources/CoreBlueprints/`:

| Table | Fields |
| --- | --- |
| `DataTable_MMO/OriginWar/OriginWarSeasonConfigDataTable_MMO` | `SeasonBeginTime`, `SeasonEndTime` and their `_Region[]` overrides. `Region_Oversea` is used when present. |
| `DataTable_MMO/OriginWar/OriginWarRoundConfigDataTable_MMO` | `OriginSeasonID`, `OriginRound`, `ShowBuffs`, `MonsterWeakBuffs`, `DropBuffs`, `WaveMonsterPool`, `MonsterStrength` |
| `DataTable_MMO/OriginWar/OriginWarMonsterPoolDataTable_MMO` | `PoolMonsters[]`: `MonsterClass`, `MonsterType`, `MonsterLevel`, `MonsterCount`, `AttributeID`, `MonsterBuffID[]` |
| `DataTable_MMO/OriginWar/OriginWarBuffPoolDataTable_MMO` | `BuffType`, `BuffID`, `BuffTypeImg` for each `DropBuffs[].BuffPoolID` |
| `DataTable_MMO/DT_MonsterStaticData_MMO` | Enemy base stats by `AttributeID` |
| `DataTable_Balance/EffectFigure/OriginWarMonster_Balance` | Difficulty curves (`Keys[].Time/Value`) referenced by `MonsterStrength.RowName` |
| `DataTable_Balance/GameplayEffectTipsDataTable_Balance` | `Name`, `Desc`, `Icon.AssetPathName` for every effect |

Global seasons use the corresponding `ResourcesOverSea` tables with base fallbacks.

## Calculations

**Difficulty.** The applied coefficient is the first curve key's `Value / 100`, rounded to four decimals. It scales `MaxHealth`, `CommonAtkBase` and `PhyDefBase`; the raw values stay in `baseHp`, `baseAtk` and `baseDef`.

> Example: round row 74 uses curve row `1_2`, whose first key is `Value = 200`, so the coefficient is 2.0. Its boss has `MaxHealth = 62,961,076`, giving 125,922,152 HP.

**Drop buffs.** Each `DropBuffs[]` entry has an integer weight `DropWight` (the source spelling). The page shows `DropWight / sum(DropWight)` as a relative share; the table does not say the weights are percentages.

**Resistance.** The single displayed resistance percentage is an estimate calculated from scaled physical defense with `calculateOowResistance` (`datamine/shared/tof-formulas.ts`) at level 100. It is not five independent elemental values.

## Effects

`EnvirSeasonDisplayForMon` entries and `None` slots in `MonsterBuffID[]` are environment markers, not enemy effects, and are filtered out of enemy cards. Effect icons always come from the exact `Icon.AssetPathName` in the effect-tips table; a missing icon stays missing.

The complete effect catalog (`scripts/normalize-game-data/oow-effects.ts`) is the union of all effect definitions and seasonal references, with Global and MMO kept separate:

| Source | Contents |
| --- | --- |
| `OriginWarBuffPoolDataTable` (Overseas, base and MMO) | `BuffID.AssetPathName` of every pool row, including unused ones |
| `OriginWarMonsterPoolDataTable_MMO` | Environment effects such as `Buff_EnvirDisplay_Firewall` |
| `GameplayEffectTipsDataTable` (Overseas, base, Balance) | Names, descriptions and icons |
| Season shards | Historical stage effects, drops and enemy buffs |

Assets are merged by their exact package name; similar names stay separate. MMO text is looked up only in Balance namespaces, so a Global key can never supply MMO text.

```bash
pnpm exec tsx scripts/normalize-game-data/oow-effects-only.ts --raw-source <raw-root> --legacy-source <prepared-site-root> [--check]
```

### Monster effects without a direct tip

`scripts/normalize-game-data/oow-effects.ts` reads exact class references from
`Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Dungeon/OriginWarMonsterPoolDataTable_Overseas.json`
and `Hotta/Content/Resources/CoreBlueprints/DataTable/OriginWarMonsterPoolDataTable.json`,
`Rows.*...MonsterBuffID[].AssetPathName`. If no effect-tips row exists, it follows
the exported class JSON's `GEObjs[]` references. Exactly one applied effect with
a tip can supply its text, recorded as `source.tipVia`. Example:
`Buff_Curse_001` applies `Buff_Curse_001_Start`; the Overseas tips table resolves
`BuffDes:Buff_Curse_001_Start_name` to "Delay". The Global export examined on
2026-10-29 (exact build unknown) still had effects without tips or matching
localization, such as `buff_Origin_BeFire_Mon`. They retain the raw identity and
the unavailable-description state. This adds no guessed values or unit conversions.

## Validation

- The processor fails when a required table or curve is missing, instead of substituting Global data or 100 % scaling.
- Seasons are discovered from the data; there is no allowlist. Shards are written to a temporary directory and swapped atomically.
- `validateOowEffectCatalogMedia` rejects a release when a declared effect icon is missing.
- `tools/patch-exporter/src/oow-media.ts` verifies that enemy PNG originals are copied byte for byte; WebP previews never count as PNG originals.

## Open questions

- The unit of `MonsterStrength.Keys[].Time` (mapped to a day-like schedule).
- How the game samples drop choices from their weights.
- The MMO round table configures seasons 1, 3 and 4 only. Season 2 has dates but no rounds, so it is not generated. The page numbers the configured seasons S1–S3 while URLs keep the raw IDs.
