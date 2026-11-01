/**
 * Generates apps/web/public/game-data/wish-media-map.json from game files.
 *
 * Maps every simulacra weapon and matrix piece to a disk-verified image
 * (simulacra avatars for weapons, yizhi icons for matrices) plus EN/RU
 * names, so /tools/wish history and timelines never hardcode item art.
 * Run with `pnpm generate:wish-media-map` after any game-data refresh.
 * The JSON output is gitignored like the rest of game-data; this script
 * is the source of truth.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import {gameAsset} from '@tof-hub/game-assets';

export interface WishMediaEntry {
  kind: 'weapon' | 'matrix';
  /** Canonical rarity from the generated simulacra roster (SR=4, SSR=5). */
  rarity?: 4 | 5;
  /** Public URL (disk-verified at generation time) or null when no art ships. */
  image: string | null;
  /** Game weapon artwork; `image` remains the simulacra portrait used in pull history. */
  weapon_icon?: string | null;
  /** Tighter crop for portrait assets whose face is smaller within the same canvas. */
  portrait_zoom?: 'tight';
  name_en: string;
  name_ru: string;
  character_name_en?: string | null;
  character_name_ru?: string | null;
  weapon_name_en?: string | null;
  weapon_name_ru?: string | null;
  /** Simulacra id for weapons, suit id for matrices. */
  ref: string;
}

export interface WishMediaMap {
  version: 1;
  generatedAt: string;
  byKey: Record<string, WishMediaEntry>;
  currencyIcons: Record<string, string>;
  /** Editorial default artwork per aggregate banner (`all`, `characters`, `matrices`), resolved from the Arts catalog. */
  aggregateArtworks:Partial<Record<AggregateBanner,AggregateArtwork>>;
}

type AggregateBanner='all'|'characters'|'matrices';
type AggregateArtwork={id:string;image:string;position:{x:number;y:number};scale:number};

interface GeneratorOptions {
  publicDir?: string;
  outputFile?: string;
}

const DEFAULT_PUBLIC_DIR = path.resolve(__dirname, '../../apps/web/public');
const DEFAULT_OUTPUT = 'game-data/wish-media-map.json';

