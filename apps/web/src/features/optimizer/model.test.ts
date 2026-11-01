import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {getBuildAugmentPools,getBuildRVFactors,getBuildTitanPrimaries} from '@tof-hub/game-domain';
import {BuildCaptureSchema} from '@tof-hub/contracts';
import capture from '../../../../../packages/contracts/src/__fixtures__/build-capture.json';
import titanBoots from '../build/__fixtures__/titan-boots.json';
import {buildCombatDraft,cardGear,elementTotalAttack,gearCurrentRollValue,gearElementStat,rollValueContext,titanMaximums} from '../build/model';
import {supportAttack} from '../build/support-attack';
import {personalRVProfile} from '../build/rv-profile';
import type {BuildCatalog,GearDraft} from '../build/types';
import {applyGearSwap,gearBeforeTitan,matureTitan,pairMarginalWeights,projectGear,rankInventory,resolveWhatIf,slotComparison,statImpactModel,titanTarget} from './model';

const catalog=JSON.parse(readFileSync(resolve(import.meta.dirname,'../build/__fixtures__/catalog.json'),'utf8')) as BuildCatalog;
// Baseline cases enter totals with no selected temporary consumables.
const unbuffedDraft=()=>{const draft=structuredClone(catalog.demoDraft);draft.consumables=catalog.consumables.map(()=>'');return draft;};
const makeDraft=()=>{const draft=unbuffedDraft();draft.rv={mode:'prv',element:'Frost',includeCrit:true,weaponId:''};draft.weapons=[];return draft;};

