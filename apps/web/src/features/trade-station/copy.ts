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
  qualityColumn: string;
  bandNote: string;
  notListable: string;
  notListableReason: string;
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
    qualityColumn: 'Grade',
    bandNote: 'Client bands use the reference price × PutAwardRange, rounded to whole Universal Crystals. Some items use a band observed on the Overseas server.',
    notListable: 'Cannot be listed',
    notListableReason: 'The client marks this item as unlistable. Equipment Expansion Packs have not been listable since the Overseas server launch.',
    bindOnPurchase: 'Bound on purchase',
    openCalculator: 'Fees',
    closeCalculator: 'Close',
    calculatorTitle: 'Fee calculator',
    pricePerUnit: 'Price per unit',
    quantityLabel: 'Quantity',
    passLabel: 'Pass active (−20% listing fee)',
    grossLabel: 'Listing value',
    listingFeeLabel: 'Listing fee',
    saleFeeLabel: 'Sale fee (5%)',
    netLabel: 'You receive',
    feeCurrencyNote: 'Listing fee is charged in {gold}, sale fee in {uc}.',
    rulesTitle: 'Trade Station rules',
    rulesObserved: 'Observed on the Overseas server',
    rulesTimeZone: 'Server time',
    rulesMissing: 'No curated rules file was generated for this dataset.',
    datasetMissing: 'The Trade Station dataset has not been generated for this deployment yet.',
    noRows: 'No items match the current filters.',
    resetFilters: 'Reset filters',
    priceStepNote: 'Prices move in steps of {step}.',
    serverBandNote: 'Band measured on the server: {min} to {max}, {step} steps.',
    loadAll: 'Load all ({total})',
    openInItems: 'Open in the item database',
    viewItem: 'View item',
    loadMore: 'Load more ({count} left)',
    shardBadge: 'Shard',
    shardCombinesInto: '10 shards combine into 1 item',
    shardCombinesIntoNamed: '10 shards → 1 × {name} · reference {price}',
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
    qualityColumn: 'Редкость',
    bandNote: 'Диапазон из клиента рассчитывается как базовая цена × PutAwardRange с округлением до целых универсальных кристаллов. Для некоторых предметов используется диапазон, который наблюдали на зарубежном сервере.',
    notListable: 'Нельзя выставить',
    notListableReason: 'Клиент помечает предмет как невыставляемый. Наборы расширения снаряжения недоступны с запуска зарубежного сервера.',
    bindOnPurchase: 'Привязывается при покупке',
    openCalculator: 'Комиссии',
    closeCalculator: 'Закрыть',
    calculatorTitle: 'Калькулятор комиссий',
    pricePerUnit: 'Цена за единицу',
    quantityLabel: 'Количество',
    passLabel: 'Активен пропуск (−20% к комиссии за выставление)',
    grossLabel: 'Стоимость лота',
    listingFeeLabel: 'Комиссия за выставление',
    saleFeeLabel: 'Комиссия за продажу (5%)',
    netLabel: 'Вы получите',
    feeCurrencyNote: 'Комиссия за выставление списывается {gold}, за продажу — {uc}.',
    rulesTitle: 'Правила Торговой станции',
    rulesObserved: 'Проверено на зарубежном сервере',
    rulesTimeZone: 'Время сервера',
    rulesMissing: 'Для этого набора данных нет файла правил.',
    datasetMissing: 'Набор данных Торговой станции ещё не сгенерирован для этого развёртывания.',
    noRows: 'Нет предметов, подходящих под фильтры.',
    resetFilters: 'Сбросить фильтры',
    priceStepNote: 'Цены меняются с шагом {step}.',
    serverBandNote: 'Диапазон измерен на сервере: от {min} до {max}, шаги по {step}.',
    loadAll: 'Показать все ({total})',
    openInItems: 'Открыть в базе предметов',
    viewItem: 'Открыть предмет',
    loadMore: 'Показать ещё ({count})',
    shardBadge: 'Осколок',
    shardCombinesInto: '10 осколков = 1 предмет',
    shardCombinesIntoNamed: '10 осколков → 1 × {name} · базовая цена {price}',
    missingName: 'Предмет без названия',
    currencyNote: 'Цены в {currency}.',
  },
}));
