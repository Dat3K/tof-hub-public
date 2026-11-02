# Documentation

Start with the [project README](../README.md) for an overview and the quick start,
and [My journey in Tower of Fantasy](case-study.md) ([Русский](case-study.ru.md)) for the story, research and decisions behind it.

## Guides

| Guide | Contents |
| --- | --- |
| [Gear ranking and tools](tools.md) | Item and player leaderboards, GRV/PRV, best known sets, Build, Optimizer, Wish and Comp |
| [Configuration](configuration.md) | Environment variables, database roles, installation keys |
| [Operations](operations.md) | Backups, restore, updates, HTTPS, logs, troubleshooting |
| [Data pipeline](pipeline.md) | How game content is extracted, processed and released |
| [Imports](imports.md) | JSON formats for builds, wish history, players and comps |
| [Development](development.md) | Local setup, checks, tests and conventions |

## Architecture

| Document | Contents |
| --- | --- |
| [Overview](architecture/overview.md) | Runtime services, packages and how data reaches a page |
| [Job queue](architecture/job-queue.md) | How imports are queued, limited and delivered |
| [Localization](architecture/localization.md) | Game cultures, UI translations and fallbacks |
| [Frontend](architecture/frontend.md) | Shared UI components, design tokens and the Info standard |
| [Runtime data](architecture/runtime-data.md) | Catalog projections, raid detail files and loading boundaries |
| [Ranking caches](architecture/ranking-cache.md) | Shared Redis responses, warmup, identities and the Me control |
| [Project story page](architecture/project-story-page.md) | EN/RU article, chapter links, editorial media and sticker controls |
| [SEO and link previews](architecture/seo.md) | Metadata, Open Graph images and the sitemap |

## Game data

| Document | Contents |
| --- | --- |
| [Data provenance](data-provenance.md) | Where every input comes from and how it is recorded |
| [Game data reference](game-data/README.md) | Source tables and formulas behind individual Datamine pages |
| [Third-party notices](third-party.md) | Bundled tools and their licenses |
