import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import capture from '../../../../../packages/contracts/src/__fixtures__/build-capture.json';
import {BuildCaptureSchema} from '@tof-hub/contracts';
import {draftFromCapture,inventoryFromCapture,refreshCapturedDraft,type CaptureImportCatalog} from './capture-import';
import {markCaptureEdit} from './capture-source';
import {emptyDraft,restoreDraft} from './model';
import type {BuildCatalog} from './types';
import type {TemporaryAttackCatalog} from '@tof-hub/game-domain';
const catalog=JSON.parse(readFileSync(resolve(import.meta.dirname,'../../../public/game-data/build-page.json'),'utf8')) as BuildCatalog;
const mapping=JSON.parse(readFileSync(resolve(import.meta.dirname,'../../../public/game-data/capture-card-map.json'),'utf8')) as CaptureImportCatalog;
const digest='a'.repeat(64);
describe('capture to card',()=>{
  it('refreshes the generated example without losing its marked weapon and custom pet name',async()=>{
    const cached=restoreDraft(structuredClone(catalog.demoDraft),catalog)!;
    expect(cached.demo).toBe(true);
    expect(cached.markWeaponId).toBeTruthy();
    expect(cached.pet.customName).toBeTruthy();
    cached.art.x=25;cached.enemyLevel=90;cached.rv={element:'Physical',includeCrit:true,mode:'prv'};
    cached.profile.role='tank';cached.updatedAt='2026-10-13T00:00:00.000Z';
    // Repair caches already affected by the old capture-only refresh, too.
    cached.markWeaponId='';delete cached.pet.customName;cached.combat.hp=1;
    const restored=await refreshCapturedDraft(cached,catalog,'en');
    expect(restored.markWeaponId).toBe(catalog.demoDraft.markWeaponId);
    expect(restored.pet).toEqual(catalog.demoDraft.pet);
    expect(restored.combat).toEqual(catalog.demoDraft.combat);
    expect(restored).toMatchObject({demo:true,art:cached.art,rv:cached.rv,enemyLevel:90,profile:{role:'tank'},updatedAt:cached.updatedAt});
    expect(await refreshCapturedDraft(restored,catalog,'en')).toEqual(restored);
    expect(cached.markWeaponId).toBe('');
  });
  it('refreshes obsolete cached capture inputs and consumables while preserving display choices',async()=>{
    const temporary=JSON.parse(readFileSync(resolve(import.meta.dirname,'../../../public/game-data/temporary-attack-effects.json'),'utf8')) as TemporaryAttackCatalog;
    const expected=draftFromCapture(capture,catalog,mapping,'en',digest,temporary,'signed-capture-fixture');
    const cached=structuredClone(expected);
    cached.combat.hp=1;cached.combat.crit=1;cached.combat.elements.forEach(element=>{element.attack=1;element.attackPercent=0;});
    cached.consumables=cached.consumables?.map(()=>'');cached.profile.characterTitle='';
    cached.enemyLevel=90;cached.profile.role='tank';cached.rv={element:'Physical',includeCrit:true,mode:'prv'};
    cached.art.x=25;cached.updatedAt='2026-10-13T00:00:00.000Z';
    const restored=await refreshCapturedDraft(cached,catalog,'en',{mapping,temporary});
    expect(restored.combat).toEqual(expected.combat);
    expect(restored.consumables).toEqual(expected.consumables);
    expect(restored.profile.characterTitle).toBe(expected.profile.characterTitle);
    expect(restored.captureSource).toEqual(expected.captureSource);
    expect(restored).toMatchObject({enemyLevel:90,profile:{role:'tank'},rv:cached.rv,art:cached.art,updatedAt:cached.updatedAt});
    expect(await refreshCapturedDraft(restored,catalog,'en',{mapping,temporary})).toEqual(restored);
    const edited=structuredClone(restored);edited.combat.hp=12345;markCaptureEdit(restored,edited);
    expect(edited.captureSource?.kind).toBe('manual');
    expect(await refreshCapturedDraft(edited,catalog,'en',{mapping,temporary})).toBe(edited);
  });
  it('keeps permitted food and injection ATK in the imported totals',()=>{
    const temporary=JSON.parse(readFileSync(resolve(import.meta.dirname,'../../../public/game-data/temporary-attack-effects.json'),'utf8')) as TemporaryAttackCatalog;
    const input=BuildCaptureSchema.parse(structuredClone(capture));input.support=null;
    input.combat.attackBase.FireAtkDisplayBase=50000;input.combat.attack.FireAtk=101250;
    input.buffs.records=['Default__buff_AddFireAtkFoodBase_C','Default__Buff_Jiuyu_Cooking34_C']
      .map(definition=>({definition,stackCount:1,durationSeconds:900,remainingSeconds:800,expiresAt:null}));
    const draft=draftFromCapture(input,catalog,mapping,'en',digest,temporary);
    expect(draft.combat.elements.find(item=>item.id==='Flame')?.attackPercent).toBeCloseTo(1.025);
  });
  it('retains support inside DisplayBase and repairs the old subtraction idempotently',()=>{
    const input=BuildCaptureSchema.parse(structuredClone(capture));
    input.support={modules:[{id:catalog.support.modules.find(item=>item.attackStat==='Volt Attack')!.id,level:5}],reset:{storedCivilTime:null,availability:'unknown',availableAt:null}};
    input.combat.attackBase.ThunderAtkDisplayBase=50000;
    input.combat.attack.ThunderAtk=100000;
    const draft=draftFromCapture(input,catalog,mapping,'en',digest);
    expect(draft.combat.elements.find(item=>item.id==='Volt')).toMatchObject({attack:50000,attackPercent:1});
    const legacy=structuredClone(draft);legacy.combat.elements.find(item=>item.id==='Volt')!.attackPercent=.985;
    const restored=restoreDraft(legacy,catalog)!;
    expect(restored.combat.elements.find(item=>item.id==='Volt')!.attackPercent).toBeCloseTo(1,12);
    expect(restoreDraft(restored,catalog)!.combat.elements.find(item=>item.id==='Volt')!.attackPercent).toBeCloseTo(1,12);
    input.support.modules=[];input.combat.attack.ThunderAtk=100000;
    expect(draftFromCapture(input,catalog,mapping,'en',digest).combat.elements.find(item=>item.id==='Volt')!.attackPercent).toBe(1);
  });
  it('maps a different account through generated catalogs and preserves the first CS and missing data',()=>{
    const draft=draftFromCapture(capture,catalog,mapping,'en',digest);
    expect(draft.profile.name).toBe('Example player');expect(draft.profile.characterTitle).toBe(capture.profile.titleId);
    expect(draft.profile.cs).toBe(Math.floor(capture.profile.cs!));
    expect(draft.weapons.every(x=>x.id&&x.matrices.every(m=>m.id))).toBe(true);
    expect(draft.gear.every(x=>x.equipped&&x.rows.some(r=>r.value>0))).toBe(true);
    expect(draft.traitId).toBeTruthy();expect(draft.traitPoints).toBe(4000);
    expect(draft.computing.map(x=>x.level).sort((a,b)=>a-b)).toEqual([10,13,15,15]);
    expect(draft.pet.customName).toBe('Example pet');expect(draft.pet.moduleLevels).toEqual([3,4,0,0]);
    expect(draft.relicDamage?.Frost).toBeCloseTo(.09);
    // SuperpowerDefMult from relic stars is the Altered RES% A4, kept apart from DMG% A4.
    expect(draft.relicResistance?.Altered).toBeGreaterThan(0);
    expect(draft.relicDamage?.Altered).toBeUndefined();
    expect(draft.captureSource?.capture.support).toBeNull();expect(draft.markWeaponId).toBe('');
    expect(draft.captureSource?.unresolved).toEqual([]);
    expect(restoreDraft(JSON.parse(JSON.stringify(draft)),catalog)?.captureSource?.kind).toBe('file');
  });
  it('changes provenance only when player data changes and keeps the original capture',()=>{
    const before=draftFromCapture(capture,catalog,mapping,'ru',digest),next=structuredClone(before);
    next.art.zoom=2;markCaptureEdit(before,next);expect(next.captureSource?.kind).toBe('file');
    next.computing[0].level++;markCaptureEdit(before,next);expect(next.captureSource?.kind).toBe('manual');
    expect(next.captureSource?.capture).toEqual(before.captureSource?.capture);
    expect(restoreDraft(next,catalog)?.captureSource?.kind).toBe('manual');
  });
  it('fills values before Titan by attribute from the matched inventory record and leaves the rest unknown',()=>{
    const input=BuildCaptureSchema.parse(capture);
    const visor=input.gear[0]!,random=visor.stats.filter(stat=>stat.tag==='None');
    visor.beforeTitan=[...random].reverse().map(stat=>({attribute:stat.attribute,value:stat.value/2}));
    const draft=draftFromCapture(input,catalog,mapping,'en',digest);
    const target=draft.gear.find(gear=>gear.titan&&gear.rows[0]?.value===random[0]!.value)!;
    expect(target.rows.map(row=>row.beforeTitan)).toEqual(random.map(stat=>Number((stat.value/2).toFixed(6))));
    expect(draft.gear.filter(gear=>gear!==target&&gear.titan).every(gear=>gear.rows.every(row=>row.beforeTitan===null))).toBe(true);
  });
  it('keeps the Titan click count (Augmentation Count) of the matched inventory record',()=>{
    const input=BuildCaptureSchema.parse({...capture,gear:capture.gear.map((item,index)=>index===0?{...item,augmentCount:180}:item)});
    const draft=draftFromCapture(input,catalog,mapping,'en',digest);
    const slot=mapping.gear[input.gear[0]!.itemId.toLowerCase()]!.id;
    expect(draft.gear.find(gear=>gear.id===slot)?.augmentCount).toBe(180);
    expect(draft.gear.filter(gear=>gear.id!==slot&&gear.equipped).every(gear=>gear.augmentCount===null)).toBe(true);
    expect(()=>BuildCaptureSchema.parse({...capture,gear:[{...capture.gear[0],augmentCount:-1}]})).toThrow();
  });
  it('notes a partially captured relic loadout instead of leaving the slot silently blank',()=>{
    const input=BuildCaptureSchema.parse(structuredClone(capture));
    input.relics=input.relics.slice(0,1);
    input.availability.relicLoadout={state:'partial',observedAt:input.availability.relicLoadout.observedAt};
    const draft=draftFromCapture(input,catalog,mapping,'en',digest);
    expect(draft.relics[1]).toMatchObject({id:'',stars:0});
    expect(draft.captureSource?.unresolved).toContain('relic: 1 of 2 captured (partial)');
    const received=BuildCaptureSchema.parse(structuredClone(capture));
    expect(draftFromCapture(received,catalog,mapping,'en',digest).captureSource?.unresolved).toEqual([]);
  });
  it('maps backpack inventory with the slot enhancement and stars, skipping unknown items',()=>{
    // Titan Eyepiece from source observation (screen: Flame 1274, ATK 285, Frost 5.178%, Volt RES 1159; enhancement 70 on the slot).
    const input=BuildCaptureSchema.parse({...capture,inventory:[
      {itemId:'visor_OS_red',stats:[{attribute:'FireAtkAdded',value:1274.852539,tag:null},{attribute:'CommonAtkAdded',value:285.69101,tag:null},
        {attribute:'IceAtkMult',value:.051779,tag:null},{attribute:'ThunderDefAdded',value:1159.37439,tag:null},
        {attribute:'uncommon_10',value:3,tag:'CommonAtkAggravatingInjury_Lv3'},{attribute:'IceAtkAdded',value:1180.72168,tag:'EquipmentTupo'}],
        beforeTitan:[{attribute:'FireAtkAdded',value:886.617493},{attribute:'CommonAtkAdded',value:52},{attribute:'IceAtkMult',value:.0414},{attribute:'ThunderDefAdded',value:215}],
        rolls:1,augmentCount:249},
      {itemId:'not_a_gear_item',stats:[],beforeTitan:null,rolls:null,augmentCount:null}]});
    const draft=draftFromCapture(input,catalog,mapping,'en',digest);
    const pieces=inventoryFromCapture(input,draft,catalog,mapping),slot=draft.gear.find(gear=>gear.id==='visor')!;
    expect(pieces).toHaveLength(1);
    expect(pieces[0]!.gear).toMatchObject({id:'visor',equipped:false,enhancement:slot.enhancement,stars:slot.stars,titan:true,augmentCount:249,
      rareId:'CommonAtkAggravatingInjury',rareLevel:3});
    expect(pieces[0]!.gear.rows.slice(0,4).map(row=>[row.value,row.beforeTitan])).toEqual([[1274.852539,886.617493],[285.69101,52],[.051779,.0414],[1159.37439,215]]);
    expect(pieces[0]!.gear.augments[0]!.value).toBe(1180.72168);
    expect(inventoryFromCapture(BuildCaptureSchema.parse(capture),draft,catalog,mapping)).toEqual([]);
  });
  it('leaves unknown identities blank without selecting arbitrary catalog items',()=>{
    const input=BuildCaptureSchema.parse(capture);input.weapons[0].itemId='future_unknown_weapon';
    input.weapons[0].level=200;
    const draft=draftFromCapture(input,catalog,mapping,'en',digest);
    expect(draft.weapons[0].id).toBe('');expect(draft.captureSource?.unresolved).toContain('weapon: future_unknown_weapon');
  });
  it('keeps an unreceived section distinct from a confirmed zero',()=>{
    const input=BuildCaptureSchema.parse(capture);input.computing=null;
    const draft=draftFromCapture(input,catalog,mapping,'en',digest);
    expect(draft.captureSource?.capture.computing).toBeNull();
    expect(BuildCaptureSchema.safeParse({...input,arbitraryExtraField:1}).success).toBe(false);
  });
  it.each([
    ['1300500001','Astora (EU)'],
    ['1300900001','Cosmos (EU)'],
    ['1200500001','Solaris (NA)'],
    ['9999900001',''],
  ])('uses the shared Wish server resolver for UID %s', (uid,server)=>{
    const input=BuildCaptureSchema.parse(capture);input.capture.subject.uid=uid;
    const draft=draftFromCapture(input,catalog,mapping,'ru',digest);
    expect(draft.profile.server).toBe(server);expect(draft.captureSource?.kind).toBe('file');
  });
  it('imports the Nan Yin mark as the catalog weaponId and reports an unknown target',()=>{
    const input=BuildCaptureSchema.parse(capture);
    const target=catalog.weapons.find(item=>item.weaponId)!;
    input.weaponSettings.nanYinMark=target.weaponId.toLowerCase();
    expect(draftFromCapture(input,catalog,mapping,'en',digest).markWeaponId).toBe(target.weaponId);
    input.weaponSettings.nanYinMark='Unknown_Weapon';
    const unknown=draftFromCapture(input,catalog,mapping,'en',digest);
    expect(unknown.markWeaponId).toBe('');expect(unknown.captureSource?.unresolved).toContain('mark: Unknown_Weapon');
  });
  it('fills a bare template when sections are absent from the file',()=>{
    const input=BuildCaptureSchema.parse(capture);
    for(const key of Object.keys(input.profile) as (keyof typeof input.profile)[])input.profile[key]=null;
    input.combat={hp:null,endurance:null,crit:null,critDamage:null,additionalCritRate:null,serverCritRate:null,attack:{},attackBase:{},resistance:{}};
    input.weapons=[];input.gear=[];input.matrices=[];input.trait=null;input.relics=[];input.relicPassives=[];
    input.pet=null;input.computing=null;input.support=null;input.synthesis=[];
    input.buffs={observedAt:null,precision:'approximate',records:[],counts:null};
    input.weaponSettings={elements:{},fionaSkills:null,settings:{},nanYinMark:null};
    for(const value of Object.values(input.availability))value.state='waiting';
    const draft=draftFromCapture(input,catalog,mapping,'en',digest),blank=emptyDraft(catalog);
    expect(draft.profile.name).toBe('');expect(draft.profile.signature).toBe('');expect(draft.profile.crew).toBe('');
    expect(draft.profile.avatarId).toBe('');expect(draft.profile.characterTitle).toBe('');
    expect(draft.profile.cs).toBeNull();expect(draft.profile.apexCs).toBeNull();
    for(const key of ['weapons','gear','pet','computing','support','synthesis','relics','consumables','traitId','traitPoints','markWeaponId'] as const)
      expect(draft[key]).toEqual(blank[key]);
    expect(draft.combat.hp).toBe(0);expect(draft.combat.crit).toBe(0);expect(draft.captureSource?.capture.combat.hp).toBeNull();
    expect(draft.combat.elements.every(element=>element.attack===0&&element.resistance===null)).toBe(true);
  });
  it('imports a 2.2.0 capture (no app pet tables, zero synthesis stages omitted) like the older file',()=>{
    // Capture 2.2.0 reads records without app catalogs: pet table stats come from this catalog, stage 0 is the default.
    const old=BuildCaptureSchema.parse(capture),next=BuildCaptureSchema.parse(structuredClone(capture));
    if(next.pet)Object.assign(next.pet,{baseAttack:null,baseCrit:null,inheritedAttack:null});
    next.synthesis=next.synthesis.filter(entry=>entry.stage>0);
    const before=draftFromCapture(old,catalog,mapping,'en',digest),after=draftFromCapture(next,catalog,mapping,'en',digest);
    expect(after.pet).toEqual(before.pet);expect(after.synthesis).toEqual(before.synthesis);
    expect(after.weapons).toEqual(before.weapons);expect(after.captureSource?.unresolved).toEqual(before.captureSource?.unresolved);
  });
  it('does not treat empty None modules or missing pet as unresolved errors',()=>{
    const input=BuildCaptureSchema.parse(capture);
    input.pet=null;
    input.support={modules:[{id:'None',level:1},{id:catalog.support.modules[0].id,level:1}],reset:{storedCivilTime:null,availability:'unknown',availableAt:null}};
    input.weapons[0].itemId='None';
    input.trait={itemId:'None',weaponId:'None',enabled:true,points:0};
    const draft=draftFromCapture(input,catalog,mapping,'en',digest);
    expect(draft.pet.id).toBe('');
    expect(draft.captureSource?.unresolved).toEqual([]);
  });
});
