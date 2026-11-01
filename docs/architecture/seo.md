# SEO and link previews

Public metadata and link previews are always in English, regardless of the visitor's `tof_locale` cookie. The interface itself stays fully localized.

## Metadata

`apps/web/src/lib/seo/routes.ts` holds page titles, descriptions and the indexing policy for every public route. `buildMetadata` produces canonical URLs with one public origin and trailing slashes.

- Entity canonicals keep the entity identity and edition; search, sort and other incidental filters are dropped.
- Catalog links carry the selected entity in the query string (not only in the fragment), because crawlers never see a fragment.
- Old fragment links still open the right entity in the browser.

`next.config.ts` retains the pinned Next.js default HTML-limited crawler list and
adds `TelegramBot`, so these crawlers receive metadata inside `<head>` rather
than after a streamed page body. Browser metadata streaming remains enabled.
See [Next.js htmlLimitedBots](https://nextjs.org/docs/app/api-reference/config/next-config-js/htmlLimitedBots).

## Generated preview data

`scripts/generators/build-link-previews.cjs` reads the normalized English datasets (Simulacra, Matrices, Relics, Pets, Food, Cosmetics, Arts, Items, boss cards, Bygone floors and Origin of War seasons) and writes:

| File | Contents |
| --- | --- |
| `link-previews.json` | Small index manifest |
| `link-previews-*.json` | Per-route preview records |
| `link-preview-paths.json` | Object URLs for the sitemap |

It never reads raw game tables and never invents values. At request time, metadata loads only the selected route's file. Game JSON is never bundled into the app.

The generator runs at the end of the exporter's site generators and in the web prebuild. To run it alone during development:

```bash
pnpm generate:link-previews
```

## Open Graph images

`/og/?path=...` renders a 1200 × 630 PNG with a short title, description and the object's artwork.

- It accepts only site paths, never an arbitrary remote image URL.
- Game images are resolved through `@tof-hub/game-assets`, resized and converted with sharp.
- A missing image produces a text-only card.
- Cache lifetime: one hour for catalog previews, one minute for saved builds.

Saved build pages show only the public name, level, role, element and approved artwork. Nothing else from the capture enters metadata.

## Indexing

| Pages | Policy |
| --- | --- |
| Info, Datamine, tools and generated object links | Indexed, listed in the sitemap |
| Saved builds, profiles, shared teams, the queue | `noindex, follow`, not in the sitemap |
| API and developer routes | Disallowed in `robots.txt` |

The home page includes `WebSite` structured data.

## Tests

- `seo.test.ts`: locale independence, canonicals, editions, old aliases, missing objects.
- `link-previews-pipeline.test.ts`: regeneration from isolated fixtures.
- `tests/e2e/seo.spec.ts`: requests every public route as a social crawler with a Russian cookie and checks the metadata and PNG output.
