/** Exact raw bindings shared by cosmetics extraction and its coverage tests. */
export const COSMETIC_TABLES = {
  tools: 'Hotta/Content/Resources/CoreBlueprints/DataTable/ToolStaticDataTable.json',
  emblems: 'Hotta/Content/Resources/CoreBlueprints/DataTable/EmblemConfigDataTable.json',
  mountSkins: 'Hotta/Content/Resources/CoreBlueprints/DataTable/MountSkinConfigDataTable.json',
  emoji: 'Hotta/Content/SevenForest/Data/DT_Emoji.json',
  bigEmoji: 'Hotta/Content/SevenForest/Data/DT_BigEmoji.json',
  hugeEmoji: 'Hotta/Content/SevenForest/Data/DT_ChatHugeEmoji.json',
  emojiTags: 'Hotta/Content/SevenForest/Data/DT_ChatEmojiTag.json',
} as const;

const EMOJI_TOOL_TYPES = {
  static: 'STATIC_TOOL_TYPE_UNLOCK_EMOJI',
  dynamic: 'STATIC_TOOL_TYPE_UNLOCK_DYNAMIC_EMOJI',
} as const;

export function assetReference(value: unknown): string | undefined {
  const ref = typeof value === 'string' ? value : (value as {AssetPathName?: string})?.AssetPathName;
  return ref && ref !== 'None' && ref !== 'null' ? ref : undefined;
}

export function avatarAnimationSource(row: Record<string, any>) {
  const references = ['Material', 'Material2', 'ParticleAsset'].flatMap(field => {
    const asset = assetReference(row[field]);
    return asset ? [{field, asset}] : [];
  });
  return references.length ? {status: 'unresolved' as const, kind: 'material' as const, references} : undefined;
}

/** Packs/fragments are excluded: only an exact item -> unlock-tool join establishes an emoji. */
export function chatStickerSources(items: Record<string, any>, tools: Record<string, any>) {
  return Object.entries(items).flatMap(([id, item]) => {
    const tool = tools[item.StaticToolName];
    const dynamic = tool?.StaticToolType === 'STATIC_TOOL_TYPE_UNLOCK_DYNAMIC_EMOJI';
    if (!dynamic && tool?.StaticToolType !== 'STATIC_TOOL_TYPE_UNLOCK_EMOJI') return [];
    return [{id, item, toolId: item.StaticToolName, emojiId: String(tool.ToolValue),
      animation: dynamic ? {status: 'unresolved' as const, kind: 'dynamic-emoji' as const,
        references: [{field: 'ToolValue', value: String(tool.ToolValue)}]} : undefined}];
  });
}

type EmojiKind = 'static' | 'dynamic' | 'huge';

/**
 * The chat panel's master tables define every sticker, including free rows without an item.
 * A locked row's ItemId must join back through StaticToolName -> ToolValue to the same row key.
 */
