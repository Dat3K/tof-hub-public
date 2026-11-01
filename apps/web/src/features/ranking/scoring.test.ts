import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {buildRankingCatalog,elementPairs} from './catalog';
import {resistanceGearTop,resistancePlayerTop,attackGearTop,attackPlayerTop,idealPlayerTop,topGearDraft,buildTrackScore,entryGear,exampleGearTop,examplePlayerTop,gearStages,gearStageScores,gearTrackScore,parseTrack,gearGain,buildGain,trackNormalization,idealGearDraft,gearCurrentScore} from './scoring';
import type {BuildCatalog} from '../build/types';
import {compareCurrentGearForTrack,createCurrentGearScorer,elementTracks,scoreGearForTrack} from '@tof-hub/game-domain';
import {buildRollValue} from '../build/model';
import titanBoots from '../build/__fixtures__/titan-boots.json';

const build=JSON.parse(readFileSync('apps/web/public/game-data/build-page.json','utf8')) as BuildCatalog;
const catalog=buildRankingCatalog(build);

describe('ranking tracks',()=>{
  it('derives pair tracks from dual-element weapons and keeps mono elements',()=>{
    const pairs=elementPairs(build).map(pair=>pair.join('-'));
    expect(pairs).toEqual(expect.arrayContaining(['Frost-Volt','Volt-Frost','Flame-Physical','Physical-Flame']));
    expect(pairs.every(pair=>pair.split('-').length===2)).toBe(true);
    expect(parseTrack('Frost-Volt',catalog)).toEqual(['Frost','Volt']);
    expect(parseTrack('Altered',catalog)).toEqual(['Altered']);
    expect(parseTrack('Water',catalog)).toEqual([Object.keys(build.elementIcons)[0]]);
  });
  it('drops base-stat tables from the slim catalog',()=>{
    expect(catalog.gear).toHaveLength(build.gear.length);
    expect(catalog.gear.every(item=>!('baseStats' in item))).toBe(true);
    expect(JSON.stringify(catalog).length).toBeLessThan(JSON.stringify(build).length/10);
  });
});

