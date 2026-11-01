import { createLocaleCopies, type Locale } from '@tof-hub/i18n';
export interface PrivacyLocaleContent {
  metaTitle: string;
  metaDesc: string;
  heroTitle: string;
  heroSubtitle: string;
  secSummaryTitle: string;
  summaryIntro: string;
  secInventoryTitle: string;
  invAnalyticsTitle: string;
  invAnalyticsDesc: string;
  invCookiesTitle: string;
  invCookiesDesc: string;
  invSessionTitle: string;
  invSessionDesc: string;
  invLogsTitle: string;
  invLogsDesc: string;
  secExternalTitle: string;
  externalDesc: string;
  secContactTitle: string;
  contactDesc: string;
  lastUpdated: string;
  glanceTitle: string;
  glanceDeviceTitle: string;
  glanceDevice: string[];
  glanceServerTitle: string;
  glanceServer: string[];
  contactButton: string;
}

export const PRIVACY_COPY: Record<Locale, (Record<'en' | 'ru', PrivacyLocaleContent>)['en']> = createLocaleCopies(({
  en: {
    metaTitle: "ToF | Privacy",
    metaDesc: "Project independence, browser storage, uploaded game data and server diagnostics.",
    heroTitle: "Privacy & Data Storage",
    heroSubtitle: "What stays in your browser and what is sent to the server.",
    secSummaryTitle: "Independent community project",
    summaryIntro: "This project is not affiliated with the developers or publishers of Tower of Fantasy. Original game files, source materials, artwork and other game assets belong to their respective rights holders.",
    secInventoryTitle: "Data the site uses",
    invAnalyticsTitle: "Analytics & Tracking",
    invAnalyticsDesc: "The production site uses self-hosted Umami to count page views, navigation, referring websites, countries, browsers and device types. Analytics receives no URL query strings, hashes, character UIDs, imported game data or tool contents. It uses no analytics cookies, respects Do Not Track and Global Privacy Control, and sends no advertising pixels. Page errors are reported separately to the site server.",
    invCookiesTitle: "Persistent Preferences",
    invCookiesDesc: "Language, game mode, display settings and saved selections may be stored in functional cookies, localStorage or IndexedDB on your device. Clearing site data removes these browser settings and local drafts.",
    invSessionTitle: "Game data sent to the server",
    invSessionDesc: "Importing captures or wish history sends their contents to the server for processing. Stored records can include character UID, nickname, server, equipment, builds, rankings and wish records. Imported data may appear in the corresponding public profiles, rankings and statistics.",
    invLogsTitle: "Error reports",
    invLogsDesc: "When a page fails, the browser sends the page path, error name, message and an optional reference to the site server. The report excludes the stack, query string, cookies and application state. Hosting infrastructure can also keep access logs.",
    secExternalTitle: "External Links",
    externalDesc: "This website links to external resources (such as GitHub, wikis, or community spreadsheets). Clicking external links navigates you to third-party services subject to their own terms and privacy practices.",
    secContactTitle: "Contact & Transparency",
    contactDesc: "For questions or a request concerning stored game records, contact the project developer through GitHub. Include the relevant page or character UID, and do not send passwords or login tokens.",
    lastUpdated: "Last updated: 29 October 2026",
    glanceTitle: "At a glance",
    glanceDeviceTitle: "Stays on your device",
    glanceDevice: [
      "Language, game mode and display settings",
      "Saved selections and local tool drafts (cookies, localStorage, IndexedDB)",
      "No analytics cookies and no advertising pixels",
    ],
    glanceServerTitle: "Reaches the server",
    glanceServer: [
      "Imported captures and wish history, including UID, nickname and server",
      "Cookieless page-view statistics (self-hosted Umami) and error reports",
    ],
    contactButton: "GitHub Issues"
  },
  ru: {
    metaTitle: "Политика конфиденциальности — TOF Datamine",
    metaDesc: "Независимость проекта, данные браузера, импорт игровых записей и серверная диагностика.",
    heroTitle: "Конфиденциальность и хранение данных",
    heroSubtitle: "Что хранится в браузере и какие данные получает сервер.",
    secSummaryTitle: "Независимый проект сообщества",
    summaryIntro: "Проект не связан с разработчиками и издателями Tower of Fantasy. Оригинальные игровые файлы, исходные материалы, изображения и другие ресурсы игры принадлежат их правообладателям.",
    secInventoryTitle: "Какие данные использует сайт",
    invAnalyticsTitle: "Аналитика и трекеры",
    invAnalyticsDesc: "На рабочем сайте используется собственный Umami: просмотры страниц, переходы, сайты-источники, страны, браузеры и типы устройств. В аналитику не передаются параметры URL, хеши, UID персонажей, импортированные игровые данные и содержимое инструментов. Аналитических куки и рекламных пикселей нет; учитываются настройки Do Not Track и Global Privacy Control. Ошибки страниц отправляются на сервер сайта отдельно.",
    invCookiesTitle: "Постоянные настройки",
    invCookiesDesc: "Язык, режим игры, настройки отображения и выбранные параметры могут сохраняться в функциональных куки, localStorage или IndexedDB на вашем устройстве. Очистка данных сайта удаляет эти настройки и локальные черновики.",
    invSessionTitle: "Игровые данные на сервере",
    invSessionDesc: "При импорте захватов или истории круток их содержимое отправляется на сервер. В базе могут храниться UID персонажа, никнейм, сервер, экипировка, билды, рейтинги и записи круток. Импортированные данные могут отображаться в соответствующих публичных профилях, рейтингах и статистике.",
    invLogsTitle: "Отчёты об ошибках",
    invLogsDesc: "Если страница падает, браузер отправляет на сервер сайта путь страницы, название ошибки, сообщение и при наличии код обращения. Отчёт не включает стек, параметры URL, куки и состояние приложения. Инфраструктура хостинга также может вести журналы запросов.",
    secExternalTitle: "Внешние ссылки",
    externalDesc: "На сайте размещены ссылки на сторонние ресурсы (GitHub, базы данных, таблицы сообщества). Переход по ним регулируется политиками соответствующих сервисов.",
    secContactTitle: "Контакты и прозрачность",
    contactDesc: "По вопросам о данных или для запроса по сохранённым игровым записям напишите разработчику через GitHub. Укажите страницу или UID персонажа; не отправляйте пароли и токены входа.",
    lastUpdated: "Обновлено: 29 октября 2026",
    glanceTitle: "Коротко",
    glanceDeviceTitle: "Остаётся на устройстве",
    glanceDevice: [
      "Язык, режим игры и настройки отображения",
      "Выбранные параметры и локальные черновики инструментов (куки, localStorage, IndexedDB)",
      "Нет аналитических куки и рекламных пикселей",
    ],
    glanceServerTitle: "Получает сервер",
    glanceServer: [
      "Импортированные захваты и история круток, включая UID, ник и сервер",
      "Статистика просмотров без куки (собственный Umami) и отчёты об ошибках",
    ],
    contactButton: "GitHub Issues"
  }
}) satisfies Pick<Record<'en' | 'ru', PrivacyLocaleContent>, 'en' | 'ru'>);
