# Gear ranking and gameplay tools

ToF Hub connects a database of player equipment with tools for evaluating your
own build. You can follow an item from the leaderboard into its stat breakdown,
compare a replacement against your current profile, and share a build or squad.
The [live site](https://tof.smilekritik.beer/tools/) shows the tools with populated
rankings and built-in examples. Each self-hosted installation keeps its own data.

## Ranking actual equipment

The [Ranking page](https://tof.smilekritik.beer/tools/ranking/) has separate boards
for individual items and players' equipment sets. It scores imported equipment
on the server using the generated gear reference and shared domain calculations.

**Global Roll Value (GRV)** provides a common reference for comparing gear.
It measures useful current stats against the reference ceiling for the slot,
role and element track. Current random stats and Titan-added stats contribute
to the score. The item drawer exposes the equipment and score details behind
the row, including available original-stat and upgrade information.

You can compare DPS, healer and tank gear, choose an element or supported element
pair, filter by region and slot, and search by nickname or UID. The all-elements
board shows each item or player on its best track. Supported tracks follow the
catalog and role rules.

### Best known gear and equipped gear

These answer different questions:

| View | Equipment it evaluates |
| --- | --- |
| Item leaderboard | A particular retained gear piece with its current stats |
| Player leaderboard | The player's best known set for the selected role and track, assembled from retained equipment |
| Ranking on a saved Build card | The equipped gear in that saved capture, compared with the player leaderboard |

For example, a player can import a Frost set and later switch to a Physical set.
Their retained Frost pieces can still contribute to their best known Frost set.
Backpack imports can improve those sets too. Missing slots contribute no gear
value while remaining part of the complete set's reference ceiling.

A saved Build card can show where its equipped set places globally and in its
owner's region. This lets you compare the loadout you shared with the wider
database while keeping the player's best known set as a separate result.

## Build cards and personal ratings

Build brings weapons, matrices, equipment, relics and supporting progression
systems into one editable card. You can inspect item details, view progression
costs, change the role and element, and export a PNG. Global and MMO use their
own generated catalogs and calculation rules.

**Personal Roll Value (PRV)** adapts gear weights to the current profile. A crit
roll can matter less when that profile approaches its crit cap; ATK and ATK%
also depend on the profile's existing totals. Enemy level participates in the
crit conversion. GRV retains the common reference for leaderboard comparisons.

Both ratings evaluate equipment. Weapons, matrices and other systems provide
build context and combat inputs; they do not earn extra gear-ranking points.
The calculation help on the tools explains the selected rating and its inputs.

## Inventory comparisons and Titan scenarios

Optimizer reads equipped items and the optional backpack from the same Build
import. You can compare a candidate with the current piece, inspect the change
in GRV and PRV, examine personal stat weights and try replacements across slots.
Temporary replacements update the comparison profile so later choices reflect
the changes you have already made.

Titan target controls let you compare upgrade scenarios using the available
original stats and generated growth rules. A target describes a resulting-stat
scenario, not the probability of reaching it or a promise about upgrade clicks.
When an import has no backpack, the tool says so and compares equipped gear only.
Manual editing and the built-in example remain available.

## Wish history across banners

Wish keeps accounts and order tracks separate. It replays each track in order,
carries its pity state across banners of that track, and uses supplied pity
snapshots where available. Event aggregates keep permanent orders separate.

You can inspect pulls, 50/50 streaks, drop-rate luck and banner statistics, use
the simulator, and export a banner card. The importer deduplicates repeated
uploads. Banner attribution follows explicit pool mappings; unresolved history
keeps its unresolved status.

## Squad planning

Comp supports four- and eight-player squads in Standard and MMO modes. Each
player slot can carry a role, trait, weapons, matrices and relics. Presets provide
a starting point; you can edit the squad and share it through a compact URL or
PNG export.

## Data and implementation

Game tables and generated reference data supply item identities, stat ranges and
growth rules. GRV and PRV are application rating models. Player imports supply
the observed equipment and profile values. See [data provenance](data-provenance.md)
and [the pipeline](pipeline.md) for those input sources.

The public source includes the ranking, import, persistence and calculation code.
It accepts the [documented JSON formats](imports.md), including synthetic examples
for a new installation. The live site's collector is a separate component.

Maintainers can start with the shared [gear calculations](../packages/game-domain/src/build/),
[player storage](../apps/api/src/players/player-store.service.ts) and
[saved-build ranking service](../apps/api/src/build/saved-build-ranking.service.ts).