describe('temporary equipment',()=>{
  it('undoes HP% and RES% once, then applies flat and percent replacement deltas independently',()=>{
    const draft=makeDraft();draft.profile.role='tank';
    const current=draft.gear[0];
    current.rows=[{type:'HP %',value:.1,beforeTitan:null},{type:'Frost Resistance %',value:.2,beforeTitan:null},
      {type:'HP',value:10000,beforeTitan:null},{type:'Frost Resistance',value:1000,beforeTitan:null}];current.augments=[];
    draft.combat.hp=3000000;draft.combat.hpPercent=.5;
    const frost=draft.combat.elements.find(element=>element.id==='Frost')!;
    frost.resistance=30000;frost.resistancePercent=.5;
    const piece=structuredClone(current);
    piece.rows=[{type:'HP %',value:.15,beforeTitan:null},{type:'Frost Resistance %',value:.25,beforeTitan:null},
      {type:'HP',value:20000,beforeTitan:null},{type:'Frost Resistance',value:2000,beforeTitan:null}];
    const next=applyGearSwap(draft,catalog,piece.id,piece)!;
    expect(next).not.toBeNull();
    expect(next.combat.hpPercent).toBeCloseTo(.55);
    expect(next.combat.hp).toBeCloseTo(3115500); // (3m / 1.5 + 10k) × 1.55
    const after=next.combat.elements.find(element=>element.id==='Frost')!;
    expect(after.resistancePercent).toBeCloseTo(.55);
    expect(after.resistance).toBeCloseTo(32550); // (30k / 1.5 + 1k) × 1.55
  });
  const output=(draft:ReturnType<typeof makeDraft>)=>{
    const combat=buildCombatDraft(draft,catalog),context=rollValueContext(combat,catalog),source=context.inheritFrom??context.element;
    const profile=personalRVProfile(combat,catalog,source)!;
    const attack=elementTotalAttack(combat,catalog,source);
    return getBuildRVFactors([],{...profile,flatAttack:attack.attack,attackPercent:attack.percent,postPercentAttack:attack.support},context.element,context.inheritFrom,context.role)
      .reduce((total,factor)=>total*factor.value,1);
  };
  it.each(['dps','healer','tank'])('matches comparison gain for %s, including resonance, HP and resistance percentages',role=>{
    const draft=makeDraft();draft.profile.role=role;
    const saved=structuredClone(draft),piece=structuredClone(draft.gear[0]!);
    piece.enhancement=0;piece.rows.find(row=>row.type==='Frost Attack')!.value+=400;
    piece.augments.push({type:'Frost Attack %',value:.05},{type:'Frost Damage %',value:.02},{type:'HP %',value:.03},{type:'Frost Resistance %',value:.05});
    const next=applyGearSwap(draft,catalog,piece.id,piece)!;
    expect(next).not.toBeNull();
    expect(output(next)/output(draft)-1).toBeCloseTo(slotComparison(draft,catalog,piece.id)!.compare(piece).gain,8);
    expect(draft).toEqual(saved);
  });
  it('matches a duo winner change and is independent of the order of two swaps',()=>{
    const draft=makeDraft();draft.weapons=structuredClone(catalog.demoDraft.weapons);
    draft.combat.elements.find(row=>row.id==='Frost')!.attack=50000;
    draft.combat.elements.find(row=>row.id==='Volt')!.attack=60000;
    const first=structuredClone(draft.gear[0]!),second=structuredClone(draft.gear.find(gear=>gear.id==='core')!);
    first.rows.find(row=>row.type==='Frost Attack')!.value+=11000;
    second.rows.find(row=>row.type==='Volt Attack %')!.value+=.1;
    const one=applyGearSwap(draft,catalog,first.id,first)!;
    expect(output(one)/output(draft)-1).toBeCloseTo(slotComparison(draft,catalog,first.id)!.compare(first).gain,8);
    const forward=applyGearSwap(one,catalog,second.id,second)!;
    const backward=applyGearSwap(applyGearSwap(draft,catalog,second.id,second)!,catalog,first.id,first)!;
    expect(output(forward)).toBeCloseTo(output(backward),8);
    forward.combat.elements.forEach((row,index)=>{
      expect(row.attack).toBeCloseTo(backward.combat.elements[index]!.attack,8);
      expect(row.attackPercent).toBeCloseTo(backward.combat.elements[index]!.attackPercent!,8);
    });
  });
  it('preserves captured provenance and authoritative temporary DMG totals through repeated derivation',()=>{
    const draft=makeDraft();
    draft.captureSource={kind:'file',digest:'a'.repeat(64),capture:BuildCaptureSchema.parse(capture),unresolved:[]};
    const piece=structuredClone(draft.gear[0]!);
    piece.augments.push({type:'Frost Damage %',value:.03});
    const next=applyGearSwap(draft,catalog,piece.id,piece)!;
    expect(next.captureSource).toBe(draft.captureSource);
    expect(buildCombatDraft(next,catalog).combat).toEqual(next.combat);
    expect(output(next)/output(draft)-1).toBeCloseTo(slotComparison(draft,catalog,piece.id)!.compare(piece).gain,8);
    expect(draft.combat.damageSource).toBeUndefined();
  });
  it('updates inherited Altered source stats and preserves unavailable Space Support without inventing a module',()=>{
    const draft=makeDraft();draft.rv!.element='Altered';
    const context=rollValueContext(draft,catalog),source=context.inheritFrom!;
    const piece=structuredClone(draft.gear[0]!);
    piece.rows.push({type:source+' Attack',value:100,beforeTitan:100});
    piece.augments.push({type:source+' Attack %',value:.02});
    const next=applyGearSwap(draft,catalog,piece.id,piece)!;
    expect(output(next)/output(draft)-1).toBeCloseTo(slotComparison(draft,catalog,piece.id)!.compare(piece).gain,8);
    const impact=statImpactModel(next,catalog)!;
    expect(impact.profile.attackPercent).toBeCloseTo(draft.combat.elements.find(row=>row.id===source)!.attackPercent!+.02,8);
    expect(impact.supportComparison(.005)).toBeNull();
  });
  it('keeps a mature Titan forecast beneficial even with an explicitly selected lower pair',()=>{
    const draft=makeDraft();draft.rv!.element='Physical';
    const gear=draft.gear.find(piece=>piece.id==='belt')!;gear.augmentCount=480;
    const comparison=slotComparison(draft,catalog,gear.id)!;
    const projection=projectGear(gear,gear,catalog,98,candidate=>comparison.compare(candidate).gain,undefined,false);
    const worse=projection.options.find(option=>option.gain<=0);
    expect(worse).toBeDefined();
    const resolved=resolveWhatIf(draft,[],{[gear.id]:{kind:'forecast'}},catalog,98,{[`equipped-${gear.id}`]:worse!.pair});
    expect(resolved.changed.size).toBe(0);expect(resolved.draft).toBe(draft);
    expect(projection.options.length).toBeGreaterThan(0);
  });
  it('rebuilds the pool from real gear, replaces a swap, and restores the exact baseline',()=>{
    const draft=makeDraft(),slot=draft.gear[0]!.id;
    const inventory=[{key:'one',gear:{...draft.gear[0]!,equipped:false}},{key:'two',gear:{...draft.gear[0]!,equipped:false}}];
    const one=resolveWhatIf(draft,inventory,{[slot]:{kind:'swap',pieceKey:'one'}},catalog,98);
    expect(one.pool.map(piece=>piece.key)).toEqual(['two',`equipped-${slot}`]);
    expect(one.worn.map(piece=>piece.key)).toEqual(['one']);
    const two=resolveWhatIf(draft,inventory,{[slot]:{kind:'swap',pieceKey:'two'}},catalog,98);
    expect(two.pool.map(piece=>piece.key)).toEqual(['one',`equipped-${slot}`]);
    const restored=resolveWhatIf(draft,inventory,{[slot]:{kind:'swap',pieceKey:`equipped-${slot}`}},catalog,98);
    expect(restored.draft).toBe(draft);expect(restored.pool).toEqual(inventory);expect(restored.changed.size).toBe(0);
  });
  it('recomputes forecasts from the original at the live target and selected lower pair',()=>{
    const draft=makeDraft(),piece=draft.gear[0]!;piece.augmentCount=20;
    const comparison=slotComparison(draft,catalog,piece.id)!;
    const projection=projectGear(piece,piece,catalog,98,gear=>comparison.compare(gear).gain,undefined,false);
    const effective=resolveWhatIf(draft,[],{[piece.id]:{kind:'forecast'}},catalog,98);
    expect(effective.draft.gear[0]).toEqual(projection.gear);
    expect(output(effective.draft)/output(draft)-1).toBeCloseTo(comparison.compare(projection.gear!).gain,8);
    const lower=resolveWhatIf(draft,[],{[piece.id]:{kind:'forecast'}},catalog,80);
    expect(lower.draft.gear[0]).not.toEqual(effective.draft.gear[0]);
    const selected=projection.choices.at(-1)!;
    const chosen=resolveWhatIf(draft,[],{[piece.id]:{kind:'forecast'}},catalog,98,{[`equipped-${piece.id}`]:selected});
    expect(chosen.draft.gear[0]!.augments.map(row=>row.type)).toEqual(selected);
  });
  it('matches the forecast preview when replacing a temporary donor in the same slot',()=>{
    const draft=makeDraft(),original=draft.gear[0]!;
    const donor={...structuredClone(original),enhancement:80};
    const plain={...gearBeforeTitan(original)!,equipped:false,enhancement:10};
    const inventory=[{key:'donor',gear:donor},{key:'plain',gear:plain}];
    const first=resolveWhatIf(draft,inventory,{[original.id]:{kind:'swap',pieceKey:'donor'}},catalog,98);
    expect(first.changed.has(original.id)).toBe(true);
    expect(first.draft.gear[0]!.enhancement).toBe(80);
    const preview=rankInventory(first.pool,first.draft,catalog,98).find(entry=>entry.piece.key==='plain')!;
    expect(preview.projection.gear).not.toBeNull();
    const next=resolveWhatIf(draft,inventory,{[original.id]:{kind:'swap',pieceKey:'plain',forecast:true,donor:first.draft.gear[0]}},catalog,98);
    expect(next.draft.gear[0]).toEqual(preview.projection.gear);
    expect(next.pool.map(piece=>piece.key)).toEqual(['donor',`equipped-${original.id}`]);
  });
  it('allows actual unknown-base gear, rejects its forecast and a missing comparison',()=>{
    const draft=makeDraft(),gear=structuredClone(draft.gear[0]!);gear.rows.forEach(row=>{row.beforeTitan=null;});
    const inventory=[{key:'unknown',gear}];
    expect(resolveWhatIf(draft,inventory,{[gear.id]:{kind:'swap',pieceKey:'unknown'}},catalog,98).changed.size).toBe(1);
    expect(resolveWhatIf(draft,inventory,{[gear.id]:{kind:'swap',pieceKey:'unknown',forecast:true}},catalog,98).failed[gear.id]).toBe('originals');
    draft.enemyLevel=0;
    expect(applyGearSwap(draft,catalog,gear.id,gear)).toBeNull();
    expect(resolveWhatIf(draft,inventory,{[gear.id]:{kind:'swap',pieceKey:'unknown'}},catalog,98).draft).toBe(draft);
  });
});

