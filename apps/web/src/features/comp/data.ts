import { useState, useEffect, useMemo, useCallback } from 'react';
import { gameAsset } from '@tof-hub/game-assets';
import {
  adaptCompCatalog,
  adaptCompRole,
  adaptCompSimulacrum,
  deriveCompWeapon,
  adaptCompMatrix,
  adaptCompRelic,
  adaptCompPet,
  normalizeElement,
  getLocalizedValue,
  type CompRole,
  type CompRoleKey,
  type CompSimulacrumView,
  type CompWeaponView,
  type CompMatrixCarrier,
  type CompMatrixView,
  type CompRelicStar,
  type CompRelicView,
  type CompPetStar,
  type CompPetView,
  type CompCatalogView,
  type LocalizedText,
  type Element,
  type Rarity,
  type WeaponRole,
  type RelicProperty,
} from '@tof-hub/game-domain';
import { CompCatalogSchema } from '@tof-hub/contracts';
import { getDualElementIconPath } from '../info-sections/common/element-icons';
import { ELEMENT_FILTER_OPTIONS, ROLE_FILTER_OPTIONS } from '../simulacra/constants';

export type {
  CompRole,
  CompRoleKey,
  CompSimulacrumView,
  CompWeaponView,
  CompMatrixCarrier,
  CompMatrixView,
  CompRelicStar,
  CompRelicView,
  CompPetStar,
  CompPetView,
  CompCatalogView,
  LocalizedText,
  Element,
  Rarity,
  WeaponRole,
  RelicProperty,
};

export {
  adaptCompCatalog,
  adaptCompRole,
  adaptCompSimulacrum,
  deriveCompWeapon,
  adaptCompMatrix,
  adaptCompRelic,
  adaptCompPet,
  CompCatalogSchema,
};

/**
 * Normalizes string for case, diacritics, and Cyrillic ё -> е matching.
 */
export function normalizeStr(str: unknown): string {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ё/g, 'е');
}

/**
 * Strips whitespace and punctuation for compact space/hyphen-agnostic matching.
 */
