import { describe, it, expect, beforeEach } from 'vitest';
import {
  createInitialSquadState as createInitialSquad,
  loadSquadPreset,
  swapWeaponSlots,
  swapMatrixSlots,
  swapRelicSlots,
  swapTraits,
} from './state';
import { serializeSquadState, deserializeSquadState } from './codecs';
import { setCustomPhoto, getCustomPhoto, swapCustomPhotos } from './custom-photos';
import { getCompStrings, COMP_STRINGS_EN, COMP_STRINGS_RU } from './copy';
import type { CompStrings } from './copy';
import type { SquadState } from './types';
import { splitMatrix2Plus2 } from './state';
import { resolveCompMatrixIcon, resolveCompWeaponElementBadge } from './data';
import type { CompMatrixView, CompWeaponView } from './data';

const detectStub = () => 'dps' as const;

function makeSquad(): SquadState {
  const squad = createInitialSquad(4);
  squad.players[0].weapons[0] = { id: 'w-a', stars: 6, matrix: null };
  squad.players[0].weapons[0].matrix = { id: 'm-a', stars: 3, count: 4 };
  squad.players[0].relics[0] = { id: 'r-a', rank: 5 };
  squad.players[0].trait = 'sim-a';
  squad.players[0].traitCustomText = 'Leader';
  squad.players[1].weapons[0] = { id: 'w-b', stars: 1, matrix: null };
  squad.players[1].trait = 'sim-b';
  return squad;
}

