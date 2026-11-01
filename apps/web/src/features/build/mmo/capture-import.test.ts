import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {constants,createHash,generateKeyPairSync,sign} from 'node:crypto';
import {BuildCaptureSchema,canonicalJson,getAllServers,type BuildCapture} from '@tof-hub/contracts';
import {scanFixture} from '../../../../../../packages/contracts/src/__fixtures__/scan-session';
import fixture from './__fixtures__/observation-mmo-capture.json';
import {mmoDraftFromCapture} from './capture-import';
import {mmoBrainfieldChains,mmoThresholds,restoreMmoDraft,selectMmoGear,mmoPetModuleChoices,mmoPetModuleLimit} from './model';
import {mmoCardEdited,verifyMmoBuildCard} from './profiles';
import type {HandbookBrainfieldData} from '../../datamine/contracts/handbook';
import {fullMmoCapture} from './__fixtures__/capture';
import type {BuildCatalog} from '../types';
import type {MmoBuildCatalog,MmoGeneratedCatalog} from './types';

const data=(name:string)=>JSON.parse(readFileSync(resolve(import.meta.dirname,`../../../../public/game-data/${name}.json`),'utf8'));
const mmo=data('build-mmo-page') as MmoGeneratedCatalog,build=data('build-page') as BuildCatalog,brainfield=data('handbook/mmo-brainfield') as HandbookBrainfieldData;
const catalog:MmoBuildCatalog={...mmo,artworks:build.artworks,elementIcons:build.elementIcons,avatars:build.avatars,avatarFrames:build.avatarFrames,
  roleResonances:build.roleResonances.items,titles:build.titles,
  brainfieldStats:brainfield.groups.flatMap(group=>group.nodes.map(({id,kind,maxLevel,levels})=>({id,kind,maxLevel,levels:levels.map(({level,attribute})=>({level,attribute}))})))};
const capture=fullMmoCapture as BuildCapture;

