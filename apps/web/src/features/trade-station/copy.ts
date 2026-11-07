import { createLocaleCopies, type Locale } from '@tof-hub/i18n';

export interface TradeStationCopy {
  pageTitle: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  metaDescription: string;
  searchPlaceholder: string;
  sectionLabel: string;
  typeLabel: string;
  all: string;
  sortLabel: string;
  sortCategory: string;
  sortPriceDesc: string;
  sortPriceAsc: string;
  sortNameAsc: string;
  rowsUnit: string;
  showUnlistable: string;
  itemColumn: string;
  referencePriceColumn: string;
  listingBandColumn: string;
  systemBandColumn: string;
  qualityColumn: string;
  bandNote: string;
  notListable: string;
  notListableReason: string;
  systemBuyOff: string;
  bindOnPurchase: string;
  openCalculator: string;
  closeCalculator: string;
  calculatorTitle: string;
  pricePerUnit: string;
  quantityLabel: string;
  passLabel: string;
  grossLabel: string;
  listingFeeLabel: string;
  saleFeeLabel: string;
  netLabel: string;
  feeCurrencyNote: string;
  rulesTitle: string;
  rulesObserved: string;
  rulesTimeZone: string;
  rulesMissing: string;
  datasetMissing: string;
  noRows: string;
  resetFilters: string;
  priceStepNote: string;
  serverBandNote: string;
  systemBandNote: string;
  loadAll: string;
  openInItems: string;
  viewItem: string;
  loadMore: string;
  shardBadge: string;
  shardCombinesInto: string;
  shardCombinesIntoNamed: string;
  missingName: string;
  currencyNote: string;
}

