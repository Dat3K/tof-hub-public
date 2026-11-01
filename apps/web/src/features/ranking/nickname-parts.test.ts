import {describe,expect,it} from 'vitest';
import {nicknameParts} from './nickname-parts';

describe('nickname blank annotations',()=>{
  it('marks leading spaces and wholly blank names, keeping ordinary internal spaces',()=>{
    expect(nicknameParts('  Chef Ars')).toEqual([{text:'  ',blank:true},{text:'Chef Ars',blank:false}]);
    expect(nicknameParts('   ')).toEqual([{text:'   ',blank:true}]);
    expect(nicknameParts('Chef Ars')).toEqual([{text:'Chef Ars',blank:false}]);
  });
  it('marks blank Unicode runs and preserves the exact original string',()=>{
    const raw=' \u200b\u00a0Phantom\u200e\u3164';
    const parts=nicknameParts(raw);
    expect(parts).toEqual([{text:' \u200b\u00a0',blank:true},{text:'Phantom',blank:false},{text:'\u200e\u3164',blank:true}]);
    expect(parts.map(part=>part.text).join('')).toBe(raw);
    expect(nicknameParts('\u034f\ufe0f').every(part=>part.blank)).toBe(true);
  });
  it('keeps attached variation selectors, joiners and accents in visible graphemes',()=>{
    for(const raw of ['Player❤️','👩‍💻 Chef Ars','Cafe\u0301','A\u034f']) {
      expect(nicknameParts(raw)).toEqual([{text:raw,blank:false}]);
    }
  });
});
