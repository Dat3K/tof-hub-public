import { localizeUiCopy } from '@tof-hub/i18n';
import { type Locale } from '@tof-hub/i18n';
export interface CompStrings {
  metaTitle: string;
  metaDescription: string;
  // Toolbar
  toolbarAria: string;
  modeAria: string;
  presetAria: string;
  presetPlaceholder: string;
  presetFrost8p: string;
  presetMeta4p: string;
  presetFrost4p: string;
  presetFlame4p: string;
  presetVolt4p: string;
  presetPhysical4p: string;
  mode4: string;
  mode8: string;
  presetLabel: string;
  serverAria: string;
  serverLabel: string;
  serverStandard: string;
  serverMmo: string;
  shareTitle: string;
  shareAria: string;
  shareLabel: string;
  exportTitle: string;
  exportAria: string;
  exporting: string;
  exportLabel: string;
  clearTitle: string;
  clearAria: string;
  clearLabel: string;
  // Table headers
  tableAria: string;
  colRolePlayer: string;
  colTrait: string;
  colWeapons: string;
  colMatrices: string;
  colWeaponMode: string;
  colRelics: string;
  colOrder: string;
  weaponModeActive: string;
  weaponModePassive: string;
  weaponModeAria: string;
  // Item picker modal
  pickerTraitTitle: string;
  pickerWeaponTitle: string;
  pickerMatrixTitle: string;
  pickerRelicTitle: string;
  pickerSubtitle: string;
  pickerSearch: string;
  removeItem: string;
  filterElement: string;
  filterRole: string;
  filterRarity: string;
  filterProperty: string;
  filterAll: string;
  customText: string;
  customTextSub: string;
  uploadPhoto: string;
  uploadPhotoSub: string;
  customPlaceholder: string;
  apply: string;
  noMatches: string;
  // Player row
  playerRowAria: string;
  playerNameAria: string;
  dragReorderTitle: string;
  changeRoleTitle: string;
  moveUp: string;
  moveDown: string;
  clearPlayer: string;
  // Slot
  changePhoto: string;
  removePhoto: string;
  customPhoto: string;
  traitPrefix: string;
  weaponStars: string;
  advStarsWeapon: string;
  removeSecondary: string;
  addSecondary: string;
  weaponLabel: string;
  matrixStars: string;
  advStarsMatrix: string;
  setBonus: string;
  matrixLabel: string;
  relicRank: string;
  relicLabel: string;
  weaponFallback1: string;
  weaponFallback2: string;
  weaponFallback: string;
  chipFallback1: string;
  chipFallback2: string;
  matrixFallback: string;
  relicFallback: string;
  fullSetEffect: string;
  // Star popover
  starSelectorAria: string;
  matrixSelectorAria: string;
  starsWeapon: string;
  matrixChipset: string;
  setBonusLabel: string;
  advancementLabel: string;
  advancementLevel: string;
  configurationLabel: string;
  setPiecesLabel: string;
  count4Label: string;
  count2Label: string;
  splitLabel: string;
  customStarsLabel: string;
  changeWeapon1: string;
  changeWeapon2: string;
  changeChip1: string;
  changeChip2: string;
  decreaseTitle: string;
  increaseTitle: string;
  // Rank popover
  rankSelectorAria: string;
  rankLabel: string;
  relicRankTitle: string;
  relicAdvancement: string;
  rankRange: string;
  customRankLabel: string;
  // Role popover
  roleSelectorAria: string;
  playerRole: string;
  roleCustom: string;
  roleAuto: string;
  // Page toasts & states
  linkCopied: string;
  linkCopyError: string;
  exportError: string;
  squadCleared: string;
  exportedFile: string;
  catalogLoading: string;
  catalogError: string;
}