describe('ranking scoring',()=>{
  it('keeps tied captured stats within their stage ceilings without changing current ranking scores',()=>{
    const gear=structuredClone(titanBoots),track=['Physical'];
    const now=gearCurrentScore(gear,track,catalog);
    const withoutOriginals={...gear,rows:gear.rows.map(row=>({...row,beforeTitan:null}))};
    expect(gearCurrentScore(withoutOriginals,track,catalog)).toEqual(now);
    for(const reverse of [false,true]) {
      if(reverse)gear.rows.reverse();
      const stages=gearStages(gear,catalog);
      for(const type of ['Physical Attack','Volt Attack']) {
        const row=stages.current.find(row=>row.type===type)!;
        expect(row.maximum).toBeCloseTo(400.9);
        expect(row.value).toBeLessThan(row.maximum!);
      }
      expect(gearCurrentScore(gear,track,catalog).value).toBeCloseTo(now.value,12);
      const scores=gearStageScores(gear,track,catalog);
      expect(scores.maximum!.value).toBeGreaterThanOrEqual(scores.now.value);
    }
  });
  const visor=catalog.example.gear.find(item=>item.id==='visor')!;
  it('scores like the build card: a pair track also rates ATK%/DMG% of the second element',()=>{
    const fixture={...visor,stars:5,titan:false,augmented:false,rows:['Frost Attack','Frost Attack %','HP','Resistance'].map(type=>{const bounds=build.reference.statTypes[type]!,value=bounds.randomStatDefaultValue+(type==='Frost Attack'?5*bounds.randomStatMaxRollValue:0);return {type,value,beforeTitan:value};}),augments:[]};
    const mono=gearTrackScore(fixture,['Frost'],catalog),pair=gearTrackScore(fixture,['Volt','Frost'],catalog);
    expect(mono.percent).not.toBeNull();
    expect(mono.score.percentElements).toEqual(['Frost']);
    expect(pair.score.percentElements).toEqual(['Volt','Frost']);
    // Both the percentage and flat Frost ATK count on the Volt-Frost pair.
    expect(pair.score.entries.some(entry=>entry.useful&&entry.type==='Frost Attack %')).toBe(true);
    expect(pair.score.entries.some(entry=>entry.useful&&entry.type==='Frost Attack')).toBe(true);
  });
  it('ranks the example by the share of each slot ceiling and filters by slot',()=>{
    const all=exampleGearTop(catalog,['Frost','Volt'],null);
    expect(all).toHaveLength(catalog.example.gear.length);
    expect(all.map(entry=>entry.rank)).toEqual(all.map((_,index)=>index+1));
    for(let i=1;i<all.length;i++)expect(all[i-1]!.score).toBeGreaterThanOrEqual(all[i]!.score);
    expect(exampleGearTop(catalog,['Frost'],'visor').map(entry=>entry.gear.slot)).toEqual(['visor']);
  });
  it('round-trips an entry and exposes original, current and maximum stages',()=>{
    const [entry]=exampleGearTop(catalog,['Frost'],'visor');
    const gear=entryGear(entry!);
    expect(gear.rows.map(row=>row.beforeTitan)).toEqual(visor.rows.map(row=>row.beforeTitan));
    const stages=gearStages(gear,catalog);
    expect(stages.original.map(row=>row.value)).toEqual(visor.rows.map(row=>row.beforeTitan));
    for(const [index,row] of stages.maximum.entries())if(row.value!==null)expect(row.value).toBeGreaterThanOrEqual(stages.current[index]!.value-1e-9);
  });
  it('totals a player as the sum of slot scores over the sum of slot ceilings',()=>{
    const total=buildTrackScore(catalog.example.gear,['Frost'],catalog);
    const [player]=examplePlayerTop(catalog,['Frost']);
    expect(player!.score).toBeCloseTo(total.value/total.maximum*100,8);
    expect(total.slots).toHaveLength(catalog.example.gear.length);
  });
});

