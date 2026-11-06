# Biochemical Collapse (MMO)

Seasonal MMO mode with six Culture Pod encounters per season. Each pod has a fixed lineup, a time limit, a base score, advantages and disadvantages, and bonus objectives.

| | |
| --- | --- |
| Generator | `scripts/generators/build-handbook.cjs` |
| Output | `game-data/handbook/biochemical-collapse.json` |
| Page | `features/datamine/seq/mmo-sequential-view.tsx` at `/datamine/seq/?mode=mmo` |

## Sources

`Resources/CoreBlueprints/DataTable_MMO/OptionalBossDataAsset_MMO.json` binds the three tables below through `ActivityConfigDataTable_BalanceServer`, `LevelConfigDataTable_BalanceServer` and `EntryConfigDataTable_BalanceServer`. Its `EntryDescriptionMap[]` maps numeric `DescID` values to localized description keys.

| Table | Fields | Meaning |
| --- | --- | --- |
| `DataTable/OptionalBoss/DT_OptionalBossActivityConfig_BalanceServer` | `ActivitySeasonName`, `StartDateTime`, `EndDateTime`, `StartDateTime_Region[]`, `EndDateTime_Region[]`, `OpenLevels[]`, `WeaponLimitAmount` | Seasons. `OpenLevels` lists the six pods in order. |
| `DataTable/OptionalBoss/DT_OptionalBossLevelConfig_BalanceServer` | `LevelName`, `BossName`, `BossIcon`, `SlotName`, `SlotIcon`, `PoolMonstersByWave[].PoolMonsters[]`, `MonsterAttribute`, `MonsterEntryArray`, `ExtraConditionList`, `LimitChallengeTime`, `BaseScore` | Pods |
| `DataTable/OptionalBoss/DT_OptionalBossEntryConfig_BalanceServer` | `BuffName`, `DescID`, `DescArgsArray`, `Score`, `EntryIcon`, `BuffClass`, `bDebuff`, `bTargetIsSelf` | Advantages (`bDebuff = false`) and disadvantages (`bDebuff = true`) |
| `DataTable_MMO/DT_MonsterStaticData_MMO` | `MaxHealth`, `CommonAtkBase`, five `*DefBase` fields, `ArmorBase`, `FinalCritDef` | Enemy base stats, bound by `BP_GameData_MMO_Base.MonsterDataTable` |
| `DataTable_Balance/Skill/BuffDes_Balance`, `OptionalBalanceDes` | String tables | Grade and buff text |

Monster rows provide `MonsterName`, `MonsterLevel`, `MonsterType`, `MonsterCount`, `AttributeID`, `MonsterBuffID[]` and `MonsterClass`.

## Joins

- **Seasons** are ordered by date, not by row ID (two activity rows carry swapped season labels). When a regional date override exists for the Overseas region, it is used. The page opens the season whose regional interval contains today, or the latest configured one.
- **Effects:** `MonsterEntryArray[]` → entry row → `DescID` → `EntryDescriptionMap[]` → localized `Game.json`. Numbered arguments are substituted into the description.
- **Grades:** the localized `MonsterAttribute` string supplies qualitative HP / Defense / Shield / Attack grades. Letters are never computed from numbers.
- **Portraits** use exact class and FText joins. As a fallback, a pod's `BossIcon` or `SlotIcon` is used only for the enemy whose localized name matches exactly.

Time is `LimitChallengeTime` in seconds (shown as m:ss), score is `BaseScore`. `FinalCritDef` is displayed as a percentage.

An activity may list `OpenLevels` IDs whose rows are absent from the bound level
table. The generator preserves those IDs as `unresolvedLevelIds` and emits only
the available pods in `levels`. A calendar-only refresh compares the available
IDs while retaining the unresolved list; it does not infer encounters or stats.
This applies to the activity and level tables above in the current export;
availability can differ by client region and version.

Portable packages resolve `scripts/game-processors/processors/monster-image-mapping.json`
relative to the package root. Repository runs use the checkout root. Both
Biochemical Collapse and MMO Bygone media use this same maintained mapping.

## Description ID correction

In the Global export examined on 2026-10-29 (exact build unknown),
`Hotta/Content/Resources/CoreBlueprints/DataTable_MMO/OptionalBossDataAsset_MMO.json`
`Properties.EntryDescriptionMap[]` repeats some texts under consecutive keys below
1000: 4/5 (`buff_ThunderDown_Level1_des`), 9/10
(`Buff_BioCollapse_BlackHole_Level1_des`) and 12/13
(`Buff_BioColl_FatalElect_I_des`). Entry `DescID` values in this range select
distinct texts in key order, rather than map keys. For example,
`Buff_BioColl_FatalElect_I`, `DescID=10`, `DescArgsArray=[12,500]` resolves to
`Buff_BioColl_FatalElect_I_des`. All 22 comparable entry rows agree with this
reading; all 46 rows below 1000 fill their numbered arguments. Keys from 1000
use the unique `BuffDes_Balance` entries directly. `build-handbook.cjs` applies
this resolution and the generated-data validator rejects remaining `{n}` markers
in `buffCatalog` descriptions. No numeric units or combat conversions are inferred
from this text correction.

## Open questions

- Units and the conversion from `DT_MonsterStaticData_MMO` values to final in-combat stats.
- Exact runtime implementations of entry buffs: the classes under `Resources/Abilities_Balance/` are not exported, so only the localized descriptions are verified.
- Whether the BalanceServer tables or the generic tables apply on a given server; the selector is not in the exported data.
- Time zone and inclusive-boundary semantics of season dates.
