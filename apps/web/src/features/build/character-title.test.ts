import {describe,it,expect} from 'vitest';
import {characterTitleCode,characterTitleLabel} from './character-title';
import type {BuildCatalog} from './types';

const catalog={titles:{'title_code':{en:'Known title',ru:'Известный титул'}}} as Pick<BuildCatalog,'titles'> as BuildCatalog;
describe('character title identity',()=>{
  it('localizes exact codes without changing storage',()=>{
    expect(characterTitleLabel('title_code',catalog,'en')).toBe('Known title');
    expect(characterTitleLabel('title_code',catalog,'ru')).toBe('Известный титул');
    expect(characterTitleCode('title_code',catalog.titles)).toBe('title_code');
  });
  it('preserves unknown ids and custom text while trimming display whitespace',()=>{
    for(const value of ['future_code','Custom title'])expect(characterTitleLabel(value,catalog,'ru','title_code')).toBe(value);
    expect(characterTitleLabel(' Known title ',catalog,'ru','title_code')).toBe('Known title');
    expect(characterTitleCode(' Known title ',catalog.titles,'title_code')).toBe(' Known title ');
    expect(characterTitleLabel(undefined,catalog,'ru')).toBe('');
    expect(characterTitleLabel('Known title',catalog,'ru')).toBe('Known title');
  });
  it('repairs localized captures only when the captured code and saved translation agree',()=>{
    expect(characterTitleCode('Known title',catalog.titles,'title_code')).toBe('title_code');
    expect(characterTitleLabel('Known title',catalog,'ru','title_code')).toBe('Известный титул');
    expect(characterTitleLabel('Известный титул',catalog,'en','title_code')).toBe('Known title');
    expect(characterTitleCode('Custom title',catalog.titles,'title_code')).toBe('Custom title');
  });
});