describe('shared API scoring',()=>{
  it.each(['dps','healer','tank'] as const)('matches Build and Ranking total GRV, ceiling and percentage for %s',role=>{
    const draft=structuredClone(build.demoDraft);
    draft.profile.role=role;
    draft.rv={mode:'grv',element:'Frost',includeCrit:true};
    // Set the required pair explicitly: the imported public demo can have any weapons.
    const pairWeapon=build.weapons.find(item=>item.elements.length===2&&item.elements.includes('Frost')&&item.elements.includes('Volt'))!;
    draft.weapons=[{...draft.weapons[0]!,id:pairWeapon.id}];
    const track=role==='tank'?['Frost']:['Frost','Volt'];
    const card=buildRollValue(draft,build),ranking=buildTrackScore(draft.gear.filter(item=>item.equipped),track,catalog,role);
    expect(card.value).toBeCloseTo(ranking.value,9);
    expect(card.maximum).toBeCloseTo(ranking.maximum,9);
    expect(card.value!/card.maximum*100).toBeCloseTo(ranking.percent,9);
  });
  it.each(['dps','healer'] as const)('counts the larger flat ATK once on either duo orientation for %s',role=>{
    const gear=structuredClone(catalog.example.gear.find(item=>item.id==='reactor')!);
    gear.titan=false;gear.augmented=false;gear.stars=5;gear.augments=[];
    gear.rows=[{type:'Frost Attack',value:800,beforeTitan:800},{type:'Volt Attack',value:912,beforeTitan:912},
      {type:'Attack',value:495,beforeTitan:495},{type:'HP',value:23000,beforeTitan:23000}];
    const forward=gearCurrentScore(gear,['Frost','Volt'],catalog,role),reverse=gearCurrentScore(gear,['Volt','Frost'],catalog,role);
    expect(forward.value).toBeCloseTo(reverse.value,10);
    expect(forward.maximum).toBeCloseTo(reverse.maximum,10);
    expect(forward.entries.filter(entry=>entry.type.endsWith(' Attack'))).toEqual([expect.objectContaining({type:'Volt Attack',value:912})]);
    const weaker=structuredClone(gear);weaker.rows[0]!.value=0;
    expect(gearCurrentScore(weaker,['Frost','Volt'],catalog,role).value).toBeCloseTo(forward.value,10);
    expect(gearGain({gear,track:['Frost','Volt']},{gear:weaker,track:['Volt','Frost']},catalog,role).gain).toBeCloseTo(0,12);
    const batch=createCurrentGearScorer(build.reference);
    const input={rows:gear.rows,augments:gear.augments,allowedTypes:build.gear.find(slot=>slot.id===gear.id)!.allowedStats};
    expect(batch(input,['Frost','Volt'],role).value).toBeCloseTo(forward.value,10);
    expect(batch(input,['Volt','Frost'],role).value).toBeCloseTo(forward.value,10);
    const player=buildTrackScore([gear],['Frost','Volt'],catalog,role);
    expect(player.value).toBeCloseTo(buildTrackScore([gear],['Volt','Frost'],catalog,role).value,10);
  });
  it('matches the build card GRV for every sample item and every track',()=>{
    const tracks=elementTracks(Object.keys(build.elementIcons),build.weapons);
    expect(tracks.map(track=>track.join('-'))).toEqual([...Object.keys(build.elementIcons),...catalog.pairs.map(pair=>pair.join('-'))]);
    for(const gear of catalog.example.gear)for(const track of tracks) {
      const shared=scoreGearForTrack({rows:gear.rows,stars:gear.stars,augmented:gear.titan||!!gear.augmented,
        allowedTypes:build.gear.find(item=>item.id===gear.id)!.allowedStats},track,build.reference);
      const card=gearTrackScore(gear,track,catalog);
      expect(shared.maximum).toBeCloseTo(card.score.maximum,9);
      if(card.percent===null)expect(shared.percent).toBeNull();else expect(shared.percent).toBeCloseTo(card.percent,9);
    }
  });
});



describe('ATK% reference player',()=>{
  it.each([['Physical'],['Frost'],['Flame','Physical'],['Frost','Volt']])('uses legal ATK% primaries for %j without changing the ceiling',(...track)=>{
    const entry=attackPlayerTop(catalog,track),perfect=idealPlayerTop(catalog,track);
    expect(entry.rank).toBe(.5);
    expect(entry.reference).toBe('attack-percent');
    expect(entry.gear).toHaveLength(catalog.gear.length);
    expect(entry.maxScore).toBeCloseTo(perfect.maxScore,8);
    expect(entry.score).toBeGreaterThan(0);
    expect(entry.score).toBeLessThanOrEqual(perfect.score+1e-8);
    for(const item of entry.gear) {
      const meta=catalog.gear.find(slot=>slot.id===item.slot)!;
      const primary=track.map(element=>element+' Attack %').find(type=>meta.allowedStats.includes(type));
      expect(item.stats.length).toBeLessThanOrEqual(catalog.reference.limits.maxNumOfRandomStats);
      expect(item.stats.every(stat=>meta.allowedStats.includes(stat.type))).toBe(true);
      const ideal=perfect.gear.find(slot=>slot.slot===item.slot)!;
      if(!primary)expect(item).toEqual(ideal);
      else {
        const bounds=catalog.reference.statTypes[primary]!;
        expect(item.statsBeforeTitan![item.stats.findIndex(stat=>stat.type===primary)]).toBeCloseTo(
          bounds.randomStatDefaultValue+catalog.reference.limits.maxNumOfRandomStatRolls*bounds.randomStatMaxRollValue,9);
        for(const [i,stat] of item.stats.entries())if(stat.type!==primary)
          expect(item.statsBeforeTitan![i]).toBe(catalog.reference.statTypes[stat.type]!.randomStatDefaultValue);
      }
    }
    const score=buildTrackScore(entry.gear.map(topGearDraft),track,catalog);
    expect(entry.score).toBeCloseTo(score.percent,9);
  });
});


