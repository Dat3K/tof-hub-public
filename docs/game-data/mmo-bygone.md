# Bygone Phantasm (MMO)

The MMO edition has its own Bygone tables (internal family name `BigSecret`). They are never joined to the Global tables by name.

| | |
| --- | --- |
| Generator | `scripts/generators/build-handbook.cjs` |
| Domain logic | `packages/game-domain/src/encounters/mmo-bygone.ts` |
| Output | `game-data/handbook/mmo-bygone.json` |
| Page | `apps/web/src/features/datamine/bygone/mmo-bygone-view.tsx` at `/datamine/bygone/?mode=mmo` |

## Sources

All tables are reached through explicit bindings:

- `Resources/CoreBlueprints/GameMode/MMO/BP_GameData_MMO_Base.json` binds the base, reward, server-buffer, monster-pool and season tables, and `MonsterDataTable`.
- `Resources/CoreBlueprints/DataTable_MMO/BigSecret/BigSecretDataAsset_MMO.json` binds the per-round and common-round tables.

| Table (`DataTable_MMO/...`) | Fields | Notes |
| --- | --- | --- |
| `BigSecretSeasonRoundDataTable_MMO` | `BalanceMaxRound`, `OneSeasonRounds[]` (`RoundIndex`, `SubSceneType`, `SubLevelIDs`, `IsBossRound`, `IsSaveRound`) | 200 rounds, 82 boss rounds |
| `DT_BigSecretBaseConfig_MMO` | `PlayerLevelLimit`, `ReliveCount`, `RoundLimitSeconds`, `MaxRoundCount`, `BossRound`, `JumpRound` | Base settings |
| `BigSecret/DT_BigSecretRound_MMO` | `RoundTime`, player and monster buff arrays, `RecommendWeapons`, `MonsterFeature` | Per-round mechanics |
| `BigSecret/DT_BigSecretCommonRound_MMO` | `RecommendGS`, `CheckGs`, `AICombatIntensity` | Shown as raw values |
| `DT_BigSecretMonsterPoolConfig_MMO` | `RoundRange`, `MonsterPoolType`, `RoundMonsters[].MonsterType/MonsterClass/MonsterCount` | One pool per round |
| `DT_BigSecretServerMonsterRoundBufferConfig_MMO` | `ServerLevelRange`, `RoundBuffs[].Value.BuffRoudValue/BuffID/BuffCount`, `MonsterLevelValue` | Binds the scaling curves |
| `BigSecretBuffCount_MMO` | Curves `MonsterLevel`, `HpBuffCount`, `AtkBuffCount`, `DefBuffCount`, `FinalCritDef` | Linear curves keyed by round |
| `DT_MonsterStaticData_MMO` | `MaxHealth`, `CommonAtkBase`, five `*DefBase` fields, `ArmorBase`, `FinalCritDef` | Base enemy stats |
| `DT_BigSecretRoundPassRewardConfig_MMO` | `RoundIndex`, `ServerLevelRange`, `RankAwardId` | Rewards on odd floors |

## Lineups

1. Each round selects the pool whose inclusive `RoundRange` contains its `RoundIndex`.
2. Each slot's `MonsterClass` resolves to a class asset. The resolver follows Blueprint parents to the first `Properties.AttributeID`, which selects the row in `DT_MonsterStaticData_MMO`.
3. Enemy names are kept only when the class key exists in `ST_actorname`. Other enemies show their technical name.

Slots with `MonsterClass = None` stay empty; they are never filled with a guessed enemy.

## HP model

```text
stacks   = trunc(HpBuffCount(floor))
enemy.hp = enemy.stats.maxHealth × (1 + stacks)
```

The HP curve is resolved from the bound `RoundBuffs[].Value.BuffRoudValue` row, independently of the `MonsterLevel` curve. HP is calculated only when all server groups agree on a plain `Buff_BigSecret_AddHp001` binding with `BuffCount = 1` and `bBuffLevelUseSceneLevel = false`. Any other binding, a missing curve, a negative or non-finite value or a missing stat row produces unknown HP instead of a fallback.

The dataset records `hpModel = base-plus-whole-hp-stacks`, each round's `hpScaling = {curveValue, stacks, multiplier}` and each enemy's calculated `hp`. `stats.maxHealth` remains the source baseline, and the final value is not rounded because runtime rounding is unknown.

Charts plot the highest known single-enemy HP per floor. The CSV export contains `HP`, `BaseHP`, `HPStacks`, `HPMultiplier` and `MaxKnownEnemyHP`.

## Defense estimate

Elemental cards show an **estimated** defense:

```text
estimated DEF = *DefBase + trunc(DefBuffCount(floor))
```

It is calculated only for a linear `DefBuffCount` curve bound to `Buff_BigSecret_AddCommonDef_Balance` with `BuffCount = 1`. The generated `enemy.defenseEstimate` carries `verified: false`, and the UI labels it as an estimate with the base value underneath. No resistance percentage or effective HP is derived from it.

## Regenerating

```bash
node scripts/generators/build-handbook.cjs --mmo-bygone-only        # from a raw export (TOF_RAW_GAME_DIR, TOF_PUBLIC_DIR)
node scripts/generators/build-handbook.cjs --mmo-bygone-stats-only  # recalculate HP and DEF from the saved dataset
node scripts/generators/build-handbook.cjs --mmo-bygone-media-only  # refresh image provenance
```

Add `--check` to verify without writing. The stats-only mode uses the dataset's own saved baselines, curves and bindings and never reads another export.

## Open questions

- Which server group and server level apply at runtime, and how curve values are rounded into stacks and levels.
- How curve values turn into final in-combat ATK, defense and crit resistance. Raw `*DefBase = 1` rows are not player-facing resistance totals.
- The meaning of `RoundTime`, `AICombatIntensity` and `MaxRoundCount = 654` (only 200 rounds are configured).
- Twenty reward rows reference `droplist_FakeDiamond`, which has no sequence row in the bound drop table. The raw ID is kept.
- Live season rotation and time zone: the season window in the table is a placeholder-like 2023–2033 range.