describe('exact stat impact and Space Support equivalence',()=>{
  it('reproduces Lilou Fusion output in impact and gear replacement without post-percentage support',()=>{
    const draft=makeDraft();draft.weapons=structuredClone(catalog.demoDraft.weapons);
    Object.assign(draft.combat.elements.find(row=>row.id==='Frost')!,{attack:46143.7265625,attackPercent:112067.6953125/46143.7265625-1,damage:.345});
    Object.assign(draft.combat.elements.find(row=>row.id==='Volt')!,{attack:46749.78125,attackPercent:88037.9609375/46749.78125-1});
    const module=catalog.support.modules.find(item=>item.attackStat==='Frost Attack')!;
    draft.support.forEach(item=>{item.level=item.id===module.id?5:0;});
    draft.gear.forEach(item=>{item.equipped=false;item.titan=false;item.augmented=false;});
    const current=draft.gear[0]!;current.equipped=true;
    current.rows=[{type:'Frost Attack %',value:.128666,beforeTitan:null},{type:'Volt Attack %',value:.203174,beforeTitan:null}];
    const model=statImpactModel(draft,catalog)!;
    expect(model.profile.postPercentAttack).toBe(0);
    expect(model.profile.flatAttack*(1+model.profile.attackPercent)).toBeCloseTo(118900.21279521023,6);
    const comparison=slotComparison(draft,catalog,current.id)!;
    expect(comparison.compare(current).gain).toBeCloseTo(0,12);
    const candidate=structuredClone(current);candidate.rows.push({type:'Volt Attack',value:100,beforeTitan:null});
    expect(comparison.compare(candidate).gain).toBeCloseTo(100/(46749.78125+750),12);
    expect(model.equivalent('Volt Attack',100).attack).toBeCloseTo(100,8);
  });
  it('matches an independent output calculation and the generated pre-Titan roll range',()=>{
    const draft=makeDraft(),stats=draft.combat.elements.find(item=>item.id==='Frost')!;
    stats.attack=50000;stats.attackPercent=1.882;stats.damage=.47;
    const model=statImpactModel(draft,catalog)!;
    const bounds=catalog.reference.statTypes['Frost Attack']!;
    expect(model.minimum).toBe(bounds.randomStatMinRollValue);
    expect(model.maximum).toBe(bounds.randomStatMaxRollValue);
    expect(model.equivalent('Frost Attack',bounds.randomStatMaxRollValue).quality).toBeCloseTo(1,10);
    const crit=1+model.profile.critChance*model.profile.critDamageBonus;
    expect(model.increase('Frost Attack %',.0144)).toBeCloseTo(50000*.0144*1.47*crit,8);
    const damageImpact=(50000*2.882+(model.profile.postPercentAttack??0))*.0072*crit;
    expect(model.increase('Frost Damage %',.0072)).toBeCloseTo(damageImpact,8);
    const equivalent=model.equivalent('Frost Damage %',.0072);
    expect(equivalent.attack).toBeCloseTo(damageImpact/(2.882*1.47*crit),8);
    expect(equivalent.quality).toBeCloseTo((equivalent.attack!-model.minimum!)/(model.maximum!-model.minimum!),10);
    expect(model.prv('Frost Attack',250)).toBeGreaterThan(0);
    expect(model.prv('Frost Attack',500)).toBeCloseTo(2*model.prv('Frost Attack',250)!,10);
    expect(model.prv('Frost Attack',250)).not.toBeCloseTo(model.increase('Frost Attack',250)!,1);
  });
  it('uses the duo base and own support, and applies ATK% to the support increment unless ATK is inherited (Gear Compare I11)',()=>{
    const draft=makeDraft();draft.weapons=structuredClone(catalog.demoDraft.weapons);draft.rv!.element='Volt';
    draft.combat.elements.find(item=>item.id==='Frost')!.attack=60000;
    Object.assign(draft.combat.elements.find(item=>item.id==='Volt')!,{attack:50000,attackPercent:0,damage:.5});
    const module=catalog.support.modules.find(item=>item.attackStat==='Volt Attack')!;
    draft.support.forEach(item=>{item.level=item.id===module.id?5:0;});
    const model=statImpactModel(draft,catalog)!;
    // Support is retained once before ATK%; each added support point counts (1 + ATK%).
    expect(model.profile.flatAttack).toBe(60750);expect(model.profile.postPercentAttack).toBe(0);
    const total=(item:NonNullable<ReturnType<typeof statImpactModel>>)=>item.profile.flatAttack*(1+item.profile.attackPercent)+(item.profile.postPercentAttack??0);
    expect(model.supportComparison(.005)).toBeCloseTo(150*(1+model.profile.attackPercent)*(1+model.profile.damagePercent)/(total(model)*.005),10);
    draft.combat.elements.find(item=>item.id==='Volt')!.attackPercent=.5;
    const boosted=statImpactModel(draft,catalog)!;
    expect(boosted.supportComparison(.005)).toBeCloseTo(150*(1+boosted.profile.attackPercent)*(1+boosted.profile.damagePercent)/(total(boosted)*.005),10);
  });
  it('caps actual Crit increments and does not count Crit or DMG for healer or attack for Tank',()=>{
    const draft=makeDraft();draft.combat.additionalCritRate=1;
    const model=statImpactModel(draft,catalog)!;
    expect(model.increase('Crit',1000)).toBe(0);expect(model.equivalent('Crit Rate %',.0119).attack).toBe(0);
    expect(model.prv('Crit',1000)).toBe(0);
    draft.profile.role='healer';const healer=statImpactModel(draft,catalog)!;
    expect(healer.increase('Frost Damage %',.0072)).toBe(0);expect(healer.supportComparison(.005)).toBeNull();
    expect(healer.prv('Frost Damage %',.0072)).toBe(0);
    draft.profile.role='tank';expect(statImpactModel(draft,catalog)).toBeNull();
  });
});

