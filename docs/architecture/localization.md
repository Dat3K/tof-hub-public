# Localization

There are two separate translation systems:

- **Game text** (names, descriptions, enemy names) comes from the client's localization files and is produced by the pipeline.
- **Interface text** (navigation, labels, help) is written for the site and lives in `packages/i18n`.

## Locales

The registry in `packages/i18n/src/constants.ts` lists the supported cultures:

`en`, `ru`, `de`, `es`, `fr`, `id`, `ja`, `ko`, `pt`, `th`, `zh-CN`, `zh-Hans`, `zh-Hans-SG`

These are exact directory, cookie and dataset identifiers. The three Chinese cultures are separate game sources but share one site UI option (`简体中文`, `zh-CN`). `zh-Hans` and `zh-Hans-SG` are small partial overlays in the client, so the exporter does not project datasets for them (`UNPROJECTED_LOCALES` in `tools/patch-exporter/src/localization.ts`); requests for them fall back to English.

## Game text

### Sources

| Raw path | Contents |
| --- | --- |
| `Hotta/Content/Localization/Game/<culture>/Game.json` | Namespace → key → translated string |
| `Hotta/Content/L10N/<culture>/Resources/UI/**` | Localized artwork, where the client has it |

FText references keep their namespace (`TableId`) and `Key`. Equal keys in different namespaces are never joined, and nothing is ever matched by its English display string.

### How locales are produced

1. The extraction rule captures every `Localization/Game/*/Game.locres`.
2. After the base generators, `pipeline-run.ts` runs a `locales` stage.
3. For each available culture, `localization.ts` overlays that culture's `Game.json` on English and reruns the same processors, normalizers and generators in an isolated work tree. The original export is never modified.
4. Localized results are merged into `game-data/<culture>/` by stable identity. English owns the shape of every entity and array; numbers are never changed by a locale pass.

### Fallbacks

- A missing or blank key uses the English value of the **same namespace and key**.
- An entity missing from a localized pass keeps its English record.
- Editorial notes without a translation stay in English.

`game-data/localization-manifest.json` records the source path, SHA-256, translated key count, fallback key count and missing cultures for every run. Every published culture is validated.

## Interface text

- `Locale`, cookie validation, language options and `Intl` tags come from one registry.
- On the first visit, `negotiateLocale` reads `Accept-Language` (any `zh-*` maps to `zh-CN`); otherwise the site uses English.
- Call sites pass the English source string, for example `t('Save')`. Translations live in `packages/i18n/src/locales/extra/cultures/<culture>.ts`, keyed by that exact English string. Russian is one more entry in that table (`extra/cultures/ru.ts`).
- `localizedUi` resolves site-authored `{ en, ru }` copy and falls back through the table. `localized` is used for game data and falls back to English.
- Browser tab titles are static in `lib/seo`; `DocumentTitleLocalizer` translates the short page name at runtime.

### Localization check

`scripts/checks/check-ui-localization.cjs` runs as part of `pnpm lint`. It fails when:

- a UI phrase used in `apps/web/src` has no translation for any supported culture;
- translatable text is written as literal JSX text or in text-bearing attributes (`alt`, `title`, `aria-*`, `placeholder`, ...);
- a rich guide field lacks a matching translation.

A translation identical to English is allowed only when listed in `extra/site-ui/corrections.ts` (brand names, canonical game names, abbreviations).

## Data loading

- Client dataset loading falls back to English **only** on HTTP 404. Server, network and JSON errors stay errors.
- `_locale` describes the requested view; `_sourceLocale: "en"` marks an English fallback so server-rendered data can hydrate immediately.
- Switching language fetches the new culture instead of reusing cached text.

## Tests

Cosmetics controls are registered through `extra/features/cosmetic-media.ts`, and public
footer reading pages through `extra/site-ui/footer-pages.ts`. The merge in
`extra/index.ts` retains the public JSON-import translations. These are interface
phrases; game names and descriptions still come from the client catalogs.

- `tests/setup/all-locales-pipeline.test.ts`: extraction, cookies, namespace collisions, missing keys, isolation between concurrent cultures, schema retention, fallback behavior.
- `tests/e2e/locales.spec.ts`: language menu, keyboard and mobile selection, localized pages.