it.each(['dps','healer','tank'] as const)('scores the ATK% reference with the selected %s role',role=>{
  const track=['Physical'],entry=attackPlayerTop(catalog,track,role);
  const total=buildTrackScore(entry.gear.map(topGearDraft),track,catalog,role);
  expect(entry.score).toBeCloseTo(total.percent,9);
  expect(entry.maxScore).toBeCloseTo(idealPlayerTop(catalog,track,role).maxScore,9);
  expect(idealPlayerTop(catalog,track,role).score).toBeCloseTo(100,8);
},20000);


describe('ATK% reference gear',()=>{
  it.each([['Physical'],['Frost','Volt']])('adds only eligible slots and matches the reference player for %j',(...track)=>{
    const player=attackPlayerTop(catalog,track),items=attackGearTop(catalog,track,null);
    const slots=catalog.gear.filter(item=>track.some(element=>item.allowedStats.includes(element+' Attack %'))).map(item=>item.id);
    expect(items.map(item=>item.gear.slot)).toEqual(slots);
    for(const entry of items) {
      expect(entry.rank).toBe(.5);
      expect(entry.reference).toBe('attack-percent');
      expect(entry.gear).toEqual(player.gear.find(item=>item.slot===entry.gear.slot));
    }
    expect(attackGearTop(catalog,track,'helmet')).toEqual([]);
    expect(attackGearTop(catalog,track,'visor')).toEqual(items.filter(item=>item.gear.slot==='visor'));
  });
});

