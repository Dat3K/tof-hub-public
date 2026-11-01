import type { SortOption } from '@tof-hub/ui';
import type {
  CosmeticCategory,
  CosmeticItem,
  CosmeticsStrings,
  MountCraftingPart,
} from './types';

export const DEFAULT_COSMETICS_SORT = 'order_desc';

export interface CosmeticCategoryOption {
  id: CosmeticCategory;
  copyKey: keyof CosmeticsStrings;
  icon?: string;
}

export const COSMETIC_CATEGORY_OPTIONS: CosmeticCategoryOption[] = [
  { id: 'all', copyKey: 'all' },
  { id: 'SimulacrumHauteCouture', copyKey: 'typeHauteCouture', icon: 'sparkle' },
  { id: 'Dress', copyKey: 'typeDress', icon: 'dress' },
  { id: 'Headwear', copyKey: 'typeHeadwear', icon: 'headwear' },
  { id: 'Glider', copyKey: 'typeGlider', icon: 'glider' },
  { id: 'GuideNPC', copyKey: 'typeServant', icon: 'servant' },
  { id: 'Medal', copyKey: 'typeMedal', icon: 'medal' },
  { id: 'CutePet', copyKey: 'typeCutePet', icon: 'pet' },
  { id: 'Mount', copyKey: 'typeMount', icon: 'mount' },
  { id: 'Enemies', copyKey: 'typeEnemies', icon: 'enemy' },
  { id: 'Title', copyKey: 'typeTitle', icon: 'medal' },
  { id: 'Avatar', copyKey: 'typeAvatar', icon: 'avatar' },
  { id: 'AvatarFrame', copyKey: 'typeAvatarFrame', icon: 'frame' },
  { id: 'ChatBubble', copyKey: 'typeChatBubble', icon: 'chat' },
  { id: 'ChatBox', copyKey: 'typeChatBox', icon: 'chatbox' },
  { id: 'ChatSticker', copyKey: 'typeChatSticker', icon: 'chat' },
  { id: 'Badge', copyKey: 'typeBadge', icon: 'medal' },
];

export function getCosmeticsSortOptions(strings: CosmeticsStrings): SortOption[] {
  return [
    { value: 'order_desc', label: strings.sortOrderDesc },
    { value: 'order_asc', label: strings.sortOrderAsc },
    { value: 'name', label: strings.sortName, dividerBefore: true },
    { value: 'name_desc', label: strings.sortNameDesc },
    { value: 'quality', label: strings.sortQuality, dividerBefore: true },
    { value: 'quality_asc', label: strings.sortQualityAsc },
  ];
}

