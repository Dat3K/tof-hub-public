# @tof-hub/game-domain

Pure game calculations shared by the API, the website and the pipeline: gear
scoring, Titan projections, combat ratings and the order (wish) rules. The
package has no runtime dependencies and reads no files. Every game coefficient
(stat bounds, Titan growth, crit and defense curves) arrives as input from the
generated game data, so the same functions work for any client version.

The ranking server, the Build card and the Optimizer all call this code, which
is why a piece has the same rating everywhere.

## Gear rating ([`build/stats.ts`](src/build/stats.ts), [`build/gear-score.ts`](src/build/gear-score.ts))

**Roll value as a damage derivative.** A stat's weight is the local logarithmic
derivative of the player's output with respect to that stat, so the rating
answers "how much more damage does this piece give", not "how many rolls does it
have":

| Role | Output modelled | Weights |
| --- | --- | --- |
| DPS | `ATK × (1 + DMG%) × (1 + crit chance × crit damage)` with `ATK = B(1 + ATK%)` | flat ATK `(1+a)/ATK`, ATK% `B/ATK`, DMG% `1/(1+d)`, crit `k / (denominator · (1 + c·k))`, zero once crit chance reaches 100% |
| Healer | `ATK` only | flat ATK and ATK%; crit and DMG% do not count |
| Tank | effective HP `H(1+h) × (1 + R(1+r)/K)` | HP `1/H`, HP% `1/(1+h)`, RES `(1+r)/(K + R(1+r))`, RES% `R/(K + R(1+r))` |

`K` is the game's defense constant for the enemy level, so resistance has
diminishing returns exactly as in combat. Crit near the cap is scaled down so a
roll that would push past 100% only counts for the part below it
(`getBuildCritContributionScale`), and the best legal roll allocation is
re-searched when saturation makes another stat the better recipient.

**Altered inheritance.** Altered weapons inherit the final ATK of the strongest
element and add their own ATK after the percentages. The rated families and
weights follow that: the source element's flat ATK and ATK% count, Altered ATK
is weighted by `1/(1 + a)`, and DMG% does not apply (`getBuildRatedFamilies`,
`getBuildRatedWeight`).

**Global and Personal Roll Value.** GRV uses one fixed reference player
(`STANDARD_RV_PROFILE`: 52,500 ATK, +150% ATK, +50% DMG, 75% crit, enemy level
100, with a separate tank profile) so every piece in the database is comparable.
PRV feeds the same functions with the player's own profile. Both are expressed
against the slot's ceiling, the best item the rules allow for that role and
element track (`getBuildIdealItem`).

**Exact comparison.** `getBuildRVFactors` returns the multiplicative output
factors with a set of stats applied; the ratio of two factor sets is the exact
damage change of swapping one item for another, which the Optimizer uses.

## Titan and roll reconstruction

- **Roll paths.** `enumerateBuildRolls` lists every split of the upgrade rolls
  that fits an item's values and star count; `pickBuildRollPath` chooses the most
  likely one by modelling a sum of `n` uniform rolls as a normal distribution.
- **Titan projection.** `getBuildTitanProjection` applies the in-game growth
  rules: the pull-up of elemental ATK, ATK% and DMG% within the four core
  elements, the priority and fallback pools for added stats, and the share of
  the primary stat's rolls an added stat receives.
- **Measured, not assumed.** That share was measured on 19,141 captured stats:
  added stats land at 0.73–0.975 of the primary's rolls (median about 0.89).
  The commonly used fixed 0.95 is roughly the 95th percentile, not a rule, so the
  ceiling uses the highest observed share. Current-value scoring needs no
  pre-Titan values at all (`getBuildCurrentValue`), because Titan growth is
  random per stat and cannot be recovered from another player's profile.

## Other build rules

| Module | What it covers |
| --- | --- |
| [`build/capture-gear.ts`](src/build/capture-gear.ts) | Maps captured gear to build slots through exact generated identities; anything unknown is reported, never guessed |
| [`build/gear-champions.ts`](src/build/gear-champions.ts) | The minimal set of pieces a player must retain to build every best set, per role, track and slot |
| [`build/temporary-attack.ts`](src/build/temporary-attack.ts) | Removes food and other temporary ATK effects that were active when the profile was read |
| [`build/mmo-card.ts`](src/build/mmo-card.ts) | MMO expansion-card parameters from UE curves, verified against in-game texts |

## Orders (wish) ([`wish/`](src/wish))

- **Pity replay.** `replayPityChain` replays each order track in order across
  banners. An early SSR does not reset pity; imported fragments never invent a
  zero origin.
- **50/50 streak rules.** Two wins in a row force a loss, two losses force a win,
  and fewer than two known outcomes stay unknown (`evaluateStreak`). Win-rate
  analytics count only the free, unforced rolls.
- **Luck.** Expected SSR rates include the non-resetting hard pity: weapons
  `(1 + 80 × 0.75%) / 80 = 2.00%`, matrices `(1 + 40 × 1.70%) / 40 = 4.20%`.
- **Simulation.** Monte Carlo and worst-case planners for weapon and matrix
  banners, including currency returns and the matrix box, with a seeded PRNG.
- **Cashback and tally.** Currency returns counted only from recorded data, and
  anonymous public statistics built from imported pulls.

## Encounters

[`encounters/mmo-bygone.ts`](src/encounters/mmo-bygone.ts) converts MMO Bygone
curve stacks into enemy HP and labels defense as an estimate.
[`encounters/raid-rankings.ts`](src/encounters/raid-rankings.ts) projects and
deduplicates raid leaderboards while keeping the source's own ordering and time
precision.

## Tests

```bash
pnpm exec vitest run packages/game-domain
```

[`rv-output.test.ts`](src/build/rv-output.test.ts) checks the output factors
against the "swap the item, recompute the damage" result,
[`altered-score.test.ts`](src/build/altered-score.test.ts) the Altered
inheritance and [`stats.test.ts`](src/build/stats.test.ts) roll paths, Titan
projections and ceilings. The wish tests cover pity replay, streaks, luck and
tallies.
