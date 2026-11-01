# Brainfield (MMO)

The MMO talent system, shown in game as *Brainfield* with four *Neuron Chains*. Its internal source family is `PlayerTalent`.

| | |
| --- | --- |
| Generator | `scripts/generators/build-handbook.cjs` |
| Output | `game-data/handbook/mmo-brainfield.json` |
| Page | `mmo-brainfield-section.tsx`, Handbook section `brainfield` (MMO only) |
| Domain logic | `brainfield-domain.ts` |

## Sources

| Raw path | Fields | Role |
| --- | --- | --- |
| `Resources/CoreBlueprints/DataTable_MMO/PlayerTalent/DA_PlayerTalent.json` | `Properties.DataTables[]` | Binds the two tables below |
| `.../PlayerTalent/DT_PlayerTalentGroup.json` | `GroupIndex`, `DisplayName`, `UnlockConditions`, `TalentMaxLevel[].ID/Level`, `bCanReset` | Four chains, their nodes and special skills with max levels |
| `.../PlayerTalent/DT_PlayerTalentConfig.json` | `UnlockConditions`, `DisplayName`, `FuncDescription`, image fields, `AttrModifyData.{IsTag, PropName, PropValue, ModifierOp}`, `BuffObject`, `UpgradeMaterials[]`, `BannedLevelArray` | One row per node level (`Talent<ID>_<level>`, `skill<ID>_<level>`) |
| `Resources/CoreBlueprints/DataTable/Item/ItemConfigs.json` | `MMOTalent_01`, `MMOTalent_02`, `MMOTalent_SP` | Upgrade material names and icons |
| `SevenForest/Blueprint/UI/PlayerTalent/UI_PlayerTalentTree.json` | `UI_PlayerTalentNode_C` (`TalentID`), `UI_PlayerTalentConnection_C` (`UI_<from>_<to>`), `CanvasPanelSlot` layout | Node positions and graph edges |
| `Resources/UI/Talent/shenjingyuan_shuxing/*`, `.../shengjingyuan_buff/*` | Textures | Node and special-skill icons |

The exported data contains 494 level records for 67 IDs (55 attribute nodes and 12 special skills), 55 graph nodes and 45 connections. Maximum level sums per chain are 75, 165, 127 and 127.

## Calculations

- **Costs** are the sum of the selected levels' own `UpgradeMaterials`.
- **Stat summary** groups the selected level records by `AttrModifyData.PropName` and adds their `PropValue`, for non-tag attributes with `ModifierOp = MODIFY_MODOP_ADDITIVE` only. Each level's record is added separately; the last row is never multiplied by the level.
- `PropValue` is used without unit conversion. `*AtkAdded` values are flat, so they have no percent sign.
- Stat labels and icons come from `handbook/random-stats.json` (originally `AttributeStaticDataTable.json`), the same as for Global gear.

The planner starts with every node at its maximum level. The summary is the sum of direct upgrade records, not a verified final account stat.

## Open questions

- How the client rounds fractional values (for example 29,030.4 is displayed as 29,030).
- Runtime effects and stacking of special-skill buffs. Some reference season curves, others use custom requirements; at least one row appears to reference the wrong curve and needs confirmation in game.
- Dynamic unlock, activation and reset behavior, which the static UI layout does not describe.