describe('comp legacy port: state, codec, photos', () => {
  it('preserves ordered weapon techniques through sharing, including split weapons',()=>{
    const state=makeSquad();
    state.players[0].weapons[0].skills=['technique-a','technique-b'];
    state.players[0].weapons[0].id2='w-c';
    state.players[0].weapons[0].skills2=['technique-c',''];
    const code=serializeSquadState(state);
    const restored=deserializeSquadState(`?c=${code}`,detectStub);
    expect(restored?.players[0].weapons[0].skills).toEqual(['technique-a','technique-b']);
    expect(restored?.players[0].weapons[0].skills2).toEqual(['technique-c','']);
  });
  it('preserves gacha weapon modes and element forms of both chips through sharing',()=>{
    const state=makeSquad();
    Object.assign(state.players[0].weapons[0],{mode:'ga_BlackStar_RealSkill2',id2:'w-c',element2:'Frost',mode2:'GA_FPlayerLanaSkill_Skill1'});
    state.players[1].weapons[0].element='Volt';
    const restored=deserializeSquadState(`?c=${serializeSquadState(state)}`,detectStub);
    expect(restored?.players[0].weapons[0]).toMatchObject({mode:'ga_BlackStar_RealSkill2',element2:'Frost',mode2:'GA_FPlayerLanaSkill_Skill1'});
    expect(restored?.players[0].weapons[0].element).toBeUndefined();
    expect(restored?.players[1].weapons[0].element).toBe('Volt');
    expect(restored?.players[1].weapons[0].skills).toBeUndefined();
  });
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('defaults to the frost-8p raid preset content', () => {
    const preset = loadSquadPreset('frost-8p');
    expect(preset).not.toBeNull();
    expect(preset?.mode).toBe(8);
    expect(preset?.players.length).toBe(8);
    expect(preset?.players[0].weapons[0]?.id).toBe('ene');
  });

  it('share codec round-trips squad state', () => {
    const squad = makeSquad();
    const code = serializeSquadState(squad);
    expect(code.length).toBeGreaterThan(0);
    const restored = deserializeSquadState(`?c=${code}`, detectStub);
    expect(restored?.mode).toBe(4);
    expect(restored?.players[0].weapons[0]?.id).toBe('w-a');
    expect(restored?.players[0].weapons[0]?.matrix?.id).toBe('m-a');
    expect(restored?.players[0].relics[0]?.rank).toBe(5);
    expect(restored?.players[0].trait).toBe('sim-a');
    expect(restored?.players[1].weapons[0]?.stars).toBe(1);
  });

  it('round-trips mmo server scope, defaults standard to no marker', () => {
    const squad = makeSquad();
    squad.server = 'mmo';
    const code = serializeSquadState(squad);
    const restored = deserializeSquadState(`?c=${code}`, detectStub);
    expect(restored?.server).toBe('mmo');

    const stdSquad = makeSquad();
    expect(stdSquad.server).toBe('standard');
    const stdCode = serializeSquadState(stdSquad);
    const stdRestored = deserializeSquadState(`?c=${stdCode}`, detectStub);
    expect(stdRestored?.server).toBe('standard');
  });

  it('loads MMO presets with MMO-only roster ids and empty matrices', () => {
    const raid = loadSquadPreset('mmo-8p');
    expect(raid.mode).toBe(8);
    expect(raid.server).toBe('mmo');
    expect(raid.players.length).toBe(8);
    for (const p of raid.players) {
      for (const w of p.weapons) {
        if (w.id) {
          expect(w.id.endsWith('-mmo')).toBe(true);
          expect(w.matrix).toBeNull();
        }
      }
      if (p.trait) expect(p.trait.endsWith('-mmo')).toBe(true);
    }

    const frost = loadSquadPreset('mmo-4p');
    expect(frost.mode).toBe(4);
    expect(frost.server).toBe('mmo');

    const classic = loadSquadPreset('frost-8p');
    expect(classic.server).toBe('standard');
  });

  it('swaps weapon slots between players', () => {
    const next = swapWeaponSlots(makeSquad(), 0, 0, 1, 0);
    expect(next.players[0].weapons[0]?.id).toBe('w-b');
    expect(next.players[1].weapons[0]?.id).toBe('w-a');
  });

  it('swaps matrix sub-objects between weapon slots', () => {
    const squad = makeSquad();
    squad.players[1].weapons[0].matrix = { id: 'm-b', stars: 0, count: 2 };
    const next = swapMatrixSlots(squad, 0, 0, 1, 0);
    expect(next.players[0].weapons[0]?.matrix?.id).toBe('m-b');
    expect(next.players[1].weapons[0]?.matrix?.id).toBe('m-a');
    // Weapons themselves stay in place.
    expect(next.players[0].weapons[0]?.id).toBe('w-a');
  });

  it('swaps relic slots and traits with custom text', () => {
    const squad = makeSquad();
    squad.players[1].relics[0] = { id: 'r-b', rank: 0 };
    const swappedRelics = swapRelicSlots(squad, 0, 0, 1, 0);
    expect(swappedRelics.players[0].relics[0]?.id).toBe('r-b');
    expect(swappedRelics.players[1].relics[0]?.rank).toBe(5);

    const swappedTraits = swapTraits(squad, 0, 1);
    expect(swappedTraits.players[0].trait).toBe('sim-b');
    expect(swappedTraits.players[0].traitCustomText).toBe('');
    expect(swappedTraits.players[1].traitCustomText).toBe('Leader');
  });

  it('swaps custom photos between slots', () => {
    setCustomPhoto(0, 'weapon', 0, 0, 'data:photo-a');
    swapCustomPhotos(0, 'weapon', 0, 1, 0);
    expect(getCustomPhoto(0, 'weapon', 0, 0)).toBeNull();
    expect(getCustomPhoto(1, 'weapon', 0, 0)).toBe('data:photo-a');
  });

  it('resolves comp UI strings in English and Russian', () => {
    const en: CompStrings = getCompStrings('en');
    const ru: CompStrings = getCompStrings('ru');
    expect(en).toBe(COMP_STRINGS_EN);
    expect(ru).toBe(COMP_STRINGS_RU);
    expect(en.mode4).toBe('4 Players');
    expect(ru.mode4).toBe('4 Игрока');
    expect(en.colWeapons).toBe('Weapons');
    expect(ru.colWeapons).toBe('Оружие');
    expect(en.colMatrices).toBe('Matrices');
    expect(en.colRelics).toBe('Relics');
    expect(en.pickerWeaponTitle).toBe('Select Weapon (Slot {slot})');
    expect(ru.pickerWeaponTitle).toBe('Выбор оружия (Слот {slot})');
    expect(en.removeItem).toBe('Remove Item');
    expect(ru.removeItem).toBe('Очистить слот');
    expect(en.advStarsWeapon).toBe('Advancement Stars');
    expect(ru.advStarsWeapon).toBe('Звезды оружия (0-6)');
    expect(en.roleAuto).toBe('Auto');
    expect(ru.roleAuto).toBe('Авто');
    expect(en.linkCopied).toBe('Comp shareable link copied to clipboard!');
    expect(ru.linkCopied).toBe('Ссылка на состав скопирована в буфер!');
    expect(en.exportedFile.replace('{file}', 'comp.png')).toBe('Exported comp.png');
    expect(ru.exportedFile.replace('{file}', 'comp.png')).toBe('Экспортировано: comp.png');
    expect(en.catalogLoading).toBe('Loading squad builder catalog...');
    expect(ru.catalogLoading).toBe('Загрузка каталога отрядов...');
  });
});

