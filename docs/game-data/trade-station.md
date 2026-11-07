# Trade Station prices

`/tools/trade-station/` answers, for the MMO (`mmo`) edition, which items can be listed and inside
what price range. Every price comes from the client tables below; nothing is observed from the live
market. The rules text is not in the client at all: it is the curated
`scripts/game-processors/curated/tools/trade-station-rules.json`, transcribed from the Overseas
server build, which also records when it was observed.

## Raw tables

| Table | Fields used |
| --- | --- |
| `Resources/CoreBlueprints/DataTable/TradeLineItemStaticDataTable.json` | `TradeBasePrice.Amount`, `TradeBasePrice.CurrencyType`, `PutAwardRange`, `SysTradePriceRatio`, `TradePriceMinDif`, `TradeQuality`, `Typeindex`, `bCanList`, `bCanSysAutoSell`, `bForceBind`, `SubTypeIndex` |
| `Resources/CoreBlueprints/DataAsset/DA_TradeLine.json` | `TradeLineMenuListArray` (section → type), `TradeShopLevelDataTable` reference, `TradePreviewTimeMinutes`, `TradePutAwayTimeMinutes`, `TradeOpenHour_Region`/`TradeCloseHour_Region` |
| `Resources/CoreBlueprints/DataTable/TradeShopLevelDataTable.json` | `PutawayPriceRatio`, `TradeCapacity` — exported but unused, see below |

Icons the client keeps outside `ItemConfigs` come from two more tables, read only as a fallback:

| Table | Why |
| --- | --- |
| `DataTable/cooking/CookingFoodDataTable.json`, `DataTable_MMO/cooking/CookingFoodDataTable_MMO.json` | cooking dishes carry their own `ItemIcon`; `ItemConfigs` has no row for `item_Cooking_*` |
| `DataTable/ArtPackDataTable.json` | hair items only name an `ArtPackID`; the icon is `Icons[1]` (female), then `Icons[2]` (male) |

Row keys are item ids, so identity is the id itself; no join on display names is needed.

## Derivation

All money is a whole number of Universal Crystals, rounded half up (`.5` up):

```
minPrice       = round(TradeBasePrice.Amount × PutAwardRange.X)
maxPrice       = round(TradeBasePrice.Amount × PutAwardRange.Y)
systemMinPrice = round(TradeBasePrice.Amount × SysTradePriceRatio.X)
systemMaxPrice = round(TradeBasePrice.Amount × SysTradePriceRatio.Y)
```

`minRatio`/`maxRatio` are kept beside the integers so the UI can show the percentages without
re-deriving them.

Labels: `TradeQuality` and `Typeindex` are resolved through the localization keys carried in
`DA_TradeLine.TextContent.Key`; the keys are stored full length in `Localization/Game/<culture>/Game.json`,
so a lookup may need to match by prefix.

## Item names and icons

The **name is the client's**. `ItemConfigs.ItemName` plus `Localization/Game/en/Game.json` names the
id; for the 100 ids whose catalog entry has no icon, the catalog name is a machine translation
("Blast the peppers.", "Zip fragments.") and is not used. Two catalog rows in the whole repository
carry a hand-written `rename`; that still wins.

The **icon is the site projection** when the catalog has one (it points at the webp the other pages
use), else the cooking table, else the hair art pack, else `ItemConfigs.ItemIcon`. The catalogs store
either the served root or `/datamine/shared/media/...`; the processor rewrites the second onto
`/game-assets/webp/Hotta/Content/...`, so every path in the dataset loads in a local checkout too
(nginx serves `/datamine/shared/media` in production only). All 1081 rows resolve an icon; a row
keeps `name: null` rather than borrowing a neighbour's name.

A media export only converts the assets that existed in `game-data` when it ran, so a dataset added
later names WebPs the export never produced (the trade rows needed 91 more). Re-running the media
step after the dataset ships fills them in; until then the table renders the quality placeholder
instead of a broken image, because the view drops an `<img>` whose load fails.

## Price ladder

`TradePriceMinDif` is a ratio, so two ladders exist:

- **Client band.** Walk `minPrice` in whole UC steps of `max(1, round(base × TradePriceMinDif))` and
  always include `minPrice`, the reference price and `maxPrice`. On a 128 UC shard that is
  45, 58, 71 … 448 — 10% of the reference price, landing exactly on both ends of the band.
- **Server band** (see below). Price the rungs the curated band carries,
  `round(base × (1 + percent / 100))`, because a whole UC step cannot express 13.3333% of a 12 UC
  reference price. The percent labels are the station's own and are not re-derived from the ratio;
  on the 12 UC weapon-enhancement modules they read -40% … +146% and price as 7, 9, 10, 12 … 30 UC.

## Server price bands

`PutAwardRange` describes the build the client was compiled from; the Overseas station opens a
different band on one family of items. The curated rules file carries those bands, and the processor
applies them by id prefix, so the client table stays untouched:

```jsonc
"priceBands": [
  {
    "idPrefix": "StrengthenStoneMMO_B", "minRatio": 0.6, "maxRatio": 2.46,
    "stepRatio": 0.1333333,
    "percentRungs": [-40, -27, -13, 0, 13, 27, 40, 53, 67, 80, 93, 106, 120, 133, 146],
    "note": "…"
  }
]
```

| Family | Rows | Client band | Server band |
| --- | --- | --- | --- |
| Enhanced Resonance Module / Advanced Restructure Component | 10 | 50% – 250%, 13.3% step | **-40% … +146%, 13.3333% steps** |