export const MOUNT_CRAFTING_PARTS: Record<string, MountCraftingPart[]> = {
  Mount2: [
    {
      id: 'Mount_002_a',
      name: 'Magnetic Rod',
      name_en: 'Magnetic Rod',
      name_ru: 'Магнитный стержень',
      title: 'Magnetic Rod',
      count: 1,
      quantity: 1,
      quality: 'SSR',
      icon: '/datamine/shared/media/Hotta/Content/Resources/Icon/Mount/Mount_002_a.webp',
      source: '📍 Rusty Belt: Top of the abandoned tower in Astra',
      source_en: '📍 Rusty Belt: Top of the abandoned tower in Astra',
      source_ru: '📍 Ржавый пояс: На вершине заброшенной башни в Астре',
      location: '📍 Rusty Belt: Top of the abandoned tower in Astra',
      location_en: '📍 Rusty Belt: Top of the abandoned tower in Astra',
      location_ru: '📍 Ржавый пояс: На вершине заброшенной башни в Астре',
      lore: 'This is not for hanging clothes out to dry! An abandoned tower in the Rusty Belt. Is someone trying to put something on it?',
      lore_en: 'This is not for hanging clothes out to dry! An abandoned tower in the Rusty Belt. Is someone trying to put something on it?',
      lore_ru: 'Не для вывешивания одежды на просушку! Заброшенная башня в Ржавом поясе. Кто-то пытается что-то на нее повесить?',
    },
    {
      id: 'Mount_002_b',
      name: 'Maglev Stalker',
      name_en: 'Maglev Stalker',
      name_ru: 'Маглев-сталкер',
      title: 'Maglev Stalker',
      count: 1,
      quantity: 1,
      quality: 'SSR',
      icon: '/datamine/shared/media/Hotta/Content/Resources/Icon/Mount/Mount_002_b.webp',
      source: '📍 Astra / Crown / Warren: Drop from Vermin Brothers (鼠怪)',
      source_en: '📍 Astra / Crown / Warren: Drop from Vermin Brothers (鼠怪)',
      source_ru: '📍 Астра / Крон / Уоррен: Выпадает из Братьев-грызунов (鼠怪)',
      location: '📍 Astra / Crown / Warren: Drop from Vermin Brothers (鼠怪)',
      location_en: '📍 Astra / Crown / Warren: Drop from Vermin Brothers (鼠怪)',
      location_ru: '📍 Астра / Крон / Уоррен: Выпадает из Братьев-грызунов (鼠怪)',
      drop_rate: '0.15% (0.45% at 100+ kills)',
      dropRate: '0.15% (0.45% at 100+ kills)',
      lore: 'A core motor stolen and guarded fiercely by the Vermin Brothers.',
      lore_en: 'A core motor stolen and guarded fiercely by the Vermin Brothers.',
      lore_ru: 'Основной двигатель, украденный и яростно охраняемый Братьями-грызунами.',
    },
  ],
  Mount3: [
    {
      id: 'Mount_003_a',
      name: 'Omnium Forearm',
      name_en: 'Omnium Forearm',
      name_ru: 'Омниумное предплечье',
      title: 'Omnium Forearm',
      count: 1,
      quantity: 1,
      quality: 'SSR',
      icon: '/datamine/shared/media/Hotta/Content/Resources/Icon/Mount/Mount_003_a.webp',
      source: '📍 Banges: Ruin E-01 (Normal / Hard difficulty chest)',
      source_en: '📍 Banges: Ruin E-01 (Normal / Hard difficulty chest)',
      source_ru: '📍 Бэнджес: Руины E-01 (Сундук обычной/высокой сложности)',
      location: '📍 Banges: Ruin E-01 (Normal / Hard difficulty chest)',
      location_en: '📍 Banges: Ruin E-01 (Normal / Hard difficulty chest)',
      location_ru: '📍 Бэнджес: Руины E-01 (Сундук обычной/высокой сложности)',
      lore: 'High-torque hydraulic articulation arm for heavy industrial bipedal units.',
      lore_en: 'High-torque hydraulic articulation arm for heavy industrial bipedal units.',
      lore_ru: 'Гидравлическое предплечье с высоким крутящим моментом для тяжелых шагоходов.',
    },
    {
      id: 'Mount_003_b',
      name: 'Omnium Cockpit',
      name_en: 'Omnium Cockpit',
      name_ru: 'Омниумная кабина',
      title: 'Omnium Cockpit',
      count: 1,
      quantity: 1,
      quality: 'SSR',
      icon: '/datamine/shared/media/Hotta/Content/Resources/Icon/Mount/Mount_003_b.webp',
      source: '📍 Banges: Signal Station puzzle at Rig FC-11',
      source_en: '📍 Banges: Signal Station puzzle at Rig FC-11',
      source_ru: '📍 Бэнджес: Головоломка сигнальной станции на вышке FC-11',
      location: '📍 Banges: Signal Station puzzle at Rig FC-11',
      location_en: '📍 Banges: Signal Station puzzle at Rig FC-11',
      location_ru: '📍 Бэнджес: Головоломка сигнальной станции на вышке FC-11',
      lore: 'Armored hermetic cockpit capsule providing EMP and radiation shielding.',
      lore_en: 'Armored hermetic cockpit capsule providing EMP and radiation shielding.',
      lore_ru: 'Бронированная герметичная кабина с защитой от ЭМИ и радиации.',
    },
    {
      id: 'Mount_003_c',
      name: 'Omnium Left Arm',
      name_en: 'Omnium Left Arm',
      name_ru: 'Омниумная левая рука',
      title: 'Omnium Left Arm',
      count: 1,
      quantity: 1,
      quality: 'SSR',
      icon: '/datamine/shared/media/Hotta/Content/Resources/Icon/Mount/Mount_003_c.webp',
      source: '📍 Banges / Crown / Warren: Drop from Devint (巨怪) aberrant giants',
      source_en: '📍 Banges / Crown / Warren: Drop from Devint (巨怪) aberrant giants',
      source_ru: '📍 Бэнджес / Крон / Уоррен: Выпадает из аберрантных гигантов Devint (巨怪)',
      location: '📍 Banges / Crown / Warren: Drop from Devint (巨怪) aberrant giants',
      location_en: '📍 Banges / Crown / Warren: Drop from Devint (巨怪) aberrant giants',
      location_ru: '📍 Бэнджес / Крон / Уоррен: Выпадает из аберрантных гигантов Devint (巨怪)',
      drop_rate: '0.12% (0.40% at 100+ kills)',
      dropRate: '0.12% (0.40% at 100+ kills)',
      lore: 'Reinforced servo limb salvaged from aberrant wasteland behemoths.',
      lore_en: 'Reinforced servo limb salvaged from aberrant wasteland behemoths.',
      lore_ru: 'Усиленный сервопривод конечности, добытый у чудовищ пустошей.',
    },
  ],
  Mount4: [
    {
      id: 'Mount_004_a',
      name: 'Unicorn Power Supply',
      name_en: 'Unicorn Power Supply',
      name_ru: 'Блок питания Единорога',
      title: 'Unicorn Power Supply',
      count: 1,
      quantity: 1,
      quality: 'SSR',
      icon: '/datamine/shared/media/Hotta/Content/Resources/Icon/Mount/Mount_004_a.webp',
      source: '📍 Navia: Hidden barrier generator puzzle at Raincaller Island',
      source_en: '📍 Navia: Hidden barrier generator puzzle at Raincaller Island',
      source_ru: '📍 Навия: Секретная головоломка генератора барьера на острове Дождевика',
      location: '📍 Navia: Hidden barrier generator puzzle at Raincaller Island',
      location_en: '📍 Navia: Hidden barrier generator puzzle at Raincaller Island',
      location_ru: '📍 Навия: Секретная головоломка генератора барьера на острове Дождевика',
      lore: 'Miniaturized fusion core generating sustained plasma currents.',
      lore_en: 'Miniaturized fusion core generating sustained plasma currents.',
      lore_ru: 'Миниатюрный термоядерный реактор, генерирующий плазменные токи.',
    },
    {
      id: 'Mount_004_b',
      name: 'Unicorn Bionic Limbs',
      name_en: 'Unicorn Bionic Limbs',
      name_ru: 'Бионические ноги Единорога',
      title: 'Unicorn Bionic Limbs',
      count: 1,
      quantity: 1,
      quality: 'SSR',
      icon: '/datamine/shared/media/Hotta/Content/Resources/Icon/Mount/Mount_004_b.webp',
      source: '📍 Warren: Electronic password door (Code 7092) in Aarniel Fortress',
      source_en: '📍 Warren: Electronic password door (Code 7092) in Aarniel Fortress',
      source_ru: '📍 Уоррен: Электронная дверь с паролем (Код 7092) в крепости Аарниэль',
      location: '📍 Warren: Electronic password door (Code 7092) in Aarniel Fortress',
      location_en: '📍 Warren: Electronic password door (Code 7092) in Aarniel Fortress',
      location_ru: '📍 Уоррен: Электронная дверь с паролем (Код 7092) в крепости Аарниэль',
      lore: 'Precision bionic limbs equipped with adaptive terrain shock dampeners.',
      lore_en: 'Precision bionic limbs equipped with adaptive terrain shock dampeners.',
      lore_ru: 'Точные бионические конечности с адаптивными амортизаторами рельефа.',
    },
    {
      id: 'Mount_004_c',
      name: 'Unicorn Cyberlimbs',
      name_en: 'Unicorn Cyberlimbs',
      name_ru: 'Киберконечности Единорога',
      title: 'Unicorn Cyberlimbs',
      count: 1,
      quantity: 1,
      quality: 'SSR',
      icon: '/datamine/shared/media/Hotta/Content/Resources/Icon/Mount/Mount_004_c.webp',
      source: '📍 Warren: Supply pod on the Goldrush Mountain cliff',
      source_en: '📍 Warren: Supply pod on the Goldrush Mountain cliff',
      source_ru: '📍 Уоррен: Капсула снабжения на скале горы Голд-Раш',
      location: '📍 Warren: Supply pod on the Goldrush Mountain cliff',
      location_en: '📍 Warren: Supply pod on the Goldrush Mountain cliff',
      location_ru: '📍 Уоррен: Капсула снабжения на скале горы Голд-Раш',
      lore: 'Lightweight titanium structural struts engineered for extreme sprint velocity.',
      lore_en: 'Lightweight titanium structural struts engineered for extreme sprint velocity.',
      lore_ru: 'Легкие титановые стойки, разработанные для максимальной скорости бега.',
    },
    {
      id: 'Mount_004_d',
      name: 'Unicorn Head (Mechanical Core)',
      name_en: 'Unicorn Head (Mechanical Core)',
      name_ru: 'Голова Единорога (Механическое ядро)',
      title: 'Unicorn Head (Mechanical Core)',
      count: 1,
      quantity: 1,
      quality: 'SSR',
      icon: '/datamine/shared/media/Hotta/Content/Resources/Icon/Mount/Mount_004_d.webp',
      source: '📍 Crown / Warren: Drop from Devoted Aberrant Zealots (祭司)',
      source_en: '📍 Crown / Warren: Drop from Devoted Aberrant Zealots (祭司)',
      source_ru: '📍 Крон / Уоррен: Выпадает из Фанатиков-жрецов (祭司)',
      location: '📍 Crown / Warren: Drop from Devoted Aberrant Zealots (祭司)',
      location_en: '📍 Crown / Warren: Drop from Devoted Aberrant Zealots (祭司)',
      location_ru: '📍 Крон / Уоррен: Выпадает из Фанатиков-жрецов (祭司)',
      drop_rate: '0.08% (0.35% at 100+ kills)',
      dropRate: '0.08% (0.35% at 100+ kills)',
      lore: 'Ornate mechanical equine head housing sensor arrays and an Omnium horn radiator.',
      lore_en: 'Ornate mechanical equine head housing sensor arrays and an Omnium horn radiator.',
      lore_ru: 'Механическая голова скакуна с сенсорными матрицами и излучателем-рогом.',
    },
  ],
  Mount11: [
    {
      id: 'Mount_011_a',
      name: 'Voyager: Engine',
      name_en: 'Voyager: Engine',
      name_ru: 'Вояджер: Двигатель',
      title: 'Voyager: Engine',
      count: 1,
      quantity: 1,
      quality: 'SSR',
      icon: '/datamine/shared/media/Hotta/Content/Resources/Icon/Mount/Mount_011_a.webp',
      source: '📍 Banges: Hyena base oil rig password & puzzle series',
      source_en: '📍 Banges: Hyena base oil rig password & puzzle series',
      source_ru: '📍 Бэнджес: Серия головоломок на нефтяной вышке Гиен',
      location: '📍 Banges: Hyena base oil rig password & puzzle series',
      location_en: '📍 Banges: Hyena base oil rig password & puzzle series',
      location_ru: '📍 Бэнджес: Серия головоломок на нефтяной вышке Гиен',
      lore: 'High-output ion propulsion engine crafted for high-altitude hovering.',
      lore_en: 'High-output ion propulsion engine crafted for high-altitude hovering.',
      lore_ru: 'Высокопроизводительный ионный двигатель для парения на большой высоте.',
    },
    {
      id: 'Mount_011_b',
      name: 'Voyager: Thruster',
      name_en: 'Voyager: Thruster',
      name_ru: 'Вояджер: Ускоритель',
      title: 'Voyager: Thruster',
      count: 1,
      quantity: 1,
      quality: 'SSR',
      icon: '/datamine/shared/media/Hotta/Content/Resources/Icon/Mount/Mount_011_b.webp',
      source: '📍 Navia: Low-probability drop from Four Powers (四权) mechs',
      source_en: '📍 Navia: Low-probability drop from Four Powers (四权) mechs',
      source_ru: '📍 Навия: Низкая вероятность выпадения из мехов Четырех Сил (四权)',
      location: '📍 Navia: Low-probability drop from Four Powers (四权) mechs',
      location_en: '📍 Navia: Low-probability drop from Four Powers (四权) mechs',
      location_ru: '📍 Навия: Низкая вероятность выпадения из мехов Четырех Сил (四权)',
      drop_rate: '0.20% (0.50% at 100+ kills)',
      dropRate: '0.20% (0.50% at 100+ kills)',
      lore: 'Stabilization thruster looted from heavy Aberrant Four Powers mechas.',
      lore_en: 'Stabilization thruster looted from heavy Aberrant Four Powers mechas.',
      lore_ru: 'Стабилизирующий ускоритель, добытый из тяжелых мехов.',
    },
    {
      id: 'Mount_011_c',
      name: 'Voyager: Control Room',
      name_en: 'Voyager: Control Room',
      name_ru: 'Вояджер: Кабина управления',
      title: 'Voyager: Control Room',
      count: 1,
      quantity: 1,
      quality: 'SSR',
      icon: '/datamine/shared/media/Hotta/Content/Resources/Icon/Mount/Mount_011_c.webp',
      source: '📍 Crown: Seaforth Dock electronic lock code 3594',
      source_en: '📍 Crown: Seaforth Dock electronic lock code 3594',
      source_ru: '📍 Крон: Электронный замок в доке Сифорт, код 3594',
      location: '📍 Crown: Seaforth Dock electronic lock code 3594',
      location_en: '📍 Crown: Seaforth Dock electronic lock code 3594',
      location_ru: '📍 Крон: Электронный замок в доке Сифорт, код 3594',
      lore: 'Cockpit console with advanced avionics navigation software.',
      lore_en: 'Cockpit console with advanced avionics navigation software.',
      lore_ru: 'Консоль кабины с передовой навигационной системой.',
    },
    {
      id: 'Mount_011_d',
      name: 'Voyager: Hull',
      name_en: 'Voyager: Hull',
      name_ru: 'Вояджер: Корпус',
      title: 'Voyager: Hull',
      count: 1,
      quantity: 1,
      quality: 'SSR',
      icon: '/datamine/shared/media/Hotta/Content/Resources/Icon/Mount/Mount_011_d.webp',
      source: '📍 Navia: Ecstasy Club ecological station water platform puzzle',
      source_en: '📍 Navia: Ecstasy Club ecological station water platform puzzle',
      source_ru: '📍 Навия: Головоломка водной платформы на станции Экстази',
      location: '📍 Navia: Ecstasy Club ecological station water platform puzzle',
      location_en: '📍 Navia: Ecstasy Club ecological station water platform puzzle',
      location_ru: '📍 Навия: Головоломка водной платформы на станции Экстази',
      lore: 'Aerodynamic monocoque chassis built from lightweight composite armor.',
      lore_en: 'Aerodynamic monocoque chassis built from lightweight composite armor.',
      lore_ru: 'Аэродинамический монокок из легкой композитной брони.',
    },
  ],
  Mount7: [
    {
      id: 'Mount_007_a',
      name: 'Mechbird: Head',
      name_en: 'Mechbird: Head',
      name_ru: 'Мехаптица: Голова',
      title: 'Mechbird: Head',
      count: 1,
      quantity: 1,
      quality: 'SSR',
      icon: '/datamine/shared/media/Hotta/Content/Resources/Icon/Mount/Mount_007_a.webp',
      source: '📍 Event Reward: Aida Cafe limited exchange shop',
      source_en: '📍 Event Reward: Aida Cafe limited exchange shop',
      source_ru: '📍 Награда события: Магазин обмена Кафе Аиды',
      location: '📍 Event Reward: Aida Cafe limited exchange shop',
      location_en: '📍 Event Reward: Aida Cafe limited exchange shop',
      location_ru: '📍 Награда события: Магазин обмена Кафе Аиды',
      lore: 'Head structure of the mechanical bird, featuring optical sensors.',
      lore_en: 'Head structure of the mechanical bird, featuring optical sensors.',
      lore_ru: 'Головная часть механической птицы с оптическими датчиками.',
    },
    {
      id: 'Mount_007_b',
      name: 'Mechbird: Torso',
      name_en: 'Mechbird: Torso',
      name_ru: 'Мехаптица: Корпус',
      title: 'Mechbird: Torso',
      count: 1,
      quantity: 1,
      quality: 'SSR',
      icon: '/datamine/shared/media/Hotta/Content/Resources/Icon/Mount/Mount_007_b.webp',
      source: '📍 Event Reward: Aida Cafe limited exchange shop',
      source_en: '📍 Event Reward: Aida Cafe limited exchange shop',
      source_ru: '📍 Награда события: Магазин обмена Кафе Аиды',
      location: '📍 Event Reward: Aida Cafe limited exchange shop',
      location_en: '📍 Event Reward: Aida Cafe limited exchange shop',
      location_ru: '📍 Награда события: Магазин обмена Кафе Аиды',
      lore: 'Central fuselage of the mechanical bird with energy conduits.',
      lore_en: 'Central fuselage of the mechanical bird with energy conduits.',
      lore_ru: 'Центральный корпус механической птицы с энергоканалами.',
    },
    {
      id: 'Mount_007_c',
      name: 'Mechbird: Legs',
      name_en: 'Mechbird: Legs',
      name_ru: 'Мехаптица: Ноги',
      title: 'Mechbird: Legs',
      count: 1,
      quantity: 1,
      quality: 'SSR',
      icon: '/datamine/shared/media/Hotta/Content/Resources/Icon/Mount/Mount_007_c.webp',
      source: '📍 Event Reward: Aida Cafe limited exchange shop',
      source_en: '📍 Event Reward: Aida Cafe limited exchange shop',
      source_ru: '📍 Награда события: Магазин обмена Кафе Аиды',
      location: '📍 Event Reward: Aida Cafe limited exchange shop',
      location_en: '📍 Event Reward: Aida Cafe limited exchange shop',
      location_ru: '📍 Награда события: Магазин обмена Кафе Аиды',
      lore: 'Shock-absorbing hydraulic bipedal limbs for rapid running.',
      lore_en: 'Shock-absorbing hydraulic bipedal limbs for rapid running.',
      lore_ru: 'Амортизирующие гидравлические ноги для быстрого бега.',
    },
    {
      id: 'Mount_007_d',
      name: 'Mechbird: Core',
      name_en: 'Mechbird: Core',
      name_ru: 'Мехаптица: Ядро',
      title: 'Mechbird: Core',
      count: 1,
      quantity: 1,
      quality: 'SSR',
      icon: '/datamine/shared/media/Hotta/Content/Resources/Icon/Mount/Mount_007_d.webp',
      source: '📍 Event Reward: Aida Cafe limited exchange shop',
      source_en: '📍 Event Reward: Aida Cafe limited exchange shop',
      source_ru: '📍 Награда события: Магазин обмена Кафе Аиды',
      location: '📍 Event Reward: Aida Cafe limited exchange shop',
      location_en: '📍 Event Reward: Aida Cafe limited exchange shop',
      location_ru: '📍 Награда события: Магазин обмена Кафе Аиды',
      lore: 'High-density power generator powering the avian automaton.',
      lore_en: 'High-density power generator powering the avian automaton.',
      lore_ru: 'Генератор высокой плотности, питающий механизм птицы.',
    },
  ],
};