describe('comp legacy port: chip icons and element badges', () => {
  function makeMatrix(overrides: Partial<CompMatrixView> = {}): CompMatrixView {
    return {
      id: 'm-test',
      name: { en: 'Test Matrix', ru: 'Тестовая матрица' },
      quality: 'SSR',
      icon: '/datamine/shared/media/icon.webp',
      suitPortrait: '/datamine/shared/media/portrait.webp',
      remouldIcon: null,
      desc2p: null,
      desc3p: null,
      desc4p: null,
      simulacrumId: null,
      simName: null,
      ...overrides,
    } as CompMatrixView;
  }

  function makeWeapon(overrides: Partial<CompWeaponView> = {}): CompWeaponView {
    return {
      id: 'w-test',
      element: 'Frost',
      elementSecondary: null,
      elementComboIcon: null,
      ...overrides,
    } as CompWeaponView;
  }

  it('prefers the small matrix chip icon over the suit portrait (legacy icon || suit_portrait)', () => {
    const url = resolveCompMatrixIcon(makeMatrix());
    expect(url).toContain('icon.webp');
    expect(url).not.toContain('portrait.webp');
  });

  it('falls back to the suit portrait when the chip icon is missing', () => {
    const url = resolveCompMatrixIcon(makeMatrix({ icon: '' }));
    expect(url).toContain('portrait.webp');
  });

  it('prefers the combined element icon for dual-element weapons', () => {
    const badge = resolveCompWeaponElementBadge(
      makeWeapon({ elementComboIcon: '/datamine/shared/media/combo.webp' })
    );
    expect(badge.kind).toBe('combo');
    expect(badge.icons).toHaveLength(1);
    expect(badge.icons[0]).toContain('combo.webp');
  });

  it('resolves the canonical combined icon for a dual primary/secondary pair', () => {
    const badge = resolveCompWeaponElementBadge(
      makeWeapon({ element: 'Frost', elementSecondary: 'Volt' })
    );
    expect(badge.kind).toBe('combo');
    expect(badge.icons).toHaveLength(1);
    expect(badge.icons[0]).toContain('icon_element_binglei');
  });

  it('resolves a single element icon', () => {
    const badge = resolveCompWeaponElementBadge(makeWeapon({ element: 'Flame' }));
    expect(badge.kind).toBe('single');
    expect(badge.icons).toHaveLength(1);
    expect(badge.icons[0]).toContain('icon_element_huo');
  });

  it('returns no badge when the weapon is missing', () => {
    expect(resolveCompWeaponElementBadge(null).kind).toBe('none');
  });

  it('splits a single matrix set into 2+2 (legacy popover button)', () => {
    const squad = makeSquad();
    squad.players[0].weapons[0] = {
      id: 'w-a',
      stars: 6,
      matrix: { id: 'm-a', count: 4, stars: 3 },
    };
    const next = splitMatrix2Plus2(squad, 0, 0);
    const m = next.players[0].weapons[0].matrix;
    expect(m?.count).toBe(2);
    expect(m?.id2).toBe('m-a');
    expect(m?.count2).toBe(2);
    expect(m?.stars2).toBe(3);
  });

  it('does not split an empty or already-split matrix slot', () => {
    const squad = makeSquad();
    squad.players[0].weapons[0] = { id: 'w-a', stars: 6, matrix: null };
    expect(splitMatrix2Plus2(squad, 0, 0)).toBe(squad);
    squad.players[0].weapons[0] = {
      id: 'w-a',
      stars: 6,
      matrix: { id: 'm-a', count: 2, stars: 3, id2: 'm-b', count2: 2, stars2: 1 },
    };
    expect(splitMatrix2Plus2(squad, 0, 0)).toBe(squad);
  });
});