export function chatStickerCatalog(tables: {emoji?: Record<string, any>; bigEmoji?: Record<string, any>; hugeEmoji?: Record<string, any>},
  items: Record<string, any>, tools: Record<string, any>) {
  const issues: Array<{table: string; row: string; reason: string}> = [];
  const stickers: Array<{id: string; table: keyof typeof tables; row: string; kind: EmojiKind; locked: boolean;
    tagId?: string; item?: Record<string, any>; itemId?: string; toolId?: string; image?: string; imageField?: string;
    animation?: {status: 'unresolved'; kind: 'dynamic-emoji'; references: Array<{field: string; asset?: string; value?: string}>}}> = [];
  const add = (table: keyof typeof tables, row: string, entry: Record<string, any>, kind: EmojiKind) => {
    const itemId = entry.ItemId && entry.ItemId !== 'None' ? String(entry.ItemId) : undefined;
    const item = itemId ? items[itemId] : undefined;
    const tool = item ? tools[item.StaticToolName] : undefined;
    if (itemId && !item) issues.push({table, row, reason: `ItemId ${itemId} has no ItemConfigs row`});
    if (item && (kind === 'huge' || tool?.StaticToolType !== EMOJI_TOOL_TYPES[kind] || String(tool.ToolValue) !== row)) {
      issues.push({table, row, reason: `ItemId ${itemId} unlocks ${tool?.StaticToolType ?? 'no tool'}=${tool?.ToolValue ?? ''}, not this row`});
    }
    const material = kind === 'static' ? undefined
      : kind === 'dynamic' ? assetReference(entry.EmojiBrush) : entry.ImgBrush?.ResourceObject?.ObjectPath;
    stickers.push({
      id: itemId ?? (kind === 'static' ? `emoji_${row}` : kind === 'huge' ? `huge_emoji_${row}` : row),
      table, row, kind, locked: entry.IsLock === true, tagId: entry.TagId && entry.TagId !== 'None' ? entry.TagId : undefined,
      item, itemId: item ? itemId : undefined, toolId: item?.StaticToolName,
      image: kind === 'static' ? assetReference(entry.EmojiTexture) : assetReference(item?.ItemIcon),
      imageField: kind === 'static' ? 'EmojiTexture' : item ? 'ItemIcon' : undefined,
      animation: material ? {status: 'unresolved', kind: 'dynamic-emoji',
        references: [{field: kind === 'dynamic' ? 'EmojiBrush' : 'ImgBrush.ResourceObject', asset: material}]} : undefined,
    });
  };
  for (const [row, entry] of Object.entries(tables.emoji ?? {})) add('emoji', row, entry, 'static');
  for (const [row, entry] of Object.entries(tables.bigEmoji ?? {})) add('bigEmoji', row, entry, 'dynamic');
  for (const [row, entry] of Object.entries(tables.hugeEmoji ?? {})) add('hugeEmoji', row, entry, 'huge');
  const joined = new Set(stickers.flatMap(sticker => sticker.itemId ? [sticker.itemId] : []));
  const unlockItemsWithoutRow = chatStickerSources(items, tools).filter(source => !joined.has(source.id))
    .map(({id, toolId, emojiId}) => ({id, toolId, emojiId}));
  return {stickers, issues, unlockItemsWithoutRow};
}

const FLIPBOOK_FUNCTION = 'Engine/Content/Functions/Engine_MaterialFunctions02/Texturing/FlipBook.0';

interface MaterialEvidence {
  chain: Array<{packagePath: string; type: string; name: string}>;
  scalars: Record<string, {value: number; packagePath: string; field: string}>;
  textures: Record<string, {asset: string; size?: {x: number; y: number}; packagePath: string; field: string}>;
  baseMaterialFunctions: string[];
}

/**
 * Chat emoji materials end in UI_Main_01, whose cooked data lists the engine FlipBook function but
 * not its wiring. Inferred reading (docs/info/cosmetics/media-pipeline.md): `V` columns x `U` rows of
 * `UI_Tex_01`, row-major, one infinite loop every `1 / Speed` seconds. Anything else is rejected.
 */
export function emojiFlipbookRecipe(material: MaterialEvidence) {
  return flipbookRecipe(material);
}

/**
 * Avatar effects share UI_Main_01. Only instances that set their own U/V grid carry a frame sequence
 * (e.g. a 3x3 face atlas); BaseTex02 is drawn over every frame and the icon is shown in a circle.
 * Frame 0 composed this way matches the game's static item icon (docs/info/cosmetics/media-pipeline.md).
 * Panning detail, pulse and particle layers are not reproduced.
 */
export function avatarFlipbookRecipe(material: MaterialEvidence) {
  const explicit = ['U', 'V'].every(name => material.scalars[name] && !material.scalars[name].field.startsWith('CachedExpressionData'));
  if (!explicit) return {rejection: 'shader-only effect: the material instance sets no U/V frame grid'};
  const overlay = material.textures.BaseTex02;
  const result = flipbookRecipe(material);
  if (!result.recipe) return result;
  return {recipe: {...result.recipe, mask: 'circle' as const,
    ...(overlay ? {overlay: overlay.asset} : {}),
    provenance: [...result.recipe.provenance,
      ...(overlay ? [{file: `${overlay.packagePath}.json`, object: overlay.packagePath.split('/').pop()!, fields: [`${overlay.field} (BaseTex02)`]}] : [])]}};
}