A row that took an override carries `bandSource: "server"`, and the calculator prints the observed
range instead of the client step. `bandSource: "client"` means the numbers come from the table.

## System buys at

`SysTradePriceRatio` is `X: 0.9, Y: 1.2` on all 1081 rows, so the station itself pays 90%–120% of
the reference price when it buys the item and `bCanSysAutoSell` is true. It is an instant sale to the
system, not a player purchase — the client gates it on `SysAutoSellLimitArray`
(`ServerLevelRequired` 10…49 by row, cooldown 3600–9000 s) and caps the stack with
`SysTradeItemAmount` (X/Y between 10/50 and 40/200). The dataset keeps the band
(`canSystemBuy`, `systemMinPrice`, `systemMaxPrice`); the page does not show a column for it.

## Measured facts

- 1081 rows, **669** with `bCanList: true`.
- `PutAwardRange` depends on `TradeQuality`: `0.5–2.5` for Normal Supply and most Rare Supply,
  `0.35–3.5` for Rare Skin Deco, `0.3–4` for 7 rows.
- `SysTradePriceRatio` is the constant `0.9–1.2` on every row; `bCanSysAutoSell` is true on 289.
- `EHottaCurrencyType::TradeDiamond` is displayed as **Universal Crystal**, not Dark Crystal.
- Every listable row has `SubTypeIndex = 1`; `SubTypeIndex 2–5` rows are all unlistable, so the
  version axis is not part of the dataset.
- All 30 `TQ_RATE` `Typeindex 2` rows (Equipment Expansion Packs) are unlistable, which matches the
  server rule that they can no longer be listed.
- `TradePriceMinDif` is `0.1` on 1069 rows, `0.133` on 10 and `0.25` on 2 rows. It is the price
  **increment**, and the calculator steps by `max(1, round(base × TradePriceMinDif))`: 10% of the
  reference price normally, but 1 UC on the 4 UC Reconstruct Components (25% would be 0.4 UC) and
  2 UC on the 12 UC ones (13.3% × 12 = 1.6 UC). The client only drops below 10% where 10% of a
  small base is not a whole UC.
- 217 rows are **shards**: ids carrying a `frag_` segment (`frag_imitation_extra_6`,
  `mmo_frag_Mount_038`). Their reference price is exactly `1/10` of the item the rest of the id
  names (155/155 MMO fashion pairs and 56/56 imitation pairs measure `0.100`), and ten of them
  combine into that item. 211 name a parent row this table also sells; 6 do not (the MMO weapon
  shards, whose weapons are not traded).
- `fragment_artifact_*` rows are named "… Shard" but carry no `frag_` prefix and no parent row, so
  they are not flagged as shards.

## `PutawayPriceRatio`

The ten rows of `TradeShopLevelDataTable` are the only place the field appears in the whole export:
`NeedExp` 500 … 128000, `PutawayPriceRatio` `2.0, 1.9, 1.8 … 1.1` (exactly −0.1 per level) and
`TradeCapacity` a flat `6` on every level. Because it is level-scaled and nothing else about the fee
is, it reads as a **level-dependent listing-fee coefficient in the CN build**: level 1 would charge
`200%` of the listed value, level 10 `110%`. The Overseas server charges `price × quantity` in Gold
with no level term at all, so the field has no consumer here and the calculator ignores it. The
capacity the rules quote comes from `TradeCapacity` (6), `MaxShelveCount` (10) and
`TradeCapacityAfterCombatAward` (10) in `DA_TradeLine`.

## `TradePriceWaveRangeArray`

Seven constant entries on every row — `{DifLevel: -10, fRecycleRatio: 0.5}`, `-5 → 0.4`, `-3 → 0.3`,
`-1 → 0.2`, `0 → 0.1`, `1 → 0.01`, `2 → 0.0`. `DifLevel` matches the `Dif` in `TradePriceMinDif`, so
this is the undercut ladder: how far below the current lowest listing a price sits, and the share of
the price the system keeps or returns at that rung. It is const across all items, so it changes no
per-item number and is not surfaced.

## Client constants the page quotes

`DA_TradeLine` also proves three numbers the curated rules state:

| Field | Value | Rule |
| --- | --- | --- |
| `TradePutAwayTimeMinutes` | `1440` | a listing expires after 24 hours |
| `TradePreviewTimeMinutes` | `120` | a listing under review is purchasable after 2 hours |
| `TradeOpenHour_Region` / `TradeCloseHour_Region` | `OVERSEA_KR/TW/PS: 1` / `0` | the station is closed 00:00–01:00 |

The client sends no timezone; the server clock is UTC+9, which is observed and recorded in the
curated rules file, not in the dataset.

## Open questions

- **Whether a shard's own band applies or its parent's.** The table carries a band per shard row
  (`0.3–4` for `frag_*`), and the page applies it to the shard price. Unconfirmed against the live
  UI.
- **`StarRecycleDataTable`** sits next to the trade tables and is exported; whether it feeds the
  same prices is unchecked.
- **Whether the other rare families share the module band.** Only `StrengthenStoneMMO_B*` is
  measured (-40% … +146%, 13.3333% steps). The `A*` rows (step 25% of 4 UC = 1 UC) and the 150 UC
  `C*` rows still use the client band; whether the Overseas station narrows those too is
  unconfirmed.
- **Whether a price must sit on the step grid at all.** The client stores an increment, not a rule
  that prices are quantised, and the calculator offers only grid rungs.
