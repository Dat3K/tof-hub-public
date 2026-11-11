<div align="center">

# ToF Hub

**Game database, datamine archive, gear rankings and build tools for Tower of Fantasy.**

[Live site](https://tof.smilekritik.beer/) · [Datamine](#datamine-archive) · [Game database](#game-database) · [Tools](#build-and-optimization-tools) · [Ranking](#gear-ranking) · [Getting started](#getting-started) · [Documentation](docs/README.md)

![Next.js 16](https://img.shields.io/badge/Next.js-16-000?logo=nextdotjs)
![React 19](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=000)
![TypeScript 6](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=fff)
![Node.js 24](https://img.shields.io/badge/Node.js-24-339933?logo=nodedotjs&logoColor=fff)
![NestJS 12](https://img.shields.io/badge/NestJS-12-E0234E?logo=nestjs&logoColor=fff)
![Tailwind CSS 4](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=fff)
![Prisma 7](https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma&logoColor=fff)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-4169E1?logo=postgresql&logoColor=fff)
![Redis 7.4](https://img.shields.io/badge/Redis-7.4-DC382D?logo=redis&logoColor=fff)
![Docker Compose](https://img.shields.io/badge/Docker%20Compose-2496ED?logo=docker&logoColor=fff)
![License: MIT](https://img.shields.io/badge/License-MIT-green)

![ToF Hub home page](docs/screenshots/home.webp)

</div>

## About

ToF Hub is a Tower of Fantasy reference and toolkit for both the Global (gacha) and MMO editions. It is built on a detailed understanding of how the game's own data fits together: which tables, Blueprints, curves and localization keys describe a character, an enemy or a floor, and how they reference each other.

- **The Datamine archive** surfaces values the game uses but never shows, such as enemy stats per floor, difficulty curves, hidden buffs, boss pools and combat constants, and documents how each one was traced through the client files.
- **The tools** apply that knowledge where the game offers nothing comparable: a build card with far more detail than the in-game profile, and an optimizer that ranks stats with damage formulas researched from game tables and in-game observations.
- **Everything comes from the client.** A dedicated exporter extracts and processes the data automatically, so the site follows each patch without hand-copied values.
- **Every game language.** The whole site, interface included, is available in all eleven languages of the game: English, Russian, German, Spanish, French, Indonesian, Japanese, Korean, Portuguese, Thai and Simplified Chinese. Game text comes from the client's own localization tables, so names and descriptions match the game's wording in each language.

All of it, from the datamining and formula research to the website and the exporter, is the work of one developer. **[Read the full story](docs/case-study.md)**: how a day-one player ended up building it, and the research and decisions behind the project.

| Section | What it covers |
| --- | --- |
| [**Datamine**](#datamine-archive) | Endgame encounters, enemy scaling, boss mechanics, combat formulas and other hidden values |
| [**Info**](#game-database) | Encyclopedia of simulacra, matrices, relics, servants, food, cosmetics and artwork, with balance changes between patches |
| [**Tools**](#build-and-optimization-tools) | Build card, gear optimizer, wish tracker, squad planner and Titan calculator |
| [**Ranking**](#gear-ranking) | Item and player gear leaderboards with a common gear-quality score |

### One project instead of six

In the Genshin Impact community, each of these features is its own project, run by a different team. ToF Hub covers the same ground for Tower of Fantasy, a game whose gear, Titan, simulacra and order systems have more moving parts, and it was designed and built by one developer together with the extraction pipeline behind it.

| ToF Hub | Comparable Genshin Impact project |
| --- | --- |
| [Game database](#game-database) | [Lunaris](https://lunaris.moe/) |
| [Build card](#build-and-optimization-tools) | [Enka.Network](https://enka.network/) |
| [Gear ranking](#gear-ranking) | [Akasha](https://akasha.cv/) |
| [Wish tracker](#build-and-optimization-tools) | [paimon.moe](https://paimon.moe/) |
| [Comp showcase](#build-and-optimization-tools) | [Artifacter](https://paimon.plus/en/artifacter/) |
| [Raid rankings](#datamine-archive) | [Stygian](https://www.stygian.moe/) |

## Datamine archive

**Hidden game data, decoded and explained.** The game ships these values in its tables and Blueprints but does not display them. Finding them means following references across files: resolving an enemy through its Blueprint inheritance chain, reaching MMO tables only through the data assets that bind them, joining difficulty curves to the rows that name them, and keeping Global and MMO data strictly apart. Values that depend on an unverified assumption are labelled as estimates.

| Page | What you can see |
| --- | --- |
| [**Origin of War**](https://tof.smilekritik.beer/datamine/oow/) | Every floor of every season: wave lineups, enemy stats, defenses, stage effects, drop buffs and the seasonal difficulty curve |
| [**Bygone Phantasm**](https://tof.smilekritik.beer/datamine/bygone/) | Floor HP and ATK scaling, boss pools and weakness buffs; the MMO edition's 200-round ladder with per-round mechanics |
| [**Sequential Phantasm**](https://tof.smilekritik.beer/datamine/seq/) | Boss HP and effective HP per stage, growth between stages and the damage required to clear within the time limit |
| [**Biochemical Collapse**](https://tof.smilekritik.beer/datamine/seq/?mode=mmo) (MMO) | Seasonal Culture Pod encounters with lineups, time limits, scores, advantages, disadvantages and bonus objectives |
| [**Boss mechanics**](https://tof.smilekritik.beer/datamine/fce/) | Mechanic cards for every boss in the ladder |
| [**Team raids**](https://tof.smilekritik.beer/datamine/raids/) | Raid encounters, requirements, rewards and boss mechanics |
| [**Handbook**](https://tof.smilekritik.beer/datamine/handbook/) | Gear stat ranges, Titan rerolls, Combat Strength, upgrade costs, combat and resistance formulas, the MMO Brainfield talent tree and server lists |
| [**Multiplicative buffs**](https://tof.smilekritik.beer/datamine/multype/) | Which buffs multiply and which add up, with their grouping and multipliers |
| [**Items**](https://tof.smilekritik.beer/datamine/items/) | Internal IDs and localized names, plus Trade Station prices, listing ranges and filters in MMO mode |

The [game data reference](docs/game-data/README.md) documents each page: source tables and fields, joins, formulas and the questions that remain open.

## Game database

**Every playable and collectable entity, with its original in-game text and images.**

| Page | What you can see |
| --- | --- |
| [**Simulacra**](https://tof.smilekritik.beer/info/simulacra/) | Character profiles with weapon skills and their scaling, advancements, traits, matrices and artwork, in both editions |
| [**Balance changelog**](https://tof.smilekritik.beer/info/simulacra/changelog/) | Value changes between client versions, computed automatically by comparing each export with the previous one |
| [**Matrices**](https://tof.smilekritik.beer/info/matrices/) | Matrix sets with their 2-piece and 4-piece effects and carriers |
| [**Relics**](https://tof.smilekritik.beer/info/relics/) | Relic effects, star advancements and cooldowns |
| [**Pets**](https://tof.smilekritik.beer/info/pets/) | Combat servants with their skills and modules, and cute pets |
| [**Food**](https://tof.smilekritik.beer/info/food/) | Dishes, ingredients and potions with satiety and buff effects, including MMO cooking levels |
| [**Cosmetics**](https://tof.smilekritik.beer/info/cosmetics/) | Outfits, mounts, avatars, frames, titles, chat stickers and badges with their in-game artwork |
| [**Arts**](https://tof.smilekritik.beer/info/arts/) | Wallpapers, loading screens, character and event artwork, including art the current client no longer ships |

## Build and optimization tools

**What the game cannot show you.** The tools combine a player's imported data with the decoded game rules.

- **[Build card](https://tof.smilekritik.beer/tools/build/).** Weapons, matrices, gear, relics, servant, consumables, supercomputing and Space Support on one interactive card. Every stat can be traced to its sources: base values, ATK% and DMG% contributions, resistances, temporary effects and Combat Strength by system. Gear shows its roll quality, Titan history, upgrade costs and GRV/PRV ratings. Cards can be edited, imported from screenshots with OCR, saved as signed public profiles and exported as PNG. Global and MMO have their own catalogs and rules.
- **[Gear optimizer](https://tof.smilekritik.beer/tools/optimizer/).** Ranks every backpack piece against the equipped one using the player's own profile: damage derivatives per stat, the crit cap, element inheritance for Altered, healer and tank models (effective HP from resistance and the defense constant) and legal Titan stat pairs. Replacements compound, so each next choice reflects the ones already made.
- **[Wish tracker](https://tof.smilekritik.beer/tools/wish/).** Replays each order track across banners with its pity state, separates event and permanent orders, shows 50/50 streaks and luck, runs pull simulations and exports banner cards.
- **[Comp showcase](https://tof.smilekritik.beer/tools/comp/).** Plans four- or eight-player squads with roles, traits, weapons, matrices and relics in Standard or MMO mode, and shares them as a compact link or PNG.
- **[Titan calculator](https://tof.smilekritik.beer/tools/titan/).** Takes a Global damage parse, accounts for the Titan levels worn during it and compares legal level sets with and without Weak Point. See the [calculation and data sources](docs/tools/titan-calculator.md).

The [tools guide](docs/tools.md) explains the ratings, comparisons and import behavior.

<p align="center"><img src="docs/screenshots/build-card.webp" alt="Build card of the site's demo profile"><br><sub>Build card of the site's demo profile, as exported</sub></p>

### Game clients and versions

The way official clients discover their branch, launcher and resource versions was studied across every region. Together with ToF Exporter this closes the loop: the patcher can install any official client from scratch, live, test or Chinese, and the exporter can then extract data from it, so the archive is not limited to the client that happens to be installed. Two features build on this research:

- **[Version tracker](https://tof.smilekritik.beer/).** The home page follows the live, player-test and development branches of Global, China, Korea and Taiwan, checks the official launcher endpoints every ten minutes and shows how long each branch has gone without an update.
- **[Branch patcher](tools/tof-client-patcher).** A single BAT/PowerShell script that installs a client from scratch or switches an existing installation to another official branch, downloading launcher files only from the official CDNs over HTTPS. It is plain text on purpose: it runs on any Windows PC without dependencies, weighs about 65 KB, and anyone can read exactly what it does before running it.

## Gear ranking

**Compare the equipment players have collected in the game, down to individual pieces and their rolls.** The [live leaderboard](https://tof.smilekritik.beer/tools/ranking/) holds a public player and gear database; a self-hosted installation ranks its own imported records.

- **Item and player leaderboards.** Compare individual pieces or complete sets by role, element and supported dual-element track. Filter by region and equipment slot, or find a player by name or UID.
- **A common gear-quality score.** Global Roll Value (GRV) scores current random stats and Titan-added stats against a shared reference ceiling. Personal Roll Value (PRV) rates the same gear against a player's own profile.
- **Best known sets.** The player board selects equipment from retained imports, including backpack pieces, so a player's best Frost set can stay ranked after they switch to another element.
- **Ranking inside Build.** A saved build shows the global and regional position of its equipped gear.

Ranking, Build and Optimizer share the same scoring code, so a piece has the same rating everywhere.

## Screenshots

Captured on 2026-10-30 and 2026-10-31 from the [live site](https://tof.smilekritik.beer/).
Build, Wish and Optimizer show the site's built-in examples; Ranking and raid
rankings show live public data.
See [capture details](docs/screenshots/README.md).

<table>
  <tr><th colspan="2">Datamine</th></tr>
  <tr>
    <td width="50%"><img src="docs/screenshots/bosses.webp" alt="Boss mechanics"><p align="center"><sub>Boss mechanics card</sub></p></td>
    <td width="50%"><img src="docs/screenshots/raids.webp" alt="Team raid"><p align="center"><sub>Team raid: mechanics and boss stats</sub></p></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/raid-ranking.webp" alt="Raid rankings"><p align="center"><sub>Raid rankings by season and region</sub></p></td>
    <td><img src="docs/screenshots/handbook.webp" alt="Handbook"><p align="center"><sub>Handbook: gear stat ranges</sub></p></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/oow.webp" alt="Origin of War"><p align="center"><sub>Origin of War: enemy stats by floor</sub></p></td>
    <td><img src="docs/screenshots/bygone.webp" alt="Bygone Phantasm scaling"><p align="center"><sub>Bygone Phantasm: HP scaling</sub></p></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/seq.webp" alt="Sequential Phantasm"><p align="center"><sub>Sequential Phantasm: required damage</sub></p></td>
    <td><img src="docs/screenshots/datamine-hub.webp" alt="Datamine hub"><p align="center"><sub>Datamine hub</sub></p></td>
  </tr>
  <tr><th colspan="2">Game database</th></tr>
  <tr>
    <td><img src="docs/screenshots/simulacra.webp" alt="Simulacra catalog"><p align="center"><sub>Simulacra catalog</sub></p></td>
    <td><img src="docs/screenshots/gefion.webp" alt="Simulacrum profile"><p align="center"><sub>Simulacrum profile</sub></p></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/salidy.webp" alt="Salidy MMO profile"><p align="center"><sub>Salidy · MMO</sub></p></td>
    <td><img src="docs/screenshots/info-hub.webp" alt="Info hub"><p align="center"><sub>Info hub</sub></p></td>
  </tr>
  <tr><th colspan="2">Tools and ranking</th></tr>
  <tr>
    <td><img src="docs/screenshots/build.webp" alt="Build card page"><p align="center"><sub>Build card page · site example</sub></p></td>
    <td><img src="docs/screenshots/optimizer.webp" alt="Gear optimizer"><p align="center"><sub>Gear optimizer</sub></p></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/ranking.webp" alt="Gear and player ranking"><p align="center"><sub>Gear and player ranking</sub></p></td>
    <td><img src="docs/screenshots/wish.webp" alt="Wish tracker"><p align="center"><sub>Wish tracker</sub></p></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/comp.webp" alt="Team composition"><p align="center"><sub>Team composition editor</sub></p></td>
    <td><img src="docs/screenshots/tools-hub.webp" alt="Tools hub"><p align="center"><sub>Tools hub</sub></p></td>
  </tr>
  <tr><th colspan="2">Mobile</th></tr>
  <tr>
    <td><img src="docs/screenshots/mobile-home.webp" alt="Home on mobile"><p align="center"><sub>Home · mobile</sub></p></td>
    <td><img src="docs/screenshots/mobile.webp" alt="Simulacra on mobile"><p align="center"><sub>Simulacra · mobile</sub></p></td>
  </tr>
</table>

## How it works

| Data | How it reaches the site |
| --- | --- |
| **Game content** | ToF Exporter reads the installed client offline and builds catalogs, localizations and images. The site serves the generated files. |
| **Player content** | The API validates JSON and file imports, processes them through a queue and stores builds, wish histories and rankings in PostgreSQL. |

More detail: [architecture](docs/architecture/overview.md) · [pipeline](docs/pipeline.md) · [imports](docs/imports.md).

## Engineering highlights

### Automated game-data pipeline

The core of the project is [ToF Exporter](tools/patch-exporter): one command turns an installed game client into everything the site shows. Nobody types in stats, names or images; when the game updates, the exporter is run again and produces an update for the site.

1. **Discovery.** Finds the client, reads its version metadata and locates the Unreal Engine archives.
2. **Selective extraction.** Opens the encrypted UE4 packages through UnrealExporter / CUE4Parse (the key is supplied separately, never committed) and exports only what the site uses: 471 extraction rules cover tables, Blueprints, localization and textures.
3. **Processor graph.** 36 processors run in dependency order from a declared job graph ([`jobs.json`](scripts/game-processors/contracts/jobs.json)). Identities are joined through exact asset references, never by similar names, and Global and MMO data are never mixed.
4. **Normalize and localize.** Stable IDs, language-neutral datasets and localized catalogs for all 13 client cultures, with recorded fallbacks.
5. **Generators.** 51 generators build page data: Build catalogs and combat formulas, the Handbook, progression costs, encounter scaling, hub summaries and link previews.
6. **Media.** Resolves the exact texture behind every reference, keeps required PNG originals, produces WebP previews and renders supported animated cosmetics.
7. **Validate and release.** Schemas, cross-file integrity and declared media are checked; a failed check produces a report and no package. Every file is hashed into a full or delta update, including deletions, that installs with one command.

The exporter ships as a single Windows executable: a C++ launcher with a bundled, checksum-pinned Node.js runtime and toolchain. The same processors also run in Docker against an existing raw export. Every generated dataset records the SHA-256 of the raw files it came from; see [the pipeline guide](docs/pipeline.md) and [data provenance](docs/data-provenance.md).

### Application

- **One scoring engine, three tools.** Ranking, Build and Optimizer share the gear-scoring code in [`packages/game-domain`](packages/game-domain), so a piece has the same GRV on the leaderboard, on a build card and in the optimizer.
- **Shared contracts.** Zod schemas in [`packages/contracts`](packages/contracts/src) are used by the pipeline, the API and the website, so a format change is checked on every side at once.
- **Sealed, signed imports.** Files can be encrypted for one installation (AES-256-GCM, key wrapped with RSA-OAEP), and accepted build cards are signed so a saved profile can be verified later.
- **Queue-backed API ([module map](apps/api)).** Imports run through a PostgreSQL job queue with per-client limits, one-time private delivery and retention rules; Redis caches hot ranking reads.
- **Least-privilege deployment.** Migrations run as the schema owner, the API connects as a CRUD-only role, and secrets are generated per installation.
- **Continuous integration.** [GitHub Actions](.github/workflows/ci.yml) runs the public-source policy, lint, type checks of the API and shared packages, contract tests, import-example validation and a Gitleaks secret scan on every push and pull request. Checks that need generated game data run locally; see [development](docs/development.md#checks).

### By the numbers

| | |
| --- | --- |
| Source | ~250,000 lines of TypeScript and CSS, excluding translations, generated data and lockfiles |
| Game-data pipeline | 471 extraction rules, 36 processors, 51 generators, 13 client cultures |
| Website | 46 page routes across Info, Datamine, Tools and Ranking |
| API | 41 endpoints |
| Shared contracts | 64 Zod schema modules |
| Tests | 316 Vitest, Node test runner and Playwright test files |

## Tech stack

| Layer | Technology |
| --- | --- |
| Language and runtime | TypeScript 6, Node.js 24 |
| Web | Next.js 16 App Router with Webpack, React 19, Tailwind CSS 4, PostCSS |
| API | NestJS 12 with Express, Prisma 7 with the PostgreSQL adapter, `pg` |
| Database and cache | PostgreSQL 17, Redis 7.4, `ioredis` |
| Shared contracts and UI | Zod 4, domain calculation packages, shared React UI components |
| Localization | i18next 26, react-i18next 17, generated game-language catalogs |
| Images and OCR | sharp, libwebp, Tesseract.js 7 for Build gear OCR |
| Game-data pipeline | TypeScript processors and generators, UnrealExporter / CUE4Parse |
| Exporter packaging | esbuild, bundled Node.js runtime, C++17 launcher built with MSVC and the Windows SDK |
| Workspace and builds | pnpm 12 workspaces, Turborepo 2, tsx |
| Tests | Vitest 5, jsdom, Testing Library, Playwright with Chrome |
| Code checks and CI | ESLint 10, Prettier 3, GitHub Actions, Gitleaks |
| Deployment | Docker, Docker Compose, Nginx, Alpine Linux containers |

These are the technologies used by the project. Exact dependencies and versions
are recorded in the [root](package.json), [web](apps/web/package.json),
[API](apps/api/package.json) and [exporter](tools/patch-exporter/package.json)
manifests, the [lockfile](pnpm-lock.yaml), [containers](compose.yml) and the
[exporter runtime manifest](tools/patch-exporter/config/runtime.json).

## Repository layout

```text
apps/
  api/                 NestJS API, Prisma schema and migrations (see its README)
  web/                 Next.js website
packages/
  contracts/           Zod schemas shared by API, web and pipeline
  game-domain/         Gear rating, Titan and order formulas (see its README)
  game-assets/         Game media path resolution
  i18n/                UI copy and locales
  ui/                  Shared React components
  config/              Shared configuration
tools/
  patch-exporter/      ToF Exporter: extraction, pipeline runner, release packaging
  tof-client-patcher/  Branch patcher for official game clients (BAT / PowerShell)
scripts/
  game-processors/     Per-dataset processors and their dependency graph
  normalize-game-data/ Normalization and localization
  generators/          Site generators (Build, Handbook, progression, ...)
examples/import/       Sample JSON files for every import format
deploy/                Container provisioning and Nginx configuration
docs/                  Documentation
```

## Getting started

ToF Hub is built from your own game client. You build ToF Exporter from this
checkout, run a full export of your installed Tower of Fantasy, install the
resulting update and start the site in Docker.

**Requirements**

| For | You need |
| --- | --- |
| The export | Windows x64, an installed Tower of Fantasy client, Node.js `>=24.15.0 <25`, pnpm `12.5.1`, Visual Studio Build Tools with *Desktop development with C++* and the Windows SDK; about 40 GB of free disk space and 16 GB of RAM during a full run |
| The site | Docker with Compose v2.27+ (Docker Desktop with WSL 2 on Windows); about 10 GB of disk for the generated content and about 500 MB of RAM for the whole stack |

The export runs once per game patch on a Windows machine. The site itself is light and can be hosted on any small Linux server. Most of its disk space is taken by PNG originals kept for download; a WebP-only installation needs considerably less.

### 1. Clone and configure

```powershell
git clone https://github.com/smilekritik/tof-hub-public.git
cd tof-hub-public
pnpm install --frozen-lockfile
node scripts/setup.mjs
```

`setup` writes a `.env` file with freshly generated database passwords and secrets. Running it again keeps an existing `.env`. The defaults serve the site at `http://localhost:8080`; see [configuration](docs/configuration.md) for every variable.

### 2. Restore the bootstrap package

The exporter needs a small companion **data** package: extraction settings,
reference mappings and historical artwork that the current client no longer
contains. It holds no source code. Download `tof-hub-bootstrap-v1.zip` from
[Releases](https://github.com/smilekritik/tof-hub-public/releases), place it in
`ignore/downloads/` (or set its URL in `TOF_BOOTSTRAP_URL`) and run:

```powershell
node scripts/bootstrap.mjs
```

Its size and SHA-256 are pinned in [`config/bootstrap.json`](config/bootstrap.json) and checked before anything is extracted.

### 3. Build ToF Exporter and run a full export

```powershell
pnpm --filter @tof-hub/tof-exporter package
.\tools\patch-exporter\dist\ToFExporter.exe --full
```

`package` compiles the exporter, its native launcher and the whole pipeline from
this checkout, and downloads checksum-pinned third-party tools; nothing prebuilt
is required. Select the game folder when prompted. The exporter extracts the
client, runs every processor and generator for all game languages, validates the
result and writes an update to `tools/patch-exporter/dist/output/tof-update-*/`.
A full run takes a while and needs the disk space listed above.

### 4. Install the update

```powershell
pnpm --filter @tof-hub/tof-exporter apply-update -- "<ABSOLUTE_PATH_TO_TOF_UPDATE_FOLDER>"
```

This copies the generated catalogs, localizations and images into
`apps/web/public/`, including deletions from earlier releases. After a game
patch, run the exporter again and apply the new update.

### 5. Start the site

```bash
docker compose up -d --build --wait
```

The first start creates the database, runs migrations, provisions a restricted runtime database user and generates this installation's own RSA import key. Then open:

| URL | Page |
| --- | --- |
| http://localhost:8080/ | Home |
| http://localhost:8080/info/simulacra/ | Simulacra catalog |
| http://localhost:8080/datamine/ | Datamine archive |
| http://localhost:8080/tools/build/ | Build card |
| http://localhost:8080/api/v1/health | API health check |

### 6. Add player data

A new installation has the full game database but no players yet. Import the samples to see Ranking, Build and Wish populated:

```bash
node scripts/import-json.mjs --kind build   --file examples/import/build.json
node scripts/import-json.mjs --kind players --file examples/import/players.json
node scripts/import-json.mjs --kind wish    --file examples/import/wish.json
```

You can also open any file from [`examples/import`](examples/import) in the matching page of the site. All formats are described in [imports](docs/imports.md).

<details>
<summary><strong>Already have a raw export? Run the pipeline in Docker instead</strong></summary>

If you already have an UnrealExporter output (the folder that contains
`Hotta/Content`), you can skip steps 3 and 4 and run the same pipeline in Docker
without building the exporter. Set `RAW_GAME_DIR` in `.env` to that folder, then:

```bash
docker compose --profile tools run --build --rm tooling
docker compose --profile tools run --rm bootstrap node scripts/install-public-data.mjs ignore/export/public
```

On a machine without Node.js, steps 1 and 2 also run in Docker:
`docker compose --profile tools run --rm setup` and
`docker compose --profile tools run --build --rm bootstrap`.

</details>

The [pipeline guide](docs/pipeline.md) covers stages, partial runs and delta updates.

### Stop and update

```bash
docker compose stop                       # stop, keep all data
docker compose start                      # start again
git pull --ff-only && docker compose up -d --build --wait   # update the code
```

> [!WARNING]
> Never use `docker compose down -v` as a normal stop: `-v` deletes the database and the import key. Back up first; see [operations](docs/operations.md).

Something not working? See [troubleshooting](docs/operations.md#troubleshooting).

## Development

Host development needs Node.js 24 and pnpm 12.5.1:

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm build
```

The web typecheck and many regression tests read generated game data, so generate it first (step 3). See [development](docs/development.md) for the full list of checks, browser tests and conventions.

## Contributing

Issues and pull requests are welcome; see [CONTRIBUTING.md](CONTRIBUTING.md).

## Scope of this repository

This repository contains the website, the API and the game exporter. Two things are intentionally not included:

- **Generated game data and images.** They are produced by the pipeline from your own game client, or restored from the bootstrap package.
- **The live data collector** that the official site uses to read player data. Self-hosted installations import data through the open JSON formats instead; see below.

The pipeline never invents missing values. Banner schedules, editorial boss notes and preserved historical artwork are maintained inputs, kept separate from game-derived data. See [data provenance](docs/data-provenance.md).

### How the live collector works

The collector is a separate Windows desktop app (Tauri 2 with a Rust host and an embedded Node.js backend). It is not distributed with this repository, but the format it produces is fully documented here.

- **Passive capture.** An elevated helper opens [WinDivert](https://reqrypt.org/windivert.html) in sniff, receive-only mode, so it copies the game's TCP and UDP packets without injecting, modifying or blocking anything. The UI process itself runs unelevated.
- **TCP stream decoding.** Each connection is reordered by sequence number, split into length-prefixed frames and classified by opcode. Responses such as player profiles, inventories and pull history are decoded into typed records.
- **Unreal Engine UDP decoding.** The game-world channel is parsed at bit level: packet headers, channel bunches, partial-bunch reassembly, actor channels and replicated properties. Unknown layouts are kept raw instead of guessed.
- **Export.** Decoded records are mapped to the documented import formats ([shared contracts](packages/contracts/src)), checked by a save gate that refuses incomplete captures, and sealed for the target installation (AES-256-GCM with an RSA-OAEP-wrapped key) as `.tofbuild`, `.tofwish` or `.tofplayers`.

The collector reads only data the game client already receives. It does not modify the client or its memory, and it does not send anything to the game servers.

Everything the site accepts is in [`examples/import`](examples/import): complete build captures for Global and MMO, player bundles, wish history and squad links, generated from the schemas and validated in CI. Any tool that produces these files can feed a self-hosted installation; see [imports](docs/imports.md).

## License

The project's own source code is released under the [MIT License](LICENSE).

Tower of Fantasy and all game content, including text, images and data extracted from the client, are the property of their respective owners. This is an unofficial fan project and is not affiliated with or endorsed by the game's developers or publishers. Third-party components keep their own licenses; see [third-party notices](docs/third-party.md).
