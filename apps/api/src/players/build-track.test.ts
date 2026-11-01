import fs from 'node:fs';
import path from 'node:path';
import {describe,expect,it} from 'vitest';
import {gearChampions,pairStatChoice,restrictPairStats,scoreBuildForTrack,scoreCurrentGearForTrack} from '@tof-hub/game-domain';
import {buildScoringCatalog} from './scoring-catalog';

const gameData=path.resolve(__dirname,'..','..','..','web','public','game-data');
const catalog=buildScoringCatalog(JSON.parse(fs.readFileSync(path.join(gameData,'build-page.json'),'utf8')),
  JSON.parse(fs.readFileSync(path.join(gameData,'capture-card-map.json'),'utf8')));
const track=['Physical','Flame'];

describe('whole-build pair rule',()=>{
  it('maximizes complete-set flat ATK, ATK% and DMG% independently; reversed pairs are the same board',()=>{
    const pieces=[
      {key:'local-winner',slot:'helmet',rows:[{type:'Physical Attack',value:1800},{type:'Flame Attack',value:1700}]},
      {key:'set-winner',slot:'helmet',rows:[{type:'Flame Attack',value:1750}]},
      {key:'other-slot',slot:'pauldrons',rows:[{type:'Flame Attack',value:4000},{type:'Attack',value:500}]},
      {key:'percent',slot:'eyepiece',rows:[{type:'Physical Attack %',value:.08},{type:'Flame Attack %',value:.05},{type:'Physical Damage %',value:.01},{type:'Flame Damage %',value:.03}]},
    ];
    const input=(piece:typeof pieces[number])=>({rows:piece.rows,augments:[],allowedTypes:piece.rows.map(stat=>stat.type)});
    const build=scoreBuildForTrack(pieces,piece=>piece.slot,input,track,catalog.reference);
    expect(build.choice).toEqual({Attack:'Flame','Attack %':'Physical','Damage %':'Flame'});
    expect(build.slots.get('helmet')?.piece.key).toBe('set-winner');
    const entries=[...build.slots.values()].flatMap(slot=>slot.score.entries);
    expect(entries.filter(row=>row.type==='Flame Attack').reduce((sum,row)=>sum+row.value,0)).toBe(5750);
    expect(entries.some(row=>row.type==='Physical Attack'||row.type==='Flame Attack %'||row.type==='Physical Damage %')).toBe(false);
    expect(scoreBuildForTrack(pieces,piece=>piece.slot,input,[...track].reverse(),catalog.reference).value).toBeCloseTo(build.value,10);
    const retained=gearChampions(pieces,piece=>piece.slot,input,[track],catalog.reference);
    expect(retained.some(row=>row.piece.key==='set-winner')).toBe(true);
  });
  it('takes ATK % and DMG % each from the pair element with the higher gear total',()=>{
    const totals:Record<string,number>={'Physical Attack %':0.02,'Flame Attack %':0.05,'Physical Damage %':0.06,'Flame Damage %':0.01};
    const choice=pairStatChoice((element,kind)=>totals[`${element} ${kind}`]??0,track);
    expect(choice).toEqual({'Attack':'Physical','Attack %':'Flame','Damage %':'Physical'});
    const stats=Object.keys(totals).map(type=>({type,value:totals[type]!}));
    expect(restrictPairStats(stats,track,choice).map(stat=>stat.type)).toEqual(['Flame Attack %','Physical Damage %']);
    expect(pairStatChoice(()=>1,['Frost'])).toBeNull();
  });
  // Shino Asada, 2026-10-08: Physical / Flame summed Physical DMG % from some pieces and Flame DMG % from others.
  it('scores a build with one DMG % element while a single item keeps the better of the pair',()=>{
    const slots=Object.keys(catalog.allowedStats).filter(id=>catalog.allowedStats[id]!.includes('Physical Damage %')&&catalog.allowedStats[id]!.includes('Flame Damage %'));
    expect(slots.length).toBeGreaterThanOrEqual(3);
    const pieces=[
      {id:slots[0]!,rows:[{type:'Physical Damage %',value:0.03}]},
      {id:slots[1]!,rows:[{type:'Physical Damage %',value:0.03}]},
      {id:slots[2]!,rows:[{type:'Flame Damage %',value:0.02}]},
    ];
    const input=(piece:typeof pieces[number])=>({rows:piece.rows,augments:[],allowedTypes:catalog.allowedStats[piece.id]!});
    const build=scoreBuildForTrack(pieces,piece=>piece.id,input,track,catalog.reference);
    expect(build.choice?.['Damage %']).toBe('Physical');
    expect(build.slots.get(slots[2]!)!.score.value).toBe(0);
    expect(scoreCurrentGearForTrack(input(pieces[2]!),track,catalog.reference).value).toBeGreaterThan(0);
  });
});
