# Simulacra localization

`scripts/game-processors/processors/build-simulacra.ts` resolves skill text by
exact namespace and key. When client translations are incomplete, it retains
original source text in the existing skill record. A later translated value
replaces that text on the next run.

Paths below are relative to the raw-export root. The source behavior was checked
against the Korea Dev 1 client, branch `TestPC_KR2New`, version `6.5.0`.

| Source | Fields and use |
| --- | --- |
| `Hotta/Content/Resources/CoreBlueprints/DataTable/Skill/WeaponDes/**/*.json` | `[].StringTable.TableNamespace` and `KeysToEntries`: original weapon text, included recursively by extraction rules |
| `Hotta/Content/Resources/Text/**/*.json` | The same StringTable fields, including separate Overseas namespaces |
| `Hotta/Content/Localization/Game/{zh-CN,en,ru}/Game.json` | Exact namespace/key translations; no numeric conversion |
| `Hotta/Content/Resources/CoreBlueprints/DataTable/StaticWeaponDataTable.json` | `[0].Rows.Painter_Fire.WeaponSkillList`: active ability identities |
| `Hotta/Content/Resources/CoreBlueprints/DataTable/GameplayEffectTipsDataTable.json` | `[0].Rows.Buff_Painter_ImitationLikeLevel1_FinalDMGUP`, `Name` and `Desc`: trait text references |

English text takes precedence over zh-CN localization, which takes precedence
over original StringTables. Russian takes precedence over the completed English
view. Other culture passes use the exporter's localized source projection.
Base and Overseas namespaces remain separate. Bare `GA_*` name keys are accepted
when the same namespace contains the paired `_des` key.

Trait lookup first uses exact identities. An explicit imitation identity may
resolve a unique suffixed row; ambiguous or unrelated rows remain unresolved.

The processor writes staging `info/simulacra/data/*.json`. The Simulacra
normalizer and runtime generator consume those records. This source fallback
adds no translated text or game values of its own.
