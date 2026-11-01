import { createLocaleCopies, type Locale } from '@tof-hub/i18n';
interface Entry {
  title: string;
  text: string;
}
interface Dataset extends Entry {
  id: string;
  href: string;
}
interface AboutContent {
  title: string;
  subtitle: string;
  nav: string;
  navLinks: Record<
    "overview" | "datasets" | "pipeline" | "live-capture" | "validation" | "sources",
    string
  >;
  overview: string;
  intro: string;
  snapshot: string;
  version: string;
  client: string;
  exported: string;
  live: string;
  unavailable: string;
  snapshotNote: string;
  origins: Entry[];
  sectionsTitle: string;
  sectionsIntro: string;
  groups: { title: string; href: string; entries: Dataset[] }[];
  pipelineTitle: string;
  pipelineIntro: string;
  steps: Entry[];
  captureTitle: string;
  captureIntro: string;
  captureSteps: Entry[];
  captureNote: string;
  captureFilesTitle: string;
  captureFiles: { ext: string; text: string; href: string }[];
  principlesTitle: string;
  principles: Entry[];
  glossaryTitle: string;
  glossary: Entry[];
  reproduceTitle: string;
  reproduceText: string;
  help: string;
  source: string;
  code: string;
  disclaimer: string;
}

export const ABOUT_COPY: Record<Locale, (Record<"en" | "ru", AboutContent>)['en']> = createLocaleCopies(({
  en: {
    title: "Where the site’s data comes from",
    subtitle:
      "From game files and captured profiles to the catalogs, research and tools on ToF Hub. What we extract, what we calculate and what we maintain by hand.",
    nav: "On this page",
    navLinks: {
      overview: "Sources",
      datasets: "Site sections",
      pipeline: "Update pipeline",
      "live-capture": "Live Capture",
      validation: "Checks & limits",
      sources: "Code & contributions",
    },
    overview: "Several sources, one site",
    intro:
      "Info, Datamine and Tools share game catalogs, translations and images. Player records take a separate route through captures and imports. Keeping those sources distinct helps explain why a catalog value, a calculated score and a player’s current stats can differ.",
    snapshot: "Game data snapshot",
    version: "Version",
    client: "Source client",
    exported: "Export date",
    live: "Live Global",
    unavailable: "Unavailable",
    snapshotNote:
      "This describes the exported game resources. Player captures have their own dates; a test-client snapshot does not mean every entry is available on live servers.",
    origins: [
      {
        title: "Client resources",
        text: "Game tables, localized descriptions, icons and artwork extracted from an installed PC client.",
      },
      {
        title: "Calculations",
        text: "Scaling, derived stats, gear scores and simulations computed from supported inputs, with their own assumptions and limits.",
      },
      {
        title: "Captures and imports",
        text: "Observed profiles, equipment, counters and order history. Coverage depends on what the game sends during collection.",
      },
      {
        title: "Editorial content",
        text: "Readable names, explanations, artwork selections, team presets and some schedules, maintained separately from extracted game facts.",
      },
    ],
    sectionsTitle: "How each section uses the data",
    sectionsIntro:
      "Shared references feed several pages. Each feature selects the relevant records and adds its own presentation or calculations.",
    groups: [
      {
        title: "Info · catalogs and descriptions",
        href: "/info/",
        entries: [
          {
            id: "simulacra",
            href: "/info/simulacra/",
            title: "Simulacra, weapons and matrices",
            text: "Character and weapon records, skills, advancements, traits and matrix effects are joined to EN/RU game text and media. Gacha and MMO retain their own source catalogs; level-dependent values use supported game curves.",
          },
          {
            id: "relics-pets",
            href: "/info/relics/",
            title: "Relics and pets",
            text: "Relic effects and advancements, Smart Servant skills and upgrades come from their game tables and descriptions. Cute pets use their catalog records and images.",
          },
          {
            id: "food-cosmetics",
            href: "/info/food/",
            title: "Food, cosmetics and artwork",
            text: "Recipes, ingredients and effects are assembled from item and cooking tables. Cosmetics use unlock records and item metadata. Artwork selection and readable gallery titles include editorial work.",
          },
        ],
      },
      {
        title: "Datamine · modes and mechanics",
        href: "/datamine/",
        entries: [
          {
            id: "oow",
            href: "/datamine/oow/",
            title: "Origin of War",
            text: "Season and floor configurations connect enemies, buffs and attributes. Scaling and comparisons are derived from those inputs, in the context of the selected season and difficulty.",
          },
          {
            id: "bygone",
            href: "/datamine/bygone/",
            title: "Bygone and Sequential",
            text: "Floor configurations, enemies and scaling tables drive the views. Sequential score and damage analysis add calculations: a modelled threshold is an interpretation, not a recorded combat result.",
          },
          {
            id: "fce",
            href: "/datamine/fce/",
            title: "Boss mechanics",
            text: "Boss and season tables provide identities, rotation and mechanic references. Readable mechanic cards and selected illustrations include curated descriptions and mappings.",
          },
          {
            id: "raids",
            href: "/datamine/raids/",
            title: "Team raids",
            text: "Team8P raid tables supply difficulties, entry requirements, rewards and boss mechanics. Original and MMO servers keep separate catalogs; the live weekly rotation is not inferred from client dates.",
          },
          {
            id: "items",
            href: "/datamine/items/",
            title: "Items and Handbook",
            text: "Item records, localized text and icons form the item catalog. Handbook combines progression and equipment references into comparisons and tables.",
          },
          {
            id: "multype",
            href: "/datamine/multype/",
            title: "Multype",
            text: "A broader asset scan finds modifier structures and their source references. This research snapshot has a separate discovery workflow; exporting the regular catalogs again does not automatically refresh it.",
          },
        ],
      },
      {
        title: "Tools · personal data and models",
        href: "/tools/",
        entries: [
          {
            id: "build",
            href: "/tools/build/",
            title: "Build card and Optimizer",
            text: "A captured or entered loadout is combined with generated equipment, growth and effect references. Build reconstructs supported stats; Optimizer evaluates changes to the supplied gear. Forecasts remain separate from actual captured values.",
          },
          {
            id: "ranking",
            href: "/tools/ranking/",
            title: "Ranking and player profiles",
            text: "Imported player observations and saved builds supply the records. The site calculates comparable gear scores from supported fields. Collection time and server matter: a ranking reflects collected records, not a census of every player.",
          },
          {
            id: "wish",
            href: "/tools/wish/",
            title: "Wish Tracker and simulator",
            text: "Imported order records supply personal history, counts, pity and statistics. The simulator generates hypothetical pulls. Catalogs provide item identities and art; banner schedules need a separate maintained source because the client does not provide the full live schedule.",
          },
          {
            id: "comp",
            href: "/tools/comp/",
            title: "Team and raid compositions",
            text: "The builder reuses the character, weapon, matrix, relic and pet catalogs. Team choices, notes and presets are authored content, not team recommendations extracted from the game.",
          },
        ],
      },
    ],
    pipelineTitle: "From an installed game to an update",
    pipelineIntro:
      "The portable exporter runs the processing pipeline near the installed client. The website consumes its finished datasets and media.",
    steps: [
      {
        title: "Identify the client",
        text: "Read installation and launcher metadata to record the exported version and branch.",
      },
      {
        title: "Extract selected resources",
        text: "UnrealExporter reads configured paths from the game archives: tables, localization and the textures needed by the site.",
      },
      {
        title: "Process and connect",
        text: "Processors resolve identifiers and join tables to translations and media. Separate curated inputs add labels, notes and preserved resources.",
      },
      {
        title: "Generate the site data",
        text: "Normalization creates EN/RU datasets. Feature generators prepare references for tools and research pages; media processing prepares WebP images and supported PNG downloads.",
      },
      {
        title: "Validate and package",
        text: "Dataset checks run before the update archive is produced. A manifest records file hashes; later updates can include only changed files and a list of removals.",
      },
      {
        title: "Apply and publish",
        text: "The update is applied to the site’s generated public files and checked before deployment. Exporting a client does not itself publish the website.",
      },
    ],
    captureTitle: "ToF Hub Live Capture",
    captureIntro:
      "Game archives describe systems and items; they do not contain your current account. The Windows capture app collects supported data received while the game is running and saves files the tools can import.",
    captureSteps: [
      {
        title: "Start before logging in",
        text: "Choose a task and follow the readiness checks. The app uses the WinDivert driver to observe network traffic and asks for Windows administrator rights.",
      },
      {
        title: "Follow the in-game prompts",
        text: "Login and the requested profile, equipment or order-history screens cause the game to send relevant records. The collector decodes supported messages and accumulates observations. Missing fields stay incomplete.",
      },
      {
        title: "Save and import",
        text: "Save a .tofbuild for a build, .tofwish for order history or .tofplayers for collected players, then import it in the relevant tool. The site checks format and provenance; a valid file does not prove that every possible field was captured.",
      },
    ],
    captureNote:
      "Live Capture is separate from the static exporter. Developer research mode can record raw computer traffic, including background apps; its raw archives differ from the task-specific files intended for site imports. Availability depends on the client and task, and some fields remain under investigation.",
    captureFilesTitle: "Import files",
    captureFiles: [
      { ext: ".tofbuild", text: "Build card", href: "/tools/build/" },
      { ext: ".tofwish", text: "Wish Tracker", href: "/tools/wish/" },
      { ext: ".tofplayers", text: "Ranking", href: "/tools/ranking/" },
    ],
    principlesTitle: "Checks and limits",
    principles: [
      {
        title: "Keep the source attached",
        text: "Record the source branch, export or capture time and known provenance. A test client can contain unreleased or unused records.",
      },
      {
        title: "Check relationships and calculations",
        text: "Validate generated structures, identifiers and media references. Calculation tests and comparisons with observed game values help check the interpretation of raw fields.",
      },
      {
        title: "Show uncertainty",
        text: "An absent field is not zero. Unknown mappings, partial captures and unresolved mechanics should remain visible instead of being replaced by plausible guesses.",
      },
      {
        title: "Separate edits from observations",
        text: "Translations, notes, presets and maintained schedules supplement the data without becoming extracted evidence. Edited loadouts and simulations describe a scenario.",
      },
    ],
    glossaryTitle: "A few file terms",
    glossary: [
      {
        title: ".pak / .uasset",
        text: "Unreal Engine archives and individual assets. Tables, configuration and textures are exported into readable formats.",
      },
      {
        title: ".locres / JSON",
        text: "Localization supplies game text. JSON is the exported or generated representation used by the processors and website.",
      },
      {
        title: "PNG / WebP",
        text: "Extracted textures are converted for display. WebP serves the site; PNG is retained for supported original-image downloads.",
      },
    ],
    reproduceTitle: "Questions, corrections and updates",
    reproduceText:
      "The exporter, processors, generators and site code are in the public ToF Hub repository, and its README explains how to build your own copy from an installed client. The contribution page explains how to send a data update; report errors on the feedback page or through GitHub Issues.",
    help: "Help update the data",
    source: "GitHub Issues",
    code: "Source code",
    disclaimer:
      "ToF Hub is an unofficial community project. Tower of Fantasy data and artwork belong to their respective owners. Extracted resources and calculated models may differ from the behavior of a particular live version.",
  },
  ru: {
    title: "Откуда берутся данные на сайте",
    subtitle:
      "Как файлы игры и собранные профили становятся каталогами, исследованиями и инструментами ToF Hub. Что мы извлекаем, что рассчитываем и что поддерживаем вручную.",
    nav: "На этой странице",
    navLinks: {
      overview: "Источники",
      datasets: "Разделы сайта",
      pipeline: "Обновление",
      "live-capture": "Live Capture",
      validation: "Проверки",
      sources: "Код и участие",
    },
    overview: "Несколько источников для одного сайта",
    intro:
      "Info, Datamine и Tools используют общие игровые каталоги, переводы и изображения. Данные игроков приходят отдельно — через сбор и импорт. Это разделение помогает понять, почему значение в каталоге, расчётная оценка и текущая характеристика персонажа могут различаться.",
    snapshot: "Снимок игровых данных",
    version: "Версия",
    client: "Клиент-источник",
    exported: "Дата экспорта",
    live: "Global сейчас",
    unavailable: "Недоступно",
    snapshotNote:
      "Здесь указана версия выгруженных ресурсов игры. У профилей игроков свои даты сбора; наличие записи в тестовом клиенте не означает её доступность на основных серверах.",
    origins: [
      {
        title: "Ресурсы клиента",
        text: "Игровые таблицы, локализованные описания, иконки и иллюстрации из установленного PC-клиента.",
      },
      {
        title: "Расчёты",
        text: "Масштабирование, итоговые характеристики, оценки экипировки и симуляции на основе поддержанных данных, со своими допущениями и ограничениями.",
      },
      {
        title: "Сбор и импорт",
        text: "Наблюдаемые профили, экипировка, счётчики и история круток. Полнота зависит от того, какие данные игра передала во время сбора.",
      },
      {
        title: "Редакторские материалы",
        text: "Понятные названия, пояснения, подбор иллюстраций, пресеты отрядов и часть расписаний. Они поддерживаются отдельно от извлечённых игровых значений.",
      },
    ],
    sectionsTitle: "Как устроены данные разных разделов",
    sectionsIntro:
      "Общие справочники используются на нескольких страницах. Каждый раздел выбирает нужные записи и при необходимости добавляет свои расчёты.",
    groups: [
      {
        title: "Info · каталоги и описания",
        href: "/info/",
        entries: [
          {
            id: "simulacra",
            href: "/info/simulacra/",
            title: "Симулякры, оружие и матрицы",
            text: "Записи персонажей и оружия, навыки, звёзды, черты и эффекты матриц связываются с игровыми текстами EN/RU и изображениями. Каталоги Gacha и MMO сохраняют свои исходные данные; значения по уровням используют поддержанные игровые кривые.",
          },
          {
            id: "relics-pets",
            href: "/info/relics/",
            title: "Реликвии и питомцы",
            text: "Эффекты и звёзды реликвий, навыки и улучшения смарт-слуг берутся из соответствующих таблиц и описаний. Для декоративных питомцев используются записи каталога и изображения.",
          },
          {
            id: "food-cosmetics",
            href: "/info/food/",
            title: "Еда, косметика и арты",
            text: "Рецепты, ингредиенты и эффекты собираются из таблиц предметов и готовки. Косметика использует записи разблокировки и свойства предметов. Подбор артов и понятные названия галереи включают редакторскую работу.",
          },
        ],
      },
      {
        title: "Datamine · режимы и механики",
        href: "/datamine/",
        entries: [
          {
            id: "oow",
            href: "/datamine/oow/",
            title: "Истоки войны",
            text: "Конфигурации сезонов и этажей связывают противников, бафы и характеристики. Масштабирование и сравнения рассчитываются на их основе с учётом выбранного сезона и сложности.",
          },
          {
            id: "bygone",
            href: "/datamine/bygone/",
            title: "Былой фантазм и Sequential",
            text: "В основе страниц — конфигурации этажей, противники и таблицы масштабирования. Анализ очков и необходимого урона Sequential добавляет расчёты: порог по модели не равен результату, записанному в реальном бою.",
          },
          {
            id: "fce",
            href: "/datamine/fce/",
            title: "Механики боссов",
            text: "Таблицы боссов и сезонов дают идентификаторы, ротацию и ссылки на механики. Читаемые карточки механик и подбор иллюстраций включают подготовленные вручную пояснения и привязки.",
          },
          {
            id: "raids",
            href: "/datamine/raids/",
            title: "Командные рейды",
            text: "Таблицы рейдов Team8P дают сложности, требования для входа, награды и механики боссов. У серверов Original и MMO отдельные каталоги; актуальная недельная ротация не выводится из дат клиента.",
          },
          {
            id: "items",
            href: "/datamine/items/",
            title: "Предметы и Handbook",
            text: "Записи предметов, локализация и иконки образуют каталог. Handbook объединяет справочники прогрессии и экипировки в удобные таблицы и сравнения.",
          },
          {
            id: "multype",
            href: "/datamine/multype/",
            title: "Multype",
            text: "Более широкий скан ресурсов находит структуры модификаторов и ссылки на их источники. У этого исследовательского снимка отдельный процесс поиска; повторный экспорт обычных каталогов сам по себе его не обновляет.",
          },
        ],
      },
      {
        title: "Tools · личные данные и модели",
        href: "/tools/",
        entries: [
          {
            id: "build",
            href: "/tools/build/",
            title: "Карточка билда и Optimizer",
            text: "Собранный или введённый комплект объединяется со справочниками экипировки, роста и эффектов. Build восстанавливает поддержанные характеристики; Optimizer оценивает изменения указанного гира. Прогнозы отделены от фактически собранных значений.",
          },
          {
            id: "ranking",
            href: "/tools/ranking/",
            title: "Рейтинг и профили игроков",
            text: "Основой служат импортированные наблюдения игроков и сохранённые билды. Сайт рассчитывает сопоставимые оценки экипировки по поддержанным полям. Важны сервер и время сбора: рейтинг отражает собранные записи, а не всех игроков игры.",
          },
          {
            id: "wish",
            href: "/tools/wish/",
            title: "История круток и симулятор",
            text: "Личная история берётся из импортированных записей, по ним считаются крутки, гарант и статистика. Симулятор создаёт условные результаты. Названия предметов и арты приходят из каталогов, а расписания баннеров требуют отдельного источника: полного актуального расписания в клиенте нет.",
          },
          {
            id: "comp",
            href: "/tools/comp/",
            title: "Конструктор отрядов и рейдов",
            text: "Конструктор использует общие каталоги персонажей, оружия, матриц, реликвий и питомцев. Составы, заметки и пресеты — авторские материалы, а не извлечённая из игры рекомендация по команде.",
          },
        ],
      },
    ],
    pipelineTitle: "От установленной игры до обновления сайта",
    pipelineIntro:
      "Портативный экспортёр запускает обработку рядом с установленным клиентом. Сайт получает готовые наборы данных и изображения.",
    steps: [
      {
        title: "Определяем клиент",
        text: "Читаем данные установки и лаунчера, чтобы записать версию и ветку экспортируемого клиента.",
      },
      {
        title: "Извлекаем нужные ресурсы",
        text: "UnrealExporter читает настроенные пути в игровых архивах: таблицы, локализацию и текстуры, которые нужны сайту.",
      },
      {
        title: "Обрабатываем и связываем",
        text: "Процессоры сопоставляют идентификаторы, переводы и изображения. Отдельные редакторские материалы добавляют названия, пояснения и сохранённые ресурсы.",
      },
      {
        title: "Готовим данные для страниц",
        text: "Нормализация создаёт наборы EN/RU. Генераторы готовят справочники для инструментов и исследований; обработка медиа создаёт WebP для сайта и PNG для поддержанных скачиваний.",
      },
      {
        title: "Проверяем и упаковываем",
        text: "Проверки данных выполняются до создания архива обновления. Манифест хранит хеши файлов; следующие обновления могут включать только изменения и список удалений.",
      },
      {
        title: "Применяем и публикуем",
        text: "Обновление применяется к сгенерированным публичным файлам сайта и проверяется перед публикацией. Сам экспорт клиента ещё не публикует сайт.",
      },
    ],
    captureTitle: "ToF Hub Live Capture",
    captureIntro:
      "Архивы игры описывают системы и предметы, но не содержат текущий аккаунт игрока. Приложение для Windows собирает поддержанные данные, которые приходят во время работы игры, и сохраняет файлы для импорта в инструменты сайта.",
    captureSteps: [
      {
        title: "Запустить до входа в аккаунт",
        text: "Выберите задачу и пройдите проверку готовности. Приложение использует драйвер WinDivert для наблюдения за сетевым обменом и запрашивает права администратора Windows.",
      },
      {
        title: "Следовать подсказкам в игре",
        text: "При входе и открытии нужных экранов профиля, экипировки или истории круток игра передаёт соответствующие записи. Сборщик разбирает поддержанные сообщения и накапливает наблюдения. Недостающие поля остаются неполными.",
      },
      {
        title: "Сохранить и импортировать",
        text: "Для билда используется .tofbuild, для истории круток — .tofwish, для собранных игроков — .tofplayers. Загрузите файл в соответствующий инструмент. Сайт проверяет формат и происхождение файла; успешная проверка не означает, что собраны все возможные поля.",
      },
    ],
    captureNote:
      "Live Capture работает отдельно от экспортёра ресурсов. Исследовательский DEV-режим может записывать сырой трафик компьютера, включая фоновые приложения; такие архивы отличаются от файлов конкретной задачи для импорта на сайт. Доступность зависит от клиента и задачи, часть полей ещё исследуется.",
    captureFilesTitle: "Файлы для импорта",
    captureFiles: [
      { ext: ".tofbuild", text: "Карточка билда", href: "/tools/build/" },
      { ext: ".tofwish", text: "История круток", href: "/tools/wish/" },
      { ext: ".tofplayers", text: "Рейтинг", href: "/tools/ranking/" },
    ],
    principlesTitle: "Проверки и ограничения",
    principles: [
      {
        title: "Сохраняем сведения об источнике",
        text: "Учитываем ветку клиента, время экспорта или сбора и известное происхождение. В тестовом клиенте могут быть ещё не выпущенные или неиспользуемые записи.",
      },
      {
        title: "Проверяем связи и расчёты",
        text: "Проверяем структуру данных, идентификаторы и ссылки на медиа. Тесты формул и сверки с наблюдаемыми значениями игры помогают проверить трактовку исходных полей.",
      },
      {
        title: "Обозначаем неизвестное",
        text: "Отсутствующее поле не равно нулю. Неизвестные привязки, частичный сбор и неразобранные механики должны оставаться заметными, а не заменяться правдоподобной догадкой.",
      },
      {
        title: "Отделяем правки от наблюдений",
        text: "Переводы, пояснения, пресеты и ручные расписания дополняют сайт, но не становятся доказательством из игровых файлов. Изменённый билд и симуляция описывают выбранный сценарий.",
      },
    ],
    glossaryTitle: "Несколько слов о форматах",
    glossary: [
      {
        title: ".pak / .uasset",
        text: "Архивы Unreal Engine и отдельные ресурсы. Таблицы, конфигурации и текстуры из них выгружаются в читаемые форматы.",
      },
      {
        title: ".locres / JSON",
        text: "Локализация содержит игровые тексты. JSON — представление выгруженных или подготовленных данных для процессоров и сайта.",
      },
      {
        title: "PNG / WebP",
        text: "Извлечённые текстуры преобразуются для показа. WebP используется на сайте, PNG сохраняется для поддержанных скачиваний исходных изображений.",
      },
    ],
    reproduceTitle: "Вопросы, исправления и обновления",
    reproduceText:
      "Экспортёр, процессоры, генераторы и код сайта находятся в открытом репозитории ToF Hub; в его README описано, как собрать свою копию из установленного клиента. На странице помощи проекту описано, как передать обновление данных; об ошибках сообщайте на странице отзывов или в GitHub Issues.",
    help: "Помочь обновить данные",
    source: "GitHub Issues",
    code: "Исходный код",
    disclaimer:
      "ToF Hub — неофициальный проект сообщества. Игровые данные и изображения Tower of Fantasy принадлежат соответствующим правообладателям. Извлечённые ресурсы и расчётные модели могут отличаться от поведения конкретной версии игры на основных серверах.",
  },
}) satisfies Pick<Record<"en" | "ru", AboutContent>, 'en' | 'ru'>);