export const TRADE_STATION_COPY: Record<Locale, (Record<'en' | 'ru', TradeStationCopy>)['en']> = createLocaleCopies(({
  en: {
    pageTitle: 'ToF | Trade Station',
    eyebrow: 'TOOLS',
    title: 'Trade Station price lookup',
    subtitle:
      'Which items can be listed, and inside what price range. Reference prices and bands come from the game client; they are the prices the station accepts, not what other players are currently asking.',
    metaDescription:
      'Look up Tower of Fantasy MMO Trade Station items: what can be listed, the reference price in Universal Crystals, the allowed listing band and the fee you pay to sell.',
    searchPlaceholder: 'Search item name or ID',
    sectionLabel: 'Category',
    typeLabel: 'Type',
    all: 'All',
    sortLabel: 'Sort',
    sortCategory: 'Category, then price (default)',
    sortPriceDesc: 'Reference price (high → low)',
    sortPriceAsc: 'Reference price (low → high)',
    sortNameAsc: 'Name (A → Z)',
    rowsUnit: 'items',
    showUnlistable: 'Include items that cannot be listed',
    itemColumn: 'Item',
    referencePriceColumn: 'Reference',
    listingBandColumn: 'Listing band',
    systemBandColumn: 'System buys at',
    qualityColumn: 'Grade',
    bandNote: 'Band = reference price × PutAwardRange, rounded to whole Universal Crystals.',
    notListable: 'Cannot be listed',
    notListableReason: 'The client marks this item as unlistable. Equipment Expansion Packs have not been listable since the Overseas server launch.',
    systemBuyOff: 'Not system-buyable',
    bindOnPurchase: 'Bound on purchase',
    openCalculator: 'Fees',
    closeCalculator: 'Close',
    calculatorTitle: 'Fee calculator',
    pricePerUnit: 'Price per unit (UC)',
    quantityLabel: 'Quantity',
    passLabel: 'Pass active (−20% listing fee)',
    grossLabel: 'Listing value',
    listingFeeLabel: 'Listing fee',
    saleFeeLabel: 'Sale fee (5%)',
    netLabel: 'You receive',
    feeCurrencyNote: 'Listing fee is charged in Gold, sale fee in Universal Crystals.',
    rulesTitle: 'Trade Station rules',
    rulesObserved: 'Observed on the Overseas server',
    rulesTimeZone: 'Server time',
    rulesMissing: 'No curated rules file was generated for this dataset.',
    datasetMissing: 'The Trade Station dataset has not been generated for this deployment yet.',
    noRows: 'No items match the current filters.',
    resetFilters: 'Reset filters',
    priceStepNote: 'Prices move in steps of {step} UC.',
    serverBandNote: 'Band measured on the server: {min} to {max}, {step} steps.',
    systemBandNote:
      'System buys at is what the station itself pays for the item: reference price × SysTradePriceRatio. It is an instant sale to the system, not a player purchase, and the client gates it on server level with a cooldown.',
    loadAll: 'Load all ({total})',
    openInItems: 'Open in the item database',
    viewItem: 'View item',
    loadMore: 'Load more ({count} left)',
    shardBadge: 'Shard',
    shardCombinesInto: '10 shards combine into 1 item',
    shardCombinesIntoNamed: '10 shards → 1 × {name} · reference {price} UC',
    missingName: 'Unnamed item',
    currencyNote: 'Prices are in {currency}.',
  },
  ru: {
    pageTitle: 'ToF | Торговая станция',
    eyebrow: 'ИНСТРУМЕНТЫ',
    title: 'Цены Торговой станции',
    subtitle:
      'Какие предметы можно выставить и в каком диапазоне цен. Базовая цена и диапазон берутся из клиента игры: это цены, которые станция принимает, а не текущие предложения других игроков.',
    metaDescription:
      'Предметы Торговой станции Tower of Fantasy (MMO): что можно выставить, базовая цена в универсальных кристаллах, допустимый диапазон и комиссия при продаже.',
    searchPlaceholder: 'Поиск по названию или ID',
    sectionLabel: 'Категория',
    typeLabel: 'Тип',
    all: 'Все',
    sortLabel: 'Сортировка',
    sortCategory: 'Категория, затем цена (по умолчанию)',
    sortPriceDesc: 'Базовая цена (по убыванию)',
    sortPriceAsc: 'Базовая цена (по возрастанию)',
    sortNameAsc: 'Название (А → Я)',
    rowsUnit: 'предметов',
    showUnlistable: 'Показать предметы, которые нельзя выставить',
    itemColumn: 'Предмет',
    referencePriceColumn: 'Базовая',
    listingBandColumn: 'Диапазон',
    systemBandColumn: 'Система покупает по',
    qualityColumn: 'Редкость',
    bandNote: 'Диапазон = базовая цена × PutAwardRange, округлённая до целых универсальных кристаллов.',
    notListable: 'Нельзя выставить',
    notListableReason: 'Клиент помечает предмет как невыставляемый. Наборы расширения снаряжения недоступны с запуска зарубежного сервера.',
    systemBuyOff: 'Система не покупает',
    bindOnPurchase: 'Привязывается при покупке',
    openCalculator: 'Комиссии',
    closeCalculator: 'Закрыть',
    calculatorTitle: 'Калькулятор комиссий',
    pricePerUnit: 'Цена за единицу (UC)',
    quantityLabel: 'Количество',
    passLabel: 'Активен пропуск (−20% к комиссии за выставление)',
    grossLabel: 'Стоимость лота',
    listingFeeLabel: 'Комиссия за выставление',
    saleFeeLabel: 'Комиссия за продажу (5%)',
    netLabel: 'Вы получите',
    feeCurrencyNote: 'Комиссия за выставление списывается золотом, за продажу — универсальными кристаллами.',
    rulesTitle: 'Правила Торговой станции',
    rulesObserved: 'Проверено на зарубежном сервере',
    rulesTimeZone: 'Время сервера',
    rulesMissing: 'Для этого набора данных нет файла правил.',
    datasetMissing: 'Набор данных Торговой станции ещё не сгенерирован для этого развёртывания.',
    noRows: 'Нет предметов, подходящих под фильтры.',
    resetFilters: 'Сбросить фильтры',
    priceStepNote: 'Цены меняются с шагом {step} UC.',
    serverBandNote: 'Диапазон измерен на сервере: от {min} до {max}, шаги по {step}.',
    systemBandNote:
      '«System buys at» — цена, по которой предмет покупает сама станция: базовая цена × SysTradePriceRatio. Это мгновенная продажа системе, а не другому игроку; клиент требует уровень сервера и выдерживает перезарядку.',
    loadAll: 'Показать все ({total})',
    openInItems: 'Открыть в базе предметов',
    viewItem: 'Открыть предмет',
    loadMore: 'Показать ещё ({count})',
    shardBadge: 'Осколок',
    shardCombinesInto: '10 осколков = 1 предмет',
    shardCombinesIntoNamed: '10 осколков → 1 × {name} · базовая цена {price} UC',
    missingName: 'Предмет без названия',
    currencyNote: 'Цены в {currency}.',
  },
}));