export function getItemCategory(item: CosmeticItem): CosmeticCategory {
  if (item.fashion_type === 'SimulacrumHauteCouture') return 'SimulacrumHauteCouture';
  if (item.fashion_type === 'Dress') return 'Dress';
  if (item.fashion_type === 'Headwear') return 'Headwear';
  if (item.fashion_type === 'Glider') return 'Glider';
  if (item.fashion_type === 'GuideNPC') return 'GuideNPC';
  if (item.fashion_type === 'Medal') return 'Medal';
  if (item.fashion_type === 'CutePet' || item.category === 'cutePets') return 'CutePet';
  if (item.fashion_type === 'Mount' || item.category === 'mounts') return 'Mount';
  if (item.fashion_type === 'Enemy' || item.category === 'enemies') return 'Enemies';
  if (item.category === 'titles') return 'Title';
  if (item.category === 'chatStickers') return 'ChatSticker';
  if (item.category === 'badges') return 'Badge';
  if (item.category === 'avatars') return 'Avatar';
  if (item.category === 'avatarFrames') return 'AvatarFrame';
  if (item.category === 'chatBackgrounds') {
    const id = String(item.id || '').toLowerCase();
    if (id.startsWith('bag_')) return 'ChatBox';
    return 'ChatBubble';
  }
  return 'Dress';
}

