# Project story

`/story/` publishes `docs/case-study.md` as the author's long-form account of playing
Tower of Fantasy, researching its mechanics and building ToF Hub. The footer label
is **Project story** / **История проекта**. The author maintains English and Russian
editions only (`docs/case-study.md` and `docs/case-study.ru.md`). The existing header
language selector refreshes the server-rendered article without changing the chapter
hash. Russian selects the Russian edition; other site languages use English.
There is no duplicate article-specific language control.

## Content and rendering

The page imports the maintained Markdown with a narrow webpack `asset/source`
rule. `render-story.ts` uses Marked on the server and GitHub-compatible heading
slugs. The website replaces the Markdown header and contents table with the shared
`EditorialHeader` and responsive chapter navigation; the narrative, figures,
captions and credits remain in the document. The renderer accepts repository-owned
editorial content only, rejects active HTML, resolves code/documentation references
to the public repository and requires every image to have a declared media entry.
It is not an upload or user-comment renderer.

`StoryReader` contains the small client-side part: chapter highlighting, sticker
play/pause and delegated screenshot opening through the existing `Lightbox`.
The parser and Markdown stay out of the client JavaScript. Native anchors and
mobile `details` navigation work before hydration. Both editions keep the same
canonical English heading IDs, including explicit aliases in the Russian Markdown.
The article and its controls declare the selected `en`/`ru` language. Screenshot links still open the original
media without JavaScript or with a modified click.

## Editorial media

`scripts/generators/prepare-project-story.cjs` prepares only images explicitly
referenced by the article, under `apps/web/public/project-story/`. In a public
checkout it copies the reviewed screenshots and stickers from `docs/`. A release
that already maintains these images in `public/project-story/` can retain them
without keeping binary media in its documentation tree. Missing inputs fail the
preparation. The manifest records natural dimensions and content-versioned URLs.
The public Docker context includes the two Markdown files and their reviewed
`docs/screenshots/*.webp` / `docs/stickers/*.gif` inputs through narrow exceptions
in `.dockerignore`; the remaining documentation and generated game media stay excluded.
The generated `media.generated.ts` imports the originals and posters as static
assets. Next emits them under `/_next/static/media/`, so they also ship with the
standalone build when a self-hosted server mounts its own `public/` directory for
game data. The Markdown parser receives the emitted URLs rather than assuming
the generated editorial folder exists on that runtime mount.
Static lossless WebP posters come from the original GIF's first frame, using Sharp.
The preparation samples still images for a predominantly near-white background.
Those charts and spreadsheets receive a display-only brightness filter in the
article; source files and original-image downloads retain their pixels.

The existing GIFs remain unchanged. The owner explicitly requested that stickers
play by default, including when the system prefers reduced motion. The page's
manual pause control switches all stickers to their static posters. Image dimensions reserve screenshot space while lazy
loading. The preparation runs before development, type checks and production builds; generated
public output is separate from the maintained Markdown and source media.

The article's media provenance remains documented alongside the public screenshots
and stickers. These are editorial illustrations and existing game animations,
not newly extracted game-data records or replacements for the extraction pipeline.

## Verification

Renderer tests cover actual chapter and nested-anchor navigation, image resolution,
captions, the closing acknowledgements and missing/unsupported-input failures.
Browser checks cover the footer entry, mobile contents, direct anchors, screenshots,
keyboard dismissal, default autoplay and manual pause, including when reduced motion is requested.

The reading column is centered independently of its right-hand sticky chapter
navigation, with a 1040px maximum at wide desktop sizes. At narrower widths the
contents become a native disclosure above the article.
Only the active chapter expands a short curated list of milestones, including
the 119.99 incident, the spreadsheet and the first website in Part 1. Topic IDs
remain identical in English and Russian. Scroll tracking selects the last milestone
above the reading line and replaces the URL hash without adding history entries.
Opening or reloading that URL restores the selected heading; language changes retain
the same canonical target. Screenshot aspect ratios reserve their full space before
lazy loading so decoded images do not displace a restored reading location.
Selecting a mobile contents link closes the disclosure before native anchor navigation.
