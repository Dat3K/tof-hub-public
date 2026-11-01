# Data provenance

Generated output is only reproducible when every input is explicit. This page lists where each kind of input comes from.

## Inputs

| Input | Origin | Used for |
| --- | --- | --- |
| Game tables, Blueprints, localization, textures | Installed client or its raw export | Processors, normalizers, generators, media |
| Gear reference definitions | Pinned upstream revision in `scripts/generators/build-reference.cjs`, refined from game tables | `game-data/build-reference.json` |
| Import mappings | Bootstrap package, with raw-source metadata | Mapping imported items to catalog entries |
| Server registry | Official launcher data plus annotated records in `scripts/data` | Server list and contract registry |
| Preserved artwork and site icons | Bootstrap package, checked against `config/bootstrap.json` | Curated media |
| Editorial boss text and banner schedules | Curated inputs in `scripts/game-processors/curated` | Descriptions and schedules |
| Player, wish and build data | User JSON or installation-encrypted files | This installation's database |
| Raid observations | Optional normalized JSON (`TOF_RAID_RANKINGS_FILE`) | Handbook raid comparison |

## Import mapping sources

The bootstrap mapping keeps its provenance for every identity:

| Mapping | Raw source | Fields |
| --- | --- | --- |
| Equipment | `Hotta/Content/ResourcesOverSea/CoreBlueprints/DataTable/Equipment/EquipmentDataTable_Overseas.json` | Row key, `EquipmentType`, `EquipmentSlotType`, `OutputSourceID`, `ItemIcon.AssetPathName` |
| Titles | `Hotta/Content/Resources/CoreBlueprints/DataTable/Title/DT_Title.json` | `Name.Key` |
| Consumables | `Hotta/Content/Resources/CoreBlueprints/DataTable/cooking/CookingFoodDataTable.json` | Row keys, `Buffs[].BuffClass.AssetPathName` |

Only exact identity and icon relations are used. Ambiguous candidates stay unresolved.

## Import examples

The files in `examples/import` are demonstrations with synthetic identities. Their equipment fields reuse stripped contract fixtures; they are not observations of a real player.

The wish example uses the `standard-weapon` banner from the generated `wish-banners.json` (raw banner code `WeaponLottery_2`).

## Recording new data

For every new source, document in [game data](game-data/README.md):

- the raw path relative to the export root, the table or object, row keys and fields;
- region and client version, when known;
- units, conversions and rounding;
- anything still unresolved;
- the generator and output that consume it.

Never fill a missing value from a screenshot, an old guess or a made-up path. Editorial and demo inputs must always be distinguishable from game data.