export const COMP_STRINGS_EN: CompStrings = {
  metaTitle: 'Squad Builder',
  metaDescription:
    'Interactive 4-player squad and 8-player raid composition builder for Tower of Fantasy. Configure roles, awakening traits, weapons, matrix sets, and relics with live search and link sharing.',
  toolbarAria: 'Comp Builder Controls',
  presetAria: 'Squad Preset Compositions',
  modeAria: 'Squad Mode',
  presetPlaceholder: 'Choose Preset Comp...',
  presetFrost8p: '8p Frost',
  presetMeta4p: 'Meta 4-Player Squad',
  presetFrost4p: 'Frost Hypercarry 4p',
  presetFlame4p: 'Flame Ignite 4p',
  presetVolt4p: 'Volt Resonance 4p',
  presetPhysical4p: 'Physical Force 4p',
  mode4: '4 Players',
  mode8: '8 Players',
  presetLabel: 'Preset:',
  serverAria: 'Game server',
  serverLabel: 'Game Mode',
  serverStandard: 'Standard',
  serverMmo: 'MMO',
  shareTitle: 'Copy shareable link to clipboard',
  shareAria: 'Share Comp',
  shareLabel: 'Share Comp',
  exportTitle: 'Export infographic comp as PNG',
  exportAria: 'Export PNG',
  exporting: 'Exporting...',
  exportLabel: 'Export PNG',
  clearTitle: 'Clear all slots in current squad',
  clearAria: 'Clear squad',
  clearLabel: 'Clear',
  tableAria: 'Squad Composition Table',
  colRolePlayer: '# • Role & Player',
  colTrait: 'Trait',
  colWeapons: 'Weapons',
  colMatrices: 'Matrices',
  colWeaponMode: 'Mode',
  colRelics: 'Relics',
  colOrder: 'Order',
  weaponModeActive: 'Active',
  weaponModePassive: 'Passive',
  weaponModeAria: 'Weapon mode for player {n}',
  pickerTraitTitle: 'Select Simulacrum Trait',
  pickerWeaponTitle: 'Select Weapon (Slot {slot})',
  pickerMatrixTitle: 'Select Matrix Set (Slot {slot})',
  pickerRelicTitle: 'Select Relic (Slot {slot})',
  pickerSubtitle: 'Player {player} • Slot {slot}',
  pickerSearch: 'Search by name, element, or character...',
  removeItem: 'Remove Item',
  filterElement: 'Element:',
  filterRole: 'Role:',
  filterRarity: 'Rarity:',
  filterProperty: 'Property:',
  filterAll: 'All',
  customText: 'Empty (Custom text)',
  customTextSub: 'Custom text',
  uploadPhoto: 'Custom Photo',
  uploadPhotoSub: 'Import photo',
  customPlaceholder: 'Enter custom text...',
  apply: 'Apply',
  noMatches: 'No items match the current filters',
  playerRowAria: 'Player {n}',
  playerNameAria: 'Player {n} name',
  dragReorderTitle: 'Drag to reorder',
  changeRoleTitle: 'Change role or auto resonance',
  moveUp: 'Move Player Up',
  moveDown: 'Move Player Down',
  clearPlayer: 'Clear Player',
  changePhoto: 'Change photo',
  removePhoto: 'Remove photo',
  customPhoto: 'Custom photo',
  traitPrefix: 'Trait',
  weaponStars: 'Weapon Stars (0-6)',
  advStarsWeapon: 'Advancement Stars',
  removeSecondary: 'Remove secondary weapon',
  addSecondary: 'Add secondary weapon',
  weaponLabel: 'Weapon',
  matrixStars: 'Matrix Stars (0-3)',
  advStarsMatrix: 'Advancement Stars',
  setBonus: 'Set Bonus (2pc / 4pc)',
  matrixLabel: 'Matrix',
  relicRank: 'Relic Rank (R0-R5)',
  relicLabel: 'Relic',
  weaponFallback1: 'Weapon 1',
  weaponFallback2: 'Weapon 2',
  weaponFallback: 'Weapon',
  chipFallback1: 'Chip 1',
  chipFallback2: 'Chip 2',
  matrixFallback: 'Matrix',
  relicFallback: 'Relic',
  fullSetEffect: 'Full set effect active.',
  starSelectorAria: 'Weapon Stars Selector',
  matrixSelectorAria: 'Matrix Properties Selector',
  starsWeapon: 'Weapon Stars',
  matrixChipset: 'Matrix Chipset',
  setBonusLabel: 'Set Bonus:',
  advancementLabel: 'Advancement:',
  advancementLevel: 'Advancement Level',
  configurationLabel: 'Configuration',
  setPiecesLabel: 'Set Pieces',
  count4Label: '4pc Set',
  count2Label: '2pc Set',
  splitLabel: '2+2 Set',
  customStarsLabel: 'Custom Stars:',
  changeWeapon1: 'Change 1',
  changeWeapon2: 'Change 2',
  changeChip1: 'Change Chip 1',
  changeChip2: 'Change Chip 2',
  decreaseTitle: 'Decrease star',
  increaseTitle: 'Increase star',
  rankSelectorAria: 'Relic Rank Selector',
  rankLabel: 'Rank',
  relicRankTitle: 'Relic Rank',
  relicAdvancement: 'Relic Advancement',
  rankRange: 'Rank (R0 – R5)',
  customRankLabel: 'Custom Rank:',
  roleSelectorAria: 'Player Role Selector',
  playerRole: 'Player Role',
  roleCustom: 'Custom',
  roleAuto: 'Auto',
  linkCopied: 'Comp shareable link copied to clipboard!',
  linkCopyError: 'Failed to copy link',
  exportError: 'Failed to export image',
  squadCleared: 'All squad slots cleared',
  exportedFile: 'Exported {file}',
  catalogLoading: 'Loading squad builder catalog...',
  catalogError: 'Failed to load catalog',
};

