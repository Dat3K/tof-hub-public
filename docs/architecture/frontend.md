# Frontend

The website is a Next.js App Router application. Server pages load the initial data, feature hooks own selection, filters and URL state, and shared React components in `packages/ui` own repeated presentation.

The Simulacra catalog and the Gefion (Global) and Salidy (MMO) profiles are the visual reference for every Info page.

## Styling sources

| Concern | Location |
| --- | --- |
| Global custom properties and app styles | `apps/web/src/app/globals.css` |
| Tailwind theme extensions | `apps/web/tailwind.config.js` |
| Tailwind / PostCSS build | `apps/web/postcss.config.js` |
| Shared Info presentation | `packages/ui/src/styles/info-standard.css` |
| Loading animation | `packages/ui/src/styles/loading.css` |

Use the existing surface, border, text, spacing and type tokens. Feature styles may compose shared primitives but must not override another feature's internal selectors. Font binaries are not part of the repository; every font stack keeps a system fallback.

## Shared components

| Concern | Components |
| --- | --- |
| Catalog search, filters, sort, counter | `CatalogControls`, `CatalogSearch`, `FilterGroup`, `FilterChip`, `CatalogCounter`, `ModeSwitcher` |
| Entity presentation | `EntityCard`, `EntityGrid`, `GameBadge` |
| Game descriptions | `GameRichText`, `formatGameRichText` |
| Full-size images and galleries | `Lightbox` |
| Dialogs and notifications | `Modal`, `Toast` / `useToast` |
| Loading, empty and error states | `LoadingState`, `Spinner`, `EmptyState` |
| Tool actions and help | `ToolRail`, `ToolInfoModal` (web app) |
| File imports | `submitSealedFile` and the [queue client](job-queue.md) |

Example:

```tsx
<div className="info-ui">
  <CatalogControls
    searchQuery={query}
    onSearchChange={setQuery}
    count={items.length}
    total={total}
    entityLabel="matrices"
  >
    <FilterGroup label="Element:">{elementFilters}</FilterGroup>
  </CatalogControls>

  <GameBadge variant="frost" presentation="icon" icon={frostIcon}>
    Frost
  </GameBadge>

  <GameRichText text={description} rank={rank} links={relatedLinks} />
</div>
```

## Info presentation rules

- Put `info-ui` on the feature root to opt into the shared standard.
- Search bars, filters and switchers use the neutral site palette (`--surface-*`) with a cyan focus ring.
- Cards and detail panels use `rgba(18, 22, 34, 0.85)`, subtle white borders and a 14 px card radius.
- Compact badges are 26 px tall with a 20 px icon. When a label is hidden, keep an accessible text alternative.
- Rarity: SSR is an amber gradient, SR violet. Rarity is always also available as text, never color alone.
- Descriptions are 13 px with 1.6 line height. Numbers and keyword links use `#2ba6df`; links have a dotted underline.
- Slash-separated rank values dim inactive entries and emphasize the selected one.
- Transient notices use the top-right `Toast` viewport and never shift the layout.
- All loading boundaries use the same 64 px two-ring animation; reduced motion slows it but keeps it visible. Background refreshes never replace loaded content with a full-page spinner.

### Mobile

Up to 640 px, each filter group becomes a horizontally scrolling row with a sticky label, and sort takes its own full-width row. Every page must stay within the viewport at 320 px.

## Adding a page

1. Look for an existing building block before writing a new one.
2. Compose shared components with feature-specific data and hooks.
3. Extract shared behavior only when a second real consumer needs it.
4. Add typed variants only for real differences; keep the default simple.
5. Test the interaction rather than CSS strings. Check EN and RU, mobile overflow, keyboard use and direct links.

Shared UI never imports app features, and game facts never live in component code.

## Rendering rules

### Section hubs

`components/section-hub` owns the common card layout, chip links, media strips,
charts and keyboard-accessible hover previews for `/info/`, `/datamine/` and
`/tools/`. Features supply domain data and links. Desktop hubs fill the available
height; shorter and mobile viewports scroll normally.

Info previews use generated character portraits. Datamine previews use the
encounter datasets, including the displayed season number separately from its
URL identifier. Tools includes a live ranking preview with distinct loading,
empty and error states, Build and Optimizer previews, a composition strip and
Wish shortcuts. The Comp preview reads the public composition directory rather
than assuming `comp.json` is an array. Every image uses the shared asset resolver.

`scripts/generators/build-hub-summary.cjs` supplies compact, localized summaries
from existing generated catalogs. No example player is substituted for an empty
ranking. Browser coverage lives in `tests/e2e/shared-ui.spec.ts` and
`tests/e2e/main-hub.spec.ts`.

### Cosmetic media API

`LightboxProps.animation` and gallery-image `animation` accept `{src, gifSrc}`
for animated WebP playback and a separate GIF download. `src` and `webpSrc` keep
their static poster roles. Closed viewers load no animation. Opening requests
playback, including when reduced motion is enabled; pause and poster fallback
remain available. Nested dialogs retain keyboard handling and restore focus.
`ProfileAvatar.formatLabel?: string` is a static caption. App-level
`ProfileCosmeticPreview` composes the same viewer for Global/MMO Build details.
Lists and exports remain static; unresolved effects have no playback URL.
Source semantics and runtime outputs are documented in
[cosmetics media](../game-data/cosmetics.md).

- The first render follows the server-parsed URL (`?server=`, `?char=`); browser storage is read after mount. Never silence hydration warnings; fix the cause.
- Missing images show a blank slot, not the browser's broken-image icon.
- Missing data shows an empty or error state, never a placeholder value.

## Verification

```bash
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm build:web
pnpm exec playwright test tests/e2e/info.spec.ts tests/e2e/shared-ui.spec.ts
```

After any change to global CSS or the Tailwind/PostCSS configuration, compare the reference pages visually. A successful TypeScript build does not prove the styles compiled.