describe('personal optimizer replacement',()=>{
  it('uses the Build PRV profile and current score, and compares identical pieces at zero',()=>{
    const draft=makeDraft();
    for(const gear of draft.gear) {
      const comparison=slotComparison(draft,catalog,gear.id)!;
      const card=gearCurrentRollValue(cardGear(gear,draft,catalog),draft,catalog);
      expect(comparison.profile).toEqual(card.profile);
      expect(comparison.rate(gear).value).toBeCloseTo(card.value!,10);
      expect(comparison.compare(gear).gain).toBeCloseTo(0,12);
    }
  });
  it('matches an independent remove-and-equip damage calculation, rather than dividing PRV points',()=>{
    const draft=makeDraft(),equipped=draft.gear[0]!;
    const candidate=structuredClone(equipped);candidate.equipped=false;
    candidate.rows.find(row=>row.type==='Frost Attack')!.value+=100;
    const full=personalRVProfile(draft,catalog,'Frost')!;
    const comparison=slotComparison(draft,catalog,equipped.id)!;
    expect(comparison.compare(candidate).gain).toBeCloseTo(100*(1+full.attackPercent)/(full.flatAttack*(1+full.attackPercent)+(full.postPercentAttack??0)),12);
    expect(comparison.profile.flatAttack).toBeLessThan(full.flatAttack);
  });
  it('removes raw crit before capping; extra Crit above the final cap has no output gain',()=>{
    const draft=makeDraft(),boots=draft.gear.find(gear=>gear.id==='boots')!;
    const denominator=catalog.reference.critFormula.denominators[draft.enemyLevel]!;
    draft.combat.crit=denominator*1.1;draft.combat.additionalCritRate=0;
    const candidate=structuredClone(boots);candidate.rows.find(row=>row.type==='Crit')!.value+=1000;
    const comparison=slotComparison(draft,catalog,boots.id)!;
    expect(comparison.profile.critChance).toBeLessThan(1);
    expect(comparison.compare(candidate).gain).toBeCloseTo(0,12);
    expect(comparison.rate(candidate).value).toBeCloseTo(comparison.rate(boots).value,12);
  });
  it('counts Crit and Crit Rate jointly up to the item-free profile cap',()=>{
    const draft=makeDraft(),boots=draft.gear.find(gear=>gear.id==='boots')!;
    const denominator=catalog.reference.critFormula.denominators[draft.enemyLevel]!;
    draft.combat.crit=denominator*.99;draft.combat.additionalCritRate=0;
    const comparison=slotComparison(draft,catalog,boots.id)!;
    const candidate={...structuredClone(boots),rows:[{type:'Crit',value:denominator*.3,beforeTitan:null},{type:'Crit Rate %',value:.3,beforeTitan:null}],augments:[]};
    const score=comparison.rate(candidate);
    const critPoints=score.entries.reduce((sum,entry)=>sum+entry.rv,0);
    const p=comparison.profile;
    expect(critPoints).toBeCloseTo(100*(1-p.critChance)*p.critDamageBonus/(1+p.critChance*p.critDamageBonus)/score.normalization,10);
    expect(score.entries.find(entry=>entry.type==='Crit')!.value).toBe(denominator*.3);
    candidate.rows[0]!.value*=2;candidate.rows[1]!.value*=2;
    expect(comparison.rate(candidate).value).toBeCloseTo(critPoints,10);
  });
  it('matches the Gear Compare reference for simultaneous flat ATK, ATK% and DMG% changes',()=>{
    const draft=makeDraft(),core=draft.gear.find(gear=>gear.id==='core')!;
    // Authored calculator inputs, not game coefficients: Gear Compare B2:B7, M5:M6.
    const combat=draft.combat.elements.find(element=>element.id==='Frost')!;
    combat.attack=50000;combat.attackPercent=1.882;combat.damage=.47;
    draft.combat.crit=26577;draft.combat.additionalCritRate=.0342;draft.combat.critDamage=.74;draft.enemyLevel=100;
    core.rows.find(row=>row.type==='Volt Attack %')!.type='Frost Attack %';
    const candidate=structuredClone(core);
    candidate.rows.find(row=>row.type==='Frost Attack')!.value+=100;
    candidate.rows.find(row=>row.type==='Frost Attack %')!.value+=.01;
    candidate.rows.find(row=>row.type==='Frost Damage %')!.value+=.005;
    const expected=(50100*(1+1.882+.01))/(50000*(1+1.882))*(1+.47+.005)/(1+.47)-1;
    expect(slotComparison(draft,catalog,core.id)!.compare(candidate).gain).toBeCloseTo(expected,12);
  });
  it('keeps paired percentages on the whole loadout, including a change of winner',()=>{
    const draft=makeDraft();
    draft.weapons=structuredClone(catalog.demoDraft.weapons);
    const gear=draft.gear.find(piece=>piece.id==='core')!;
    const context=rollValueContext(draft,catalog);
    expect(context.percentElements).toHaveLength(2);
    const candidate=structuredClone(gear);candidate.rows=candidate.rows.map(row=>row.type==='Volt Attack %'?{...row,value:row.value+.1}:row);
    const gain=slotComparison(draft,catalog,gear.id)!.compare(candidate);
    expect(gain.factors.find(factor=>factor.id==='attackPercent')!.gain).toBeGreaterThan(0);
    expect(gain.gain).toBeCloseTo(gain.factors.reduce((value,factor)=>value*(1+factor.gain),1)-1,12);
  });
  it('uses the pair’s actual inherited base ATK when a replacement changes the winning element',()=>{
    const draft=makeDraft();draft.weapons=structuredClone(catalog.demoDraft.weapons);
    draft.combat.elements.find(row=>row.id==='Frost')!.attack=50000;
    draft.combat.elements.find(row=>row.id==='Volt')!.attack=60000;
    const current=draft.gear[0]!,comparison=slotComparison(draft,catalog,current.id)!;
    const frost=structuredClone(current);frost.rows.find(row=>row.type==='Frost Attack')!.value+=100;
    expect(comparison.compare(frost).gain).toBeCloseTo(0,12);
    const volt=structuredClone(current);volt.augments.find(row=>row.type==='Volt Attack')!.value+=100;
    expect(comparison.compare(volt).gain).toBeCloseTo(100/(60000-supportAttack(draft,catalog,'Volt')+supportAttack(draft,catalog,'Frost')),12);
    frost.rows.find(row=>row.type==='Frost Attack')!.value+=10000+supportAttack(draft,catalog,'Frost')-supportAttack(draft,catalog,'Volt');
    expect(comparison.compare(frost).gain).toBeCloseTo(100/(60000-supportAttack(draft,catalog,'Volt')+supportAttack(draft,catalog,'Frost')),12);
  });
  it('counts an added duo ATK only above the winning base in the impact table',()=>{
    const draft=makeDraft();draft.weapons=structuredClone(catalog.demoDraft.weapons);
    draft.combat.elements.find(row=>row.id==='Frost')!.attack=50000;
    draft.combat.elements.find(row=>row.id==='Volt')!.attack=60000;
    const model=statImpactModel(draft,catalog)!;
    expect(model.increase('Frost Attack',100)).toBe(0);
    expect(model.prv('Frost Attack',100)).toBe(0);
    expect(model.prv('Volt Attack',100)).toBeGreaterThan(0);
    expect(model.equivalent('Frost Attack',100).attack).toBe(0);
    expect(model.increase('Frost Attack',10100+supportAttack(draft,catalog,'Frost')-supportAttack(draft,catalog,'Volt'))).toBeCloseTo(model.increase('Volt Attack',100)!,8);
    expect(model.equivalent('Volt Attack',100).attack).toBeCloseTo(100,8);
    const current=draft.gear[0]!,candidate=structuredClone(current);
    candidate.augments.find(row=>row.type==='Volt Attack')!.value+=100;
    const rank=rankInventory([{key:'volt',gear:candidate},{key:'same',gear:current}],draft,catalog,98);
    expect(rank.find(row=>row.piece.key==='volt')!.now!.gain).toBeGreaterThan(0);
    expect(rank.find(row=>row.piece.key==='same')!.now!.gain).toBeCloseTo(0,12);
  });
  it('leaves missing personal combat data unavailable and sorts unknowns last',()=>{
    const draft=makeDraft();draft.enemyLevel=0;
    expect(slotComparison(draft,catalog,'helmet')).toBeNull();
    const ranked=rankInventory([{key:'unknown',gear:draft.gear[0]!}],draft,catalog,98);
    expect(ranked[0]).toMatchObject({now:null,forecast:null,gain:null,nowPrv:null});
  });
  it('ignores rare effects, and respects healer ATK and tank EHP instead of DPS',()=>{
    const draft=makeDraft(),current=draft.gear[0]!,rare=structuredClone(current);
    rare.rareId='different-effect';rare.rareLevel+=3;
    expect(slotComparison(draft,catalog,current.id)!.compare(rare).gain).toBeCloseTo(0,12);
    draft.profile.role='healer';
    const damage=structuredClone(current);damage.augments.push({type:'Frost Damage %',value:.1});
    expect(slotComparison(draft,catalog,current.id)!.compare(damage).gain).toBeCloseTo(0,12);
    draft.profile.role='tank';
    const hp=structuredClone(current);hp.rows.find(row=>row.type==='HP')!.value+=1000;
    const full=personalRVProfile(draft,catalog,'Frost')!;
    expect(slotComparison(draft,catalog,current.id)!.compare(hp).gain).toBeCloseTo((full.hp!+1000)/full.hp!-1,12);
  });
});

