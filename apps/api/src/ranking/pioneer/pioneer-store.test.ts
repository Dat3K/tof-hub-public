import {describe,it,expect} from 'vitest';
import {roleTracks,scoreBuildForTrack,scoreCurrentGearForTrack,TOP_RV_ROLES} from '@tof-hub/game-domain';
import type {PlayerSnapshotGear} from '@tof-hub/contracts';
import {scanFixture} from '../../import/scan-session.fixture';
import {loadScoringCatalog} from '../../players/scoring-catalog';
import {pioneerInput,pioneerObservations,retainPioneer,type PioneerPiece} from './pioneer-store';

const catalog=loadScoringCatalog()!;
const scan={...scanFixture(),distribution:'global-pioneer' as const};
const slot=Object.keys(catalog.allowedStats).find(id=>catalog.allowedStats[id]!.includes('Crit'))!;
function observation(stats:PlayerSnapshotGear['stats'],id:string,gearSlot=slot):PioneerPiece {
  const [item]=pioneerObservations({source:'self',capturedAt:'2026-10-09T12:00:00Z',player:{uid:'10000002'},gear:[{
    slot:gearSlot,itemId:'fixture',stars:5,enhancement:0,titan:false,augmented:false,rareId:null,rareLevel:null,
    stats,statsBeforeTitan:null,augments:[],augmentCount:null,
  }]},{scan,collectorUid:'10000001',fileHash:'fixture-hash',ipHash:'fixture-ip-hash'});
  return {...item!,id};
}
describe('permanent Pioneer champion pool',()=>{
  it('replaces only with strictly better actual RV and removes unreferenced observations',()=>{
    const old=observation([{type:'Crit',value:1000}],'old'),better=observation([{type:'Crit',value:2000}],'better');
    const worse=observation([{type:'Crit',value:500}],'worse');
    const result=retainPioneer([old],[worse,better],catalog);
    expect(result.pieces.map(item=>item.id)).toEqual(['better']);
    expect(result.winners.every(winner=>winner.piece.id==='better')).toBe(true);
    const equal=observation([{type:'Crit',value:2000}],'equal');
    expect(retainPioneer(result.pieces,[equal,worse],catalog).pieces.map(item=>item.id)).toEqual(['better']);
    expect(result.pieces[0]!.piece.stats).toEqual([{type:'Crit',value:2000}]);
    expect(result.pieces[0]!.provenance).toMatchObject({ownerUid:'10000002',collectorUid:'10000001',scan});
  });
  it('keeps enough whole items to reproduce the best build for all three roles and pair inheritance choices',()=>{
    const pool=Object.entries(catalog.allowedStats).flatMap(([gearSlot,allowed])=>Array.from({length:8},(_,variant)=>{
      const wanted=variant===6?['HP','HP %','Resistance','Frost Resistance']:variant===7?['Volt Resistance','Volt Resistance %','HP','HP %']:
        variant%2?['Volt Attack','Volt Attack %','Volt Damage %','Crit']:['Frost Attack','Frost Attack %','Frost Damage %','Crit'];
      const types=wanted.filter(type=>allowed.includes(type)).slice(0,4);
      const stats=types.map((type,index)=>({type,value:type.endsWith('%')?(variant+index+1)/100:(variant+1)*100}));
      return observation(stats,`${gearSlot}-${variant}`,gearSlot);
    }));
    const retained=retainPioneer([],pool,catalog);
    expect(new Set(retained.winners.map(winner=>winner.role))).toEqual(new Set(TOP_RV_ROLES));
    expect(retained.winners.some(winner=>winner.choice!==null)).toBe(true);
    expect(retained.pieces.length).toBeLessThan(pool.length);
    for(const role of TOP_RV_ROLES)for(const track of roleTracks(role,catalog.tracks)) {
      const score=(items:PioneerPiece[])=>scoreBuildForTrack(items,item=>item.piece.slot,item=>pioneerInput(item.piece,catalog),track,catalog.reference,role).value;
      expect(score(retained.pieces),`${role}:${track.join('-')}`).toBeCloseTo(score(pool),9);
    }
  },30_000);
  it('scores an incomplete synthetic build against the full slot ceiling',()=>{
    const item=observation([{type:'Crit',value:1000}],'one'),track=['Physical'];
    const build=scoreBuildForTrack([item],piece=>piece.piece.slot,piece=>pioneerInput(piece.piece,catalog),track,catalog.reference);
    const maximum=Object.values(catalog.allowedStats).reduce((sum,allowedTypes)=>sum+scoreCurrentGearForTrack({rows:[],augments:[],allowedTypes},track,catalog.reference).maximum,0);
    const itemScore=scoreCurrentGearForTrack(pioneerInput(item.piece,catalog)!,track,catalog.reference);
    expect(Object.keys(catalog.allowedStats)).toHaveLength(12);
    expect(maximum).toBeGreaterThan(itemScore.maximum);
    expect(build.value/maximum*100).toBeLessThan(itemScore.percent!);
  });
});
