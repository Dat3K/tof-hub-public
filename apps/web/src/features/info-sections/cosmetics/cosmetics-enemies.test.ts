import { describe, expect, it } from 'vitest';
import {
  COSMETIC_CATEGORY_OPTIONS,
  getCosmeticCategoryTone,
  getItemCategory,
} from './constants';
import { COSMETICS_STRINGS_EN, COSMETICS_STRINGS_RU } from './copy';

describe('cosmetics enemies category', () => {
  it('maps enemy items to the Enemies category', () => {
    expect(getItemCategory({ id: 'x', category: 'enemies' })).toBe('Enemies');
    expect(getItemCategory({ id: 'x', fashion_type: 'Enemy' })).toBe('Enemies');
  });

  it('exposes the Enemies filter option with copy and icon', () => {
    const option = COSMETIC_CATEGORY_OPTIONS.find((o) => o.id === 'Enemies');
    expect(option).toMatchObject({ copyKey: 'typeEnemies', icon: 'enemy' });
  });

  it('labels Enemies in English and Russian', () => {
    expect(COSMETICS_STRINGS_EN.typeEnemies).toBe('Enemies');
    expect(COSMETICS_STRINGS_RU.typeEnemies).toBe('Враги');
  });

  it('tones enemy cards distinctly', () => {
    expect(getCosmeticCategoryTone('Enemies')).toBe('enemy');
  });
});