describe('Titan forecasts',()=>{
  it('uses corrected tied ceilings in forecasts and preserves mature captured main stats',()=>{
    for(const reverse of [false,true]) {
      const piece=structuredClone(titanBoots);
      if(reverse)piece.rows.reverse();
      const score=(gear:GearDraft)=>gear.augments.reduce((sum,row)=>sum+row.value,0);
      const mature=projectGear(piece,piece,catalog,100,score,['HP','Flame Resistance']);
      expect(mature.gear).not.toBeNull();
      expect(mature.gear!.rows).toEqual(piece.rows);
      for(const type of ['Physical Attack','Volt Attack']) {
        const index=piece.rows.findIndex(row=>row.type===type);
        expect(mature.maximums.random[index]).toBeCloseTo(400.9);
      }
      piece.augmentCount=20;
      const unfinished=projectGear(piece,piece,catalog,100,score,['HP','Flame Resistance']);
      expect(unfinished.gear).not.toBeNull();
      for(const type of ['Physical Attack','Volt Attack'])expect(unfinished.gear!.rows.find(row=>row.type===type)!.value).toBeCloseTo(400.9);
    }
  });
  it('scores every legal pair once and selects the greatest scored gain',()=>{
    const draft=makeDraft(),piece={...structuredClone(draft.gear[0]!),augmentCount:20};
    let calls=0;
    const projection=projectGear(piece,draft.gear[0]!,catalog,98,gear=>{calls++;return gear.augments.reduce((sum,row)=>sum+row.value,0);});
    expect(projection.gear).not.toBeNull();
    expect(calls).toBe(projection.choices.length);
    expect(projection.gear!.augments.reduce((sum,row)=>sum+row.value,0)).toBe(Math.max(...projection.options.map(option=>option.gain)));
    const selected=projection.choices.at(-1)!;
    const chosen=projectGear(piece,draft.gear[0]!,catalog,98,gear=>gear.augments.reduce((sum,row)=>sum+row.value,0),selected);
    expect(chosen.gear!.augments.map(row=>row.type)).toEqual(selected);
  });
  it('restricts upgraded inventory to Titan and finishes it without borrowing enhancement or rare metadata',()=>{
    const draft=makeDraft(),donor=draft.gear[0]!;
    donor.enhancement=80;donor.augmentCount=480;donor.rareLevel=3;
    const titan={...structuredClone(donor),equipped:false,titan:true,augmentCount:20,enhancement:10,rareId:'',rareLevel:0};
    const plain={...structuredClone(titan),titan:false,augmented:false,augments:[]};
    const augmented={...structuredClone(titan),titan:false,augmented:true};
    const pieces=[{key:'titan',gear:titan},{key:'plain',gear:plain},{key:'augmented',gear:augmented}];
    const normal=rankInventory(pieces,draft,catalog,98);
    expect(normal).toHaveLength(3);
    expect(normal.find(entry=>entry.piece.key==='titan')!.projection.gear).toMatchObject({enhancement:80,augmentCount:480,rareLevel:3});
    const mature={...titan,augmentCount:480};
    const restricted=rankInventory([...pieces,{key:'mature',gear:mature}],draft,catalog,98,{}, {stage:'mature'});
    expect(restricted.map(entry=>entry.piece.key)).toEqual(['mature']);
    expect(rankInventory(pieces,draft,catalog,98,{},{stage:'mature'})).toHaveLength(0);
    const [entry]=rankInventory([{key:'mature',gear:mature}],draft,catalog,98,{}, {stage:'mature'});
    expect(entry!.projection.kind).not.toBe('transfer');
    expect(entry!.now).not.toBeNull();
  });
  it('rerolls from the recipient base, applies target to main and lower stats, and preserves donor metadata',()=>{
    const draft=makeDraft(),donor=draft.gear[0]!;
    donor.augmentCount=480;donor.rareLevel=3;
    const piece={...structuredClone(donor),equipped:false,titan:false,augmented:false,augmentCount:0,augments:[],rareId:'',rareLevel:0,
      rows:donor.rows.map(row=>({...row,value:row.beforeTitan!,beforeTitan:row.beforeTitan}))};
    const forecast=projectGear(piece,donor,catalog,98,gear=>slotComparison(draft,catalog,piece.id)!.compare(gear).gain);
    expect(forecast.gear).not.toBeNull();
    expect(forecast.gear).toMatchObject({augmentCount:480,rareLevel:3,rareId:donor.rareId});
    const ceilings=titanMaximums({...forecast.gear!,equipped:true},catalog);
    forecast.gear!.rows.forEach((row,i)=>expect(row.value).toBeCloseTo(ceilings.random[i]!*.98,10));
    forecast.gear!.augments.forEach((row,i)=>expect(row.value).toBeCloseTo(ceilings.added[i]!*.98,10));
    expect(forecast.gear!.rows.some((row,i)=>row.value!==donor.rows[i]!.value)).toBe(true);
    const reranked=rankInventory([{key:'piece',gear:piece}],draft,catalog,98);
    expect(reranked[0]!.projection.kind).toBe('transfer');
  });
  it('does not inflate a developed Titan main stat; rerolling Physical onto off-element lower stats is offered',()=>{
    const draft=makeDraft(),piece=structuredClone(draft.gear.find(gear=>gear.id==='belt')!);
    piece.augmentCount=480;piece.equipped=false;
    expect(piece.augments.some(row=>row.type==='Frost Attack')).toBe(true);
    draft.rv!.element='Physical';
    const comparison=slotComparison(draft,catalog,piece.id)!;
    const forecast=projectGear(piece,comparison.current,catalog,98,gear=>comparison.compare(gear).gain);
    expect(matureTitan(piece)).toBe(true);
    // The belt's Physical ATK is already on top, so select a different mature primary with Physical available below.
    const helmet=structuredClone(draft.gear[0]!);helmet.augmentCount=480;
    const physical=slotComparison(draft,catalog,helmet.id)!;
    const reroll=projectGear(helmet,helmet,catalog,98,gear=>physical.compare(gear).gain);
    expect(reroll.kind).toBe('reroll');
    expect(reroll.gear!.augments.some(row=>row.type==='Physical Attack')).toBe(true);
    expect(reroll.gear!.rows).toEqual(helmet.rows);
    expect(forecast.gear?.rows??piece.rows).toEqual(piece.rows);
  });
  it('uses the 120 boundary strictly and refuses invented ceilings for unknown originals',()=>{
    const piece=structuredClone(catalog.demoDraft.gear[0]!);
    piece.augmentCount=120;expect(matureTitan(piece)).toBe(false);
    piece.augmentCount=121;expect(matureTitan(piece)).toBe(true);
    piece.rows[0]!.beforeTitan=null;
    expect(projectGear(piece,piece,catalog,98,()=>1)).toMatchObject({gear:null,reason:'originals'});
  });
  it('every selectable pair obeys priority-fill and uniqueness; percentages stay within the modeled range',()=>{
    const piece=structuredClone(catalog.demoDraft.gear[0]!);
    const result=projectGear(piece,piece,catalog,95,()=>1);
    const primary=getBuildTitanPrimaries(piece.rows,catalog.reference.statTypes)[0]!;
    const pools=getBuildAugmentPools(piece.rows,catalog.reference.titanGrowth,primary);
    for(const pair of result.choices){expect(new Set(pair).size).toBe(pair.length);expect(pair.filter(type=>pools.priority.includes(type)).length).toBe(Math.min(pair.length,pools.priority.length));}
    expect(titanTarget(101)).toBe(100);expect(titanTarget(NaN)).toBe(98);
  });
});

