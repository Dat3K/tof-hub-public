import {describe,expect,it} from 'vitest';
import {parseAugmentScreenText,parseGearCard,parseGearCardText,parseOcrNumber,statAliases} from './gear-ocr';
import {createOcrGuard} from './gear-ocr-engine';

const candidates=[
  {type:'HP',percent:false},{type:'Attack',percent:false},{type:'Physical Attack',percent:false},{type:'Physical Attack %',percent:true},
  {type:'Crit',percent:false},{type:'Crit Rate %',percent:true},{type:'Frost Resistance',percent:false},{type:'Frost Resistance %',percent:true}
];

describe('gear screenshot text',()=>{
  it('knows the in-game abbreviations of a stat',()=>{
    expect(statAliases('Physical Attack %')).toContain('Physical ATK');
    expect(statAliases('Crit Rate %')).toContain('CR');
  });
  it('parses in-game numbers',()=>{
    expect(parseOcrNumber('+4,125')).toBe(4125);
    expect(parseOcrNumber('+7.8%')).toBeCloseTo(0.078,10);
    expect(parseOcrNumber('abc')).toBeUndefined();
  });
  it('reads the gear card: longest name wins and % separates flat from percent',()=>{
    const text='Physical ATK +513\nPhysical ATK +5.58%\nCrit +702\nHP +4,125\nCR +1.05%';
    expect(parseGearCardText(text,candidates,4)).toEqual([
      {type:'Physical Attack',value:513},{type:'Physical Attack %',value:0.0558},{type:'Crit',value:702},{type:'HP',value:4125}]);
  });
  it('stops at the number of stat slots',()=>{
    expect(parseGearCardText('HP +1\nCrit +2\nATK +3',candidates,2)).toHaveLength(2);
  });
  it('reads the augmentation screen: name line then noisy value line, and a name without a value',()=>{
    const text='Frost RES\n  +3,6 06\nHP\n';
    expect(parseAugmentScreenText(text,candidates,2)).toEqual([{type:'Frost Resistance',value:3606},{type:'HP',value:undefined}]);
  });
  it('picks the % counterpart of a shared name by the sign',()=>{
    expect(parseAugmentScreenText('Frost RES\n+6.44%',candidates,1)).toEqual([{type:'Frost Resistance %',value:0.0644}]);
  });
});

describe('whole gear card (real client screenshots)',()=>{
  const types=[
    ['HP',false],['Attack',false],['Crit',false],['Volt Attack',false],['Volt Attack %',true],['Volt Damage %',true],
    ['Flame Resistance',false],['Volt Resistance',false],['Flame Attack %',true],['Frost Attack %',true],['Flame Attack',false]
  ] as const;
  const all=types.map(([type,percent])=>({type,percent}));
  const options={random:all,augment:all,maxRandom:4,maxAugment:2,
    rare:[{id:'weak',names:['Weak Point']},{id:'dodge',names:['Dodge Attack']},{id:'normal',names:['Normal Attack']}]};
  it('reads Titan Handguards: flat stats, rare level and flat resistances',()=>{
    const text=['Titan Handguards 80','CS: 17952','Random Stats','Volt Attack +388','HP +22,144','ATK +293','Crit +6,507',
      'Augmentation Stats','Weak Point Damage Boost +3','Flame Resistance +4,692','Volt Resistance +4,717'].join('\n');
    const card=parseGearCard(text,options);
    expect(card.name).toBe('Titan Handguards');
    expect(card.enhancement).toBe(80);
    expect(card.random).toEqual([{type:'Volt Attack',value:388},{type:'HP',value:22144},{type:'Attack',value:293},{type:'Crit',value:6507}]);
    expect(card.rare).toEqual({id:'weak',level:3});
    expect(card.augments).toEqual([{type:'Flame Resistance',value:4692},{type:'Volt Resistance',value:4717}]);
  });
  it('reads Titan Microreactor: three-decimal percentages and Volt Damage',()=>{
    const text=['Titan Microreactor 80','CS: 60932','Random Stats','ATK +295','Volt Attack +6.68%','Volt Damage +1.839%','Volt Attack +615',
      'Augmentation Stats','Dodge Attack Damage Boost +3','Flame Attack +5.83%','Frost Attack +5.937%'].join('\n');
    const card=parseGearCard(text,options);
    expect(card.random).toEqual([{type:'Attack',value:295},{type:'Volt Attack %',value:0.0668},{type:'Volt Damage %',value:0.01839},{type:'Volt Attack',value:615}]);
    expect(card.rare).toEqual({id:'dodge',level:3});
    expect(card.augments).toEqual([{type:'Flame Attack %',value:0.0583},{type:'Frost Attack %',value:0.05937}]);
  });
  it('reads a cropped screenshot without headings as random stats',()=>{
    const card=parseGearCard(['ATK +290','Volt Attack +6.621%','Volt Attack +938','Volt Damage +1.067%'].join('\n'),options);
    expect(card.random.map(stat=>stat.type)).toEqual(['Attack','Volt Attack %','Volt Attack','Volt Damage %']);
    expect(card.augments).toEqual([]);
  });
});

describe('OCR guard',()=>{
  const limits={maxBytes:1000,types:['image/png'],maxPerWindow:2,windowMs:10_000,minGapMs:1_000};
  it('rejects the wrong type and size without starting',()=>{
    const guard=createOcrGuard(limits);
    expect(guard.check({type:'application/pdf',size:10})).toMatchObject({ok:false,reason:'type'});
    expect(guard.check({type:'image/png',size:5000})).toMatchObject({ok:false,reason:'size'});
    expect(guard.check({type:'image/png',size:0})).toMatchObject({ok:false,reason:'size'});
  });
  it('applies a larger size limit only to the requested import',()=>{
    const guard=createOcrGuard();
    const maxBytes=20*1024*1024;
    const file={type:'image/png',size:maxBytes};
    expect(guard.check(file)).toMatchObject({ok:false,reason:'size'});
    expect(guard.check(file,0,maxBytes)).toEqual({ok:true});
    expect(guard.check({...file,size:maxBytes+1},0,maxBytes)).toMatchObject({ok:false,reason:'size'});
  });
  it('allows one reading at a time, a gap and a per-window budget',()=>{
    const guard=createOcrGuard(limits),file={type:'image/png',size:10};
    expect(guard.check(file,0)).toEqual({ok:true});
    guard.begin(0);
    expect(guard.check(file,100)).toMatchObject({reason:'busy'});
    guard.end();
    expect(guard.check(file,500)).toMatchObject({reason:'gap',retryAfterMs:500});
    expect(guard.check(file,2_000)).toEqual({ok:true});
    guard.begin(2_000);guard.end();
    expect(guard.check(file,4_000)).toMatchObject({reason:'rate'});
    expect(guard.check(file,11_000)).toEqual({ok:true});
  });
});
