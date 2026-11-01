import { describe, it, expect, beforeEach } from 'vitest';
import { DEFAULT_LOCALE, LOCALE_COOKIE_NAME, LEGACY_COOKIE_NAME } from '@tof-hub/i18n';
import { resolveLocaleFromCookieGetter, createI18nServerInstance } from './server';
import { readCookie, writeLocaleCookie, readClientCookieLocale } from './cookie';
import { getSimulacraStrings, getSimulacraChangelogStrings } from '@/features/simulacra/copy';
import { getMatricesStrings } from '@/features/info-sections/matrices/copy';
import { getRelicsStrings } from '@/features/info-sections/relics/copy';
import { getPetsStrings } from '@/features/info-sections/pets/copy';
import { getFoodStrings } from '@/features/info-sections/food/copy';
import { getCosmeticsStrings } from '@/features/info-sections/cosmetics/copy';
import { getArtsStrings } from '@/features/info-sections/arts/copy';
import { INFO_HUB_COPY, INFO_HUB_STRINGS_EN, INFO_HUB_STRINGS_RU } from '@/features/info-hub/copy';

describe('Info Sections i18n Resolution, Cookie Hierarchy & Fallback Logic', () => {
  beforeEach(() => {
    if (typeof document !== 'undefined') {
      // Clear document cookies
      document.cookie.split(';').forEach((c) => {
        const [k] = c.trim().split('=');
        if (k) {
          document.cookie = `${k}=; max-age=0; path=/`;
        }
      });
    }
  });

  describe('1. Server Locale Resolution & Cookie Precedence', () => {
    it('resolves canonical tof_locale cookie when present', () => {
      const getter = (name: string) => (name === LOCALE_COOKIE_NAME ? 'ru' : null);
      const res = resolveLocaleFromCookieGetter(getter);
      expect(res.locale).toBe('ru');
      expect(res.source).toBe('tof_locale');
    });

    it('resolves legacy cookie when canonical is absent', () => {
      const getter = (name: string) => (name === LEGACY_COOKIE_NAME ? 'ru' : null);
      const res = resolveLocaleFromCookieGetter(getter);
      expect(res.locale).toBe('ru');
      expect(res.source).toBe('legacy_cookie');
    });

    it('gives strict precedence to canonical cookie over legacy cookie', () => {
      const getter = (name: string) => {
        if (name === LOCALE_COOKIE_NAME) return 'en';
        if (name === LEGACY_COOKIE_NAME) return 'ru';
        return null;
      };
      const res = resolveLocaleFromCookieGetter(getter);
      expect(res.locale).toBe('en');
      expect(res.source).toBe('tof_locale');
    });

    it('falls back to default English when cookies are absent or contain invalid locale', () => {
      const emptyGetter = () => null;
      const res1 = resolveLocaleFromCookieGetter(emptyGetter);
      expect(res1.locale).toBe(DEFAULT_LOCALE);
      expect(res1.source).toBe('fallback');

      const invalidGetter = () => 'de_DE';
      const res2 = resolveLocaleFromCookieGetter(invalidGetter);
      expect(res2.locale).toBe(DEFAULT_LOCALE);
      expect(res2.source).toBe('fallback');
    });
  });

  describe('2. Client Cookie Management', () => {
    it('writes and reads canonical tof_locale cookie with valid expiration', () => {
      writeLocaleCookie('ru');
      const cookieValue = readCookie(LOCALE_COOKIE_NAME);
      expect(cookieValue).toBe('ru');

      const resolved = readClientCookieLocale();
      expect(resolved?.locale).toBe('ru');
      expect(resolved?.source).toBe('tof_locale');
    });

    it('reads legacy cookie on client when canonical cookie is absent', () => {
      document.cookie = `${LEGACY_COOKIE_NAME}=ru; path=/`;
      const resolved = readClientCookieLocale();
      expect(resolved?.locale).toBe('ru');
      expect(resolved?.source).toBe('legacy_cookie');
    });
  });

  describe('3. Server i18n Instance Translations', () => {
    it('creates server instance with English translations', async () => {
      const i18n = await createI18nServerInstance('en');
      expect(i18n.language).toBe('en');
      expect(i18n.t('shell.nav.info')).toBe('Info');
      expect(i18n.t('shell.brand.main')).toBe('TOF Hub');
    });

    it('creates server instance with Russian translations', async () => {
      const i18n = await createI18nServerInstance('ru');
      expect(i18n.language).toBe('ru');
      expect(i18n.t('shell.nav.info')).toBe('База знаний');
      expect(i18n.t('shell.brand.main')).toBe('База данных и знаний TOF');
    });
  });

  describe('4. Info Hub & Section Copy Bilingual Completeness (EN & RU)', () => {
    it('resolves Info Hub strings in English and Russian', () => {
      const en = INFO_HUB_COPY.en || INFO_HUB_STRINGS_EN;
      const ru = INFO_HUB_COPY.ru || INFO_HUB_STRINGS_RU;

      expect(en.heroTitle).toBe('Tower of Fantasy encyclopedia');
      expect(ru.heroTitle).toBe('Энциклопедия Tower of Fantasy');
      expect(en.simulacraTitle).toBe('Simulacra & Weapons');
      expect(ru.simulacraTitle).toBe('Симулякры и оружие');
      expect(en.matricesTitle).toBe('Matrices & Sets');
      expect(ru.matricesTitle).toBe('Матрицы и сеты');
    });

    it('resolves Simulacra strings in English and Russian', () => {
      const en = getSimulacraStrings('en');
      const ru = getSimulacraStrings('ru');

      expect(en.filterAll).toBe('All');
      expect(ru.filterAll).toBe('Все');
      expect(en.filterFrost).toBe('Frost');
      expect(ru.filterFrost).toBe('Лед');
      expect(en.filterFlame).toBe('Flame');
      expect(ru.filterFlame).toBe('Огонь');
      expect(en.filterVolt).toBe('Volt');
      expect(ru.filterVolt).toBe('Электро');
      expect(en.filterPhys).toBe('Physical');
      expect(ru.filterPhys).toBe('Физ.');
      expect(en.filterAltered).toBe('Altered');
      expect(ru.filterAltered).toBe('Аберрация');
      expect(en.sectionSkills).toBe('Weapon Skill Compendium & Damage Scaling');
      expect(ru.sectionSkills).toBe('Сборник навыков оружия и масштабирование урона');
      expect(en.loadingMmo).toBe('Loading MMO data...');
      expect(ru.loadingMmo).toBe('Загрузка данных MMO...');
      expect(en.loadingDetail).toBe('Loading character…');
      expect(ru.loadingDetail).toBe('Загрузка персонажа…');
      expect(en.loadingDetailHint).toBe('Skills, stats and artwork');
      expect(ru.loadingDetailHint).toBe('Навыки, характеристики и изображения');
      expect(en.advFallbackName).toBe('Star Advancement');
      expect(ru.advFallbackName).toBe('Возвышение');
      expect(en.comboWordHold).toBe('Hold');
      expect(ru.comboWordHold).toBe('Удерживать');
      expect(en.sectionOther).toBe('Other Changes');
      expect(ru.sectionOther).toBe('Прочие изменения');
      expect(en.changelogTypeTrait).toBe('Awakening Trait');
      expect(ru.changelogTypeTrait).toBe('Черта пробуждения');
      expect(en.devCatAll).toBe('All');
      expect(ru.devCatAll).toBe('Все');
      expect(en.devGroupSkillProv).toBe('Combat Skill Provenance & Identifiers');
      expect(ru.devGroupSkillProv).toBe('Источники и идентификаторы боевых навыков');
      expect(en.detailRetry).toBe('Retry');
      expect(ru.detailRetry).toBe('Повторить');
    });

    it('resolves Simulacra changelog strings in English and Russian', () => {
      const en = getSimulacraChangelogStrings('en');
      const ru = getSimulacraChangelogStrings('ru');

      expect(en.changeStatHp).toBe('HP');
      expect(ru.changeStatHp).toBe('ОЗ');
      expect(en.changeFallbackNormal).toBe('Normal Attack');
      expect(ru.changeFallbackNormal).toBe('Обычная атака');
      expect(en.trait).toBe('Trait');
      expect(ru.trait).toBe('Черта пробуждения');
      expect(en.matrix4pc).toBe('✦ 4-Piece Set');
      expect(ru.matrix4pc).toBe('✦ Комплект из 4 предметов');
    });

    it('resolves Matrices strings in English and Russian', () => {
      const en = getMatricesStrings('en');
      const ru = getMatricesStrings('ru');

      expect(en.all).toBe('All');
      expect(ru.all).toBe('Все');
      expect(en.piece2).toBe('2-Piece');
      expect(ru.piece2).toBe('2 предмета');
      expect(en.piece4).toBe('4-Piece');
      expect(ru.piece4).toBe('4 предмета');
    });

    it('resolves Relics strings in English and Russian', () => {
      const en = getRelicsStrings('en');
      const ru = getRelicsStrings('ru');

      expect(en.all).toBe('All');
      expect(ru.all).toBe('Все');
      expect(en.starAdvancements).toBe('Star Advancements');
      expect(ru.starAdvancements).toBe('Возвышения по звездам');
      expect(en.loadingMmo).toBe('Loading MMO data...');
      expect(ru.loadingMmo).toBe('Загрузка данных MMO...');
    });

    it('resolves Pets strings in English and Russian', () => {
      const en = getPetsStrings('en');
      const ru = getPetsStrings('ru');

      expect(en.categoryServants).toBe('Smart Servants');
      expect(ru.categoryServants).toBe('Смарт-слуги');
      expect(en.categoryModules).toBe('Skill Modules');
      expect(ru.categoryModules).toBe('Модули навыков');
      expect(en.loadingMmo).toBe('Loading MMO data...');
      expect(ru.loadingMmo).toBe('Загрузка данных MMO...');
      expect(en.petLoadTag).toBe('LOAD');
      expect(ru.petLoadTag).toBe('НАГР');
      expect(en.petModuleUniversalSingle).toBe('Universal Module');
      expect(ru.petModuleUniversalSingle).toBe('Общий модуль');
      expect(en.petNavBack).toBe('← Back to Pets');
      expect(ru.petNavBack).toBe('← Назад к питомцам');
      expect(en.petStatAtkLevel).toBe('ATK (Lv. {level})');
      expect(ru.petStatAtkLevel).toBe('АТК (Ур. {level})');
      expect(en.devCatAll).toBe('All');
      expect(ru.devCatAll).toBe('Все');
      expect(en.devAssetsFilterArt).toBe('Art');
      expect(ru.devAssetsFilterArt).toBe('Иллюстрации');
      expect(en.devBaseStatsTitle).toBe('Pet Stats');
      expect(ru.devBaseStatsTitle).toBe('Статы пета');
    });

    it('resolves Food strings in English and Russian', () => {
      const en = getFoodStrings('en');
      const ru = getFoodStrings('ru');

      expect(en.tabDishes).toBe('Dishes');
      expect(ru.tabDishes).toBe('Блюда');
      expect(en.tabIngredients).toBe('Ingredients');
      expect(ru.tabIngredients).toBe('Ингредиенты');
      expect(en.tabPotions).toBe('Potions');
      expect(ru.tabPotions).toBe('Зелья');
    });

    it('resolves Cosmetics strings in English and Russian', () => {
      const en = getCosmeticsStrings('en');
      const ru = getCosmeticsStrings('ru');

      expect(en.all).toBe('All');
      expect(ru.all).toBe('Все');
      expect(en.typeDress).toBe('Cosmetics');
      expect(ru.typeDress).toBe('Косметика');
      expect(en.typeMount).toBe('Mounts');
      expect(ru.typeMount).toBe('Маунты');
      expect(en.loading).toBe('Loading cosmetics…');
      expect(ru.loading).toBe('Загрузка косметики…');
    });

    it('resolves Arts strings in English and Russian', () => {
      const en = getArtsStrings('en');
      const ru = getArtsStrings('ru');

      expect(en.tabAll).toBe('All');
      expect(ru.tabAll).toBe('Все');
      expect(en.tabWallpapers).toBe('Wallpapers');
      expect(ru.tabWallpapers).toBe('Обои');
      expect(en.loading).toBe('Loading artworks…');
      expect(ru.loading).toBe('Загрузка иллюстраций…');
    });

    it('gracefully falls back to English when an unhandled locale is passed to copy getters', () => {
      const fallbackSim = getSimulacraStrings('unknown' as any);
      expect(fallbackSim.filterAll).toBe('All');
      expect(fallbackSim.sectionSkills).toBe('Weapon Skill Compendium & Damage Scaling');

      const fallbackMatrices = getMatricesStrings('unknown' as any);
      expect(fallbackMatrices.all).toBe('All');
      expect(fallbackMatrices.piece2).toBe('2-Piece');
    });
  });
});
