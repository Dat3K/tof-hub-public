import {publicImportTranslations} from './public-import';
import type { Locale } from '../../constants';
import { cosmeticMediaTranslations } from './features/cosmetic-media';
import { titanCalculatorTranslations } from './features/titan-calculator';
import { de } from './cultures/de';
import { es } from './cultures/es';
import { fr } from './cultures/fr';
import { id } from './cultures/id';
import { ja } from './cultures/ja';
import { ko } from './cultures/ko';
import { pt } from './cultures/pt';
import { th } from './cultures/th';
import { zh_CN } from './cultures/zh-CN';
import { ru } from './cultures/ru';
import { commonTranslations } from './common';
import { officialNames } from './names/official';
import { siteUiTranslations } from './site-ui/base';
import { siteUiFollowupTranslations } from './site-ui/followup';
import { siteUiAdditionalTranslations } from './site-ui/additional';
import { siteUiJapaneseKoreanTranslations } from './site-ui/ja-ko';
import { siteUiChineseTranslations } from './site-ui/zh';
import { siteUiPortugueseThaiTranslations } from './site-ui/pt-th';
import { dishEffectTranslations } from './features/dish-effects';
import { artTitleTranslations } from './names/arts-titles';
import { buildLabelTranslations } from './build/labels';
import { buildPhraseTranslations } from './build/phrases';
import { entityNames } from './names/entity-names';
import { bossPlateTranslations } from './features/boss-plate';
import { buildHelpTranslations } from './build/help';
import { siteUiRouteBoundaryTranslations } from './site-ui/route-boundaries';
import { siteUiRenderedCopyTranslations } from './site-ui/rendered-copy';
import { siteUiDynamicLabelTranslations } from './site-ui/dynamic-labels';
import { siteUiRaidTranslations } from './site-ui/raids';
import { siteUiBuildTranslations } from './site-ui/build';
import { siteUiHandbookTranslations } from './site-ui/handbook';
import { siteUiFooterPageTranslations } from './site-ui/footer-pages';
import { siteUiTradeStationTranslations } from './site-ui/trade-station';

/** Per-culture supplements to the core phrase table: page copy, tool labels and chart captions. */
const pages: Partial<Record<Locale, Readonly<Record<string, string>>>> = {
  ru, de, es, fr, id, ja, ko, pt, th, 'zh-CN': zh_CN,
};

export const extraTranslations: Partial<Record<Locale, Readonly<Record<string, string>>>> = Object.fromEntries(
  (Object.keys(pages) as Locale[]).map(locale => [locale, { ...cosmeticMediaTranslations[locale], ...siteUiRaidTranslations[locale], ...siteUiFooterPageTranslations[locale], ...pages[locale], ...commonTranslations[locale], ...dishEffectTranslations[locale], ...artTitleTranslations[locale], ...buildLabelTranslations[locale], ...buildPhraseTranslations[locale], ...buildHelpTranslations[locale], ...bossPlateTranslations[locale], ...entityNames[locale], ...officialNames[locale], ...siteUiChineseTranslations[locale], ...siteUiPortugueseThaiTranslations[locale], ...siteUiJapaneseKoreanTranslations[locale], ...siteUiAdditionalTranslations[locale], ...siteUiBuildTranslations[locale], ...siteUiHandbookTranslations[locale], ...siteUiTranslations[locale], ...siteUiFollowupTranslations[locale], ...siteUiRouteBoundaryTranslations[locale], ...siteUiRenderedCopyTranslations[locale], ...siteUiDynamicLabelTranslations[locale], ...titanCalculatorTranslations[locale], ...siteUiTradeStationTranslations[locale], ...publicImportTranslations[locale] }]),
);