export function getCosmeticCategoryTone(category: CosmeticCategory): string {
  const tones: Record<CosmeticCategory, string> = {
    all: 'neutral',
    SimulacrumHauteCouture: 'couture',
    Dress: 'dress',
    Headwear: 'headwear',
    Glider: 'glider',
    GuideNPC: 'servant',
    Medal: 'medal',
    CutePet: 'pet',
    Mount: 'mount',
    Enemies: 'enemy',
    Title: 'title',
    Avatar: 'avatar',
    AvatarFrame: 'frame',
    ChatBubble: 'chat',
    ChatBox: 'chatbox',
    ChatSticker: 'chat',
    Badge: 'medal',
  };

  return tones[category] || 'neutral';
}

export function normalizeQuality(raw?: string): 'SSR' | 'SR' | 'R' | 'N' {
  if (!raw) return 'SSR';
  const upper = raw.toUpperCase();
  if (upper === 'SSR' || upper.includes('LEGENDRY') || upper.includes('LEGENDARY') || upper.includes('ORANGE')) {
    return 'SSR';
  }
  if (upper === 'SR' || upper.includes('PURPLE')) {
    return 'SR';
  }
  if (upper === 'R' || upper.includes('BLUE')) {
    return 'R';
  }
  if (upper === 'N' || upper.includes('GREEN') || upper.includes('WHITE')) {
    return 'N';
  }
  return 'SSR';
}

