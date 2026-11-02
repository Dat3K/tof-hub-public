# Responsive layout

Ordinary pages reflow with the viewport. Exportable Build, Wish and encounter
cards keep their source geometry; fitting the preview must not change the PNG.

## Shared scale

`packages/ui/src/styles/responsive.css` supplies the relative desktop scale.
Full HD uses a 16px root, QHD grows by 4/3 and 4K by 2 when the available height
allows it. Short windows limit growth. The root never shrinks below 16px:
phones reflow or scroll specific lists instead of reducing readable text.

Typography, controls, spacing, avatars and workspace caps use relative units.
Media-query breakpoints, hairline borders and pointer/DOM measurements remain
in viewport pixels. Text reading widths remain bounded. Components also used
inside exported scenes use `--ui-unit`, which resolves to the interface scale
on the page and a fixed pixel inside the source scene.

## Fixed scenes

Global and MMO Build share `useCardPreviewScale`. Desktop fitting accounts for
both available width and height, the measured bottom toolbar, and the right
action rail. Tall wide windows allow growth beyond 1:1. On mobile, the preview
fits the width; landscape keeps small side gutters and permits vertical scroll.
Fullscreen retains its own fitting rules. The source canvas and export scale
remain fixed, including Global Build's variable footer height.

FCE and Raids share `EncounterChoices`. Desktop columns fill the available
width; narrow screens use a single horizontal viewport for the three-row roster.
Changing selection reveals its column. Scene fitting reserves the measured
export toolbar rather than assuming a fixed inset.

## Controls and reading layouts

- Mobile `ToolRail` actions start collapsed. The bottom-left toggle opens actions
  at bottom centre. Escape, outside presses and completed actions close them;
  desktop retains the visible action rail.
- Ranking uses compact explanatory hints and the inline sort variant. Filter
  groups and action rows scroll horizontally where necessary, without forcing
  the whole page outside the viewport.
- Info sticky filter labels use their containing panel's background.
- Datamine dates wrap inside tiles. Item rows stack names and copyable IDs next
  to the icon on phones. Comp and Bygone keep narrow grids/stat rows contained.
- Hubs fill available height. Article, form and other reading layouts keep
  bounded line lengths.

## Verification

`build-responsive.spec.ts`, `mobile-layout.spec.ts`, `wide-layout.spec.ts` and
`ranking-tooltips.spec.ts` exercise EN/RU, QHD/4K, short desktops, landscape and
portrait phones, overflow, focus and toolbar placement. The public main-hub
tests use synthetic version observations. Wish export tests compare PNG sizes
across desktop widths. Shared Info changes must also check Gefion Global and
Salidy MMO with the installed game snapshot.
