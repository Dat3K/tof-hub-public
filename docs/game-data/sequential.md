# Sequential Phantasm

A ladder of boss stages, each to be cleared within 150 seconds. The page charts boss HP, growth between stages and the damage a reference fighter needs to deal.

| | |
| --- | --- |
| Processor | `scripts/game-processors/processors/build-seq-data.ts` |
| Normalizer | `scripts/normalize-game-data/adapters/seq.ts` |
| Output | `game-data/<culture>/datamine/seq.json` (`stages[].maxHealth`, `stages[].def`) |
| Domain logic | `apps/web/src/features/datamine/seq/seq-domain.ts` |
| Page | `/datamine/seq/` |

## Sources

| Value | Raw path and fields |
| --- | --- |
| Boss HP | `ResourcesOverSea/CoreBlueprints/DataTable/Dungeon/DT_MonsterStaticData_Overseas.json`, rows `endless_special_boss_{stage}`, `MaxHealth` |
| Boss resistance | Same rows, `PhyDefBase`, `FireDefBase`, `ThunderDefBase`, `IceDefBase`, `SuperpowerDefBase` (7,500 for every stage and element) |
| Built-in ignore | Same rows, `*DefIgnoreMult` (0) |
| Lineup | `ResourcesOverSea/CoreBlueprints/DataTable/Dungeon/EndlessNewLandMonsterPoolDataTable_Overseas.json`, rows `{bing,huo,lei,wuli,yi}_{stage}_w1`, `PoolMonsters[]` joined by `AttributeID = endless_special_boss_{stage}` |
| Defense constant `K` | `Resources/Abilities/DataTables/DefenceFormula.json` → `build-reference.json`, `resistanceFormula.constants["100"]` (14,106) |
| Space Support damage | `Resources/CoreBlueprints/DataTable/OuterSpaceSupport/`, *Sequential Phantasm* modules (`maxLevel = 10`, level *N* gives *N* %) → `build-page.json` |

## Boss identity

`createSeqIdentityResolver` follows the exact boss classes through `BlueprintGeneratedClass.Super.ObjectPath` / `SuperStruct.ObjectPath` and reads `Default__*.Properties.MonsterName` / `CharacterName`, or an exact class name in `ST_actorname`. The pools of all five elements must agree on the class, otherwise the identity is unknown. Provenance is stored in `stages[].identitySource`.

Editorial names in `curated/datamine/seq/data/seq-mechanics-overrides.json` take priority over automatic identities and never change HP or defense.

To refresh identities only, without touching numbers:

```bash
pnpm exec tsx scripts/normalize-game-data/seq-identities-only.ts --raw-source <raw-root>
```

## Required damage

The main chart shows how much damage a reference fighter must deal to a training dummy within 150 seconds to deal the same damage to the stage boss in 150 seconds. Stage mechanics are not modelled.

```text
required = HP × (1 + R × (1 − i) / K) × (1 + D) / (1 + D + d)
```

| Symbol | Meaning |
| --- | --- |
| `HP` | Stage `maxHealth` |
| `R` | Boss resistance (`def`) |
| `K` | Level 100 defense constant. Damage reduction is `R / (R + K)`: 7,500 / 21,606 = 34.71 % |
| `i` | Resistance ignore, slider 0–50 % in 5 % steps, default 30 %. It reduces the numeric resistance, not the reduction percentage. |
| `d` | Damage bonus from the *Sequential Phantasm* Space Support module, slider level 0–10 (default 5) |
| `D` | The reference fighter's existing damage bonus, 50 % |

`d` adds to the same additive damage category as `D`, so +5 % gives ×1.0333 rather than ×1.05. The training dummy is assumed to have no resistance.

> Example, stage 1 with `i = 30 %` and `d = 5 %`: 266,444,540 × 1.372182 / 1.033333 ≈ 353,816,531.

The chart's CSV export includes `RequiredCactusDamage150s` and the slider values.

## Assumptions

- `K` uses level 100 because it reproduces the 34.71 % reduction used across the site; the raw data does not say whether the engine uses the attacker's or the target's level.
- The dummy's zero resistance and the fighter's 50 % damage bonus are modelling choices, not game data.
- The Space Support buff (`Buff_FinDamageUp_*`) is treated as additive with other damage bonuses. A separate final multiplier has not been ruled out.
- Not modelled: the 3-second invulnerability at the start, shields (−50 %), manual mechanic adjustments and the 1–3 % variance of dummy tests.

The older `effectiveHp` field (`HP × 1.3471`) is still used by the growth chart, table and CSV, but not by the required-damage chart.
