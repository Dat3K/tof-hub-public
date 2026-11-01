import { normalizeRarity } from '../common/rarities';
import {createLocalizedText, getLocalizedFields } from '../common/localization';
import { slugify } from '../common/identifiers';
import type {
  MatrixSuitCore,
  MatrixSuitDetail,
  MatrixPiece,
  MatrixEffect,
  MatrixCarrier,
} from '../entities/matrix';

export function adaptMatrixSuitCore(raw: any): MatrixSuitCore {
  const nameEn = raw.name_en ?? raw.name?.en ?? '';
  const nameRu = raw.name_ru ?? raw.name?.ru ?? '';
  const stableId = raw.id || '';
  const slug = slugify(nameEn || stableId);

  return {
    stableId,
    slug,
    name: createLocalizedText(nameEn, nameRu),
    quality: normalizeRarity(raw.quality),
    icon: raw.icon || raw.piece_icon || '',
    suitPortrait: raw.suit_portrait || raw.icon || '',
    remouldIcon: raw.remould_icon || null,
  };
}

export function adaptMatrixSuitDetail(raw: any): MatrixSuitDetail {
  const core = adaptMatrixSuitCore(raw);

  const pieces: MatrixPiece[] = Array.isArray(raw.pieces)
    ? raw.pieces.map((p: any) => ({
        slot: String(p.slot_name_en || p.slot || p.type || ''),
        id: String(p.id || ''),
        name: createLocalizedText(p.name_en ?? p.name?.en, p.name_ru ?? p.name?.ru, { ...getLocalizedFields(p, 'name') }),
        icon: p.icon || '',
        stats: Array.isArray(p.stats) ? p.stats : [],
      }))
    : [];

  const effects: MatrixEffect[] = Array.isArray(raw.effects)
    ? raw.effects.map((e: any) => ({
        pieceCount: Number(e.piece_count || e.pieces || (e.desc_2p_en ? 2 : 4)),
        name: createLocalizedText(e.name_en ?? e.name?.en, e.name_ru ?? e.name?.ru, { ...getLocalizedFields(e, 'name') }),
        description: createLocalizedText(e.desc_en ?? e.desc?.en, e.desc_ru ?? e.desc?.ru, { ...getLocalizedFields(e, 'desc') }),
        buffId: e.buff_id || null,
        stars: Array.isArray(e.stars)
          ? e.stars.map((st: any) => ({
              star: Number(st.star ?? 0),
              text: createLocalizedText(st.text_en ?? st.text?.en, st.text_ru ?? st.text?.ru, { ...getLocalizedFields(st, 'text') }),
              html: st.html_en ? createLocalizedText(st.html_en, st.html_ru, { ...getLocalizedFields(st, 'html') }) : undefined,
              csScore: typeof st.cs_score === 'number' ? st.cs_score : undefined,
              buffId: st.buff_id,
              isGlobal: Boolean(st.is_global),
            }))
          : [],
      }))
    : [];

  const carriers: MatrixCarrier[] = Array.isArray(raw.carriers)
    ? raw.carriers.map((c: any) => ({
        id: c.id || '',
        name: createLocalizedText(c.name_en ?? c.name?.en, c.name_ru ?? c.name?.ru, { ...getLocalizedFields(c, 'name') }),
        weaponName: c.weapon_name_en ? createLocalizedText(c.weapon_name_en, c.weapon_name_ru, { ...getLocalizedFields(c, 'weapon_name') }) : undefined,
        element: c.element,
        role: c.role,
      }))
    : [];

  return {
    ...core,
    pieces,
    effects,
    carriers,
    isOpened: raw.is_opened,
    playableCarrier: raw.playable_carrier,
    hasCarrier: raw.has_carrier,
  };
}
