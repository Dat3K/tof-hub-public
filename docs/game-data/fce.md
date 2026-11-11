# Boss mechanics

## Laurent

Laurent was verified in the Korea development client 6.5.0
(`TestPC_KR2New`). The curated card is
`scripts/game-processors/curated/datamine/fce/data/bosses/laurent.json`.
`scripts/generators/build-fce-cards.cjs` consumes it into
`game-data/fce-cards.json`.

| Input relative to the raw export root | Evidence |
| --- | --- |
| `Hotta/Content/Resources/CoreBlueprints/DataTable/BorderWarSeasonDataTable.json` | `Rows["13"].BorderWarAllBossList` lists `BorderWar_D128` with Laurent in slot 4, `BossLevel=100` and `AttributeID` entries `boss_hum_084_0` through `boss_hum_084_4`. |
| `Hotta/Content/Localization/Game/{en,ru}/Game.json` | `ST_actorname.Boss_hum_084` supplies Laurent and Лоран. |
| `Hotta/Content/Localization/Game/zh-CN/Game.json` | `Voidbuffdes.boss_hum_084_{1..4}_des` supplies the mechanics. The card has editorial EN and RU translations of those rows with the original seconds and percentages. |

The base and Overseas monster tables use different stat scales in this export.
The card leaves the Overseas stat fields absent until matching rows ship.
The base rows are in
`Hotta/Content/Resources/CoreBlueprints/DataTable/DT_MonsterStaticData.json`.
The final-phase row is `boss_hum_084_4`. Its `MaxHealth` and `FinalCritDef`
are kept out of the Overseas plate.

The curated card uses the raid `Team8P_17` title artwork at
`Hotta/Content/Resources/UI/fuben/taofazuozhan/bosshd`. That selection follows
the raid binding in `game-data/handbook/team-raids.json` and a visual comparison.
