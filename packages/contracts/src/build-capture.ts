import {z} from 'zod';
import {CaptureSessionSchema} from './capture-session';

const text=z.string().max(1000);
const id=z.string().max(160);
const number=z.number().finite().min(0).max(1e12);
const integer=number.int();
const time=z.string().datetime({offset:true});
const field=z.object({state:z.enum(['received','partial','waiting']),observedAt:time.nullable()}).strict();
const item=z.object({itemId:id,level:integer.max(1000),stars:integer.max(6)}).strict();
// Raw capture attributes have no verified magnitude limit; preserve every finite value.
const statValue=z.number().finite();
const stat=z.object({attribute:id,value:statValue,tag:id.nullable()}).strict();
const elements=z.record(id,number.nullable());
const originals=z.array(z.object({attribute:id,value:statValue}).strict()).max(8);

/** Card-only payload. Null means unavailable; it is never a confirmed zero. */
/**
 * Own account counters exported raw by the capture app (shown on Build; semantics of recharge units unverified;
 * docs/imports.md).
 */
const counter=z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).nullable();
export const ACCOUNT_COUNTER_KEYS=['totalRecharge','totalRechargeValue','totalRechargeValueByRmbTicket','activityRecharge','activityRechargeByRmbTicket',
  'paymentFakeDiamond','buyGemCount','buyFashionCount','monthCardLeftDays','tyroMonthCardLeftDays','totalLoginDays','continueLoginDays','reportCount',
  'antiPluginReportCount'] as const;
export const AccountCountersSchema=z.object(Object.fromEntries(ACCOUNT_COUNTER_KEYS.map(key=>[key,counter.optional()])) as
  Record<typeof ACCOUNT_COUNTER_KEYS[number],z.ZodOptional<typeof counter>>).strict();
export type AccountCounters=z.infer<typeof AccountCountersSchema>;
/**
 * Oldest capture app whose files the site accepts (owner, 2026-10-23: 2.0.0 for every import). An older `.tofbuild` is
 * shown but never stored, verified or ranked; an older `.tofwish` / `.tofplayers` is refused.
 */
