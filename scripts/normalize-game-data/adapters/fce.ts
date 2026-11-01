import fs from 'node:fs';
import path from 'node:path';
import type { DatasetNormalizationResult } from '../types';
import { sortById, deepClone } from '../split-merge';

const FALLBACK_FCE_BOSSES = [
  {
    slug: 'chaos-armor',
    order: 1,
    boss_id: 'boss_hum_046',
    boss_num: 46,
    name: 'Chaos Armor',
    name_ru: 'Хаос Армор',
    name_color: '#f16937',
    art: '/datamine/shared/media/Hotta/Content/Resources/UI/void/boss/bigboss_SY_08.webp',
    preview: '/datamine/shared/media/Hotta/Content/Resources/UI/void/boss/bigboss_SY_08.thumb.webp',
    displayWebpUrl: '/datamine/shared/media/Hotta/Content/Resources/UI/void/boss/bigboss_SY_08.webp',
    cardThumbnail: '/datamine/shared/media/Hotta/Content/Resources/UI/void/boss/bigboss_SY_08.thumb.webp',
    downloadPngUrl: '/datamine/shared/media/Hotta/Content/Resources/UI/void/boss/bigboss_SY_08.png',
    lineupPortrait: '/datamine/shared/media/Hotta/Content/Resources/UI/void/boss/bigboss_SY_08.webp',
    lineupPortraitThumb: '/datamine/shared/media/Hotta/Content/Resources/UI/void/boss/bigboss_SY_08.thumb.webp',
    detailImage: '/datamine/shared/media/Hotta/Content/Resources/UI/void/boss/bigboss_SY_08.webp',
    mechanics_count: 4,
    ladder_level: 90,
    ladder_key: 'BorderWar_D',
    art_object_position: 'center center',
    mechanics: [
      {
        index: '1',
        html: 'Attacks come with a powerful Graying Bite effect. Increase corresponding elemental resistance or avoid being hit.',
      },
    ],
  },
];

export function normalizeFceDataset(legacySourceDir: string): DatasetNormalizationResult {
  const indexPath = path.join(legacySourceDir, 'datamine', 'fce', 'data', 'fce-index.json');
  const bossesDir = path.join(legacySourceDir, 'datamine', 'fce', 'data', 'bosses');

  let rawBosses: any[] = [];

  if (fs.existsSync(indexPath)) {
    try {
      const indexData = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
      rawBosses = Array.isArray(indexData.bosses) ? indexData.bosses : [];
    } catch {
      rawBosses = [];
    }
  }

  if (rawBosses.length === 0) {
    rawBosses = deepClone(FALLBACK_FCE_BOSSES);
  }

  const coreBosses: any[] = [];
  const overlayEnBosses: any[] = [];
  const overlayRuBosses: any[] = [];
  const matEnBosses: any[] = [];
  const matRuBosses: any[] = [];

  for (const raw of rawBosses) {
    const slug = String(raw.slug || raw.boss_id || '');
    let detailData: any = null;

    if (fs.existsSync(bossesDir)) {
      const detailPath = path.join(bossesDir, `${slug}.json`);
      if (fs.existsSync(detailPath)) {
        try {
          detailData = JSON.parse(fs.readFileSync(detailPath, 'utf8'));
        } catch {
          detailData = null;
        }
      }
    }

    const enMechanics = detailData?.en?.mechanics || raw.mechanics || [];
    const ruMechanics = detailData?.ru?.mechanics || raw.mechanics || enMechanics;

    const core: Record<string, any> = {
      slug,
      id: slug,
      order: typeof raw.order === 'number' ? raw.order : undefined,
      boss_id: String(raw.boss_id || ''),
      boss_num: Number(raw.boss_num ?? 0),
      name_color: raw.name_color || undefined,
      art: String(raw.art || ''),
      preview: String(raw.preview || ''),
      displayWebpUrl: raw.displayWebpUrl || raw.art || '',
      cardThumbnail: raw.cardThumbnail || raw.preview || '',
      downloadPngUrl: raw.downloadPngUrl || undefined,
      lineupPortrait: raw.lineupPortrait || undefined,
      lineupPortraitThumb: raw.lineupPortraitThumb || undefined,
      detailImage: raw.detailImage || undefined,
      mechanics_count: Number(raw.mechanics_count ?? enMechanics.length ?? 0),
      ladder_level: typeof raw.ladder_level === 'number' ? raw.ladder_level : undefined,
      ladder_key: raw.ladder_key || undefined,
      art_object_position: detailData?.art_object_position || raw.art_object_position || 'center center',
    };

    const nameEn = detailData?.en?.name || raw.name || slug;
    const nameRu = detailData?.ru?.name || raw.name_ru || nameEn;

    const overlayEn = {
      slug,
      id: slug,
      name: nameEn,
      name_ru: nameRu,
      mechanics: enMechanics,
    };

    const overlayRu = {
      slug,
      id: slug,
      name: nameRu,
      name_ru: nameRu,
      mechanics: ruMechanics,
    };

    const matEn = {
      ...deepClone(core),
      name: nameEn,
      name_ru: nameRu,
      mechanics: enMechanics,
    };

    const matRu = {
      ...deepClone(core),
      name: nameRu,
      name_ru: nameRu,
      mechanics: ruMechanics,
    };

    coreBosses.push(core);
    overlayEnBosses.push(overlayEn);
    overlayRuBosses.push(overlayRu);
    matEnBosses.push(matEn);
    matRuBosses.push(matRu);
  }

  const sortedCore = sortById(coreBosses);
  const sortedOverlayEn = sortById(overlayEnBosses);
  const sortedOverlayRu = sortById(overlayRuBosses);
  const sortedMatEn = [...matEnBosses].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  const sortedMatRu = [...matRuBosses].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));

  return {
    datasetName: 'fce',
    core: {
      schemaVersion: 1,
      total: sortedCore.length,
      bosses: sortedCore,
    },
    overlays: {
      en: {
        total: sortedOverlayEn.length,
        bosses: sortedOverlayEn,
      },
      ru: {
        total: sortedOverlayRu.length,
        bosses: sortedOverlayRu,
      },
    },
    materialized: {
      en: {
        bosses: sortedMatEn,
      },
      ru: {
        bosses: sortedMatRu,
      },
    },
    counts: {
      total: sortedMatEn.length,
    },
  };
}