describe('top weights on the complete build',()=>{
  it.each(['Frost','Volt'])('rates the winning gear ATK independently of the selected %s element',element=>{
    const draft=makeDraft();draft.weapons=structuredClone(catalog.demoDraft.weapons);draft.rv!.element=element;
    draft.gear.forEach(gear=>{gear.rows=[];gear.augments=[];});
    const current=draft.gear[0]!;
    current.rows=[{type:'Attack',value:589,beforeTitan:400},{type:'Volt Attack',value:1296,beforeTitan:900},
      {type:'Frost Attack',value:1000,beforeTitan:700},{type:'Volt Attack %',value:.021,beforeTitan:.02}];
    const combatFrost=draft.combat.elements.find(row=>row.id==='Frost')!,combatVolt=draft.combat.elements.find(row=>row.id==='Volt')!;
    combatFrost.attack=50000;combatVolt.attack=60000;
    const score=gearCurrentRollValue(cardGear(current,draft,catalog),draft,catalog);
    expect(score.entries.find(row=>row.type==='Volt Attack')?.useful).toBe(true);
    expect(score.entries.find(row=>row.type==='Frost Attack')?.useful).not.toBe(true);
    const comparison=slotComparison(draft,catalog,current.id)!;
    expect(comparison.rate(current).entries.some(row=>row.type==='Volt Attack')).toBe(true);
    expect(comparison.rate(current).entries.some(row=>row.type==='Frost Attack')).toBe(false);
    expect(comparison.compare(current).gain).toBeCloseTo(0,12);
    const weights=pairMarginalWeights([
      {type:'Crit',afterTitan:100,value:100},
      {type:'Frost Attack',afterTitan:300,value:40,minAfterTitan:100,minValue:15},
      {type:'Volt Attack',afterTitan:300,value:40,minAfterTitan:100,minValue:15},
    ],draft,catalog);
    expect(weights.find(row=>row.type==='Frost Attack')?.value).toBe(0);
    expect(weights.find(row=>row.type==='Volt Attack')?.value).toBe(40);
    expect(weights.find(row=>row.type==='Volt Attack')?.minValue).toBe(15);
    // A different slot can choose the source for the entire set; do not pick the best row per item.
    draft.gear[1]!.rows=[{type:'Frost Attack',value:2000,beforeTitan:1500}];
    const switched=slotComparison(draft,catalog,current.id)!.rate(current);
    expect(switched.entries.some(row=>row.type==='Frost Attack')).toBe(true);
    expect(switched.entries.some(row=>row.type==='Volt Attack')).toBe(false);
  });
  it('counts a duo-pair ATK%/DMG% roll only above the winning element total',()=>{
    const draft=makeDraft(),context={element:'Frost',selected:'Frost',percentElements:['Frost','Volt']};
    const roll=.015,frost=gearElementStat(draft,catalog,'Frost','Attack %'),volt=gearElementStat(draft,catalog,'Volt','Attack %');
    const rows=[{type:'Crit',afterTitan:1000,value:100},{type:'Frost Attack %',afterTitan:roll,value:40},{type:'Volt Attack %',afterTitan:roll,value:40}];
    const result=pairMarginalWeights(rows,draft,catalog,context);
    const counted=(own:number)=>Math.min(roll,Math.max(0,own+roll-Math.max(frost,volt)));
    expect(result.find(row=>row.type==='Frost Attack %')!.value).toBeCloseTo(40*counted(frost)/roll,10);
    expect(result.find(row=>row.type==='Volt Attack %')!.value).toBeCloseTo(40*counted(volt)/roll,10);
    expect(result[0]).toEqual({type:'Crit',afterTitan:1000,value:100});
    expect(pairMarginalWeights(rows,draft,catalog,{...context,percentElements:['Frost']})).toEqual(rows);
  });
  it('keeps the pair ATK % and DMG % rows together, selected element first',()=>{
    const draft=makeDraft(),context={element:'Frost',selected:'Frost',percentElements:['Frost','Volt']};
    const rows=[{type:'Volt Damage %',afterTitan:.0075,value:30},{type:'Crit',afterTitan:1,value:100},{type:'Frost Attack',afterTitan:300,value:20},
      {type:'Volt Attack %',afterTitan:.015,value:40},{type:'Frost Damage %',afterTitan:.0075,value:30},{type:'Frost Attack %',afterTitan:.015,value:40}];
    const order=pairMarginalWeights(rows,draft,catalog,context).map(row=>row.type);
    expect(order.indexOf('Volt Attack %')).toBe(order.indexOf('Frost Attack %')+1);
    expect(order.indexOf('Volt Damage %')).toBe(order.indexOf('Frost Damage %')+1);
    expect(order[0]).toBe('Crit');
  });
  it('scales the minimum roll the same way and keeps winning flat minima linear',()=>{
    const draft=makeDraft(),context={element:'Frost',selected:'Frost',percentElements:['Frost','Volt']};
    draft.combat.elements.find(row=>row.id==='Frost')!.attack=100000;
    const row={type:'Frost Attack',afterTitan:300,value:50,minAfterTitan:120,minValue:20};
    expect(pairMarginalWeights([{type:'Crit',afterTitan:1,value:100,minAfterTitan:.4,minValue:40},row],draft,catalog,context)[1]).toEqual(row);
    const volt=pairMarginalWeights([{type:'Crit',afterTitan:1,value:100},{type:'Volt Damage %',afterTitan:.0075,value:30,minAfterTitan:.0075,minValue:30}],draft,catalog,context)[1]!;
    expect(volt.minValue).toBeCloseTo(volt.value!,12);
  });
});

