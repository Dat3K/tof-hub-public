import { describe, expect, it } from 'vitest';
import { localized, localizedUi, translateUiText } from '@tof-hub/i18n';

describe('site UI phrase catalog', () => {
  it('translates page copy for every supplied culture and falls back to English', () => {
    expect(translateUiText('How ranking is calculated', 'de')).toBe('So wird das Ranking berechnet');
    expect(translateUiText('How ranking is calculated', 'zh-Hans-SG')).toBe('排行如何计算');
    expect(translateUiText('Capture app', 'ja')).not.toBe('Capture app');
    expect(translateUiText('A phrase nobody translated', 'ko')).toBe('A phrase nobody translated');
  });

  it('translates browser-tab titles and short labels outside the dictionaries', () => {
    expect(translateUiText('Optimizer | ToF Hub', 'zh-CN')).toBe('优化器 | ToF Hub');
    expect(translateUiText('WIN', 'de')).toBe('GEWONNEN');
    expect(translateUiText('Return to Home', 'fr')).toBe('Retour à l’accueil');
  });

  it('keeps placeholders intact and lets reviewed site wording outrank game-name fallbacks', () => {
    expect(translateUiText('Player {0}', 'ru')).toBe('Игрок {0}');
    expect(translateUiText('Loading {{section}}…', 'ru')).toBe('Загрузка {{section}}…');
    expect(translateUiText('Benediction', 'id')).toBe('Berkah');
    expect(translateUiText('Tower of Fantasy Hub', 'ja')).toBe('Tower of Fantasy Hub');
  });

  it('resolves site-authored copy through the phrase table but leaves game data on the English fallback', () => {
    const label = { en: 'Gear optimizer', ru: 'Оптимайзер гира' };
    expect(localizedUi(label, 'ru')).toBe('Оптимайзер гира');
    expect(localizedUi(label, 'fr')).toBe('Optimiseur d’équipement');
    expect(localizedUi({ en: 'Unlisted name', ru: 'x' }, 'fr')).toBe('Unlisted name');
    expect(localized(label, 'fr')).toBe('Gear optimizer');
  });
});

describe('Accept-Language negotiation', () => {
  it('prefers the highest-weighted shipped culture and otherwise yields nothing', async () => {
    const { negotiateLocale } = await import('@tof-hub/i18n');
    expect(negotiateLocale('de-DE,de;q=0.9,en;q=0.8')).toBe('de');
    expect(negotiateLocale('pt-BR,pt;q=0.9')).toBe('pt');
    expect(negotiateLocale('zh-TW,zh;q=0.9')).toBe('zh-CN');
    expect(negotiateLocale('zh-Hans-SG')).toBe('zh-Hans-SG');
    expect(negotiateLocale('xx;q=1, fr;q=0.2')).toBe('fr');
    expect(negotiateLocale('sv, nl;q=0.5')).toBeUndefined();
    expect(negotiateLocale(undefined)).toBeUndefined();
  });
});
