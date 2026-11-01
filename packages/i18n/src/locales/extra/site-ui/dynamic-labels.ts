import type { Locale } from '../../../constants';

/** Labels whose English keys come from typed site option lists rather than JSX literals. */
export const siteUiDynamicLabelTranslations: Partial<Record<Locale, Readonly<Record<string, string>>>> = {
  ru: {
    'Asia-Pacific': 'Азиатско-Тихоокеанский регион',
    'North America': 'Северная Америка',
    Europe: 'Европа',
    Korea: 'Корея',
    'South America': 'Южная Америка',
    'Southeast Asia': 'Юго-Восточная Азия',
    Taiwan: 'Тайвань',
    'Warp Server': 'Сервер Warp',
    Test: 'Тестовые серверы',
  },
  de: {
    'Warp Server': 'Warp-Server',
    Test: 'Testserver',
  },
  es: {
    'Warp Server': 'Servidor Warp',
    Test: 'Servidor de prueba',
  },
  fr: {
    'Warp Server': 'Serveur Warp',
    Test: 'Serveur de test',
  },
  id: {
    'Warp Server': 'Server Warp',
    Test: 'Server uji',
  },
  ja: {
    'Warp Server': 'ワープサーバー',
    Test: 'テストサーバー',
  },
  ko: {
    'Warp Server': '워프 서버',
    Test: '테스트 서버',
  },
  pt: {
    'Warp Server': 'Servidor Warp',
    Test: 'Servidor de teste',
  },
  th: {
    'Warp Server': 'เซิร์ฟเวอร์ Warp',
    Test: 'เซิร์ฟเวอร์ทดสอบ',
  },
  'zh-CN': {
    'Warp Server': 'Warp 服务器',
    Test: '测试服务器',
  },
};
