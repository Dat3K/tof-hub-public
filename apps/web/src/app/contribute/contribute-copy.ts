import { createLocaleCopies, type Locale } from '@tof-hub/i18n';
export interface ContributeLocaleContent {
  metaTitle: string;
  metaDesc: string;
  heroTitle: string;
  heroSubtitle: string;
  tabRegular: string;
  tabRegularSub: string;
  tabMultype: string;
  tabMultypeSub: string;
  tabCorrections: string;
  tabCorrectionsSub: string;
  tabsAria: string;
  regularTitle: string;
  regularBadge: string;
  regularIntro: string;
  regularStep1Title: string;
  regularStep1Desc: string;
  regularStep1Link: string;
  regularStep1Download: string;
  regularStep2Title: string;
  regularStep2Desc: string;
  regularStep2Code: string;
  regularStep3Title: string;
  regularStep3Desc: string;
  multypeTitle: string;
  multypeBadge: string;
  multypeIntro: string;
  multypeStep1Title: string;
  multypeStep1Desc: string;
  multypeAesKey: string;
  multypeStep2Title: string;
  multypeStep2Desc: string;
  multypeStep2Link: string;
  multypeStep3Title: string;
  multypeStep3Desc: string;
  multypeStep3Code: string;
  multypeStep4Title: string;
  multypeStep4Desc: string;
  correctionsTitle: string;
  correctionsBadge: string;
  correctionsIntro: string;
  channelFeedbackKicker: string;
  channelFeedbackTitle: string;
  channelFeedbackDesc: string;
  channelFeedbackButton: string;
  channelGithubKicker: string;
  channelGithubTitle: string;
  channelGithubDesc: string;
  guidanceTitle: string;
  guidance1Q: string;
  guidance1A: string;
  guidance2Q: string;
  guidance2A: string;
  guidance3Q: string;
  guidance3A: string;
  checklistTitle: string;
  checklistSubtitle: string;
  checklistItems: string[];
  copy: string;
  copied: string;
  aesLabel: string;
  submitText: string;
  submitButton: string;
}

