import {describe,expect,it} from 'vitest';
import {rollValueStatElement,rollValueStatGroup} from './presentation';

describe('roll value stat colours',()=>{
  it('gives every rated stat family its own group',()=>{
    expect(rollValueStatGroup('Crit')).toBe('crit');
    expect(rollValueStatGroup('Crit Rate %')).toBe('crit-rate');
    expect(rollValueStatGroup('Attack')).toBe('attack');
    expect(rollValueStatGroup('Frost Attack')).toBe('element-attack');
    expect(rollValueStatGroup('Frost Attack %')).toBe('attack-percent');
    expect(rollValueStatGroup('Volt Damage %')).toBe('damage-percent');
    // Tank stats (2026-10-08): element RES like element ATK, universal RES like universal ATK, HP its own pair.
    expect(rollValueStatGroup('Resistance')).toBe('resistance');
    expect(rollValueStatGroup('Flame Resistance')).toBe('element-resistance');
    expect(rollValueStatGroup('Flame Resistance %')).toBe('resistance-percent');
    expect(rollValueStatGroup('HP')).toBe('hp');
    expect(rollValueStatGroup('HP %')).toBe('hp-percent');
    expect(rollValueStatGroup('Block')).toBe('other');
  });
  it('names the element of element stats only',()=>{
    expect(rollValueStatElement('Frost Attack')).toBe('Frost');
    expect(rollValueStatElement('Volt Attack %')).toBe('Volt');
    expect(rollValueStatElement('Physical Damage %')).toBe('Physical');
    expect(rollValueStatElement('Attack')).toBeUndefined();
    expect(rollValueStatElement('Crit Rate %')).toBeUndefined();
    expect(rollValueStatElement('HP %')).toBeUndefined();
    expect(rollValueStatElement('Flame Resistance %')).toBe('Flame');
    expect(rollValueStatElement('Altered Resistance')).toBe('Altered');
    expect(rollValueStatElement('Resistance')).toBeUndefined();
  });
});