export function normalizeCompact(str: unknown): string {
  if (!str) return '';
  return normalizeStr(str).replace(/[\s\-_'"`.,:;!?/\\()[\]{}*+~#]+/g, '');
}

/**
 * Character and simulacra aliases table from legacy comp-data.js.
 */
export const CHARACTER_ALIASES: Record<string, string[]> = {
  'rei-ayanami': ['rei', 'rei ayanami', 'рэй', 'рей', 'аянами', 'salvation', 'спасение'],
  'ji-yu': ['ji yu', 'jiyu', 'цзи юй', 'цзи ю', 'freeflow', 'свободный поток'],
  'stabdagger': ['aster', 'астер', 'twin stars', 'двойные звезды', 'nebula aria', 'ария туманности'],
  'avatar06': ['nemesis', 'немезида', 'немезис', 'venus', 'венера'],
  'nemesis-voidpiercer': ['nemesis voidpiercer', 'voidpiercer', 'немезида жало пустоты', 'жало пустоты', 'войдпирсер', 'star of oblivion', 'звезда забвения'],
  'ciper': ['hipper', 'ciper', 'хиппер', 'servion', 'сервион'],
  'ageleia': ['agleia', 'ageleia', 'аглея', 'chrono heart', 'хроно сердце'],
  'yanmiao': ['yan miao', 'yanmiao', 'янь мяо', 'ян мяо', 'янмяо', 'яньмяо', 'equilibrium', 'равновесие'],
  'puppeteer': ['helene', 'puppeteer', 'элен', 'хелен', 'кукловод', 'pollux', 'поллукс'],
  'meryl': ['meryl', 'мерил', 'rosy edge', 'розовая грань', 'розовый край'],
  'gnonno': ['gnonno', 'гнонно', 'gunono', 'mini hurricane', 'мини-ураган'],
  'alyss': ['alyss', 'alisa', 'алиса', 'алисс', 'элис', 'unyielding wing', 'неукротимое крыло'],
  'baiyuekui': ['bai yuekui', 'baiyuekui', 'бай юкеи', 'бай юэкуй', 'бай', 'alaya', 'алая'],
  'lechesis': ['lechesis', 'лехезис', 'eternal salvation', 'вечное спасение'],
  'tian-lang': ['tian lang', 'tianlang', 'tian', 'тянь лан', 'тяньлан', 'тянь', 'thunderbreaker', 'сокрушитель грома'],
  'lan': ['lan', 'лан', 'лань', 'vermilion bird', 'вермиллион', 'алая птица'],
  'veronika': ['veronika', 'вероника', 'visios', 'визиос'],
  'antoria': ['antoria', 'антория', 'requiem', 'реквием'],
  'saki-fuwa': ['saki', 'saki fuwa', 'sakifuwa', 'саки', 'саки фува', 'сакифува', 'heartstream', 'поток сердца'],
  'greyfox': ['gray fox', 'grey fox', 'grayfox', 'greyfox', 'серая лиса', 'грейфокс', "the witch's key", 'witchs key', 'ключ ведьмы'],
  'ling-han': ['ling han', 'linghan', 'линхань', 'лин хань', 'линхан', 'alabaster tiger', 'алебастровый тигр'],
  'plotti': ['plotti', 'плотти', 'skyfire', 'огненный шторм'],
  'rubilia': ['rubilia', 'рубилия', 'lost art', 'утраченное искусство'],
  'asilada': ['asurada', 'асурада', 'hellfire', 'адский огонь'],
  'hilda': ['hilda', 'хильда', 'terminator', 'терминатор'],
  'fenrir': ['fenrir', 'фенрир', 'феня', 'gleipnir', 'глейпнир'],
  'ruby': ['ruby', 'руби', 'spark', 'искра', 'спарк'],
  'gefion': ['gefion', 'гефион', 'fairy wreath', 'венок фей', 'reverse coordinates', 'обратные координаты'],
  'carrot': ['carrot', 'морковка', 'кэррот', 'морковь', 'slap', 'шлеп'],
  'ene': ['ene', 'ina', 'ина', 'эне', 'pummeler', 'громила'],
  'yanuo': ['yanuo', 'януо', 'яно', 'wicked', 'искуситель'],
  'roslyn': ['roslyn', 'рослин', 'рос', 'calm waters', 'спокойные воды', 'штиль'],
  'lyncis': ['lyncis', 'lynx', 'линсис', 'рысь', 'swish', 'вжух'],
  'meryl-ironheart': ['meryl ironheart', 'ironheart', 'мерил железное сердце', 'железное сердце', 'айронхарт', 'siege edge', 'стенолом'],
  'nan-yin': ['nan yin', 'nanyin', 'нань инь', 'нань ин', 'наньинь', 'purple bamboo', 'черный бамбук', 'пурпурный бамбук'],
  'salidy': ['salidy', 'салиди', 'bloodfin', 'кровавый плавник'],
  'xiuma': ['huma', 'хума', 'юма', 'molten shield', 'расплавленный щит'],
  'king': ['king', 'кинг', 'scythe of the crow', 'коса ворона'],
  'kekelite': ['coco', 'cocoritter', 'коко', 'кокориттер', 'коко риттер', 'absolute zero', 'абсолютный ноль', 'proof of trust', 'доказательство доверия'],
  'pepper': ['pepper', 'пеппер', 'staff of scars', 'посох шрамов'],
  'claudia-storm': ['claudia storm', 'claudia storm eye', 'клаудия око грозы', 'око грозы', 'scarlet gale', 'алый ветер'],
  'violin': ['harmopheus', 'гармофей', 'хармофей', 'скрипка', 'violin', 'neverrest', 'неверрест'],
  'asuka': ['asuka', 'аска', 'spear of longinus', 'копье лонгина'],
  'berry': ['berry', 'берри', 'charon', 'харон'],
  'brevey': ['brevey', 'бреви', 'бревей', 'pactcrest', 'метц'],
  'liu-huo': ['liu huo', 'liuhuo', 'лю хо', 'люхо', 'pine comet', 'сосновая комета'],
  'shiro': ['shiro', 'широ', 'сиро', 'chakram of the seas', 'чакра морей'],
  'feise': ['feise', 'fei se', 'фэй сэ', 'фей сэ', 'фейсе', 'фэйсэ', 'endless bloom', 'бесконечное цветение'],
  'avatar12': ['frigg', 'фригг', 'фриг', 'balmung', 'бальмунг'],
  'nanto': ['nanto', 'нанто', 'frostfang', 'хладноклык'],
  'fiona': ['fiona', 'фиона', 'moonstar bracelet', 'браслет луны и звезд'],
  'skull': ['bone', 'bonecrush', 'bone crush', 'кость', 'костяная', 'костяная дробь', 'дробь', 'silverfang', 'серебряный клык', 'wolf spirit', 'дух волка'],
  'annabella': ['annabella', 'аннабелла', 'clover cross', 'клеверный крест'],
  'aige': ['echo', 'эхо', 'thunderous halberd', 'громовая алебарда'],
  'claudia': ['claudia', 'клаудия', 'guren blade', 'клинок гурена'],
  'yulan': ['yu lan', 'yulan', 'юйлань', 'юлань', 'юй лань', 'юлан', 'unity', 'единство'],
  'ling': ['zero', 'зеро', 'нуль', 'negating cube', 'куб отрицания'],
  'saimier': ['samir', 'самир', 'семми', 'dual em stars', 'парные эм'],
  'lana': ['lana', 'лана', 'evolution cube', 'куб эволюции'],
  'make': ['marc', 'mark', 'марк', 'dawn', 'заря'],
  'huang': ['mimi', 'huang', 'мими', 'хуан', 'azure dragon', 'лазурный дракон'],
  'nora': ['nola', 'nora', 'нола', 'нора', 'rumble', 'грохот'],
  'umi': ['umi', 'уми', 'mobius', 'мебиус', 'мёбиус'],
  'icarus': ['icarus', 'икар', 'precious one', 'драгоценность'],
  'zeke': ['zeke', 'ming jing', 'mingjing', 'зик', 'зике', 'зек', 'мин цзин', 'минцзин', 'onyx tortoise', 'ониксовая черепаха'],
  'zoey': ['zoey', 'зои', 'rosebud', 'розовый бутон', 'child of lockhart', 'дитя локхарта'],
  'anka': ['anka', 'анка', 'poppin stick', 'леденец'],
  'xinghuan': ['lyra', 'лира', 'vesper', 'вечерня'],
  'sifengyuanyu': ['tsubasa', 'цубаса', 'цуба', 'icewind arrow', 'ледяная стрела'],
  'bai-ling': ['bai ling', 'bailing', 'бай лин', 'байлин', 'nightingale', 'соловьиное перышко'],
  'lin': ['lin', 'лин', 'линь', 'shadoweave', 'теневое плетение', 'плетение теней'],
  'gulan': ['cobalt', 'cobalt-b', 'кобальт', 'кобальт би', 'кобальт-би', 'flaming revolver', 'пылающий револьвер'],
  'wuwan': ['crow', 'кроу', 'ворон', 'thunderblades', 'грозовые клинки'],
};

/**
 * World boss matrix aliases from legacy comp-data.js.
 */
export const BOSS_MATRIX_ALIASES: Record<string, string[]> = {
  suit_ssr26: ['nakia', 'nakya', 'накия', 'барабаны', 'отзвуки барабанов', 'drums', 'reverberating drums'],
  suit_ssr25: ['haboela', 'habo', 'хабоела', 'хабо', 'пепельный дождь', 'ash rain', 'volcanic ash rain'],
  suit_ssr11: ['scylla', 'сцилла', 'фанатичное преследование', 'fanatical pursuit', 'pursuit'],
  suit_sr6: ['barbarossa', 'барбаросса', 'без остановки', 'nonstop'],
  suit_sr5: ['frost bot', 'фрост бот', 'двойной кошмар', 'double nightmares'],
  suit_sr4: ['sobek', 'собек', 'болотная тень', 'swamp shadow', 'swamp'],
  suit_sr3: ['robarg', 'робарг', 'экстремальный холод', 'extreme zero'],
  suit_sr2: ['apophis', 'апофис', 'внутренняя борьба', 'internal struggle'],
  suit_sr1: ['devourer', 'поглотитель'],
};

/**
 * Authentic circular matrix trait icon resolution base URL path.
 */
export const MATRIX_TRAIT_ICON_BASE = '/datamine/shared/media/Hotta/Content/Resources/Icon/Matrix/';

/**
 * Mapping table from simulacrum ID, lowercase stem, or matrix suit ID to circular portrait.
 */
export const SIMULACRA_MATRIX_ICONS: Record<string, string> = {
  wrenna: 'Wrenna.webp',
  zoey: 'zuoyi.webp',
  'rei-ayanami': 'lingboli_2x.webp',
  huang: 'mimi.webp',
  'ji-yu': 'jiyu.webp',
  stabdagger: 'aisite.webp',
  avatar06: 'nameixisi.webp',
  nemesis: 'nameixisi.webp',
  'nemesis-voidpiercer': 'naimeixisiLK.webp',
  ciper: 'xipeier.webp',
  ageleia: 'GreyFoxSp_2x.webp',
  yanmiao: 'yanmiao.webp',
  puppeteer: 'helene.webp',
  meryl: 'meryl_2x.webp',
  gnonno: 'genuonuo_2x.webp',
  alyss: 'ailisi_2x.webp',
  baiyuekui: 'whitemoon_2x.webp',
  lechesis: 'laikexisi.webp',
  'tian-lang': 'tianlang_2x.webp',
  lan: 'lan_2x.webp',
  veronika: 'weiluonika.webp',
  antoria: 'antuoliya.webp',
  'saki-fuwa': 'bupoxiao.webp',
  greyfox: 'huihu_2x.webp',
  'ling-han': 'linhan_2x.webp',
  plotti: 'paluodi.webp',
  rubilia: 'leibiliya_2x.webp',
  asilada: 'Asurada.webp',
  hilda: 'hilda_2x.webp',
  fenrir: 'fenlier.webp',
  ruby: 'leibei_2x.webp',
  gefion: 'geerfeiyin.webp',
  carrot: 'huluobei_2x.webp',
  ene: 'xi_2x.webp',
  yanuo: 'yanuo.webp',
  roslyn: 'luosilin_2x.webp',
  lyncis: 'linsai.webp',
  'meryl-ironheart': 'meilierkai_2x.webp',
  'nan-yin': 'nanyin.webp',
  salidy: 'shaledi.webp',
  xiuma: 'huma_2x.webp',
  king: 'KING_2x.webp',
  kekelite: 'cocoritter_2x.webp',
  pepper: 'peppa_2x.webp',
  'claudia-storm': 'kelaodiyaFBY_2x.webp',
  violin: 'hemofeisi.webp',
  asuka: 'mingrixiang_2x.webp',
  berry: 'Berry.webp',
  brevey: 'buluowei_2x.webp',
  'liu-huo': 'liuhuo.webp',
  shiro: 'shiro_2x.webp',
  feise: 'feise.webp',
  avatar12: 'fulijia.webp',
  frigg: 'fulijia.webp',
  nanto: 'nandou.webp',
  fiona: 'feiouna_2x.webp',
  skull: 'skull.webp',
  annabella: 'annabeila.webp',
  aige: 'manaka_2x.webp',
  claudia: 'claudia_2x.webp',
  yulan: 'yulan.webp',
  ling: 'zero_2x.webp',
  saimier: 'samir_2x.webp',
  lana: 'lana.webp',
  make: 'mark_2x.webp',
  nora: 'nuola_2x.webp',
  umi: 'wumi_2x.webp',
  icarus: 'yikaluosi_2x.webp',
  zeke: 'mingjing_2x.webp',
  anka: 'anke_2x.webp',
  xinghuan: 'xinghuan_2x.webp',
  sifengyuanyu: 'hane_2x.webp',
  'bai-ling': 'bailing_2x.webp',
  lin: 'linye.webp',
  gulan: 'cobalt_b_2x.webp',
  wuwan: 'karasuma_2x.webp',

  // Matrix suit ID direct keys
  suit_ssr71: 'Wrenna.webp',
  suit_ssr70: 'zuoyi.webp',
  suit_ssr44: 'lingboli_2x.webp',
  suit_ssr35: 'mimi.webp',
  suit_ssr45: 'jiyu.webp',
  suit_ssr57: 'aisite.webp',
  suit_ssr14: 'nameixisi.webp',
  suit_ssr53: 'naimeixisiLK.webp',
  suit_ssr48: 'nuola_2x.webp',
  suit_ssr47: 'anke_2x.webp',
  suit_ssr46: 'luosilin_2x.webp',
  suit_ssr43: 'mingrixiang_2x.webp',
  suit_ssr42: 'yanuo.webp',
  suit_ssr41: 'paluodi.webp',
  suit_ssr40: 'buluowei_2x.webp',
  suit_ssr39: 'yanmiao.webp',
  suit_ssr38: 'nanyin.webp',
  suit_ssr37: 'linhan_2x.webp',
  suit_ssr36: 'feise.webp',
  suit_ssr34: 'mingjing_2x.webp',
  suit_ssr33: 'yulan.webp',
  suit_ssr32: 'liuhuo.webp',
  suit_ssr31: 'leibiliya_2x.webp',
  suit_ssr30: 'genuonuo_2x.webp',
  suit_ssr29: 'feiouna_2x.webp',
  suit_ssr28: 'yikaluosi_2x.webp',
  suit_ssr27: 'lan_2x.webp',
  suit_ssr24: 'fenlier.webp',
  suit_ssr23: 'wumi_2x.webp',
  suit_ssr22: 'ailisi_2x.webp',
  suit_ssr21: 'annabeila.webp',
  suit_ssr20: 'tianlang_2x.webp',
  suit_ssr19: 'xinghuan_2x.webp',
  suit_ssr18: 'linye.webp',
  suit_ssr17: 'bupoxiao.webp',
  suit_ssr16: 'leibei_2x.webp',
  suit_ssr15: 'fulijia.webp',
  suit_ssr13: 'whitemoon_2x.webp',
  suit_ssr12: 'mark_2x.webp',
  suit_ssr10: 'huma_2x.webp',
  suit_ssr9: 'samir_2x.webp',
  suit_ssr8: 'zero_2x.webp',
  suit_ssr7: 'shiro_2x.webp',
  suit_ssr6: 'claudia_2x.webp',
  suit_ssr5: 'cobalt_b_2x.webp',
  suit_ssr4: 'KING_2x.webp',
  suit_ssr3: 'cocoritter_2x.webp',
  suit_ssr2: 'hane_2x.webp',
  suit_ssr1: 'meryl_2x.webp',
  suit_ssr49: 'meilierkai_2x.webp',
  suit_ssr50: 'Asurada.webp',
  suit_ssr51: 'huihu_2x.webp',
  suit_ssr52: 'kelaodiyaFBY_2x.webp',
  suit_ssr54: 'xipeier.webp',
  suit_ssr55: 'huluobei_2x.webp',
  suit_ssr56: 'linsai.webp',
  suit_ssr58: 'laikexisi.webp',
  suit_ssr59: 'helene.webp',
  suit_ssr60: 'weiluonika.webp',
  suit_ssr61: 'nandou.webp',
  suit_ssr63: 'lana.webp',
  suit_ssr64: 'shaledi.webp',
  suit_ssr66: 'Berry.webp',
  suit_ssr67: 'hemofeisi.webp',
  suit_ssr68: 'skull.webp',
  suit_ssr69: 'geerfeiyin.webp',
  suit_sr7: 'hilda_2x.webp',
  suit_sr8: 'xi_2x.webp',
  suit_sr9: 'bailing_2x.webp',
  suit_sr12: 'manaka_2x.webp',
};

export const RELIC_PROP_ICONS: Record<string, string> = {
  attack: '/datamine/shared/assets/icons/relics/type_attack.webp',
  defense: '/datamine/shared/assets/icons/relics/type_defense.webp',
  assist: '/datamine/shared/assets/icons/relics/type_assist.webp',
  function: '/datamine/shared/assets/icons/relics/type_function.webp',
};

/** Localized text in the page language (`getLocalizedValue` of @tof-hub/game-domain). */
export const getLocalizedText = getLocalizedValue;

/**
 * Resolves simulacrum avatar through canonical game asset resolver.
 */
export function resolveCompSimulacrumAvatar(simOrAvatar: CompSimulacrumView | string): string {
  if (!simOrAvatar) return '';
  const path = typeof simOrAvatar === 'string' ? simOrAvatar : simOrAvatar.avatar;
  return gameAsset(path);
}

/**
 * Resolves simulacrum card illustration through canonical game asset resolver.
 */
export function resolveCompSimulacrumCard(simOrCard: CompSimulacrumView | string): string {
  if (!simOrCard) return '';
  const path = typeof simOrCard === 'string' ? simOrCard : simOrCard.card;
  return gameAsset(path);
}

/**
 * Resolves weapon icon through canonical game asset resolver.
 */
export function resolveCompWeaponIcon(weaponOrIcon: CompWeaponView | string): string {
  if (!weaponOrIcon) return '';
  const path = typeof weaponOrIcon === 'string' ? weaponOrIcon : weaponOrIcon.icon || weaponOrIcon.avatar;
  return gameAsset(path);
}

/**
 * Resolves authentic circular matrix trait icon with graceful fallback to character avatar.
 */
export function resolveCompTraitIcon(simOrId: CompSimulacrumView | string): string {
  if (!simOrId) return '';

  let id = '';
  let matrixSuitId: string | null = null;
  let avatar = '';

  if (typeof simOrId === 'string') {
    id = simOrId.trim();
  } else {
    id = simOrId.id || '';
    matrixSuitId = simOrId.matrixSuitId;
    avatar = simOrId.avatar;
    if (simOrId.traitIcon) return gameAsset(simOrId.traitIcon);
  }

  const key = id.toLowerCase();
  let filename = SIMULACRA_MATRIX_ICONS[key] || SIMULACRA_MATRIX_ICONS[id];

  if (!filename && matrixSuitId) {
    filename = SIMULACRA_MATRIX_ICONS[matrixSuitId.toLowerCase()];
  }

  if (filename) {
    return gameAsset(MATRIX_TRAIT_ICON_BASE + filename);
  }

  if (avatar) {
    return gameAsset(avatar);
  }

  return '';
}

/**
 * Resolves matrix icon / portrait through canonical game asset resolver.
 */
export function resolveCompMatrixIcon(matOrIcon: CompMatrixView | string): string {
  if (!matOrIcon) return '';
  // Legacy parity (comp-ui.js): small chip icon first, suit portrait as fallback.
  const path = typeof matOrIcon === 'string' ? matOrIcon : matOrIcon.icon || matOrIcon.suitPortrait;
  return gameAsset(path);
}

/**
 * Resolves relic icon through canonical game asset resolver.
 */
export function resolveCompRelicIcon(relicOrIcon: CompRelicView | string): string {
  if (!relicOrIcon) return '';
  const path = typeof relicOrIcon === 'string' ? relicOrIcon : relicOrIcon.icon;
  return gameAsset(path);
}

/**
 * Resolves combat pet icon through canonical game asset resolver.
 */
export function resolveCompPetIcon(petOrIcon: CompPetView | string): string {
  if (!petOrIcon) return '';
  const path = typeof petOrIcon === 'string' ? petOrIcon : petOrIcon.icon;
  return gameAsset(path);
}

/** Role and element icons: the Info filter icons (simulacra/constants), as on the Build and Ranking pages. */
const roleIcon = (id: string) => ROLE_FILTER_OPTIONS.find((option) => option.id === id)?.iconPath ?? '';
export const COMP_ROLE_ICONS: Record<string, string> = {
  tank: roleIcon('tank'),
  healer: roleIcon('benediction'),
  benediction: roleIcon('benediction'),
  support: roleIcon('benediction'),
  dps: roleIcon('dps'),
  attack: roleIcon('dps'),
  // Balance has no Info filter: the resonance icon of the game's balance buff.
  balance: '/datamine/shared/media/Hotta/Content/Resources/UI/AutoChess/buff_junheng.webp',
  balanced: '/datamine/shared/media/Hotta/Content/Resources/UI/AutoChess/buff_junheng.webp',
};

export const COMP_ELEMENT_ICONS: Record<string, string> = Object.fromEntries(
  ELEMENT_FILTER_OPTIONS.filter((option) => option.iconPath).map((option) => [
    option.id.charAt(0).toUpperCase() + option.id.slice(1),
    option.iconPath!,
  ]),
);

/**
 * Resolves canonical role icon through canonical game asset resolver.
 */
export function resolveCompRoleIcon(roleOrIcon: CompRole | string): string {
  if (!roleOrIcon) return '';
  if (typeof roleOrIcon === 'object' && (roleOrIcon as any).icon) {
    return gameAsset((roleOrIcon as any).icon);
  }
  const key = String(roleOrIcon).toLowerCase();
  const icon = COMP_ROLE_ICONS[key] || String(roleOrIcon);
  return gameAsset(icon);
}

/**
 * Resolves element icon through canonical game asset resolver.
 */
export function resolveCompElementIcon(elem: string): string {
  if (!elem) return '';
  const icon = COMP_ELEMENT_ICONS[elem] || COMP_ELEMENT_ICONS[normalizeElement(elem)] || '';
  return icon ? gameAsset(icon) : '';
}

export interface CompWeaponElementBadge {
  kind: 'combo' | 'dual' | 'single' | 'none';
  icons: string[];
  title: string;
}

/**
 * Legacy parity (comp-ui.js): weapon element badge prefers the combined
 * element icon, then a dual primary/secondary pair, then a single icon.
 */
export function resolveCompWeaponElementBadge(
  w: Pick<CompWeaponView, 'element' | 'elementSecondary' | 'elementComboIcon'> | null | undefined
): CompWeaponElementBadge {
  if (!w) return { kind: 'none', icons: [], title: '' };
  const comboIcon = w.elementComboIcon || getDualElementIconPath(w.element, w.elementSecondary);
  if (comboIcon) {
    const pair = w.element + (w.elementSecondary ? ` / ${w.elementSecondary}` : '');
    return { kind: 'combo', icons: [gameAsset(comboIcon)], title: pair };
  }
  const primary = w.element ? resolveCompElementIcon(w.element) : '';
  const secondary = w.elementSecondary ? resolveCompElementIcon(w.elementSecondary) : '';
  if (primary && secondary) {
    return { kind: 'dual', icons: [primary, secondary], title: `${w.element} / ${w.elementSecondary}` };
  }
  if (primary) return { kind: 'single', icons: [primary], title: w.element };
  return { kind: 'none', icons: [], title: '' };
}

/**
 * Resolves relic property icon.
 */
export function resolveCompPropertyIcon(property: string): string {
  const p = (property || 'attack').toLowerCase();
  return RELIC_PROP_ICONS[p] || RELIC_PROP_ICONS.attack;
}

/**
 * Maps raw weapon role string to canonical role ID ('tank' | 'healer' | 'dps' | 'balance').
 */
export function canonicalizeRole(role: unknown): CompRoleKey {
  if (!role) return 'dps';
  const r = String(role).toLowerCase().trim();
  if (r === 'tank' || r === 'fortitude' || r === 'защита') return 'tank';
  if (r === 'benediction' || r === 'healer' || r === 'heal' || r === 'благословение' || r === 'хил') return 'support';
  if (r === 'attack' || r === 'dps' || r === 'нападение' || r === 'дд') return 'dps';
  if (r === 'balance' || r === 'bal' || r === 'баланс') return 'balanced';
  return 'dps';
}

export {compareRelics,getSuitNumber,compareCompItemsByNewest} from "../info-sections/common/catalog-release-order";

/**
 * Evaluates entity search score against raw and compact queries.
 */
export function scoreAndMatchEntity(
  entity: any,
  rawQuery: string,
  compactQuery?: string
): { match: boolean; score: number } {
  if (!rawQuery) return { match: true, score: 0 };

  const id = (entity.id || '').toLowerCase();
  const idCompact = normalizeCompact(entity.id || '');
  const nameEn = (entity.name?.en || entity.name_en || '').toLowerCase();
  const nameRu = (entity.name?.ru || entity.name_ru || '').toLowerCase();
  const simNameEn = (entity.simName?.en || entity.sim_name_en || '').toLowerCase();
  const simNameRu = (entity.simName?.ru || entity.sim_name_ru || '').toLowerCase();
  const weaponNameEn = (entity.weaponName?.en || entity.weapon_name_en || '').toLowerCase();
  const weaponNameRu = (entity.weaponName?.ru || entity.weapon_name_ru || '').toLowerCase();

  // 1. Exact match
  if (
    rawQuery === id ||
    rawQuery === nameEn ||
    rawQuery === nameRu ||
    rawQuery === simNameEn ||
    rawQuery === simNameRu ||
    rawQuery === weaponNameEn ||
    rawQuery === weaponNameRu ||
    (compactQuery &&
      (compactQuery === idCompact ||
        compactQuery === normalizeCompact(nameEn) ||
        compactQuery === normalizeCompact(nameRu) ||
        compactQuery === normalizeCompact(simNameEn) ||
        compactQuery === normalizeCompact(simNameRu) ||
        compactQuery === normalizeCompact(weaponNameEn) ||
        compactQuery === normalizeCompact(weaponNameRu)))
  ) {
    return { match: true, score: 100 };
  }

  // Exact match on alias
  if (Array.isArray(entity.aliases)) {
    for (const a of entity.aliases) {
      if (!a) continue;
      const an = normalizeStr(a);
      const ac = normalizeCompact(a);
      if (rawQuery === an || (compactQuery && compactQuery === ac)) {
        return { match: true, score: 95 };
      }
    }
  }

  let score = 0;
  let matched = false;

  // 2. Prefix match
  if (
    nameEn.startsWith(rawQuery) ||
    nameRu.startsWith(rawQuery) ||
    simNameEn.startsWith(rawQuery) ||
    simNameRu.startsWith(rawQuery) ||
    weaponNameEn.startsWith(rawQuery) ||
    weaponNameRu.startsWith(rawQuery) ||
    id.startsWith(rawQuery) ||
    (compactQuery &&
      (normalizeCompact(nameEn).startsWith(compactQuery) ||
        normalizeCompact(nameRu).startsWith(compactQuery) ||
        normalizeCompact(simNameEn).startsWith(compactQuery) ||
        normalizeCompact(simNameRu).startsWith(compactQuery) ||
        normalizeCompact(weaponNameEn).startsWith(compactQuery) ||
        normalizeCompact(weaponNameRu).startsWith(compactQuery)))
  ) {
    score = Math.max(score, 85);
    matched = true;
  }

  // Prefix match on alias
  if (Array.isArray(entity.aliases)) {
    for (const a of entity.aliases) {
      if (!a) continue;
      const an = normalizeStr(a);
      const ac = normalizeCompact(a);
      if (an.startsWith(rawQuery) || (compactQuery && ac.startsWith(compactQuery))) {
        score = Math.max(score, 80);
        matched = true;
        break;
      }
    }
  }

  // 3. Substring match
  if (!matched) {
    if (
      nameEn.includes(rawQuery) ||
      nameRu.includes(rawQuery) ||
      simNameEn.includes(rawQuery) ||
      simNameRu.includes(rawQuery) ||
      weaponNameEn.includes(rawQuery) ||
      weaponNameRu.includes(rawQuery) ||
      id.includes(rawQuery) ||
      (compactQuery &&
        (normalizeCompact(nameEn).includes(compactQuery) ||
          normalizeCompact(nameRu).includes(compactQuery) ||
          normalizeCompact(simNameEn).includes(compactQuery) ||
          normalizeCompact(simNameRu).includes(compactQuery) ||
          normalizeCompact(weaponNameEn).includes(compactQuery) ||
          normalizeCompact(weaponNameRu).includes(compactQuery)))
    ) {
      score = Math.max(score, 60);
      matched = true;
    }

    if (!matched && Array.isArray(entity.aliases)) {
      for (const a of entity.aliases) {
        if (!a) continue;
        const an = normalizeStr(a);
        const ac = normalizeCompact(a);
        if (an.includes(rawQuery) || (compactQuery && ac.includes(compactQuery))) {
          score = Math.max(score, 55);
          matched = true;
          break;
        }
      }
    }
  }

  return { match: matched, score };
}

export interface CompIndexes {
  simulacraById: Map<string, CompSimulacrumView>;
  simulacraByRole: Map<string, CompSimulacrumView[]>;
  simulacraByElement: Map<string, CompSimulacrumView[]>;
  weaponsById: Map<string, CompWeaponView>;
  weaponsByRole: Map<string, CompWeaponView[]>;
  weaponsByElement: Map<string, CompWeaponView[]>;
  matricesById: Map<string, CompMatrixView>;
  matricesByQuality: Map<string, CompMatrixView[]>;
  relicsById: Map<string, CompRelicView>;
  relicsByQuality: Map<string, CompRelicView[]>;
  petsById: Map<string, CompPetView>;
  rolesById: Map<string, CompRole>;
}

/**
 * Builds high-performance lookup maps and precomputes search aliases across the catalog.
 */
export function buildCompIndexes(catalog: CompCatalogView): CompIndexes {
  const indexes: CompIndexes = {
    simulacraById: new Map(),
    simulacraByRole: new Map(),
    simulacraByElement: new Map(),
    weaponsById: new Map(),
    weaponsByRole: new Map(),
    weaponsByElement: new Map(),
    matricesById: new Map(),
    matricesByQuality: new Map(),
    relicsById: new Map(),
    relicsByQuality: new Map(),
    petsById: new Map(),
    rolesById: new Map(),
  };

  const addToMap = <T>(map: Map<string, T[]>, key: string, item: T) => {
    if (!key) return;
    const k = key.toLowerCase();
    if (!map.has(k)) map.set(k, []);
    const arr = map.get(k)!;
    if (!arr.includes(item)) arr.push(item);
  };

  // 1. Roles
  for (const role of catalog.roles || []) {
    indexes.rolesById.set(role.id, role);
    indexes.rolesById.set(role.id.toLowerCase(), role);
  }

  // 2. Simulacra
  for (const sim of catalog.simulacra || []) {
    indexes.simulacraById.set(sim.id, sim);
    indexes.simulacraById.set(sim.id.toLowerCase(), sim);

    // Attach aliases from table
    const aliases = CHARACTER_ALIASES[sim.id] || CHARACTER_ALIASES[sim.id.toLowerCase()] || [];
    (sim as any).aliases = aliases;

    addToMap(indexes.simulacraByRole, sim.role, sim);
    addToMap(indexes.simulacraByElement, sim.element, sim);
    if (sim.elementSecondary) {
      addToMap(indexes.simulacraByElement, sim.elementSecondary, sim);
    }
  }

  // 3. Weapons
  const weapons = catalog.weapons || [];
  for (const w of weapons) {
    indexes.weaponsById.set(w.id, w);
    indexes.weaponsById.set(w.id.toLowerCase(), w);
    if (w.weaponId && w.weaponId !== w.id) {
      indexes.weaponsById.set(w.weaponId, w);
      indexes.weaponsById.set(w.weaponId.toLowerCase(), w);
    }

    const aliases = CHARACTER_ALIASES[w.simulacrumId] || CHARACTER_ALIASES[w.id.toLowerCase()] || [];
    (w as any).aliases = aliases;

    addToMap(indexes.weaponsByRole, w.role, w);
    addToMap(indexes.weaponsByRole, w.canonicalRole, w);
    addToMap(indexes.weaponsByElement, w.element, w);
    if (w.elementSecondary) {
      addToMap(indexes.weaponsByElement, w.elementSecondary, w);
    }
  }

  // 4. Matrices
  for (const mat of catalog.matrices || []) {
    indexes.matricesById.set(mat.id, mat);
    indexes.matricesById.set(mat.id.toLowerCase(), mat);

    const aliases = [...(BOSS_MATRIX_ALIASES[mat.id.toLowerCase()] || [])];
    (mat as any).aliases = aliases;

    addToMap(indexes.matricesByQuality, mat.quality, mat);
  }

  // Cross-reference matrices with characters
  for (const sim of catalog.simulacra || []) {
    if (sim.matrixSuitId) {
      const mat = indexes.matricesById.get(sim.matrixSuitId.toLowerCase());
      if (mat) {
        if (!mat.simulacrumId) mat.simulacrumId = sim.id;
        if (!mat.simName) mat.simName = sim.name;
        if (!(mat as any).aliases) (mat as any).aliases = [];
        (mat as any).aliases.push(
          sim.id,
          sim.name.en,
          sim.name.ru,
          sim.weaponName.en,
          sim.weaponName.ru,
          ...((sim as any).aliases || [])
        );
      }
    }
  }

  // 5. Relics
  for (const relic of catalog.relics || []) {
    indexes.relicsById.set(relic.id, relic);
    indexes.relicsById.set(relic.id.toLowerCase(), relic);
    addToMap(indexes.relicsByQuality, relic.quality, relic);
  }

  // 6. Pets
  for (const pet of catalog.pets || []) {
    indexes.petsById.set(pet.id, pet);
    indexes.petsById.set(pet.id.toLowerCase(), pet);
  }

  return indexes;
}

// In-memory runtime cache for parsed CompCatalogView
const catalogMemoryCache = new Map<string, CompCatalogView>();

/**
 * Fetches and adapts the Squad & Raid Comp Builder catalog.
 */
export async function fetchCompCatalog(options: {
  locale?: string;
  baseUrl?: string;
  fetchFn?: typeof fetch;
} = {}): Promise<CompCatalogView> {
  const locale = options.locale || 'en';
  const cacheKey = `comp:${locale}`;
  if (catalogMemoryCache.has(cacheKey)) {
    return catalogMemoryCache.get(cacheKey)!;
  }

  const fetchFn = options.fetchFn || (typeof window !== 'undefined' ? window.fetch.bind(window) : fetch);
  const base = (options.baseUrl || '/game-data').replace(/\/+$/, '');

  const url = `${base}/${locale}/runtime/comp.json`;
  const response = await fetchFn(url);
  if (!response.ok) throw new Error(`Failed to load comp catalog (HTTP ${response.status})`);
  const rawJson = await response.json();

  const domainCatalog = adaptCompCatalog(rawJson);

  // Validate at runtime boundary
  const parsed = CompCatalogSchema.safeParse(domainCatalog);
  const finalCatalog = parsed.success ? parsed.data : domainCatalog;

  catalogMemoryCache.set(cacheKey, finalCatalog);
  return finalCatalog;
}

/**
 * Synchronously loads catalog data from a pre-loaded JSON object.
 */
export function loadCompCatalogSync(rawJson: unknown): CompCatalogView {
  const domainCatalog = adaptCompCatalog(rawJson);
  return domainCatalog;
}

/**
 * React hook to load and index the Comp Catalog with reactive state.
 */
export function useCompCatalog(options: {
  locale?: string;
  initialData?: CompCatalogView;
} = {}) {
  const locale = options.locale || 'en';
  const [catalog, setCatalog] = useState<CompCatalogView | null>(options.initialData || null);
  const [isLoading, setIsLoading] = useState(!options.initialData);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchCompCatalog({ locale });
      setCatalog(data);
    } catch (err: any) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [locale]);

  useEffect(() => {
    if (!catalog || options.locale) {
      load();
    }
  }, [load, options.locale]);

  const indexes = useMemo(() => {
    if (!catalog) return null;
    return buildCompIndexes(catalog);
  }, [catalog]);

  return {
    catalog,
    indexes,
    isLoading,
    error,
    refetch: load,
  };
}