export const CONTRIBUTE_COPY: Record<Locale, (Record<'en' | 'ru', ContributeLocaleContent>)['en']> = createLocaleCopies(({
  en: {
    metaTitle: "ToF | Contribute",
    metaDesc: "Help keep ToF Hub current by providing a fresh Tower of Fantasy game export for regular Datamine updates, Multype research scans, or manual data corrections.",
    heroTitle: "Help improve ToF Hub",
    heroSubtitle: "Send a fresh game export, help with a Multype research scan or report a data error. Each option is independent: pick the one that fits your time.",
    tabRegular: "Regular update",
    tabRegularSub: "~30 min",
    tabMultype: "Multype scan",
    tabMultypeSub: "~2 h",
    tabCorrections: "Fix data",
    tabCorrectionsSub: "Feedback · GitHub",
    tabsAria: "Contribution workflows",
    regularTitle: "Regular data update",
    regularBadge: "~30 min",
    regularIntro: "Requires Windows and an installed Tower of Fantasy PC client. A regular update takes about 30 minutes, depending on your disk and the size of the game update.",
    regularStep1Title: "Get ToF Exporter",
    regularStep1Desc: "ToFExporter.exe is a single Windows program: no installation, Node.js or game unpacker required. Put it in a writable folder on a disk with room for the extracted files and the archive.",
    regularStep1Link: "Public download link coming soon",
    regularStep1Download: "Download from Mega.nz",
    regularStep2Title: "Run it and choose the game",
    regularStep2Desc: "Double-click ToFExporter.exe. On the first run, choose the game installation folder; later runs offer the saved one. The exporter extracts and processes the files and packs an update archive. To skip the question, pass the folder directly:",
    regularStep2Code: 'ToFExporter.exe --game-path "D:\\Tower of Fantasy"',
    regularStep3Title: "Send the archive to the developer",
    regularStep3Desc: "When the exporter finishes, the output folder beside the EXE contains tof-update-<version>-<date>.zip. The first archive is full (about 3.5 GB); later ones contain only the changes and end in -delta. If the previous archive was not applied, run it again with --full. You do not need to process or publish anything yourself.",
    multypeTitle: "Multype research scan",
    multypeBadge: "Export ~1–2 h · Scan ~5 min",
    multypeIntro: "Multype uses a full unpack of all game assets and a deep recursive scan of gameplay effect modifiers. Plan for about 2 hours total. This specialized research workflow is separate from regular updates.",
    multypeStep1Title: "Export and unpack the full game",
    multypeStep1Desc: "Export the complete game assets to structured JSON using FModel or UnrealExporter with UE_Version set to GAME_TowerOfFantasy.",
    multypeAesKey: "",
    multypeStep2Title: "Get Tower of Fantasy Exporter Scanner",
    multypeStep2Desc: "Download or clone the scanner Python tool from GitHub:",
    multypeStep2Link: "Tower of Fantasy Exporter Scanner on GitHub",
    multypeStep3Title: "Run the scanner",
    multypeStep3Desc: "Execute the scanner CLI against your JSON export folder to map AttributeName, Modifiers, and ModuleExtraType relationships:",
    multypeStep3Code: "python main_scanning_files.py --input path_to_json --mode 1",
    multypeStep4Title: "Mapping outputs",
    multypeStep4Desc: "The generated files unique_attributes_sorted.json and module_extra_to_files_mapping3.json in the Exported folder serve as the direct source for the Multype dataset.",
    correctionsTitle: "Report a data error",
    correctionsBadge: "Two ways",
    correctionsIntro: "Found a value, name or picture that does not match the game? Leave a message on the site’s feedback page or open an issue on GitHub, whichever is easier for you. Both reach the developer.",
    channelFeedbackKicker: "On the site",
    channelFeedbackTitle: "Feedback page",
    channelFeedbackDesc: "No account needed. Add a message, choose “A specific page” and the “Data error” type, then describe what the site shows, what it should show and your source. Messages are private.",
    channelFeedbackButton: "Leave feedback",
    channelGithubKicker: "On GitHub",
    channelGithubTitle: "GitHub issue",
    channelGithubDesc: "Needs a GitHub account. Issues are public: you can attach files, discuss the details and follow the fix.",
    guidanceTitle: "Decision guide: what kind of issue did you find?",
    guidance1Q: "Raw game value or stat looks wrong in OOW / Sequential?",
    guidance1A: "Raw enemy HP, element resistances, base stats, and wave pools are extracted directly from client data tables. Do not submit arbitrary numeric adjustments — please cite the specific game client version or season.",
    guidance2Q: "Readable item name is missing, outdated, or awkward?",
    guidance2A: "Item renames are maintained in a dedicated translation layer. Report the numeric item ID, the developer key, and your recommended translation.",
    guidance3Q: "Boss artwork mapping or mechanics composition is incorrect in FCE / OOW?",
    guidance3A: "Boss portraits, ability descriptions, and mechanics cards are maintained explicitly. If an association is mismatched, submit the correct boss identifier and screenshot/source reference.",
    checklistTitle: "What to include in a report",
    checklistSubtitle: "Include as much of the following as possible to help reproduce and fix the issue quickly:",
    checklistItems: [
      "Exact page URL and feature section (e.g. /datamine/oow/?s=23&floor=25)",
      "Game region and client version",
      "Screenshot or excerpt from the official game client showing the expected value",
      "Item ID, monster key, or buff attribute name if known",
      "Clear explanation of why the current value is incorrect"
    ],
    copy: "Copy",
    copied: "Copied",
    aesLabel: "Global AES key",
    submitText: "Send a report through the feedback page or GitHub Issues:",
    submitButton: "Open GitHub Issues"
  },
  ru: {
    metaTitle: "Помощь проекту — ToF Hub",
    metaDesc: "Помогите поддерживать актуальность ToF Hub: предоставьте свежий экспорт игры, помогите со сканированием Multype или сообщите об ошибке.",
    heroTitle: "Как помочь проекту",
    heroSubtitle: "Отправьте свежий экспорт игры, помогите со сканированием Multype или сообщите об ошибке в данных. Варианты независимы — выберите подходящий по времени.",
    tabRegular: "Обычное обновление",
    tabRegularSub: "~30 мин",
    tabMultype: "Скан Multype",
    tabMultypeSub: "~2 ч",
    tabCorrections: "Исправления",
    tabCorrectionsSub: "Отзывы · GitHub",
    tabsAria: "Варианты помощи проекту",
    regularTitle: "Регулярное обновление данных",
    regularBadge: "~30 мин",
    regularIntro: "Нужны Windows и установленный ПК-клиент Tower of Fantasy. Регулярное обновление занимает около 30 минут; время зависит от диска и размера обновления игры.",
    regularStep1Title: "Получите ToF Exporter",
    regularStep1Desc: "ToFExporter.exe — одна программа для Windows: не нужны установка, Node.js и распаковщик игры. Положите его в папку с правом записи на диске, где хватит места для извлечённых файлов и архива.",
    regularStep1Link: "Публичная ссылка на скачивание появится позже",
    regularStep1Download: "Скачать с Mega.nz",
    regularStep2Title: "Запустите и выберите игру",
    regularStep2Desc: "Запустите ToFExporter.exe двойным щелчком. При первом запуске выберите папку установленной игры, в следующие разы программа предложит сохранённую. Экспортёр извлечёт и обработает файлы и упакует архив обновления. Чтобы не отвечать на вопрос, укажите папку сразу:",
    regularStep2Code: 'ToFExporter.exe --game-path "D:\\Tower of Fantasy"',
    regularStep3Title: "Отправьте архив разработчику",
    regularStep3Desc: "После завершения в папке output рядом с EXE появится tof-update-<версия>-<дата>.zip. Первый архив полный (около 3,5 ГБ), следующие содержат только изменения и оканчиваются на -delta. Если прошлый архив не был применён, запустите экспортёр с --full. Самостоятельно обрабатывать файлы и публиковать обновление не нужно.",
    multypeTitle: "Исследовательское сканирование Multype",
    multypeBadge: "Экспорт ~1–2 ч · Скан ~5 мин",
    multypeIntro: "Раздел Multype требует полной распаковки всех ассетов игры и рекурсивного сканирования структур модификаторов. Рассчитывайте примерно на 2 часа общего времени.",
    multypeStep1Title: "Экспорт и распаковка всей игры",
    multypeStep1Desc: "Экспортируйте все ассеты игры в структурированный JSON с помощью FModel или UnrealExporter (параметр UE_Version: GAME_TowerOfFantasy).",
    multypeAesKey: "",
    multypeStep2Title: "Скачайте Exporter Scanner",
    multypeStep2Desc: "Загрузите или клонируйте инструмент сканирования на Python из GitHub:",
    multypeStep2Link: "Tower of Fantasy Exporter Scanner на GitHub",
    multypeStep3Title: "Запустите сканер",
    multypeStep3Desc: "Запустите CLI сканера, указав папку с экспортированными JSON, для построения карты связей атрибутов и модулей:",
    multypeStep3Code: "python main_scanning_files.py --input path_to_json --mode 1",
    multypeStep4Title: "Выходные файлы карты",
    multypeStep4Desc: "Сгенерированные файлы unique_attributes_sorted.json и module_extra_to_files_mapping3.json из папки Exported служат прямым источником для датасета Multype.",
    correctionsTitle: "Сообщить об ошибке в данных",
    correctionsBadge: "Два способа",
    correctionsIntro: "Нашли значение, название или картинку, которые не совпадают с игрой? Оставьте сообщение на странице отзывов сайта или откройте issue на GitHub — как вам удобнее. Оба способа доходят до разработчика.",
    channelFeedbackKicker: "На сайте",
    channelFeedbackTitle: "Страница отзывов",
    channelFeedbackDesc: "Аккаунт не нужен. Добавьте сообщение, выберите «К конкретной странице» и тип «Ошибка в данных», затем опишите, что показывает сайт, что должно быть и откуда эти данные. Сообщения не публикуются.",
    channelFeedbackButton: "Оставить отзыв",
    channelGithubKicker: "На GitHub",
    channelGithubTitle: "Issue на GitHub",
    channelGithubDesc: "Нужен аккаунт GitHub. Issue публичны: можно приложить файлы, обсудить детали и следить за исправлением.",
    guidanceTitle: "Какой тип проблемы вы обнаружили?",
    guidance1Q: "Числовое значение или характеристика в OOW / Sequential кажется неверной?",
    guidance1A: "Сырое здоровье монстров, сопротивления и пулы волн извлекаются напрямую из игровых таблиц. Не предлагайте произвольные правки цифр — укажите версию клиента игры или сезон для сверки.",
    guidance2Q: "Понятное название предмета отсутствует, устарело или переведено неточно?",
    guidance2A: "Переименования предметов хранятся в отдельном слое перевода. Укажите числовой ID предмета, ключ разработчика и предложенный вариант перевода.",
    guidance3Q: "Портрет босса или описание механики в FCE / OOW не совпадает?",
    guidance3A: "Привязка портретов боссов и тексты механик проверяются вручную. Сообщите идентификатор босса и приложите снимок экрана из игры.",
    checklistTitle: "Что включить в отчёт",
    checklistSubtitle: "Приложите максимум доступных данных для быстрого воспроизведения и исправления:",
    checklistItems: [
      "Точный URL страницы и подраздел (например, /datamine/oow/?s=23&floor=25)",
      "Регион игры и версия клиента (например, Korea Dev 2 · 6.4.10)",
      "Скриншот или фрагмент из игры с ожидаемым значением",
      "Числовой ID предмета, ключ монстра или название атрибута баффа (если известно)",
      "Краткое пояснение, в чём заключается неточность"
    ],
    copy: "Копировать",
    copied: "Скопировано",
    aesLabel: "Глобальный AES-ключ",
    submitText: "Отправьте отчёт через страницу отзывов или GitHub Issues:",
    submitButton: "Открыть GitHub Issues"
  }
}) satisfies Pick<Record<'en' | 'ru', ContributeLocaleContent>, 'en' | 'ru'>);
