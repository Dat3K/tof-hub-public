import fs from 'node:fs';
import path from 'node:path';

// Pull records are synthetic; banner dates, featured IDs and item labels are
// selected from the generated game-data registry rather than copied into UI code.
// The demo identity (nickname, UID, avatar and frame) mirrors the Build card demo
// (`build-page.json` demoDraft) so both tools present the same example account.
const root = path.resolve(__dirname, '..', '..');
const dataDir = path.join(root, 'apps', 'web', 'public', 'game-data');
type Banner = {
  id: string;
  banner_type: string;
  start_date: string;
  end_date: string;
  featured_ssr: string[];
  assets?: { background?: string; splash?: string };
};
type Media = { name_en?: string; name_ru?: string; image?: string };
const banners = JSON.parse(fs.readFileSync(path.join(dataDir, 'wish-banners.json'), 'utf8')) as Banner[];
const media = (JSON.parse(fs.readFileSync(path.join(dataDir, 'wish-media-map.json'), 'utf8')) as {
  byKey: Record<string, Media>;
}).byKey;

const item = (id: string, slot?: string) => {
  const entry = media[id.toLowerCase()];
  if (!entry?.name_en || !entry?.name_ru || !entry.image) {
    throw new Error(`Missing wish demo media for ${id}`);
  }
  return { id, name: entry.name_en, nameRu: entry.name_ru, ...(slot ? { slot } : {}) };
};

const selected = [
  'weapon-agleia', 'matrix-agleia', 'weapon-berry', 'matrix-berry', 'weapon-gefion',
  'weapon-zoey', 'matrix-zoey',
];
const result = selected.map((id) => {
  const banner = banners.find((candidate) => candidate.id === id);
  if (!banner?.featured_ssr[0] || !banner.assets?.background || !banner.assets?.splash) {
    throw new Error(`Incomplete wish demo banner ${id}`);
  }
  const matrix = banner.banner_type === 'matrix_limited';
  const suit = banner.featured_ssr[0].match(/^suit_(SSR\d+)$/i)?.[1];
  if (matrix && !suit) throw new Error(`Invalid matrix suit on ${id}`);
  return {
    id: banner.id,
    bannerType: banner.banner_type,
    startDate: banner.start_date,
    endDate: banner.end_date,
    featuredItems: matrix
      ? (['mind', 'memory', 'belief', 'emotion'] as const).map((slot, index) => item(`matrix_${suit}_${index + 1}`, slot))
      : [item(banner.featured_ssr[0])],
  };
});
fs.writeFileSync(path.join(dataDir, 'wish-demo-banners.json'), `${JSON.stringify(result, null, 2)}\n`);
console.log('Generated wish-demo-banners.json from banner and media registries');

type Cosmetic = { id: string; icon: string; canvas?: { width: number; height: number; centerX: number; centerY: number } };
const build = JSON.parse(fs.readFileSync(path.join(dataDir, 'build-page.json'), 'utf8')) as {
  demoDraft: { profile: { name: string; uid: string; avatarId: string; avatarFrameId?: string } };
  avatars: Cosmetic[];
  avatarFrames?: Cosmetic[];
};
const demo = build.demoDraft.profile;
const cosmetic = (items: Cosmetic[] | undefined, id: string | undefined) => {
  if (!id) return undefined;
  const found = items?.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`Missing Build demo cosmetic ${id}`);
  return { icon: found.icon, ...(found.canvas ? { canvas: found.canvas } : {}) };
};
if (!demo.name || !/^\d+$/.test(demo.uid)) throw new Error('Build demo profile has no nickname or numeric UID');
const profile = {
  nickname: demo.name,
  uid: demo.uid,
  avatar: cosmetic(build.avatars, demo.avatarId),
  avatarFrame: cosmetic(build.avatarFrames, demo.avatarFrameId),
};
fs.writeFileSync(path.join(dataDir, 'wish-demo-profile.json'), `${JSON.stringify(profile, null, 2)}
`);
console.log('Generated wish-demo-profile.json from the Build card demo profile');
