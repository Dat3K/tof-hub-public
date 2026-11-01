# Bygone Phantasm (Global)

Processor: `scripts/game-processors/processors/build-bygone.ts`, with the shared identity resolver `enemy-identity.ts` (also used by the Handbook).

## Sources

| Raw path | Fields |
| --- | --- |
| `ResourcesOverSea/CoreBlueprints/DataTable/Dungeon/DT_BigSecretMonsterPoolConfig_Overseas.json` | `PoolID`, `RoundRange.LowerBound/UpperBound` (`Type`, `Value`), `MonsterPoolType`, `RoundMonsters[].MonsterType`, `MonsterClass.AssetPathName`, `MonsterCount` |
| `Resources/CoreBlueprints/DataTable/DT_BigSecretMonsterPoolConfig.json` | Base counterpart. Its bounds are read from its own rows, never borrowed from Overseas. |
| `ResourcesOverSea/CoreBlueprints/DataTable/Dungeon/OriginWarMonsterPoolDataTable_Overseas.json` and its base table | `PoolMonsters[].MonsterClass.AssetPathName`, `MonsterName` (names for identical classes only) |
| `Localization/Game/<culture>/Game.json` | `ST_actorname` and exact FText namespaces |

Range bounds are floor numbers. Inclusive endpoints are kept; exclusive endpoints move inward by one floor.

## Enemy identity

1. A class reference such as `/Game/Resources/CoreBlueprints/Character/BigSecretMonster/Elite/BigSecret_Elite_LDZ_DLJQR.BigSecret_Elite_LDZ_DLJQR_C` resolves to `Hotta/Content/<package>.json`.
2. The resolver walks `BlueprintGeneratedClass.Super.ObjectPath` / `SuperStruct.ObjectPath` and reads `Default__*.Properties.{MonsterName, CharacterName, ActorName}`.
3. Names come from the explicit name reference or the exported class name in `ST_actorname`.
4. Cycles and paths outside `/Game/` stop the walk. Trimming suffixes never establishes a parent.

Images come from confirmed entries in `processors/monster-image-mapping.json`, from direct Blueprint fields (`BossImage`, `PortraitImage`, `IconImage`), or from an exact actor key that matches a texture in `UI/void/boss`, `UI/Scenery/monster`, `UI/SHTT/guaiwu/Btn` or `UI/plugin/FB/bigmon`.

Each enemy keeps its `classPath`, the name and image provenance and the files it traversed. `identityCoverage` separates missing names from missing artwork.

## Output

`datamine/bygone/data/bygone.json` (staging) → `game-data/<culture>/bygone.json` and runtime projections.

## Known limitations

- `BigSecretSeasonRoundDataTable_Overseas.json` lists rounds (`RoundIndex`, `SubSceneType`, `SubLevelIDs`, `IsBossRound`, `IsSaveRound`) but does not say which of several eligible pools the server picks. A floor is assigned a lineup only when exactly one pool is eligible; otherwise its candidates remain available in `monsterPools`.
- Scaling beyond floor 500 follows the template curve, which does not imply a verified lineup.
