import fs from 'node:fs';
import path from 'node:path';
import type { DatasetNormalizationResult } from '../types';
import { correctKnownCarrierElements } from '../known-data-corrections';
import { createMatrixTraitIconResolver } from '../../lib/matrix-trait-icon.cjs';

export function normalizeCompDataset(
  legacySourceDir: string,
  canonicalMmo?: readonly any[],
  mediaManifestPath?: string
): DatasetNormalizationResult {
  function resolveDataPath(...relCandidates: string[]): string {
    for (const rel of relCandidates) {
      const full = path.join(legacySourceDir, rel);
      if (fs.existsSync(full)) {
        return full;
      }
    }
    return path.join(legacySourceDir, relCandidates[0]);
  }

  const legacyCatalogPath = resolveDataPath(
    'tools/data/catalog.json',
    'apps/web/public/game-data/tools/data/catalog.json',
    'apps/web/public/tools/data/catalog.json',
    'local-deploy/game-data/tools/data/catalog.json'
  );
  const simIndexPath = resolveDataPath(
    'info/simulacra/data/simulacra-index.json',
    'datamine2/simulacra/data/simulacra-index.json',
    'datamine/simulacra/data/simulacra-index.json'
  );
  const mmoSimIndexPath = resolveDataPath(
    'info/simulacra/data/simulacra-mmo-index.json',
    'datamine2/simulacra/data/simulacra-mmo-index.json',
    'datamine/simulacra/data/simulacra-mmo-index.json'
  );
  const simDir = resolveDataPath(
    'info/simulacra/data',
    'datamine2/simulacra/data',
    'datamine/simulacra/data'
  );
  const matricesDataPath = resolveDataPath(
    'info/matrices/data/matrices.json',
    'datamine2/matrices/data/matrices.json',
    'datamine/matrices/data/matrices.json'
  );
  const relicsDataPath = resolveDataPath(
    'info/relics/data/relics.json',
    'datamine2/relics/data/relics.json',
    'datamine/relics/data/relics.json'
  );
  const petsDataPath = resolveDataPath(
    'info/pets/data/pets.json',
    'datamine2/pets/data/pets.json',
    'datamine/pets/data/pets.json'
  );

  const manifestCandidates = [
    mediaManifestPath,
    path.join(legacySourceDir, 'game-assets', 'media-manifest.json'),
    path.join(legacySourceDir, 'public', 'game-assets', 'media-manifest.json'),
    path.join(legacySourceDir, 'apps', 'web', 'public', 'game-assets', 'media-manifest.json'),
  ].filter((candidate): candidate is string => Boolean(candidate));
  let mediaAssets: any[] = [];
  for (const manifestPath of [...new Set(manifestCandidates)]) {
    if (!fs.existsSync(manifestPath)) continue;
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      if (Array.isArray(manifest.assets)) mediaAssets = manifest.assets;
      break;
    } catch {
      // Ignore malformed optional media manifests; missing icons use the legacy fallback.
    }
  }
  const resolveMatrixTraitIcon = createMatrixTraitIconResolver(mediaAssets);

  let rawCatalog: any = null;

  // 1. Primary: Build catalog from prepared individual datasets
  if (fs.existsSync(simIndexPath) && fs.existsSync(matricesDataPath) && fs.existsSync(relicsDataPath)) {
    try {
      const simIndex = JSON.parse(fs.readFileSync(simIndexPath, 'utf8'));
      const mmoSimIndex = fs.existsSync(mmoSimIndexPath)
        ? JSON.parse(fs.readFileSync(mmoSimIndexPath, 'utf8')).map((sim: any, index: number) => ({
            ...sim,
            release_order: index + 1,
          }))
        : [];
      const simulacra = [...simIndex, ...mmoSimIndex].map((s: any) => {
        let trait_name_en = '';
        let trait_name_ru = '';
        let trait_desc_en = '';
        let trait_desc_ru = '';

        const candidateDetailPaths = [
          path.join(simDir, `${s.id}.json`),
          path.join(legacySourceDir, 'info', 'simulacra', 'data', `${s.id}.json`),
          path.join(legacySourceDir, 'datamine2', 'simulacra', 'data', `${s.id}.json`),
          path.join(legacySourceDir, 'datamine', 'simulacra', 'data', `${s.id}.json`),
        ];

        for (const detailPath of candidateDetailPaths) {
          if (fs.existsSync(detailPath)) {
            try {
              const detail = JSON.parse(fs.readFileSync(detailPath, 'utf8'));
              if (Array.isArray(detail.traits) && detail.traits.length > 0) {
                const maxTrait =
                  detail.traits.find((t: any) => t.affinity === 4000) ||
                  detail.traits[detail.traits.length - 1];
                trait_name_en = maxTrait.name_en || '';
                trait_name_ru = maxTrait.name_ru || '';
                trait_desc_en = maxTrait.desc_en || '';
                trait_desc_ru = maxTrait.desc_ru || '';
              }
              break;
            } catch {
              // Ignore parse error and keep searching
            }
          }
        }

        return {
          id: s.id,
          avatar_id: s.avatar_id || s.avatarId || null,
          imitation_id: s.imitation_id || null,
          matrix_suit_num: s.matrix_suit_num ?? null,
          server_mode: s.server_mode || s.edition || (String(s.id).endsWith('-mmo') ? 'mmo' : 'standard'),
          season: typeof s.season === 'number' ? s.season : null,
          release_order: typeof s.release_order === 'number' ? s.release_order : null,
          name_en: s.name_en || s.id,
          name_ru: s.name_ru || s.name_en || s.id,
          avatar: s.avatar || s.portrait || s.card || '',
          weapon_id: s.weapon_id || '',
          weapon_name_en: s.weapon_name_en || s.name_en || '',
          weapon_name_ru: s.weapon_name_ru || s.name_ru || '',
          weapon_icon: s.icon || s.icon_thumb || '',
          element: s.element || 'Altered',
          element_secondary: s.element_secondary || null,
          element_combo_icon: s.element_combo_icon || null,
          role: s.role || 'DPS',
          role_icon: s.role_icon || '',
          rarity: s.rarity || 'SSR',
          matrix_suit_id: s.matrix_suit_id || null,
          card: s.card || s.detail_art || s.portrait || null,
          trait_name_en,
          trait_name_ru,
          trait_desc_en,
          trait_desc_ru,
        };
      });

      const matData = JSON.parse(fs.readFileSync(matricesDataPath, 'utf8'));
      const matrices = (matData.items || []).map((m: any) => {
        let desc_2p_en = '';
        let desc_2p_ru = '';
        let desc_3p_en = '';
        let desc_3p_ru = '';
        let desc_4p_en = '';
        let desc_4p_ru = '';

        if (Array.isArray(m.effects)) {
          for (const eff of m.effects) {
            if (eff.count === 2) {
              desc_2p_en = eff.text_en || eff.description_en || '';
              desc_2p_ru = eff.text_ru || eff.description_ru || '';
            }
            if (eff.count === 3) {
              desc_3p_en = eff.text_en || eff.description_en || '';
              desc_3p_ru = eff.text_ru || eff.description_ru || '';
            }
            if (eff.count === 4) {
              desc_4p_en = eff.text_en || eff.description_en || '';
              desc_4p_ru = eff.text_ru || eff.description_ru || '';
            }
          }
        }

        return {
          id: m.id,
          name_en: m.name_en || m.id,
          name_ru: m.name_ru || m.name_en || m.id,
          quality: m.quality || 'SSR',
          icon: m.icon || m.piece_icon || '',
          suit_portrait: m.suit_portrait || '',
          remould_icon: m.remould_icon || '',
          desc_2p_en,
          desc_2p_ru,
          desc_3p_en,
          desc_3p_ru,
          desc_4p_en,
          desc_4p_ru,
        };
      });

      const relicData = JSON.parse(fs.readFileSync(relicsDataPath, 'utf8'));
      const relics = (relicData.items || [])
        .map((r: any) => ({
          id: r.id,
          server_mode: r.server_mode || r.edition || (String(r.id).endsWith('-mmo') ? 'mmo' : 'standard'),
          edition: r.edition || r.server_mode || (String(r.id).endsWith('-mmo') ? 'mmo' : 'standard'),
          name_en: r.name_en || r.id,
          name_ru: r.name_ru || r.name_en || r.id,
          quality: r.quality || 'SSR',
          property: r.property || 'Utility',
          icon: r.item_icon || r.attack_icon || r.card_image || '',
          desc_en: r.desc_en || '',
          desc_ru: r.desc_ru || '',
          stars: (r.stars || []).map((st: any) => ({
            star: st.star,
            desc_en: st.desc_en || '',
            desc_ru: st.desc_ru || '',
          })),
        }));

      relics.sort((a: any, b: any) => {
        const qOrder: Record<string, number> = { SSR: 1, SR: 2, R: 3, N: 4 };
        const qDiff = (qOrder[a.quality] || 99) - (qOrder[b.quality] || 99);
        if (qDiff !== 0) return qDiff;
        const numA = parseInt(String(a.id || '').replace(/\D/g, ''), 10) || 0;
        const numB = parseInt(String(b.id || '').replace(/\D/g, ''), 10) || 0;
        if (numA !== numB) return numB - numA;
        return (a.id || '').localeCompare(b.id || '');
      });

      let pets: any[] = [];
      if (fs.existsSync(petsDataPath)) {
        const petData = JSON.parse(fs.readFileSync(petsDataPath, 'utf8'));
        pets = (petData.items || [])
          .filter((p: any) => p.id && p.id.startsWith('FightPet'))
          .map((p: any) => ({
            id: p.id,
            name_en: p.name_en || p.id,
            name_ru: p.name_ru || p.name_en || p.id,
            quality: p.quality || 'SSR',
            icon: p.icon || (p.media && p.media.photo && p.media.photo.fullUrl) || '',
            stars: [0, 1, 2, 3, 4, 5],
          }));
      }

      const roles = [
        {
          id: 'tank',
          name_en: 'Fortitude',
          name_ru: 'Защита',
          short_en: 'Tank',
          short_ru: 'Танк',
          color: '#eab308',
          bg_color: 'rgba(202, 160, 48, 0.22)',
          icon: '/datamine/shared/media/Hotta/Content/Resources/UI/wuqi/icon_fangyu.webp',
        },
        {
          id: 'healer',
          name_en: 'Benediction',
          name_ru: 'Благословение',
          short_en: 'Heal',
          short_ru: 'Хил',
          color: '#10b981',
          bg_color: 'rgba(46, 175, 110, 0.22)',
          icon: '/datamine/shared/media/Hotta/Content/Resources/UI/wuqi/icon_zengyi.webp',
        },
        {
          id: 'dps',
          name_en: 'Attack',
          name_ru: 'Нападение',
          short_en: 'DPS',
          short_ru: 'ДД',
          color: '#ef4444',
          bg_color: 'rgba(220, 53, 69, 0.22)',
          icon: '/datamine/shared/media/Hotta/Content/Resources/UI/wuqi/icon_qianggong.webp',
        },
        {
          id: 'balance',
          name_en: 'Balance',
          name_ru: 'Баланс',
          short_en: 'Bal',
          short_ru: 'Баланс',
          color: '#a855f7',
          bg_color: 'rgba(138, 75, 225, 0.22)',
          icon: '/datamine/shared/media/Hotta/Content/Resources/UI/wuqi/icon_element_powers.webp',
        },
      ];

      rawCatalog = {
        generatedAt: new Date().toISOString(),
        totalSimulacra: simulacra.length,
        totalMatrices: matrices.length,
        totalRelics: relics.length,
        totalPets: pets.length,
        roles,
        simulacra,
        matrices,
        relics,
        pets,
      };
    } catch {
      rawCatalog = null;
    }
  }

  // 2. Fallback: Load existing tools/data/catalog.json if individual files unavailable
  if (!rawCatalog && fs.existsSync(legacyCatalogPath)) {
    try {
      rawCatalog = JSON.parse(fs.readFileSync(legacyCatalogPath, 'utf8'));
    } catch {
      rawCatalog = null;
    }
  }

  // 3. Fallback: Load existing comp.json if catalog.json unavailable
  if (!rawCatalog) {
    const existingCompPath = resolveDataPath(
      'apps/web/public/game-data/en/comp.json',
      'apps/web/public/comp.json',
      'local-deploy/game-data/en/comp.json'
    );
    if (fs.existsSync(existingCompPath)) {
      try {
        rawCatalog = JSON.parse(fs.readFileSync(existingCompPath, 'utf8'));
      } catch {
        rawCatalog = null;
      }
    }
  }

  if (!rawCatalog) {
    rawCatalog = {
      generatedAt: new Date().toISOString(),
      totalSimulacra: 0,
      totalMatrices: 0,
      totalRelics: 0,
      totalPets: 0,
      roles: [],
      simulacra: [],
      matrices: [],
      relics: [],
      pets: [],
    };
  }

  const roles = rawCatalog.roles || [];
  if(canonicalMmo?.length){
    const previous=new Map<string,any>((rawCatalog.simulacra || []).map((row:any)=>[row.id,row]));
    rawCatalog.simulacra=[...(rawCatalog.simulacra || []).filter((row:any)=>row.server_mode!=='mmo'&&!String(row.id).endsWith('-mmo')),
      ...canonicalMmo.map(row=>({...previous.get(row.id),...row,server_mode:'mmo',weapon_icon:row.weapon_icon||row.icon||row.avatar}))];
  }
  const simulacra = (rawCatalog.simulacra || []).map((sim: any) => {
    const elementCorrection = correctKnownCarrierElements(sim);
    const traitIcon = resolveMatrixTraitIcon(sim);
    return {
      ...sim,
      ...(elementCorrection
        ? { element: elementCorrection.element, element_secondary: elementCorrection.element_secondary }
        : {}),
      ...(traitIcon ? { trait_icon: `/datamine/shared/media/${traitIcon}` } : {}),
    };
  });
  const matrices = rawCatalog.matrices || [];
  const relics = rawCatalog.relics || [];
  const pets = rawCatalog.pets || [];

  // Construct Language-Neutral Core
  const core = {
    roles: roles.map((r: any) => ({
      id: r.id,
      color: r.color,
      bg_color: r.bg_color,
      icon: r.icon,
    })),
    simulacra: simulacra.map((s: any) => ({
      id: s.id,
      avatar_id: s.avatar_id,
      imitation_id: s.imitation_id,
      matrix_suit_num: s.matrix_suit_num,
      server_mode: s.server_mode,
      season: s.season,
      release_order: s.release_order,
      avatar: s.avatar,
      trait_icon: s.trait_icon,
      weapon_id: s.weapon_id,
      weapon_icon: s.weapon_icon,
      element: s.element,
      element_secondary: s.element_secondary,
      element_combo_icon: s.element_combo_icon,
      role: s.role,
      role_icon: s.role_icon,
      rarity: s.rarity,
      matrix_suit_id: s.matrix_suit_id,
      card: s.card,
    })),
    matrices: matrices.map((m: any) => ({
      id: m.id,
      quality: m.quality,
      icon: m.icon,
      suit_portrait: m.suit_portrait,
      remould_icon: m.remould_icon,
    })),
    relics: relics.map((r: any) => ({
      id: r.id,
      server_mode: r.server_mode,
      edition: r.edition,
      quality: r.quality,
      property: r.property,
      icon: r.icon,
      stars: (r.stars || []).map((st: any) => ({ star: st.star })),
    })),
    pets: pets.map((p: any) => ({
      id: p.id,
      quality: p.quality,
      icon: p.icon,
      stars: p.stars || [0, 1, 2, 3, 4, 5],
    })),
  };

  // Construct Locale Overlays
  const overlays = {
    en: {
      roles: roles.map((r: any) => ({
        id: r.id,
        name: r.name_en,
        name_en: r.name_en,
        short: r.short_en,
        short_en: r.short_en,
      })),
      simulacra: simulacra.map((s: any) => ({
        id: s.id,
        name: s.name_en,
        name_en: s.name_en,
        weapon_name: s.weapon_name_en,
        weapon_name_en: s.weapon_name_en,
        trait_name: s.trait_name_en,
        trait_name_en: s.trait_name_en,
        trait_desc: s.trait_desc_en,
        trait_desc_en: s.trait_desc_en,
      })),
      matrices: matrices.map((m: any) => ({
        id: m.id,
        name: m.name_en,
        name_en: m.name_en,
        desc_2p: m.desc_2p_en,
        desc_2p_en: m.desc_2p_en,
        desc_3p: m.desc_3p_en,
        desc_3p_en: m.desc_3p_en,
        desc_4p: m.desc_4p_en,
        desc_4p_en: m.desc_4p_en,
      })),
      relics: relics.map((r: any) => ({
        id: r.id,
        name: r.name_en,
        name_en: r.name_en,
        desc: r.desc_en,
        desc_en: r.desc_en,
        stars: (r.stars || []).map((st: any) => ({
          star: st.star,
          desc: st.desc_en,
          desc_en: st.desc_en,
        })),
      })),
      pets: pets.map((p: any) => ({
        id: p.id,
        name: p.name_en,
        name_en: p.name_en,
      })),
    },
    ru: {
      roles: roles.map((r: any) => ({
        id: r.id,
        name: r.name_ru,
        name_ru: r.name_ru,
        short: r.short_ru,
        short_ru: r.short_ru,
      })),
      simulacra: simulacra.map((s: any) => ({
        id: s.id,
        name: s.name_ru,
        name_ru: s.name_ru,
        weapon_name: s.weapon_name_ru,
        weapon_name_ru: s.weapon_name_ru,
        trait_name: s.trait_name_ru,
        trait_name_ru: s.trait_name_ru,
        trait_desc: s.trait_desc_ru,
        trait_desc_ru: s.trait_desc_ru,
      })),
      matrices: matrices.map((m: any) => ({
        id: m.id,
        name: m.name_ru,
        name_ru: m.name_ru,
        desc_2p: m.desc_2p_ru,
        desc_2p_ru: m.desc_2p_ru,
        desc_3p: m.desc_3p_ru,
        desc_3p_ru: m.desc_3p_ru,
        desc_4p: m.desc_4p_ru,
        desc_4p_ru: m.desc_4p_ru,
      })),
      relics: relics.map((r: any) => ({
        id: r.id,
        name: r.name_ru,
        name_ru: r.name_ru,
        desc: r.desc_ru,
        desc_ru: r.desc_ru,
        stars: (r.stars || []).map((st: any) => ({
          star: st.star,
          desc: st.desc_ru,
          desc_ru: st.desc_ru,
        })),
      })),
      pets: pets.map((p: any) => ({
        id: p.id,
        name: p.name_ru,
        name_ru: p.name_ru,
      })),
    },
  };

  // Materialized Payloads
  const materializedEn = {
    schemaVersion: 1,
    generatedAt: rawCatalog.generatedAt || new Date().toISOString(),
    total: simulacra.length + matrices.length + relics.length + pets.length,
    totalSimulacra: simulacra.length,
    totalMatrices: matrices.length,
    totalRelics: relics.length,
    totalPets: pets.length,
    roles: roles.map((r: any) => ({
      ...r,
      name: r.name_en,
      short: r.short_en,
    })),
    simulacra: simulacra.map((s: any) => ({
      ...s,
      name: s.name_en,
      weapon_name: s.weapon_name_en,
      trait_name: s.trait_name_en,
      trait_desc: s.trait_desc_en,
    })),
    matrices: matrices.map((m: any) => ({
      ...m,
      name: m.name_en,
      desc_2p: m.desc_2p_en,
      desc_3p: m.desc_3p_en,
      desc_4p: m.desc_4p_en,
    })),
    relics: relics.map((r: any) => ({
      ...r,
      name: r.name_en,
      desc: r.desc_en,
      stars: (r.stars || []).map((st: any) => ({
        star: st.star,
        desc: st.desc_en,
        desc_en: st.desc_en,
        desc_ru: st.desc_ru,
      })),
    })),
    pets: pets.map((p: any) => ({
      ...p,
      name: p.name_en,
    })),
  };

  const materializedRu = {
    schemaVersion: 1,
    generatedAt: rawCatalog.generatedAt || new Date().toISOString(),
    total: simulacra.length + matrices.length + relics.length + pets.length,
    totalSimulacra: simulacra.length,
    totalMatrices: matrices.length,
    totalRelics: relics.length,
    totalPets: pets.length,
    roles: roles.map((r: any) => ({
      ...r,
      name: r.name_ru,
      short: r.short_ru,
    })),
    simulacra: simulacra.map((s: any) => ({
      ...s,
      name: s.name_ru,
      weapon_name: s.weapon_name_ru,
      trait_name: s.trait_name_ru,
      trait_desc: s.trait_desc_ru,
    })),
    matrices: matrices.map((m: any) => ({
      ...m,
      name: m.name_ru,
      desc_2p: m.desc_2p_ru,
      desc_3p: m.desc_3p_ru,
      desc_4p: m.desc_4p_ru,
    })),
    relics: relics.map((r: any) => ({
      ...r,
      name: r.name_ru,
      desc: r.desc_ru,
      stars: (r.stars || []).map((st: any) => ({
        star: st.star,
        desc: st.desc_ru,
        desc_en: st.desc_en,
        desc_ru: st.desc_ru,
      })),
    })),
    pets: pets.map((p: any) => ({
      ...p,
      name: p.name_ru,
    })),
  };

  return {
    datasetName: 'comp',
    core,
    overlays,
    materialized: {
      en: materializedEn,
      ru: materializedRu,
    },
    counts: {
      total: simulacra.length + matrices.length + relics.length + pets.length,
      simulacra: simulacra.length,
      matrices: matrices.length,
      relics: relics.length,
      pets: pets.length,
      roles: roles.length,
    },
  };
}