describe('MMO capture to card',()=>{
  it('fills profile, panel, gear with rolls and cards, weapons, mode and Brainfield from the devscan captures',()=>{
    const {draft,missing}=mmoDraftFromCapture(capture,catalog);
    // The nickname keeps its invisible trailing character as captured.
    expect(draft.profile).toMatchObject({name:fixture.profile.name,uid:'888800113',level:85,cs:185991,crew:'EOS',characterTitle:'2_2_0_95',
      // `zuoyi` is newer than the published cosmetics: kept for the fallback until the pipeline adds it.
      avatarId:'zuoyi',avatarFrameId:'AvatarFrame_236'});
    expect(draft.stats).toMatchObject({MaxHP:2786640.75,Crit:7448,EquipAttrSuperArmor:1375});
    // Equipment_16 → visor, its rolls kept by RandomProp id; the slot's active card with its byte as stars.
    expect(draft.gear.visor).toEqual({itemId:'S2_T2_Glisten_visor_def',card:{id:'orange_Skill_15',stars:3},
      rolls:[{prop:'DefenseIntensityMMO_2',value:0.0074},{prop:'EquipAttrSuperArmor_2',value:275},{prop:'AttackPowerMMO_2',value:0.0074}]});
    expect(Object.values(draft.gear).filter(gear=>gear.itemId)).toHaveLength(12);
    expect(draft.weapons.map(weapon=>weapon.id)).toEqual(['salidy-mmo','berry-mmo','gnonno-mmo']);
    expect(draft.weaponMode).toBe('fixed');
    expect(mmoBrainfieldChains(draft,catalog).slice(0,2).map(chain=>chain.level)).toEqual([35,34]);
    // FightPet_14 decodes with the MMO capture pet catalog; inherited ATK as the client computes it (screenshot "+33407").
    expect(draft.pet).toEqual({id:'FightPet_14',level:1,inheritedAttack:33407,stars:0,modules:[]});
    expect(missing).toEqual([]);
  });
  it('sums the reached Brainfield levels by attribute with the Handbook rule',()=>{
    const {draft}=mmoDraftFromCapture(capture,catalog);
    const [first]=mmoBrainfieldChains(draft,catalog);
    expect(first!.stats.length).toBeGreaterThan(0);
    // Talent101 Max HP Up: five levels of MaxHealthAdded rows are part of the chain sum.
    const hp=first!.stats.find(stat=>stat.prop==='MaxHealthAdded')!;
    const talent101=catalog.brainfieldStats!.find(node=>node.id==='Talent101')!.levels.reduce((sum,level)=>sum+(level.attribute.propValue??0),0);
    expect(hp.value).toBeGreaterThanOrEqual(talent101);
  });
  it('keeps MMO module identity, advancement and load separate from overlapping Global ids',()=>{
    const module=catalog.petModules!.find(row=>row.id==='SkillModule_ssr_1_1')!;
    expect(module).toMatchObject({load:1,exclusivePets:['FightPet_13']});
    const input=structuredClone(capture);
    input.pet={...input.pet!,itemId:'FightPet_13',stars:1,modules:[{slot:1,itemId:'SkillModule_ssr_2_1',typeId:'SkillModule_ssr_2',level:1},{slot:0,itemId:module.id,typeId:module.typeId,level:module.level}]};
    const draft=mmoDraftFromCapture(input,catalog).draft;
    draft.source={capture:input,digest:'a'.repeat(64),signature:'b'.repeat(64)};
    expect(draft.pet).toMatchObject({stars:1,modules:[{slot:0,id:module.id},{slot:1,id:'SkillModule_ssr_2_1'}]});
    expect(mmoPetModuleLimit(draft,catalog)).toMatchObject({slots:2,load:8});
    expect(mmoPetModuleChoices(draft,catalog,1)).toContainEqual(module);
    expect(mmoPetModuleChoices(draft,catalog,2)).toEqual([]);
    expect(mmoCardEdited(draft,catalog)).toBe(false);
    draft.pet!.modules!.reverse();expect(mmoCardEdited(draft,catalog)).toBe(false);
    draft.pet!.modules=[];expect(mmoCardEdited(draft,catalog)).toBe(true);
    draft.pet!.id='FightPet_14';expect(mmoPetModuleChoices(draft,catalog,0)).toEqual([]);
  });
  it('lists what a login did not send',()=>{
    const {missing}=mmoDraftFromCapture({...capture,mmo:{...capture.mmo!,slotCards:null,brainfield:null,weaponMode:null}},catalog);
    expect(missing).toEqual(['cards','mode','brainfield']);
  });
  it('keeps expansion cards when a partial capture has no gear, and through removing/replacing an item',()=>{
    const draft=mmoDraftFromCapture({...capture,gear:[]},catalog).draft;
    expect(draft.gear.visor?.card).toEqual({id:'orange_Skill_15',stars:3});
    selectMmoGear(draft,'visor','S2_T2_Glisten_visor_def',catalog);
    expect(draft.gear.visor?.card?.stars).toBe(3);
    selectMmoGear(draft,'visor','',catalog);
    const restored=restoreMmoDraft(draft,catalog)!;
    expect(restored.gear.visor).toEqual({itemId:'',rolls:[],card:{id:'orange_Skill_15',stars:3}});
    const before=structuredClone(restored.gear.visor);
    selectMmoGear(restored,'visor',catalog.gear.find(item=>item.slot!=='visor')!.id,catalog);
    expect(restored.gear.visor).toEqual(before);
  });
  it('uses the captured exact-property threshold reference after the active catalog advances to _3',()=>{
    const draft=mmoDraftFromCapture(capture,catalog).draft;
    expect(catalog.thresholds.some(track=>track.prop==='EquipAttrSuperArmor_3')).toBe(true);
    const tracks=mmoThresholds(draft,catalog);
    expect(tracks).toHaveLength(7);
    expect(tracks.find(track=>track.attribute==='EquipAttrSuperArmor')).toMatchObject({prop:'EquipAttrSuperArmor_2',total:1375,level:1});
    expect(tracks.find(track=>track.attribute==='EquipAttrHealAtk')).toMatchObject({prop:'EquipAttrHealAtk_2',total:1600,level:0});
    expect(tracks.some(track=>track.level>0)).toBe(true);
    const old=catalog.thresholds.find(track=>track.prop==='EquipAttrSuperArmor_2')!;
    draft.gear.visor!.rolls.push({prop:'EquipAttrSuperArmor_3',value:2500});
    const mixed=mmoThresholds(draft,catalog).filter(track=>track.attribute===old.attribute);
    expect(mixed.map(track=>track.total)).toEqual([2500,1375]);
  });
  it('preserves the signed import only for role and artwork, and recognizes restored values',()=>{
    const draft=mmoDraftFromCapture(capture,catalog).draft;
    draft.source={capture,digest:'a'.repeat(64),signature:'b'.repeat(64)};
    draft.role='tank';draft.art.zoom=1.3;
    expect(mmoCardEdited(draft,catalog)).toBe(false);
    draft.gear.visor!.card!.stars=1;
    expect(mmoCardEdited(draft,catalog)).toBe(true);
    draft.gear.visor!.card!.stars=3;
    expect(mmoCardEdited(draft,catalog)).toBe(false);
    draft.profile.season=null;
    expect(mmoCardEdited(draft,catalog)).toBe(true);
  });
  it('verifies MMO export signatures, value edits and restoration; never promotes a DEV capture',async()=>{
    const keys=generateKeyPairSync('rsa',{modulusLength:2048});
    const publicKey=keys.publicKey.export({type:'spki',format:'pem'}).toString();
    const server=getAllServers().find(row=>row.kind==='warp');
    expect(server).toBeDefined();
    const live=BuildCaptureSchema.parse({...capture,capture:{...capture.capture,scan:scanFixture('live'),subject:{
      uid:server!.id+'1000001',roleId:((BigInt(server!.id)<<32n)+1n).toString(),
    }}});
    const digest=createHash('sha256').update(canonicalJson(live)).digest('hex');
    const signature=sign('sha256',Buffer.from(`tof-hub-build-capture:1:${digest}`),{key:keys.privateKey,padding:constants.RSA_PKCS1_PSS_PADDING,saltLength:32}).toString('base64url');
    const draft=mmoDraftFromCapture(live,catalog).draft;
    draft.source={capture:live,digest,signature};draft.role='healer';draft.art.zoom=1.2;
    expect(await verifyMmoBuildCard(draft,catalog,publicKey)).toBe('verified');
    draft.weapons[0]!.stars=7;
    expect(await verifyMmoBuildCard(draft,catalog,publicKey)).toBe('edited');
    draft.weapons[0]!.stars=15;
    expect(await verifyMmoBuildCard(draft,catalog,publicKey)).toBe('verified');
    draft.source.signature='a'.repeat(64);
    expect(await verifyMmoBuildCard(draft,catalog,publicKey)).toBe('edited');
    draft.source={capture,digest,signature};
    expect(await verifyMmoBuildCard(draft,catalog,publicKey)).toBe('test-server');
  });
});
