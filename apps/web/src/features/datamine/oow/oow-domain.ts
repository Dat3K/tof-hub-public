import type { OowFloor, OowEnemy, OowMainEnemyItem, OowHpUnit, OowSeasonSummary } from './oow-types';
import { normalizeAssetPath } from '@tof-hub/game-assets';

export function getOowMobLinkId(search: string, hash: string): string | null {
  const hashMob = new URLSearchParams(hash.replace(/^#/, '')).get('mob');
  const queryMob = new URLSearchParams(search).get('mob');
  return hashMob || queryMob || null;
}

export function createOowMobHash(mobId: string | null): string {
  if (!mobId) return '';
  return `#${new URLSearchParams({ mob: mobId }).toString()}`;
}

export function extractBossNumber(value: unknown): number | null {
  if (!value) return null;
  const match = String(value).match(/boss(?:_hum)?[\s_]*#?0*(\d+)/i);
  return match ? parseInt(match[1], 10) : null;
}

export function resolveFceBoss(monster: any, fceIndex?: any): any | null {
  if (!monster) return null;
  const isBoss =
    monster.monsterType === 'BS_MONSTER_BOSS' ||
    monster.type === 'boss' ||
    monster.isBoss ||
    monster.enemyKind === 'boss' ||
    /boss/i.test(monster.codeName || '') ||
    /boss/i.test(monster.bossId || '') ||
    /boss/i.test(monster.blueprint || '') ||
    /boss/i.test(monster.monsterClass || '') ||
    /boss/i.test(monster.normalizedMonsterClass || '') ||
    /boss/i.test(monster.nameEn || '') ||
    /boss/i.test(monster.nameRu || '');

  if (!isBoss) return null;

  const code = String(
    monster.codeName ||
      monster.blueprint ||
      monster.bossId ||
      monster.id ||
      monster.normalizedMonsterClass ||
      monster.monsterClass ||
      ''
  ).toLowerCase();
  const nameEn = String(monster.nameEn || monster.name || '').trim().toLowerCase();
  const nameRu = String(monster.nameRu || '').trim().toLowerCase();

  // 1. Specific known non-FCE OoW bosses
  if (
    /boss_hum_061_shtt|061_shtt/i.test(code) ||
    /zhuge|zhuque|朱雀/i.test(code) ||
    /zhuge/i.test(nameEn) ||
    /чжугэ|чжуцюэ/i.test(nameRu)
  ) {
    return {
      slug: 'zhuge-chen',
      boss_id: 'Boss_hum_061_SHTT',
      boss_num: 61,
      name: 'Zhuge Chen',
      name_ru: 'Чжугэ Чэнь',
      name_color: '#ff6644',
      art: '/datamine/shared/media/Hotta/Content/Resources/UI/void/boss/bigboss061.webp',
      preview: '/datamine/shared/media/Hotta/Content/Resources/UI/void/boss/Boss_hum_061.webp',
      lineupPortrait: '/datamine/shared/media/Hotta/Content/Resources/UI/void/boss/Boss_hum_061.webp',
      lineupPortraitThumb: '/datamine/shared/media/Hotta/Content/Resources/UI/void/boss/Boss_hum_061.webp',
      detailImage: '/datamine/shared/media/Hotta/Content/Resources/UI/void/boss/bigboss061.webp',
      hasMechanics: false,
    };
  }

  if (
    /boss_038_balance|038_balance/i.test(code) ||
    /devourer/i.test(code) ||
    /devourer/i.test(nameEn) ||
    (/пожиратель/i.test(nameRu) && !/потрошитель/i.test(nameRu))
  ) {
    const isMmo = fceIndex?.mode === 'mmo';
    const devourerImage = isMmo
      ? '/datamine/shared/media/Hotta/Content/Resources/UI/WorldBossList/BOSS/Boss_7.webp'
      : '/datamine/shared/media/Hotta/Content/Resources/UI/void/boss/mon_hum_038.webp';

    return {
      slug: 'devourer',
      boss_id: 'boss_038_Balance',
      boss_num: 38,
      name: 'Devourer',
      name_ru: 'Пожиратель',
      name_color: '#d480ff',
      art: devourerImage,
      preview: devourerImage,
      lineupPortrait: devourerImage,
      lineupPortraitThumb: devourerImage,
      detailImage: devourerImage,
      hasMechanics: false,
    };
  }

  if (/boss_hum_026|boss_026|longxiao/i.test(code) || /seele/i.test(nameEn) || /зеле/i.test(nameRu)) {
    return {
      slug: 'seele',
      name: 'Seele',
      name_ru: 'Зеле',
      art: '/datamine/shared/media/Hotta/Content/Resources/UI/void/boss/bigboss009.webp',
      preview: '/datamine/shared/media/Hotta/Content/Resources/UI/void/boss/bigboss009.webp',
      mechanics_count: 0,
      hasMechanics: false,
    };
  }

  if (
    /boss_hum_022|boss_022|boss_hum_035|boss_035/i.test(code) ||
    /aegis/i.test(nameEn) ||
    /эгида|иджис/i.test(nameRu)
  ) {
    return {
      slug: 'aegis',
      name: 'Aegis',
      name_ru: 'Эгида',
      art: '/datamine/shared/media/Hotta/Content/Resources/UI/void/boss/bigboss010.webp',
      preview: '/datamine/shared/media/Hotta/Content/Resources/UI/void/boss/bigboss010.webp',
      mechanics_count: 0,
      hasMechanics: false,
    };
  }

  if (/boss_hum_072|boss_072/i.test(code) || /weaver/i.test(nameEn) || /ткач/i.test(nameRu)) {
    return {
      slug: 'weaver',
      name: 'Weaver',
      name_ru: 'Ткач',
      art: '/datamine/shared/media/Hotta/Content/Resources/UI/void/boss/Boss_hum_072.webp',
      preview: '/datamine/shared/media/Hotta/Content/Resources/UI/void/boss/Boss_hum_072.webp',
      mechanics_count: 0,
      hasMechanics: false,
    };
  }

  if (/boss_038|boss_029|ripper/i.test(code) || /потрошитель/i.test(nameRu)) {
    return {
      slug: 'ripper',
      boss_id: 'boss_038',
      boss_num: 38,
      name: 'Ripper',
      name_ru: 'Потрошитель',
      name_color: '#d480ff',
      art: '/datamine/shared/media/Hotta/Content/Resources/UI/void/boss/bigboss_SY_07.webp',
      preview: '/datamine/shared/media/Hotta/Content/Resources/UI/void/boss/bigboss_SY_07.webp',
      hasMechanics: false,
    };
  }

  if (/058/i.test(code) || /quasivita/i.test(nameEn) || /квазивита/i.test(nameRu)) {
    const quasivitaImage = '/datamine/shared/media/Hotta/Content/Resources/UI/void/boss/boss_hum_058.webp';
    return {
      slug: 'quasivita',
      name: 'Quasivita',
      name_ru: 'Квазивита',
      art: quasivitaImage,
      preview: quasivitaImage,
      mechanics_count: 0,
      hasMechanics: false,
    };
  }

  if (/055/i.test(code) || /taotie/i.test(nameEn) || /таоте/i.test(nameRu)) {
    return {
      slug: 'taotie',
      name: 'Taotie',
      name_ru: 'Таоте',
      art: '/datamine/shared/media/Hotta/Content/Resources/UI/void/boss/TX_boss_hum_055.webp',
      preview: '/datamine/shared/media/Hotta/Content/Resources/UI/void/boss/TX_boss_hum_055.webp',
      mechanics_count: 0,
      hasMechanics: false,
    };
  }

  // 2. Direct name or ID matching in fceIndex (canonical FCE catalog)
  if (Array.isArray(fceIndex?.bosses)) {
    const directMatch = fceIndex.bosses.find((b: any) => {
      const bName = String(b.name || '').trim().toLowerCase();
      const bNameRu = String(b.name_ru || '').trim().toLowerCase();
      const bSlug = String(b.slug || '').trim().toLowerCase();
      const bId = String(b.boss_id || '').trim().toLowerCase();
      return (
        (nameEn && (bName === nameEn || bSlug === nameEn)) ||
        (nameRu && bNameRu === nameRu) ||
        (code &&
          (bId === code ||
            bSlug === code ||
            (code.includes('barbarossa') && bSlug === 'barbarossa')))
      );
    });
    if (directMatch) return directMatch;
  }

  // 3. Match by numeric identifier
  if (/061_shtt/i.test(code)) return null;
  const num = extractBossNumber(code || nameEn || nameRu);
  if (num != null && Array.isArray(fceIndex?.bosses)) {
    const found = fceIndex.bosses.find(
      (b: any) =>
        Number(b.boss_num) === num || extractBossNumber(b.boss_id || b.slug) === num
    );
    if (found) return found;
  }

  return null;
}

export interface OowEnemyPresentation {
  nameEn: string;
  nameRu: string;
  color: string | null;
  avatar: string | null;
  detailImage: string | null;
  detailImagePng: string | null;
  fce: any | null;
}

/**
 * Applies the legacy OoW identity overrides without changing the materialized
 * game record. Legacy names are presentation data: raw exports may identify a
 * boss by code while the UI uses the curated in-game name.
 */
export function getEnemyPresentation(monster: any, fceIndex?: any): OowEnemyPresentation {
  const fce = resolveFceBoss(monster, fceIndex);
  const fallbackNameEn = String(monster?.nameEn || monster?.name || 'Boss');
  const fallbackNameRu = String(monster?.nameRu || monster?.nameEn || 'Босс');
  const fceDetailImage = fce?.detailImage || fce?.displayWebpUrl || fce?.lineupPortrait || fce?.art;
  const detailImage = fceDetailImage || monster?.detailImageFull || monster?.image || null;
  const detailPath = normalizeAssetPath(detailImage).normalizedPath;
  const detailImagePng = detailPath && [fce?.downloadPngUrl, monster?.detailImagePng, monster?.imagePng]
    .find((candidate) => candidate && normalizeAssetPath(candidate).normalizedPath === detailPath);

  return {
    nameEn: String(fce?.name || fce?.nameEn || fallbackNameEn),
    nameRu: String(fce?.name_ru || fce?.nameRu || fallbackNameRu),
    color: fce?.name_color || fce?.color || null,
    avatar: fce?.cardThumbnail || fce?.lineupPortraitThumb || fce?.preview || fce?.art || monster?.lineupPortraitThumb || monster?.imageThumb || monster?.image || null,
    detailImage,
    detailImagePng: detailImagePng || null,
    fce,
  };
}

export function pluralRu(count: number, one: string, few: string, many: string): string {
  const mod100 = Math.abs(count) % 100;
  const mod10 = mod100 % 10;
  if (mod100 > 10 && mod100 < 20) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

export function formatMobsCount(count: number, isRu: boolean): string {
  if (isRu) {
    return `${count} ${pluralRu(count, 'моб', 'моба', 'мобов')}`;
  }
  return count === 1 ? '1 mob' : `${count} mobs`;
}

/** Matches the legacy OoW resistance presentation (one decimal percent). */
export function formatResistancePercent(value: number | null | undefined): string {
  return (Number.isFinite(value) ? Number(value) : 85).toFixed(1);
}

export function getEnemyEffectiveHp(e: OowEnemy): number {
  if (typeof e.effectiveHp === 'number' && e.effectiveHp > 0) return e.effectiveHp;
  if (typeof (e as any).effHp === 'number' && (e as any).effHp > 0) return (e as any).effHp;
  if (typeof e.combinedHp === 'number' && e.combinedHp > 0) return e.combinedHp;
  if (typeof e.hp === 'number' && e.hp > 0) return e.hp;
  return 0;
}

export function buildMainEnemiesList(
  floor: OowFloor | undefined,
  fceIndex: any,
  isRu: boolean
): OowMainEnemyItem[] {
  if (!floor) return [];
  const enemies = floor.enemies || [];
  if (!enemies.length) {
    const count = floor.mobCount || 0;
    return count > 0
      ? [
          {
            isBoss: false,
            isMobCount: true,
            label: formatMobsCount(count, isRu),
            hasSeparator: false,
          },
        ]
      : [];
  }

  const indexed = enemies.map((e, i) => ({ e, i, wave: e.wave || 1 }));
  const encounteredBosses: Array<{
    isBoss: boolean;
    name: string;
    color: string | null;
    avatar: string | null;
    fallbackAvatar: string | null;
    hp: number;
    wave: number;
    i: number;
  }> = [];
  let mobCount = 0;

  for (const { e, i, wave } of indexed) {
    const isBoss =
      e.monsterType === 'BS_MONSTER_BOSS' ||
      e.enemyKind === 'boss' ||
      /boss/i.test(e.codeName || '') ||
      /boss/i.test(e.bossId || '') ||
      /boss/i.test(e.nameEn || '');

    const count = e.count || 1;

    if (isBoss) {
      const presentation = getEnemyPresentation(e, fceIndex);
      let name = isRu ? presentation.nameRu : presentation.nameEn;
      let color: string | null = null;
      let avatar: string | null = null;
      let fallbackAvatar: string | null = null;

      const fce = presentation.fce;
      if (fce) {
        name = isRu ? (fce.name_ru || fce.name || name) : (fce.name || fce.name_ru || name);
        color = presentation.color;
        avatar = fce.cardThumbnail || fce.lineupPortraitThumb || fce.preview || fce.art || null;
        fallbackAvatar = fce.displayWebpUrl || fce.lineupPortrait || fce.art || null;
      }

      if (!avatar) {
        avatar =
          e.lineupPortraitThumb ||
          e.imageThumb ||
          e.image ||
          '/datamine/shared/media/Hotta/Content/Resources/UI/void/boss/placeholder-boss.webp';
        fallbackAvatar = e.lineupPortraitFull || e.image || avatar;
      }

      if (!name) name = isRu ? 'Босс' : 'Boss';
      const hp = getEnemyEffectiveHp(e);

      for (let k = 0; k < count; k++) {
        encounteredBosses.push({
          isBoss: true,
          name,
          color,
          avatar,
          fallbackAvatar,
          hp,
          wave,
          i,
        });
      }
    } else {
      mobCount += count;
    }
  }

  // Sort bosses by HP descending
  encounteredBosses.sort((a, b) => {
    if (b.hp !== a.hp) return b.hp - a.hp;
    if (b.wave !== a.wave) return b.wave - a.wave;
    return b.i - a.i;
  });

  const items: OowMainEnemyItem[] = [...encounteredBosses];
  if (mobCount > 0) {
    items.push({
      isBoss: false,
      isMobCount: true,
      label: formatMobsCount(mobCount, isRu),
    });
  }

  return items.map((item, index) => ({
    ...item,
    hasSeparator: index < items.length - 1,
  }));
}

export function formatHpValue(num: number, unit: OowHpUnit): { value: string; unitLabel: string } {
  if (unit === 'RAW') {
    return {
      value: num.toLocaleString('en-US'),
      unitLabel: '',
    };
  }
  if (unit === 'M') {
    return {
      value: (num / 1e6).toFixed(1),
      unitLabel: 'M',
    };
  }
  // Default 'G'
  if (num >= 1e12) {
    return {
      value: (num / 1e12).toFixed(2),
      unitLabel: 'T',
    };
  }
  const billions = num / 1e9;
  return { value: billions >= 10 ? billions.toFixed(1) : billions.toFixed(2), unitLabel: 'G' };
}

export function formatPercentDelta(deltaPct: number): { text: string; color: string; bg: string } {
  const isPositive = deltaPct > 0;
  const isZero = deltaPct === 0;
  const sign = isPositive ? '+' : '';
  const text = isZero ? '0%' : `${sign}${deltaPct.toFixed(1)}%`;
  const color = isPositive ? '#ff7d95' : (isZero ? '#cbc2de' : '#4fe3c1');
  const bg = isPositive ? 'rgba(255,125,149,.15)' : (isZero ? 'rgba(255,255,255,.05)' : 'rgba(79,227,193,.15)');
  return { text, color, bg };
}

/**
 * Calculates a unique, deterministic, harmonious color for any OoW season.
 * Preserves the exact mathematical coprime hue distribution from legacy:
 * ((s * 47 + 18) % 360) with 68% saturation and 64% lightness.
 */
export function getSeasonColor(season: number): string {
  const hue = Math.round((season * 47 + 18) % 360);
  return `hsl(${hue} 68% 64%)`;
}

function parseSeasonDay(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const time = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(time) ? null : time;
}

/**
 * Returns the season whose [startDate, endDate] range contains today, or null
 * when no season matches (gaps between seasons, missing dates). The optional
 * `now` parameter exists for deterministic tests.
 */
export function getLiveSeasonNumber(
  seasons: Array<{ season: number; startDate?: string; endDate?: string }>,
  now: Date = new Date()
): number | null {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  for (const item of seasons) {
    const start = parseSeasonDay(item?.startDate);
    const end = parseSeasonDay(item?.endDate);
    if (start == null || end == null) continue;
    if (start <= today && today <= end) return item.season;
  }
  return null;
}