function readJson(filePath: string): any {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function isFile(filePath: string): boolean {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function toPublicUrl(publicDir: string, absolutePath: string): string {
  return '/' + path.relative(publicDir, absolutePath).split(path.sep).join('/');
}

/** Resolve a media-manifest webpPath (Windows absolute) to a public URL when the file ships. */
function manifestUrl(publicDir: string, webpPath: unknown): string | null {
  if (typeof webpPath !== 'string') return null;
  const normalized = webpPath.replace(/\\/g, '/');
  const marker = '/public/';
  const idx = normalized.toLowerCase().lastIndexOf(marker);
  if (idx < 0) return null;
  const url = normalized.slice(idx + marker.length - 1);
  const absolute = path.join(publicDir, ...url.split('/').filter((part) => part && part !== '/'));
  return isFile(absolute) ? url : null;
}

function pickTouxiang(publicDir: string, slug: string, avatarId: string): string | null {
  const dir = path.join(publicDir, 'datamine/shared/media/artworks', slug);
  let files: string[] = [];
  try {
    files = fs.readdirSync(dir).filter((f) => f.startsWith('touxiang_') && f.endsWith('.webp'));
  } catch {
    return null;
  }
  if (files.length === 0) return null;
  const candidates = [
    `touxiang_${avatarId.toLowerCase()}.webp`,
    `touxiang_${slug.replace(/-/g, '')}.webp`,
  ];
  for (const candidate of candidates) {
    if (files.includes(candidate)) return toPublicUrl(publicDir, path.join(dir, candidate));
  }
  const small = files.find((f) => f.endsWith('_s.webp'));
  return toPublicUrl(publicDir, path.join(dir, small ?? [...files].sort()[0]));
}

function addKey(map: Record<string, WishMediaEntry>, key: string | undefined, entry: WishMediaEntry): void {
  if (!key) return;
  const normalized = key.trim().toLowerCase();
  if (normalized && !map[normalized]) map[normalized] = entry;
}

export function generateWishMediaMap(options: GeneratorOptions = {}): { map: WishMediaMap; warnings: string[] } {
  const publicDir = options.publicDir ?? DEFAULT_PUBLIC_DIR;
  const warnings: string[] = [];
  const byKey: Record<string, WishMediaEntry> = {};

  const simEn = readJson(path.join(publicDir, 'game-data/en/simulacra.json')).items as any[];
  const simRu = readJson(path.join(publicDir, 'game-data/ru/simulacra.json')).items as any[];
  const ruSimById: Record<string, any> = {};
  for (const item of simRu) ruSimById[item.id] = item;

  const manifestFile = [path.join(publicDir, 'game-assets/media-manifest.json'), path.join(publicDir, 'media-manifest.json')].find(isFile);
  const manifest = manifestFile ? readJson(manifestFile) : { assets: [] };
  const manifestTouxiangByName: Record<string, string> = {};
  for (const asset of manifest.assets ?? []) {
    const rel = String(asset.relativePath ?? '');
    const match = rel.match(/touxiang_(.+)\.png$/i);
    if (match) {
      const url = manifestUrl(publicDir, asset.webpPath);
      if (url && !manifestTouxiangByName[match[1].toLowerCase()]) {
        manifestTouxiangByName[match[1].toLowerCase()] = url;
      }
    }
  }

  for (const sim of simEn) {
    const ru = ruSimById[sim.id];
    const normalizedWeaponIcon = typeof sim.icon === 'string'
      ? sim.icon.replace(
          /^\/datamine\/shared\/media\/Hotta\/Content\/Resources\//,
          '/game-assets/webp/Hotta/Content/Resources/',
        )
      : null;
    const weaponIcon = normalizedWeaponIcon && isFile(path.join(publicDir, normalizedWeaponIcon.slice(1)))
      ? normalizedWeaponIcon
      : null;
    let image = pickTouxiang(publicDir, sim.id, String(sim.avatar_id ?? sim.id));
    if (!image) {
      image =
        manifestTouxiangByName[String(sim.avatar_id ?? '').toLowerCase()] ??
        manifestTouxiangByName[String(sim.id).replace(/-/g, '').toLowerCase()] ??
        null;
    }
    if (!image) {
      const portraitIcon = path.join(
        publicDir,
        'game-assets/webp/Hotta/Content/Resources/Icon/item',
        `icon_${String(sim.avatar_id ?? sim.id).toLowerCase()}_lv2.webp`,
      );
      if (isFile(portraitIcon)) image = toPublicUrl(publicDir, portraitIcon);
    }
    if (!image) {
      const artworkDir = path.join(publicDir, 'datamine/shared/media/artworks', sim.id);
      const avatarId = String(sim.avatar_id ?? sim.id).toLowerCase();
      const avatarCandidates = [`avatar_${avatarId}_a0.webp`, `avatar_${String(sim.id).toLowerCase()}_a0.webp`];
      for (const candidate of avatarCandidates) {
        const avatarIcon = path.join(artworkDir, candidate);
        if (isFile(avatarIcon)) {
          image = toPublicUrl(publicDir, avatarIcon);
          break;
        }
      }
    }
    if (!image) warnings.push(`simulacra portrait missing for ${sim.id}`);
    const entry: WishMediaEntry = {
      kind: 'weapon',
      rarity: sim.rarity === 'SSR' ? 5 : sim.rarity === 'SR' ? 4 : undefined,
      image,
      weapon_icon: weaponIcon,
      ...(sim.id === 'berry' && image?.endsWith('/avatar_berry_a0.webp')
        ? { portrait_zoom: 'tight' as const }
        : {}),
      name_en: sim.weapon_name_en ?? sim.name_en ?? sim.id,
      name_ru: ru?.weapon_name_ru ?? ru?.name_ru ?? sim.weapon_name_en ?? sim.id,
      character_name_en: sim.name_en ?? null,
      character_name_ru: ru?.name_ru ?? sim.name_en ?? null,
      weapon_name_en: sim.weapon_name_en ?? null,
      weapon_name_ru: ru?.weapon_name_ru ?? sim.weapon_name_en ?? null,
      ref: sim.id,
    };
    addKey(byKey, sim.id, entry);
    addKey(byKey, sim.avatar_id, entry);
    addKey(byKey, sim.weapon_id, entry);
    addKey(byKey, entry.name_en, entry);
    addKey(byKey, entry.name_ru, entry);
    addKey(byKey, sim.name_en, entry);
    if (ru?.name_ru) addKey(byKey, ru.name_ru, entry);
    if (sim.weapon_name_en) addKey(byKey, sim.weapon_name_en, entry);
    if (ru?.weapon_name_ru) addKey(byKey, ru.weapon_name_ru, entry);
  }

  const matEn = readJson(path.join(publicDir, 'game-data/en/matrices.json')).items as any[];
  const matRu = readJson(path.join(publicDir, 'game-data/ru/matrices.json')).items as any[];
  const ruMatById: Record<string, any> = {};
  for (const suit of matRu) ruMatById[suit.id] = suit;

  // Matrix art ships in several manifest trees: yizhi/256, yizhi/512 and
  // yizhi/SuitAvatar (e.g. icon_matrix_SSR70_256, avatar_matrix_R1_256).
  // Index by lowercase basename so each suit can try its candidates in order.
  const manifestArt: Record<string, string> = {};
  for (const asset of manifest.assets ?? []) {
    const rel = String(asset.relativePath ?? '');
    const base = rel.split('/').pop() ?? '';
    if (!/^(icon_matrix_|avatar_matrix_)/i.test(base)) continue;
    const key = base.replace(/\.png$/i, '').toLowerCase();
    const url = manifestUrl(publicDir, asset.webpPath);
    if (url && !manifestArt[key]) manifestArt[key] = url;
  }
  const lookupManifestArt = (bases: string[]): string | null => {
    for (const base of bases) {
      const hit = manifestArt[base.toLowerCase()];
      if (hit) return hit;
    }
    return null;
  };

  // Standard-pool weapons without a simulacra carrier ship ChaJian preview
  // icons (Icon_CJ_512_Bow_Fire01 …). Index them by snake_case weapon id so
  // records like bow_fire resolve to real art.
  const manifestWeaponIcon: Record<string, string> = {};
  for (const asset of manifest.assets ?? []) {
    const rel = String(asset.relativePath ?? '');
    const match = rel.match(/Icon_CJ_512_(.+)\.png$/i);
    if (!match) continue;
    const url = manifestUrl(publicDir, asset.webpPath);
    if (!url) continue;
    const token = match[1]
      .replace(/\d+$/g, '')
      .replace(/([a-z])([A-Z])/g, '$1_$2')
      .toLowerCase();
    if (token && !manifestWeaponIcon[token]) manifestWeaponIcon[token] = url;
  }

  for (const suit of matEn) {
    const ruSuit = ruMatById[suit.id];
    const suitNum = String(suit.id).replace(/\D/g, '');
    // Suit ids look like suit_SSR70 / suit_SR12 / suit_R1: the icon file keeps
    // the same quality prefix (icon_matrix_SR12_256, not SSR12).
    const suitTag = String(suit.id).replace(/^suit_/i, '').toLowerCase();
    const iconBase = `icon_matrix_${suitTag}_256`;
    const suitIcon =
      lookupManifestArt([
        `icon_matrix_${suitTag}_256`,
        `icon_matrix_${suitTag}_512`,
        `avatar_matrix_${suitTag}_256`,
      ]) ?? null;
    for (const piece of suit.pieces ?? []) {
      const ruPiece = (ruSuit?.pieces ?? []).find(
        (p: any) => String(p.id).toLowerCase() === String(piece.id).toLowerCase(),
      );
      let image: string | null = suitIcon;
      if (!image) {
        // Carrier artworks ship per-suit 256 icons (e.g. artworks/zoey/icon_matrix_ssr70_256.webp).
        const carriers: string[] = Array.isArray(suit.carriers)
          ? suit.carriers.map((c: any) => c.char_id).filter(Boolean)
          : [];
        for (const carrier of carriers) {
          const dir = path.join(publicDir, 'datamine/shared/media/artworks', carrier);
          try {
            const hit = fs
              .readdirSync(dir)
              .find((f) => f.toLowerCase() === `${iconBase}.webp`);
            if (hit) {
              image = toPublicUrl(publicDir, path.join(dir, hit));
              break;
            }
          } catch {
            // artworks dir may not exist for every carrier
          }
        }
      }
      if (!image) warnings.push(`matrix image missing for piece ${piece.id}`);
      const entry: WishMediaEntry = {
        kind: 'matrix',
        image,
        name_en: piece.name ?? suit.name_en ?? piece.id,
        name_ru: ruPiece?.name ?? ruSuit?.name_ru ?? piece.name ?? piece.id,
        character_name_en: suit.carriers?.[0]?.char_name_en ?? null,
        character_name_ru: suit.carriers?.[0]?.char_name_ru ?? null,
        ref: suit.id,
      };
      addKey(byKey, piece.id, entry);
    }
    // Suit-level fallback key (e.g. suit_ssr70) for records that only carry a suit id.
    if (suitNum) {
      addKey(byKey, String(suit.id).toLowerCase(), {
        kind: 'matrix',
        image: suitIcon,
        name_en: suit.name_en ?? suit.id,
        name_ru: ruSuit?.name_ru ?? suit.name_en ?? suit.id,
        character_name_en: suit.carriers?.[0]?.char_name_en ?? null,
        character_name_ru: suit.carriers?.[0]?.char_name_ru ?? null,
        ref: suit.id,
      });
    }
  }

  // Resolve cashback currency artwork from the normalized item pipeline. The
  // two matrix currencies are EquipFragment_UP* and EquipFragment in game data.
  const items = Object.values(readJson(path.join(publicDir, 'game-data/en/items.json'))) as Array<{ id?: string; icon?: string }>;
  const itemImage = (itemId: string): string => {
    const icon = items.find((item) => item.id === itemId)?.icon;
    const relative = icon?.replace(/^\/datamine\/shared\/media\//, '/game-assets/webp/');
    if (!relative || relative === icon || !isFile(path.join(publicDir, relative.slice(1)))) {
      throw new Error(`Wish cashback image missing for ${itemId}`);
    }
    return relative;
  };

  // Pull selectors use the actual order currency art rather than the banner
  // character portrait. Resolve each icon from normalized game item data.
  const currencyIcons = {
    gold_nucleus: itemImage('Item_Gem_003'),
    black_nucleus: itemImage('Item_Gem_002'),
    proof_of_purchase: itemImage('item_ticket_01'),
    all_banners: itemImage('Item_Gem_001'),
    characters: itemImage('Item_Gem_004'),
    matrices: itemImage('item_ticket_02'),
  };

  // Explicit standard-pool weapons (3* / R), batteries and materials
  const STANDARD_POOL_ITEMS: Array<{
    ids: string[];
    name_en: string;
    name_ru: string;
    imagePath: string;
    kind: 'weapon' | 'matrix';
    ref: string;
  }> = [
    {
      ids: ['bow_fire', 'composite bow', 'составной лук', 'wuqi_fuhegong', 'chajian_item_weapon_sr_bow_fire01', 'bow_fire01'],
      name_en: 'Composite Bow',
      name_ru: 'Составной лук',
      imagePath: '/game-assets/webp/Hotta/Content/Resources/UI/plugin/icon/ChaJian_item_Weapon_SR_Bow_Fire01.webp',
      kind: 'weapon',
      ref: 'standard_bow_fire',
    },
    {
      ids: ['sword_thunder', 'em blade', 'электромагнитный клинок', 'эм-клинок', 'wuqi_dianciren', 'chajian_item_weapon_r_sword_thunder01', 'sword_thunder01'],
      name_en: 'EM Blade',
      name_ru: 'Электромагнитный клинок',
      imagePath: '/game-assets/webp/Hotta/Content/Resources/UI/plugin/icon/ChaJian_item_Weapon_R_Sword_Thunder01.webp',
      kind: 'weapon',
      ref: 'standard_sword_thunder',
    },
    {
      ids: ['spear_ice', 'frosted spear', 'морозное копьё', 'ледяное копьё', 'морозное копье', 'ледяное копье', 'wuqi_shuangdongchangqiang', 'cajian_item_weapon_r_spear_ice01', 'spear_ice01'],
      name_en: 'Frosted Spear',
      name_ru: 'Ледяное копьё',
      imagePath: '/game-assets/webp/Hotta/Content/Resources/UI/plugin/icon/CaJian_item_Weapon_R_Spear_Ice01.webp',
      kind: 'weapon',
      ref: 'standard_spear_ice',
    },
    {
      ids: ['digger_physic', 'combat blade', 'боевой клинок', 'ds_phy', 'wuqi_gedoudao', 'chajian_item_weapon_r_ds_phy01', 'ds_phy01'],
      name_en: 'Combat Blade',
      name_ru: 'Боевой клинок',
      imagePath: '/game-assets/webp/Hotta/Content/Resources/UI/plugin/icon/ChaJian_item_Weapon_R_Ds_Phy01.webp',
      kind: 'weapon',
      ref: 'standard_digger_physic',
    },
    {
      ids: ['weapon_exp_sr', 'weapon battery iii', 'аккумулятор оружия iii', 'аккумулятор для оружия iii', 'weapon_sr_exp01'],
      name_en: 'Weapon Battery III',
      name_ru: 'Аккумулятор оружия III',
      imagePath: '/game-assets/webp/Hotta/Content/Resources/Icon/item/Weapon_SR_Exp01.webp',
      kind: 'weapon',
      ref: 'standard_battery_sr',
    },
    {
      ids: ['weapon_exp_r', 'weapon battery ii', 'аккумулятор оружия ii', 'аккумулятор для оружия ii', 'weapon_r_exp01', 'battery 2', 'battery ii', 'батарея 2', 'аккумулятор 2'],
      name_en: 'Weapon Battery II',
      name_ru: 'Аккумулятор оружия II',
      imagePath: '/game-assets/webp/Hotta/Content/Resources/Icon/item/Weapon_R_Exp01.webp',
      kind: 'weapon',
      ref: 'standard_battery_r',
    },
    {
      ids: ['weapon_exp_n', 'weapon battery i', 'аккумулятор оружия i', 'аккумулятор для оружия i', 'weapon_n_exp01'],
      name_en: 'Weapon Battery I',
      name_ru: 'Аккумулятор оружия I',
      imagePath: '/game-assets/webp/Hotta/Content/Resources/Icon/item/Weapon_N_Exp01.webp',
      kind: 'weapon',
      ref: 'standard_battery_n',
    },
    {
      ids: ['weaponfragment_up74', 'weaponfragment_up_74', 'ui_up_zuoyi_wq_icon', 'ui_up_lyra_wq_icon'],
      name_en: 'Flame Gold (Zoey)',
      name_ru: 'Огненное золото (Зои)',
      imagePath: '/datamine/shared/media/artworks/zoey/UI_UP_zuoyi_WQ_Icon.webp',
      kind: 'weapon',
      ref: 'currency_flame_gold_zoey',
    },
    {
      ids: ['flame_gold', 'flame gold', 'огненное золото', 'weaponfragment_up'],
      name_en: 'Flame Gold',
      name_ru: 'Огненное золото',
      imagePath: '/game-assets/webp/Hotta/Content/Resources/Icon/huobi/weaponfragment_up.webp',
      kind: 'weapon',
      ref: 'currency_flame_gold',
    },
    {
      ids: ['black_gold', 'black gold', 'черное золото', 'weaponfragment_', 'weaponfragment'],
      name_en: 'Black Gold',
      name_ru: 'Чёрное золото',
      imagePath: '/game-assets/webp/Hotta/Content/Resources/Icon/huobi/weaponfragment.webp',
      kind: 'weapon',
      ref: 'currency_black_gold',
    },
    {
      ids: ['overclocking_chip', 'overclocking chip', 'overclocking chips', 'чипы', 'чип'],
      name_en: 'Overclocking Chip',
      name_ru: 'Чип разгона',
      imagePath: itemImage('EquipFragment_UP1'),
      kind: 'matrix',
      ref: 'currency_overclocking_chip',
    },
    {
      ids: ['base_chip', 'base chip', 'базовый чип'],
      name_en: 'Base Chip',
      name_ru: 'Базовый чип',
      imagePath: itemImage('EquipFragment'),
      kind: 'matrix',
      ref: 'currency_base_chip',
    },
  ];

  for (const item of STANDARD_POOL_ITEMS) {
    const entry: WishMediaEntry = {
      kind: item.kind,
      image: item.imagePath,
      name_en: item.name_en,
      name_ru: item.name_ru,
      ref: item.ref,
    };
    for (const key of item.ids) {
      addKey(byKey, key, entry);
    }
  }

  // Standard-pool weapons without a carrier: image-only entries keyed by
  // weapon id. Names stay empty so the resolver always prefers the record's
  // own names.
  for (const [token, image] of Object.entries(manifestWeaponIcon)) {
    if (byKey[token]) continue;
    byKey[token] = { kind: 'weapon', image, name_en: '', name_ru: '', ref: 'standard' };
  }

  const artsPath=path.join(publicDir,'game-data/en/arts.json');
  const arts=isFile(artsPath)?readJson(artsPath):{items:[]};
  // Editorial presentation chosen by the user on the live banner; the image itself is a generated game asset.
  const AGGREGATE_ARTWORKS:Record<AggregateBanner,{id:string;position:{x:number;y:number};scale:number}>={
    all:{id:'loading_loading21',position:{x:47.7364,y:54.0165},scale:2.75},
    characters:{id:'gashapon_btz_bg_btz',position:{x:51.2,y:51.6},scale:2.64},
    matrices:{id:'gashapon_tzxf_bg_tzxf',position:{x:48,y:47.6},scale:2.59},
  };
  const aggregateArtworks:WishMediaMap['aggregateArtworks']={};
  for(const [aggregate,choice] of Object.entries(AGGREGATE_ARTWORKS) as [AggregateBanner,typeof AGGREGATE_ARTWORKS['all']][]) {
    const selected=arts.items?.find((art:any)=>art.id===choice.id);
    const selectedUrl=selected?gameAsset(selected.webpUrl||selected.url):undefined;
    if(selectedUrl&&fs.existsSync(path.join(publicDir,selectedUrl)))aggregateArtworks[aggregate]={id:choice.id,image:selectedUrl,position:choice.position,scale:choice.scale};
    else warnings.push(`Wish ${aggregate} artwork ${choice.id} is unavailable in the Arts catalog.`);
  }
  return {
    map: { version: 1, generatedAt: new Date().toISOString(), byKey, currencyIcons,aggregateArtworks },
    warnings,
  };
}

// CLI entry point
if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('generate-wish-media-map/index.ts')) {
  const { map, warnings } = generateWishMediaMap();
  const output = path.join(DEFAULT_PUBLIC_DIR, DEFAULT_OUTPUT);
  fs.writeFileSync(output, JSON.stringify(map, null, 1) + '\n');
  const images = Object.values(map.byKey).filter((e) => e.image).length;
  console.log(`wish media map: ${Object.keys(map.byKey).length} keys, ${images} with images -> ${output}`);
  if (warnings.length > 0) {
    console.log(`warnings (${warnings.length}):`);
    for (const warning of warnings.slice(0, 20)) console.log(`  - ${warning}`);
  }
}
