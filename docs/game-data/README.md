# Game data reference

These pages document how individual Datamine sections are derived from the game files: which raw tables are read, how they are joined, which formulas are applied, and what is still unknown.

| Page | Section on the site |
| --- | --- |
| [Bygone Phantasm (Global)](bygone.md) | `/datamine/bygone/` |
| [Bygone Phantasm (MMO)](mmo-bygone.md) | `/datamine/bygone/?mode=mmo` |
| [Biochemical Collapse (MMO)](biochemical-collapse.md) | `/datamine/seq/?mode=mmo` |
| [Brainfield (MMO)](brainfield.md) | `/datamine/handbook/#brainfield` |
| [Origin of War](origin-of-war.md) | `/datamine/oow/` |
| [Sequential Phantasm](sequential.md) | `/datamine/seq/` |
| [Cosmetics media](cosmetics.md) | `/info/cosmetics/`, Build account details |

## Conventions

- Raw paths are relative to the export root (the folder that contains `Hotta/Content`).
- Global (gacha) tables usually live under `ResourcesOverSea/` with a base fallback under `Resources/`. MMO tables live under `DataTable_MMO/` or `DataTable_Balance/` and are bound through the MMO game-data asset `GameMode/MMO/BP_GameData_MMO_Base`.
- Global and MMO data are never joined by matching file or row names. Each mode reads the tables its own data asset binds.
- Text is resolved by exact FText namespace and key from `Localization/Game/<culture>/Game.json`.
- Every generated dataset keeps the SHA-256 of the raw files it consumed.

## Principles

1. **Never invent a value.** Missing names, images or numbers stay unknown and are shown as such.
2. **Identity by reference, not by name.** Classes, rows and images are joined through explicit asset paths, never by similar display strings or file name suffixes.
3. **Raw values stay raw.** Source fields are preserved unchanged. Derived values are stored separately and labelled with the model that produced them.
4. **Mark estimates.** A value that relies on an unverified assumption is labelled as an estimate in the data (`verified: false`) and in the UI.
