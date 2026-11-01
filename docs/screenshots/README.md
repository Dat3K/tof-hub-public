# Screenshot provenance

Captured on **2026-10-30** and **2026-10-31** in Chrome from the
[live ToF Hub website](https://tof.smilekritik.beer/). The screenshots use English,
a 1600 × 1000 desktop viewport or a 390 × 844 mobile viewport, and reduced motion.
They are actual browser captures encoded as WebP; no interface content was
composited into them.

Build, Wish and Optimizer show the live site's built-in examples. Ranking and
the Tools hub show the real public leaderboard at capture time, and raid rankings
show the public in-game leaderboard of that season. Comp shows the composition
editor. `build-card.webp` is the demo profile's card element alone, the same area
that Export PNG produces. No local QA database or imported synthetic accounts were
used in these screenshots.

| File | Route |
| --- | --- |
| `home.webp`, `mobile-home.webp` | `/` |
| `info-hub.webp` | `/info/` |
| `datamine-hub.webp` | `/datamine/` |
| `tools-hub.webp` | `/tools/` |
| `simulacra.webp`, `mobile.webp` | `/info/simulacra/` |
| `gefion.webp` | `/info/simulacra/?server=gacha&char=gefion` |
| `salidy.webp` | `/info/simulacra/?server=mmo&char=salidy-mmo` |
| `build.webp`, `build-card.webp` | `/tools/build/` |
| `bosses.webp` | `/datamine/fce/` |
| `raids.webp` | `/datamine/raids/?season=S14` |
| `raid-ranking.webp` | `/datamine/raids/?season=S14&tab=ranking` |
| `handbook.webp` | `/datamine/handbook/` |
| `optimizer.webp` | `/tools/optimizer/` |
| `ranking.webp` | `/tools/ranking/` |
| `wish.webp` | `/tools/wish/` |
| `oow.webp` | `/datamine/oow/` |
| `comp.webp` | `/tools/comp/` |
| `bygone.webp` | `/datamine/bygone/` |
| `seq.webp` | `/datamine/seq/` |

The live site changes independently of this source snapshot. Self-hosted
installations may show different releases, empty rankings or their own imported
records. See [the pipeline guide](../pipeline.md) and
[JSON imports](../imports.md).

## Case-study images

The historical images below were supplied by the author while editing the case
study. Their original capture dates and browser settings are not established by
the live-site capture notes above:

| File | Subject |
| --- | --- |
| `maygi-dps-calculations.webp` | Maygi's team DPS spreadsheet |
| `incin-pull-history.webp` | Incin's order-history interface |
| `tower-of-fantasy-index-v1.webp` | Tower of Fantasy Index v1 |
| `epic-tanium-119-99.webp` | The Tanium pack's displayed price |
| `raid-season-3-eu-smilekritik.webp` | Historical EU season 3 raid comparison |
| `test-client-active-buff.webp` | Test-client buff debug display |
| `sequential-damage-requirements.webp` | The author's early Excel chart |
| `mod-execute-thresholds.webp` | The author's enemy HP-bar variant with execute-threshold markers |
| `mod-debuff-icons.webp` | The author's status-icon rework highlighting action-restricting debuffs |
| `mod-distinct-buff-icons.webp` | Custom images distinguishing buffs that shared an icon |

The three `mod-*.webp` images are lossless conversions of the author's supplied
in-game PNG screenshots. Their dimensions and decoded pixels are preserved.

`legacy-datamine-hub.webp` is a WebP conversion of
[the archived site's screenshot](https://github.com/smilekritik/tof-datamine-site/blob/main/datamine/docs/screenshots/datamine-hub.png).
The PNG source matched that file's Git blob hash when it was added.
It illustrates the preserved archive build, not a dated capture of the first
prototype.

These images are stored as WebP, like the rest of this folder, and are shown
unchanged in the case study. Captions distinguish historical material, the
archived site, live public rankings and built-in demo profiles.
