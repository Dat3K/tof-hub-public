# Runtime data and memory

Game exports and installed JSON remain outside application bundles. The
normalizer and generators prepare runtime projections for the readers; raw
observations remain the provenance source. Static browser files are served by
Nginx in the supplied stack.

## Catalogs

Info uses small catalogs and content-addressed per-entity detail files.
`useGameData` shares promises and resolved values in the browser tab. Server
requests use their request-scoped loader; they do not seed the module browser
cache. Failed fetches can be retried and obsolete responses cannot replace a
newer locale or selection.

Build and Optimizer fetch the shared `runtime/build-page.json` in the browser
instead of serializing the full catalog for every SSR request. Build's optional
title styles and Optimizer's demo are separate inputs. `namespace: ''` selects
the root `/game-data/`; `namespace: 'handbook'` selects the language-neutral
Handbook tree. Locale loading keeps its existing fallback behavior.

Ranking reads generated `runtime/ranking-page.json`, a projection of only its
equipment/reference fields and weapon element combinations. Tests compare the
result with projecting the full Build catalog. This changes the loading cost,
not the scoring formula.

## Raid observations

`handbook/raid-rankings.json` is the full archive. Offline generation validates
it and selects the existing latest usable observation per season/scope. It
writes `handbook/runtime/raid-rankings.json` and immutable board files under
`handbook/runtime/details/raid-rankings/<hash>.json`.

The index includes source/season metadata, each board's full entry count and
first-place result. The website loads:

- only the index for the ordinary first-place comparison;
- the selected season and region for regional rankings;
- all regions of that season before calculating global places;
- the selected observations across seasons when opening personal history.

The browser shares cached detail paths and starts at most four shard loads at
once. Invalid or failed details show an error rather than a partial leaderboard.
Nickname/UID searches select complete team results, including repeated runs;
the unique-player display applies when no search is active. Current nicknames
retain separate historical observations and the existing identity-cache rules.

The public Handbook generator consumes the installation's normalized raid JSON,
not private collector files. Its raid-generation path also refreshes the runtime
index/details; `--check` verifies their contents. No participant, time or game
value is invented by this projection.

## Updating an older installed snapshot

After restoring the bootstrap or updating these readers, regenerate derived
runtime files before starting the matching code:

```bash
pnpm generate:runtime-data
```

Ship the index and its referenced details together. A code update does not
update a separately mounted data directory. The full archive stays available
for regeneration; readers do not fall back to parsing it on every request.

## Other bounded work

Ranking response reuse is described in [ranking cache](ranking-cache.md).
Open Graph images have their own bounded render queue and output cache; see
[SEO](seo.md). These limits reduce repeated allocation, but do not establish
that arbitrary concurrent traffic or maximum-size imports fit a particular host.