function flipbookRecipe(material: MaterialEvidence) {
  const base = material.chain.at(-1);
  if (base?.type !== 'Material' || !material.baseMaterialFunctions.includes(FLIPBOOK_FUNCTION)) {
    return {rejection: 'base material does not use the engine FlipBook function'};
  }
  const [rows, columns, speed] = ['U', 'V', 'Speed'].map(name => material.scalars[name]?.value);
  const atlas = material.textures.UI_Tex_01;
  if (!Number.isInteger(rows) || !Number.isInteger(columns) || rows < 1 || columns < 1 || rows * columns < 2) {
    return {rejection: `grid U=${rows} V=${columns} is not a multi-frame integer grid`};
  }
  if (!(speed > 0)) return {rejection: `Speed=${speed} is not positive`};
  if (!atlas?.size || atlas.size.x % columns || atlas.size.y % rows) {
    return {rejection: `UI_Tex_01 ${atlas?.size ? `${atlas.size.x}x${atlas.size.y}` : 'size'} does not divide into ${columns}x${rows}`};
  }
  const width = atlas.size.x / columns;
  const height = atlas.size.y / rows;
  const count = rows * columns;
  const delayMs = 1000 / speed / count;
  const source = (name: 'U' | 'V' | 'Speed') => ({file: `${material.scalars[name].packagePath}.json`, object: material.scalars[name].packagePath.split('/').pop()!,
    fields: [`${material.scalars[name].field} (${name})`]});
  return {recipe: {
    atlas: atlas.asset, loop: 0,
    frames: Array.from({length: count}, (_, index) => ({left: (index % columns) * width, top: Math.floor(index / columns) * height, width, height, delayMs})),
    provenance: [source('U'), source('V'), source('Speed'),
      {file: `${atlas.packagePath}.json`, object: atlas.packagePath.split('/').pop()!, fields: [`${atlas.field} (UI_Tex_01)`]},
      {file: `${base.packagePath}.json`, object: base.name, fields: ['CachedExpressionData.FunctionInfos (FlipBook)']}],
  }};
}

/** Preserve exact default-skin/item bindings; never infer a texture from the mount's number. */
export function mountImageCandidates(id: string, mount: Record<string, any>, skins: Record<string, any>, items: Record<string, any>) {
  const candidates: Array<{asset: string; table: string; row: string; field: string}> = [];
  const add = (value: unknown, table: string, row: string, field: string) => {
    const asset = assetReference(value);
    if (asset && !candidates.some(candidate => candidate.asset === asset)) candidates.push({asset, table, row, field});
  };
  const skin = skins[mount.DefaultSkinId];
  if (skin?.OwnerMountId === id) add(skin.BigImage, COSMETIC_TABLES.mountSkins, mount.DefaultSkinId, 'BigImage');
  const parts = (mount.NeedItemArray ?? []).map((entry: any) => entry.ItemId);
  for (const [itemId, item] of Object.entries(items) as Array<[string, any]>) {
    if (item.MountId !== id || !['ITEM_TYPE_MOUNT', 'ITEM_TYPE_MOUNT_SKIN'].includes(item.ItemType)) continue;
    if (parts.length > 1 && parts.includes(itemId)) continue;
    if (item.ItemType === 'ITEM_TYPE_MOUNT_SKIN' && item.StaticToolName !== mount.DefaultSkinId) continue;
    add(item.ItemIcon, 'ItemConfigs', itemId, 'ItemIcon');
  }
  add(mount.ShowImage, 'MountConfigDataTable', id, 'ShowImage');
  add(mount.Icon, 'MountConfigDataTable', id, 'Icon');
  return candidates;
}