describe('pre-Titan state of a developed piece',()=>{
  it('rebuilds the normal piece from recorded pre-Titan values and compares it like the piece',()=>{
    const draft=makeDraft(),titan=structuredClone(draft.gear.find(gear=>gear.titan&&gear.rows.every(row=>row.beforeTitan!==null))!);
    const before=gearBeforeTitan(titan)!;
    expect(before).toMatchObject({titan:false,augmented:false,augments:[],rareId:'',enhancement:titan.enhancement});
    expect(before.rows.map(row=>row.value)).toEqual(titan.rows.map(row=>row.beforeTitan));
    expect(gearBeforeTitan({...titan,titan:false,augmented:false})).toBeNull();
    expect(gearBeforeTitan({...titan,rows:titan.rows.map((row,index)=>index?row:{...row,beforeTitan:null})})).toBeNull();
    const [ranked]=rankInventory([{key:'mature',gear:{...titan,equipped:false}}],draft,catalog,98);
    expect(ranked!.before!.gain).toBeCloseTo(slotComparison(draft,catalog,titan.id)!.compare(before).gain,12);
    expect(ranked!.prvMaximum).toBeGreaterThan(0);
  });
});

 describe('Altered native source replacement',()=>{
  it.each(['dps','healer'] as const)('switches the winning source for %s and gives DMG zero impact',role=>{
    const draft=makeDraft();draft.profile.role=role;draft.rv!.element='Altered';draft.weapons=[];
    draft.gear.forEach(gear=>{gear.enhancement=0;gear.titan=false;gear.augmented=false;gear.rows=[];gear.augments=[];});
    draft.combat.elements.forEach(element=>{element.attack=element.id==='Frost'?50000:element.id==='Volt'?49000:element.id==='Altered'?125000:10000;element.attackPercent=element.id==='Altered'?0:1.5;});
    const current=draft.gear[0]!,candidate={...structuredClone(current),rows:[{type:'Volt Attack',value:5000,beforeTitan:5000}]};
    const comparison=slotComparison(draft,catalog,current.id)!;
    expect(comparison.compare(candidate).gain).toBeGreaterThan(.05);
    expect(comparison.rate(candidate).entries.some(row=>row.type==='Volt Attack')).toBe(true);
    const losing={...candidate,rows:[{type:'Flame Attack',value:5000,beforeTitan:5000}]};
    expect(comparison.compare(losing).gain).toBeCloseTo(0,8);
    const impact=statImpactModel(draft,catalog)!;
    expect(impact.increase('Frost Damage %',.5)).toBe(0);
    expect(impact.increase('Volt Attack',5000)).toBeGreaterThan(0);
    expect(impact.increase('Flame Attack',5000)).toBe(0);
    if(role==='healer')expect(impact.increase('Crit',1000)).toBe(0);
  });
});