export const MIN_CAPTURE_APP_VERSION='2.0.0';
/** Numeric `major.minor.patch` comparison of capture-app versions; an unreadable version is never "at least". */
export function exporterVersionAtLeast(version:string,minimum:string):boolean {
  const parse=(value:string)=>/^(\d{1,6})\.(\d{1,6})\.(\d{1,6})(?:[-+].*)?$/.exec(value)?.slice(1).map(Number);
  const actual=parse(version),required=parse(minimum);
  if(!actual||!required)return false;
  for(let index=0;index<3;index++)if(actual[index]!==required[index])return actual[index]!>required[index]!;
  return true;
}
export const BuildCaptureSchema=z.object({
  /** Optional PWG account identity from the checkout log or login packet, bound to this character. */
  pwg:z.object({uid:z.string().regex(/^[1-9]\d{0,31}$/),roleId:z.string().regex(/^[1-9]\d{0,31}$/),
    // Optional: the capture app writes what it recognised (an unrecognised client install has no app ID).
    serverId:z.string().regex(/^[1-9]\d{0,6}$/).optional(),appId:z.string().regex(/^[1-9]\d{0,15}$/).optional(),
    observedAt:time,source:z.enum(['HottaBrowser.log','game-login-packet'])}).strict().optional(),
  account:AccountCountersSchema.optional(),
  format:z.literal('tof-hub-build-capture'),schemaVersion:z.union([z.literal(2),z.literal(3)]),
  capture:z.object({mode:z.literal('self'),capturedAt:time,exportedAt:time.optional(),policy:z.literal('first-received'),
    exporterVersion:id,subject:z.object({uid:id,roleId:id}).strict(),scan:CaptureSessionSchema.optional()}).strict(),
  availability:z.record(id,field),
  profile:z.object({name:text.nullable(),level:integer.max(200).nullable(),avatarId:id.nullable(),
    avatarFrameId:id.nullable(),crew:text.nullable(),titleId:id.nullable(),signature:text.nullable(),
    suppressorId:id.nullable(),cs:z.number().finite().min(-1e12).max(1e12).nullable(),maxCs:number.nullable(),maxCsCivilTime:text.nullable()}).strict(),
  combat:z.object({hp:number.nullable(),endurance:number.nullable(),crit:number.nullable(),
    critDamage:number.nullable(),additionalCritRate:number.nullable(),serverCritRate:number.nullable(),
    attack:elements,attackBase:elements,resistance:elements}).strict(),
  /** Global weapons have up to 6 stars; MMO weapons carry their +N (up to +15) in `stars` (refined below). */
  weapons:z.array(item.extend({slot:integer.max(2),stars:integer.max(15),upgradeLevel:integer.max(200).optional()})).max(3),
  gear:z.array(z.object({slotKey:id,itemId:id,enhancement:integer.max(200),stars:integer.max(5).nullable(),
    stats:z.array(stat).max(12),
    /** Random stats before Titan from the matched inventory record (attributesA); null when no unique match. */
    beforeTitan:originals.nullable().optional(),
    /** Roll count of the matched inventory record (values[1]). */
    rolls:integer.max(10).nullable().optional(),
    /** Titan clicks: the Augmentation Count of the matched inventory record (`counter`), 0 without Titan. */
    augmentCount:integer.max(100000).nullable().optional()}).strict()).max(12),
  matrices:z.array(z.object({weaponSlot:integer.max(2),slot:integer.min(1).max(4),
    state:z.enum(['received','empty','waiting','partial']),matrix:item.extend({suitId:id.nullable()}).nullable()}).strict()).max(12),
  trait:z.object({itemId:id.nullable(),weaponId:id.nullable(),enabled:z.boolean(),points:integer.max(100000).nullable()}).strict().nullable(),
  relics:z.array(z.object({slot:integer.max(1),itemId:id,stars:integer.max(5)}).strict()).max(2),
  relicPassives:z.array(z.object({attribute:id,fraction:number,stackCount:integer,sourceCount:integer}).strict()).max(40),
  pet:z.object({itemId:id,customName:text,level:integer.max(100),stars:integer.max(5),
    modules:z.array(z.object({slot:integer.max(3),itemId:id,typeId:id,level:integer.max(10)}).strict()).max(4),
    baseAttack:number.nullable(),baseCrit:number.nullable(),inheritedAttack:number.nullable()}).strict().nullable(),
  computing:z.array(z.object({slot:integer,level:integer.max(100),progress:integer}).strict()).max(20).nullable(),
  support:z.object({modules:z.array(z.object({id,level:integer.max(100)}).strict()).max(40),
    reset:z.object({storedCivilTime:text.nullable(),availability:z.enum(['ready','cooldown','unknown']),
      availableAt:time.nullable()}).strict()}).strict().nullable(),
  synthesis:z.array(z.object({itemId:id,stage:integer.max(6)}).strict()).max(20),
  buffs:z.object({observedAt:time.nullable(),precision:z.literal('approximate'),
    records:z.array(z.object({definition:id,stackCount:integer.nullable(),durationSeconds:number.nullable(),
      remainingSeconds:number.nullable(),expiresAt:time.nullable()}).strict()).max(1000),
    counts:z.object({records:integer,stacks:integer,temporary:integer,permanent:integer}).strict().nullable()}).strict(),
  weaponSettings:z.object({elements:z.record(id,z.object({code:integer.max(255),aux:integer.max(255)}).strict()),
    fionaSkills:z.array(integer.min(1).max(6)).max(2).nullable(),settings:z.record(id,integer.max(255)),
    nanYinMark:id.nullable()}).strict(),
  /**
   * Backpack gear for the Optimizer: the own inventory records not matched to an equipped piece (login burst, source observation).
   * No enhancement/stars: the game transfers both with the slot on equip. Optional; older files have none.
   */
  inventory:z.array(z.object({itemId:id,stats:z.array(stat).max(12),beforeTitan:originals.nullable(),
    rolls:integer.max(10).nullable(),augmentCount:integer.max(100000).nullable()}).strict()).max(2000).optional(),
  /**
   * MMO (Warp, 8888NNN) own card systems for /tools/build/mmo/ (capture app 1.3+; docs/imports.md). Null parts
   * were not received at this login. `cards[].value` is 0–3 and likely the stars (unverified).
   */
  mmo:z.object({weaponMode:z.enum(['fixed','regular']).nullable(),
    panel:z.record(id,z.number().finite().min(-1e12).max(1e12).nullable()),
    slotCards:z.array(z.object({slot:id.nullable(),slotByte:integer.max(255),active:id.nullable(),
      cards:z.array(z.object({id,value:integer.max(255)}).strict()).max(16)}).strict()).max(32).nullable(),
    brainfield:z.array(z.object({chain:integer.max(15),nodes:z.array(z.object({id:z.string().regex(/^Talent\d{1,6}$/),level:integer.max(1000)}).strict()).max(64)}).strict()).max(8).nullable(),
  }).strict().optional(),
}).strict().superRefine((capture,ctx)=>{
  if(capture.schemaVersion===3&&!capture.capture.scan)ctx.addIssue({code:'custom',message:'Version 3 requires scan provenance'});
  capture.weapons.forEach((weapon,index)=>{
    if(!capture.mmo&&weapon.stars>6)ctx.addIssue({code:'custom',path:['weapons',index,'stars'],message:'Global weapons have at most 6 stars'});
  });
  if(capture.pwg) {
    const role=capture.capture.subject.roleId,uid=capture.capture.subject.uid;
    const server=capture.pwg.serverId;
    if(!/^[1-9]\d{0,31}$/.test(role)||capture.pwg.roleId!==role||server!==undefined&&(String(BigInt(role)>>32n)!==server||!uid.startsWith(server)||uid.length<=server.length))
      ctx.addIssue({code:'custom',path:['pwg'],message:'PWG identity does not match the captured character'});
    if(capture.pwg.appId&&capture.capture.scan?.install?.appId&&capture.pwg.appId!==capture.capture.scan.install.appId)
      ctx.addIssue({code:'custom',path:['pwg','appId'],message:'PWG app ID does not match the captured client'});
    if(capture.capture.exportedAt&&Date.parse(capture.pwg.observedAt)>Date.parse(capture.capture.exportedAt))
      ctx.addIssue({code:'custom',path:['pwg','observedAt'],message:'PWG observation is later than export'});
  }
});

export type BuildCapture=z.infer<typeof BuildCaptureSchema>;