export const COMP_STRINGS_RU: CompStrings = {
  metaTitle: 'Конструктор отрядов',
  metaDescription:
    'Интерактивный конструктор отрядов 4 игроков и рейдов 8 игроков для Tower of Fantasy. Роли, черты пробуждения, оружие, наборы матриц и реликвии с живым поиском и ссылками.',
  toolbarAria: 'Панель конструктора отрядов',
  presetAria: 'Пресеты составов отряда',
  modeAria: 'Режим отряда',
  presetPlaceholder: 'Выбрать состав...',
  presetFrost8p: '8p Лед',
  presetMeta4p: 'Мета-отряд (4p)',
  presetFrost4p: 'Лед гиперкерри (4p)',
  presetFlame4p: 'Огонь горение (4p)',
  presetVolt4p: 'Электро резонанс (4p)',
  presetPhysical4p: 'Физ пробитие (4p)',
  mode4: '4 Игрока',
  mode8: '8 Игроков',
  presetLabel: 'Пресет:',
  serverAria: 'Игровой сервер',
  serverLabel: 'Режим игры',
  serverStandard: 'Стандарт',
  serverMmo: 'MMO',
  shareTitle: 'Скопировать ссылку в буфер',
  shareAria: 'Поделиться отрядом',
  shareLabel: 'Поделиться',
  exportTitle: 'Экспортировать инфографику как PNG',
  exportAria: 'Экспорт PNG',
  exporting: 'Экспорт...',
  exportLabel: 'Экспорт PNG',
  clearTitle: 'Очистить весь отряд',
  clearAria: 'Очистить отряд',
  clearLabel: 'Очистить',
  tableAria: 'Таблица состава отряда',
  colRolePlayer: '# • Роль и Игрок',
  colTrait: 'Черта',
  colWeapons: 'Оружие',
  colMatrices: 'Матрицы',
  colWeaponMode: 'Режим',
  colRelics: 'Реликвии',
  colOrder: 'Порядок',
  weaponModeActive: 'Активный',
  weaponModePassive: 'Пассивный',
  weaponModeAria: 'Режим оружия игрока {n}',
  pickerTraitTitle: 'Выбор черты симулякра',
  pickerWeaponTitle: 'Выбор оружия (Слот {slot})',
  pickerMatrixTitle: 'Выбор набора матриц (Слот {slot})',
  pickerRelicTitle: 'Выбор реликвии (Слот {slot})',
  pickerSubtitle: 'Игрок {player} • Слот {slot}',
  pickerSearch: 'Поиск по имени, элементу или персонажу...',
  removeItem: 'Очистить слот',
  filterElement: 'Стихия:',
  filterRole: 'Роль:',
  filterRarity: 'Редкость:',
  filterProperty: 'Тип:',
  filterAll: 'Все',
  customText: 'Пусто (Свой текст)',
  customTextSub: 'Свой текст',
  uploadPhoto: 'Свое фото',
  uploadPhotoSub: 'Импорт фото',
  customPlaceholder: 'Введите произвольный текст...',
  apply: 'Применить',
  noMatches: 'Ничего не найдено по фильтру',
  playerRowAria: 'Игрок {n}',
  playerNameAria: 'Имя игрока {n}',
  dragReorderTitle: 'Перетаскивание для изменения порядка',
  changeRoleTitle: 'Сменить роль или авто-резонанс',
  moveUp: 'Переместить вверх',
  moveDown: 'Переместить вниз',
  clearPlayer: 'Очистить игрока',
  changePhoto: 'Заменить фото',
  removePhoto: 'Удалить фото',
  customPhoto: 'Свое фото',
  traitPrefix: 'Черта',
  weaponStars: 'Звезды оружия (0-6)',
  advStarsWeapon: 'Звезды оружия (0-6)',
  removeSecondary: 'Убрать второе оружие',
  addSecondary: 'Добавить второе оружие (2+2)',
  weaponLabel: 'Оружие',
  matrixStars: 'Звезды матрицы (0-3)',
  advStarsMatrix: 'Звезды матрицы (0-3)',
  setBonus: 'Бонус набора (2pc / 4pc)',
  matrixLabel: 'Матрицы',
  relicRank: 'Ранг реликвии (R0-R5)',
  relicLabel: 'Реликвия',
  weaponFallback1: 'Оружие 1',
  weaponFallback2: 'Оружие 2',
  weaponFallback: 'Оружие',
  chipFallback1: 'Чип 1',
  chipFallback2: 'Чип 2',
  matrixFallback: 'Матрица',
  relicFallback: 'Реликвия',
  fullSetEffect: 'Полный эффект комплекта активен.',
  starSelectorAria: 'Выбор звезд оружия',
  matrixSelectorAria: 'Свойства набора матрицы',
  starsWeapon: 'Звезды оружия',
  matrixChipset: 'Набор матрицы',
  setBonusLabel: 'Бонус набора:',
  advancementLabel: 'Звездность:',
  advancementLevel: 'Уровень звезд',
  configurationLabel: 'Конфигурация',
  setPiecesLabel: 'Куски сета',
  count4Label: '4pc Set',
  count2Label: '2pc Set',
  splitLabel: '2+2 Set',
  customStarsLabel: 'Количество звёзд:',
  changeWeapon1: 'Сменить 1',
  changeWeapon2: 'Сменить 2',
  changeChip1: 'Change Chip 1',
  changeChip2: 'Change Chip 2',
  decreaseTitle: 'Уменьшить звезды',
  increaseTitle: 'Увеличить звезды',
  rankSelectorAria: 'Выбор ранга реликвии',
  rankLabel: 'Ранг',
  relicRankTitle: 'Ранг реликвии',
  relicAdvancement: 'Улучшение реликвии',
  rankRange: 'Ранг (R0 – R5)',
  customRankLabel: 'Ранг реликвии:',
  roleSelectorAria: 'Выбор роли игрока',
  playerRole: 'Роль игрока',
  roleCustom: 'Ручная',
  roleAuto: 'Авто',
  linkCopied: 'Ссылка на состав скопирована в буфер!',
  linkCopyError: 'Ошибка копирования ссылки',
  exportError: 'Ошибка экспорта изображения',
  squadCleared: 'Все слоты отряда очищены',
  exportedFile: 'Экспортировано: {file}',
  catalogLoading: 'Загрузка каталога отрядов...',
  catalogError: 'Ошибка загрузки каталога',
};

export function getCompStrings(locale: Locale): CompStrings {
  return locale === 'ru' ? COMP_STRINGS_RU : localizeUiCopy(COMP_STRINGS_EN, locale);
}