export function normalizeUnrealPath(p?: string): string {
  if (!p) return '';
  let clean = String(p).trim().replace(/\\/g, '/');
  clean = clean.replace(/^[a-zA-Z0-9_]+'([^']+)'$/, '$1');
  clean = clean.replace(/\/L10N\/[a-zA-Z0-9_-]+\/Resources\//i, '/Resources/');
  if (clean.includes('/Hotta/Content/')) {
    clean = clean.substring(clean.indexOf('/Hotta/Content/') + '/Hotta/Content/'.length);
    clean = '/Game/' + clean;
  } else if (/^Hotta\/Content\//i.test(clean)) {
    clean = '/Game/' + clean.substring('Hotta/Content/'.length);
  } else if (clean.includes('/datamine/shared/media/')) {
    clean = clean.substring(clean.indexOf('/datamine/shared/media/') + '/datamine/shared/media/'.length);
    clean = clean.replace(/^Hotta\/Content\//i, '');
    clean = '/Game/' + clean;
  } else if (clean.includes('/Content/Resources/')) {
    clean = clean.substring(clean.indexOf('/Content/Resources/') + '/Content/'.length);
    clean = '/Game/' + clean;
  }
  const colonIdx = clean.indexOf(':');
  if (colonIdx !== -1 && clean.substring(0, colonIdx).includes('/Game/')) {
    clean = clean.substring(0, colonIdx);
  }
  clean = clean.replace(/\.(webp|png|jpg|jpeg|uasset|json)$/i, '');
  const lastSlash = clean.lastIndexOf('/');
  if (lastSlash !== -1) {
    const dir = clean.substring(0, lastSlash);
    const base = clean.substring(lastSlash + 1);
    const dotIdx = base.indexOf('.');
    if (dotIdx !== -1) {
      const name = base.substring(0, dotIdx);
      const sub = base.substring(dotIdx + 1);
      if (name.toLowerCase() === sub.toLowerCase()) {
        clean = dir + '/' + name;
      }
    }
  }
  if (/^\/?Game\//i.test(clean)) {
    clean = '/Game/' + clean.replace(/^\/?Game\//i, '');
  }
  return clean;
}

export function idTail(id?: string): number {
  const m = String(id || '').match(/(\d+)(?!.*\d)/);
  return m ? parseInt(m[1], 10) : -1;
}