describe('compare (universal fighter)',()=>{
  const frost=parseTrack('Frost',catalog);
  const ideal=(slot:string)=>idealGearDraft(slot,frost,catalog);
  it('is zero against itself and signed both ways',()=>{
    const helmet=catalog.example.gear.find(item=>item.id==='helmet')!;
    expect(gearGain({gear:ideal('helmet'),track:frost},{gear:ideal('helmet'),track:frost},catalog).gain).toBeCloseTo(0,12);
    const up=gearGain({gear:ideal('helmet'),track:frost},{gear:helmet,track:frost},catalog);
    const down=gearGain({gear:helmet,track:frost},{gear:ideal('helmet'),track:frost},catalog);
    expect(up.gain).toBeGreaterThan(0);
    expect(down.gain).toBeCloseTo(1/(1+up.gain)-1,12);
    expect(up.factors.reduce((product,factor)=>product*(1+factor.gain),1)-1).toBeCloseTo(up.gain,12);
  });
  it('agrees with the GRV difference to first order',()=>{
    const helmet=catalog.example.gear.find(item=>item.id==='helmet')!;
    const exact=gearGain({gear:ideal('helmet'),track:frost},{gear:helmet,track:frost},catalog).gain;
    const grv=(gear:typeof helmet)=>gearCurrentScore(gear,frost,catalog).value;
    const linear=buildGain({value:grv(ideal('helmet')),track:frost},{value:grv(helmet),track:frost},catalog);
    expect(Math.abs(linear/exact-1)).toBeLessThan(.1);
    // 100 GRV on Frost DPS ≈ the log gain of one maximum Crit roll after Titan.
    expect(trackNormalization(frost,catalog)).toBeGreaterThan(.01);
    expect(trackNormalization(frost,catalog)).toBeLessThan(.03);
  });
  it('rates healer ATK positively and tank damage taken negatively',()=>{
    for(const role of ['healer','tank'] as const) {
      const gear=idealGearDraft('helmet',frost,catalog,role);
      const gain=gearGain({gear,track:frost},{gear:catalog.example.gear.find(item=>item.id==='helmet')!,track:frost},catalog,role).gain;
      if(role==='tank')expect(gain).toBeLessThan(0);
      else expect(gain).toBeGreaterThan(0);
    }
  });
  it('inverts the tank EHP ratio and its factors rather than negating the percentage',()=>{
    const a=idealGearDraft('helmet',frost,catalog,'tank'),b=catalog.example.gear.find(item=>item.id==='helmet')!;
    const input=(gear:typeof a)=>({gear:{rows:gear.rows,augments:gear.augments,allowedTypes:build.gear.find(item=>item.id===gear.id)!.allowedStats},track:frost});
    const ehp=compareCurrentGearForTrack(input(a),input(b),build.reference,'tank');
    const damage=gearGain({gear:a,track:frost},{gear:b,track:frost},catalog,'tank');
    expect(damage.gain).toBeCloseTo(1/(1+ehp.gain)-1,12);
    expect(damage.gain).not.toBeCloseTo(-ehp.gain,6);
    expect(damage.factors.reduce((product,factor)=>product*(1+factor.gain),1)-1).toBeCloseTo(damage.gain,12);
    expect(gearGain({gear:b,track:frost},{gear:a,track:frost},catalog,'tank').gain).toBeGreaterThan(0);
    expect(gearGain({gear:a,track:frost},{gear:a,track:frost},catalog,'tank').gain).toBe(0);
    const players=buildGain({value:6000,track:frost},{value:4000,track:frost},catalog,'tank');
    expect(players).toBeCloseTo(Math.exp(-2000*trackNormalization(frost,catalog,'tank')/100)-1,12);
    expect(players).toBeLessThan(0);
    expect(buildGain({value:4000,track:frost},{value:6000,track:frost},catalog,'tank')).toBeCloseTo(1/(1+players)-1,12);
  });
});

 it.each(['dps','healer','tank'] as const)('matches the Altered equipped card and ranking for %s',role=>{
  const draft=structuredClone(build.demoDraft);draft.profile.role=role;draft.rv={mode:'grv',element:'Altered',includeCrit:true};
  const card=buildRollValue(draft,build),ranking=buildTrackScore(draft.gear.filter(item=>item.equipped),['Altered'],catalog,role);
  expect(card.value).toBeCloseTo(ranking.value,9);expect(card.maximum).toBeCloseTo(ranking.maximum,9);
});

describe('Only RES tank references',()=>{
  it.each([['Frost'],['Altered']])('keeps HP in main stats and uses the full tank ceiling for %j',(...track)=>{
    const player=resistancePlayerTop(catalog,track),items=resistanceGearTop(catalog,track,null),perfect=idealPlayerTop(catalog,track,'tank');
    expect(player.reference).toBe('resistance-only');expect(player.rank).toBe(.5);
    expect(player.gear).toHaveLength(catalog.gear.length);
    for(const gear of player.gear){
      expect([...gear.stats,...gear.augments].every(stat=>/Resistance(?: %)?$/.test(stat.type))).toBe(true);
      expect(gear.stats.every(stat=>catalog.gear.find(slot=>slot.id===gear.slot)!.allowedStats.includes(stat.type))).toBe(true);
    }
    const total=buildTrackScore(player.gear.map(topGearDraft),track,catalog,'tank');
    expect(player.score).toBeCloseTo(total.percent,9);
    expect(player.maxScore).toBeCloseTo(perfect.maxScore,9);
    expect(player.score).toBeLessThanOrEqual(100+1e-8);
    expect(items.every(entry=>entry.rank===.5&&(entry.reference==='resistance-only'||track[0]==='Altered'&&entry.gear.slot==='visor'&&entry.reference==='altered-resistance-percent'))).toBe(true);
    expect(resistanceGearTop(catalog,track,'visor')).toHaveLength(1);
  },20000);
});
