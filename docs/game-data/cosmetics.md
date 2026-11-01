# Cosmetics media

`scripts/game-processors/processors/build-cosmetics.ts` projects avatars, frames,
mounts, chat stickers and badges. `cosmetic-sources.ts` resolves source joins;
`cosmetic-source-audit.ts` follows exported material references and records their
parameters. Neither source reports nor animation recipes are bundled game data.

## Sources

All paths are relative to the raw-export root. DataTables use `[0].Rows`.
The material observations below came from a Global client export examined on
2026-10-29; the exact client build is unknown. Counts from that export are not
fixed catalog sizes and are never used as allowlists.

| Raw path | Rows and fields consumed |
| --- | --- |
| `Hotta/Content/SevenForest/Data/DT_Emoji.json` | Static sticker row keys; `EmojiTexture.AssetPathName`, `IsLock`, `TagId`, `ItemId` |
| `Hotta/Content/SevenForest/Data/DT_BigEmoji.json` | Dynamic row keys such as `big17`; `EmojiBrush.AssetPathName`, `IsLock`, `TagId`, `ItemId` |
| `Hotta/Content/SevenForest/Data/DT_ChatHugeEmoji.json` | Huge sticker row keys; `ImgBrush.ResourceObject.ObjectPath`, `IsLock` |
| `Hotta/Content/SevenForest/Data/DT_ChatEmojiTag.json` | `TagName` FText, `TagType`, `DefaultHidden` |
| `Hotta/Content/Resources/CoreBlueprints/DataTable/Item/ItemConfigs.json` (with `_OS.json` overrides) | Item row key, `StaticToolName`, `ItemName`, `Description`, `ItemIcon.AssetPathName`, `ItemQuality` |
| `Hotta/Content/Resources/CoreBlueprints/DataTable/ToolStaticDataTable.json` | Tool row key, `StaticToolType`, `ToolValue` |
| `Hotta/Content/Resources/CoreBlueprints/DataTable/EmblemConfigDataTable.json` | Badge row keys such as `Badge_ace_1`; `EmblemID`, `EmblemName`, `EmblemDescription`, `EmblemIcon`, `EmblemItemIcon` |
| `Hotta/Content/Resources/CoreBlueprints/DataTable/AvatarConfigDataTable.json` | Avatar row keys; `Name`, `Icon`, `BigImage`, `Material`, `Material2`, `ParticleAsset` |
| `Hotta/Content/Resources/CoreBlueprints/DataTable/MountConfigDataTable.json` | `DefaultSkinId`, `NeedItemArray`, `Icon`, `ShowImage` |
| `Hotta/Content/Resources/CoreBlueprints/DataTable/MountSkinConfigDataTable.json` | Skin row key, `OwnerMountId`, `BigImage` |
| `Hotta/Content/Localization/Game/<culture>/Game.json` | Exact FText namespace and key; includes item and tag names |

The sticker master tables include free stickers without inventory items. A locked
row joins through `ItemId -> ItemConfigs.StaticToolName -> ToolStaticDataTable`;
the tool type and `ToolValue` must match that sticker's kind and row key. Packs and
fragments do not become stickers. Static rows use `EmojiTexture`; a dynamic row's
inventory icon is a poster, never evidence of its frame sequence. Missing names,
quality and pixels remain missing. Badge full art uses `EmblemIcon`, separately
from the small `EmblemItemIcon`; badges are distinct from fashion medals.

## Animation evidence and inference

`Hotta/Content/Resources/UI/liaotian/biaoqing/dabiaoqing/bigemoji_17.json`,
export 0, sets `ScalarParameterValues` `U=1`, `V=2`, `Speed=1` and
`TextureParameterValues.UI_Tex_01` to the corresponding `17` texture (256x128).
Its `Parent` chain ends at `Hotta/Content/Resources/UI/UI_Main_01.json`.
`CachedExpressionData.Parameters.RuntimeEntries.ParameterInfos` aligns with
`ScalarValues` and the texture values; `FunctionInfos` references
`Engine_MaterialFunctions02/Texturing/FlipBook`. The cooked expression wiring is
absent. Effective parameter values are evidence; their shader semantics remain
partly inferred.

The supported reconstruction reads `V` as columns, `U` as rows and cells in
row-major order. It assumes one infinite loop lasts `1 / Speed` seconds, giving
`delayMs = 1000 / (Speed * U * V)`. The unit of `Speed`, loop behavior and exact
in-game timing are unresolved. Ready reconstructions carry `timing: 'inferred'`
and their source material; the UI labels the reconstructed speed. The resolver
requires the FlipBook function, a positive integer grid with at least two cells,
positive speed and exact divisibility of atlas dimensions. Other effects stay
`unresolved` with a reason in the source report.

Avatar instance `Hotta/Content/Resources/Icon/Avatar/Anm/M_Anm_Inst74.json`
(`AvatarConfigDataTable` row `Zuoyi_lv2`) sets `U=3`, `V=3`, `Speed=0.5`,
`UI_Tex_01=T_Icon074_03` (1536x1536) and `BaseTex02=T_Icon074_01` (512x512).
Avatar recipes require explicit instance grid overrides, draw `BaseTex02` over
each frame and apply a centered circle mask. Frame-zero comparisons with the
game's item icon support the composition, but do not verify the full effect.
Panning detail textures, pulse, float, rotation, sweep and `UIParticleAsset`
layers are not reproduced. Instances without a frame grid, including
`M_Anm_Inst1` for `mimi_lv2`, remain unresolved.

## Outputs and publication

The processor writes `info/cosmetics/data/{chat-stickers,badges,cosmetic-animations}.json`
and the existing cosmetics catalogs in the stage. The normalizer writes
`game-data/{core,<culture>}/cosmetics.json`; `scripts/generators/build-runtime-data.cjs`
produces `game-data/<culture>/runtime/cosmetics.json` with one canonical `items`
array. Localized labels use the existing namespaced resolver.

`tools/patch-exporter/src/cosmetic-animation.ts` renders staged recipes during
the media pass. Static posters go under `game-assets/{png,webp}/cosmetic-animations/`;
GIF and animated WebP go under `game-assets/animations/cosmetic/`. Cache keys
include source hashes, frames, loop, overlay, mask and encoder version. Outputs
are checked before publication; failed encoding aborts the release. GIF delays
round cumulative elapsed time to 10 ms ticks; WebP uses 1 ms rounding. Encoders
may merge identical adjacent frames while preserving total duration.

`cosmetics-source-report.json` records missing tables and images, join issues,
unresolved effects and exact mount candidates. `cosmetic-animations.json` records
rendered animation outputs. Both reach the pre-release reports and update package.
The extraction rules and their generator include the master tables, material
metadata, avatar effects and badge full art. Texture resolution requires the
exact package path; a same-named file elsewhere is not a match.

Lists, cards, tooltips and card exports remain static. Opening Info details, the
shared viewer or Build account details plays a ready reconstruction, with pause,
poster fallback and a separate GIF download. Missing sources never receive a
ready URL. The synthetic regressions cover changed raw input, compiled processors,
EN/RU normalization, runtime catalogs, actual pixels and the update ZIP.
