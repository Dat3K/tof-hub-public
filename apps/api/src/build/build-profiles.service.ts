import {UploadViolation} from '../security/abuse.service';
import {BadRequestException,ConflictException,Inject,Injectable,NotFoundException,type OnModuleInit,Optional,ServiceUnavailableException} from '@nestjs/common';
import {JobQueueService} from '../queue/job-queue.service';
import {constants,createHash,createPublicKey,verify,type KeyObject} from 'node:crypto';
import {Prisma,PrismaClient} from '@prisma/client';
import {z} from 'zod';
import {BuildCaptureSchema,canonicalPlayerUid,buildCaptureSigningTexts,canSaveBuildCapture,MMO_PROFILE_ROLES,MmoProfileDirectoryQuerySchema,isMmoProfileRole,mmoProfileRefusal,type MmoProfileDirectoryResponse,type MmoProfileRole,type MmoProfileSummary,PROFILE_ELEMENTS,PROFILE_ROLES,ProfileArtSchema,parseProfileSlot,playerServerRefusal,profileSlot,resolvePlayerServer,type ProfileArt,type ProfileElement,type ProfileRole,type ProfileSummary} from '@tof-hub/contracts';
import {loadImportKey} from '../import/sealed-envelope';
import {PRISMA} from '../database/database.module';
import {BUILD_CAPTURE_SIGNATURE_CONTEXT} from './build-import.service';

/** What a saved profile rates (role × element), its URL slot and background: shared with the page in @tof-hub/contracts. */
export {PROFILE_ELEMENTS,PROFILE_ROLES,parseProfileSlot,profileSlot,type ProfileArt,type ProfileElement,type ProfileRole,type ProfileSummary};
const UID=/^\d{6,20}$/;
const SaveSchema=z.object({
  capture:z.unknown(),digest:z.string().regex(/^[0-9a-f]{64}$/),signature:z.string().regex(/^[A-Za-z0-9_-]{16,1024}$/),
  role:z.enum(PROFILE_ROLES),element:z.enum(PROFILE_ELEMENTS),art:ProfileArtSchema.nullable().optional(),overwrite:z.boolean().optional(),
}).strict();
/** An MMO (Warp) card: one per UID × role, no element (docs/imports.md). */
const MmoSaveSchema=z.object({
  mode:z.literal('mmo'),capture:z.unknown(),digest:z.string().regex(/^[0-9a-f]{64}$/),signature:z.string().regex(/^[A-Za-z0-9_-]{16,1024}$/),
  role:z.enum(MMO_PROFILE_ROLES),art:ProfileArtSchema.nullable().optional(),overwrite:z.boolean().optional(),
}).strict();
const MMO_REFUSALS={'not-mmo':'Only MMO (Warp) cards are saved here','test-capture':'Test-server, DEV-client and unresolved captures cannot be saved',
  'not-warp':'Only characters of catalog Warp servers can save MMO builds'} as const;

/**
 * Saved build-card profiles per character UID. Only a card imported from a `.tofbuild` can be saved: the request carries
 * the capture the server signed on import (digest + RSA-PSS signature), the UID comes from that capture, and only the
 * capture is stored, so a saved card is always the unedited card ("Verified"); viewers verify it with the same signature.
 */
@Injectable()
export class BuildProfilesService implements OnModuleInit {
  private readonly privateKey=loadImportKey();
  private readonly publicKey:KeyObject|null=this.privateKey?createPublicKey(this.privateKey):null;
  constructor(@Optional() @Inject(JobQueueService) private readonly queue:JobQueueService|null=null,
    @Optional() @Inject(PRISMA) private readonly prisma:PrismaClient|null=null) {}
  onModuleInit() {this.queue?.register('build-profile',payload=>{
    const body=JSON.parse(payload.toString('utf8')) as {mode?:unknown};
    return body.mode==='mmo'?this.saveMmo(body):this.save(body);
  });}

  /** POST /build/profiles: the request shape answers at once; the signature check and the write wait in the shared queue. */
  async enqueue(body:unknown,ip:string) {
    this.db();
    if(!this.queue)throw new ServiceUnavailableException('Profiles are not available here');
    if((body as {mode?:unknown}|null)?.mode==='mmo') {
      if(!MmoSaveSchema.safeParse(body).success)throw new UploadViolation('Invalid profile request');
      this.requireMmoPublishable((body as {capture:unknown}).capture);
    } else {
      if(!SaveSchema.safeParse(body).success)throw new UploadViolation('Invalid profile request');
      this.requirePublishable((body as {capture:unknown}).capture);
    }
    return this.queue.enqueue('build-profile',Buffer.from(JSON.stringify(body)),ip);
  }

  private db() {
    if(!this.prisma||!this.privateKey||!this.publicKey)throw new ServiceUnavailableException('Profiles are not available here');
    return {prisma:this.prisma,privateKey:this.privateKey,publicKey:this.publicKey};
  }

  async list(uid:string):Promise<{available:boolean;profiles:ProfileSummary[]}> {
    uid=canonicalPlayerUid(uid);
    if(!UID.test(uid))throw new BadRequestException('Invalid UID');
    if(!this.prisma)return {available:false,profiles:[]};
    const rows=await this.prisma.buildProfile.findMany({where:{uid},orderBy:[{role:'asc'},{element:'asc'}],
      select:{role:true,element:true,name:true,savedAt:true,capturedAt:true}});
    return {available:true,profiles:rows.map(row=>({role:row.role as ProfileRole,element:row.element as ProfileElement,
      slot:profileSlot(row.role as ProfileRole,row.element as ProfileElement),name:row.name,savedAt:row.savedAt.toISOString(),capturedAt:row.capturedAt.toISOString()}))};
  }

  async get(uid:string,slot:string) {
    uid=canonicalPlayerUid(uid);
    const parsed=parseProfileSlot(slot);
    if(!UID.test(uid)||!parsed)throw new BadRequestException('Invalid profile');
    const {prisma}=this.db();
    const row=await prisma.buildProfile.findUnique({where:{uid_role_element:{uid,role:parsed.role,element:parsed.element}}});
    if(!row)throw new NotFoundException('Profile not found');
    return {uid,role:parsed.role,element:parsed.element,slot,name:row.name,savedAt:row.savedAt.toISOString(),
      // Exact text the digest was taken over; parsing keeps its key order for the browser's check.
      capture:JSON.parse(row.capture) as unknown,source:{kind:'file' as const,digest:row.digest,signature:row.signature},art:row.art as ProfileArt|null};
  }

  async save(body:unknown) {
    const {prisma}=this.db();
    const request=SaveSchema.safeParse(body);
    if(!request.success)throw new UploadViolation('Invalid profile request');
    const verified=this.verifySignedCapture(request.data.capture,request.data.digest,request.data.signature);
    const capture={data:verified};
    this.requirePublishable(verified);
    const digest=request.data.digest;
    const uid=canonicalPlayerUid(capture.data.capture.subject.uid,{roleId:capture.data.capture.subject.roleId});
    if(!uid||!UID.test(uid))throw new BadRequestException('The file has no character UID');
    const refusal=playerServerRefusal({uid});
    if(refusal)throw new BadRequestException(refusal==='unknown-server'?'Builds from servers missing from the site catalog cannot be saved':'Builds from Warp (MMO) servers cannot be saved yet');
    const {role,element}=request.data;
    const where={uid_role_element:{uid,role,element}};
    const existing=await prisma.buildProfile.findUnique({where,select:{savedAt:true,capturedAt:true}});
    if(existing&&!request.data.overwrite)throw new ConflictException({message:'Profile already saved',savedAt:existing.savedAt.toISOString()});
    const capturedAt=new Date(capture.data.capture.scan?.startedAt??capture.data.capture.capturedAt);
    if(existing&&capturedAt<existing.capturedAt)throw new ConflictException({message:'A newer capture is already saved',savedAt:existing.savedAt.toISOString()});
    const name=capture.data.profile.name?.slice(0,64)??null;
    const {server,regionCode}=resolvePlayerServer({uid});
    const data={name,capture:JSON.stringify(capture.data),digest,
      signature:request.data.signature,art:request.data.art?request.data.art as Prisma.InputJsonObject:Prisma.JsonNull,capturedAt,savedAt:new Date()};
    await prisma.buildProfile.upsert({where,create:{uid,role,element,...data},update:data});
    return {uid,name,region:regionCode,server:server?.name??null,role,element,slot:profileSlot(role,element),overwritten:!!existing};
  }

  async listMmo(uid:string):Promise<{available:boolean;profiles:MmoProfileSummary[]}> {
    uid=canonicalPlayerUid(uid);
    if(!UID.test(uid))throw new BadRequestException('Invalid UID');
    if(!this.prisma)return {available:false,profiles:[]};
    const rows=await this.prisma.mmoBuildProfile.findMany({where:{uid},select:{role:true,name:true,savedAt:true,capturedAt:true}});
    return {available:true,profiles:sortMmo(rows.map(mmoSummary))};
  }

  async getMmo(uid:string,role:string) {
    uid=canonicalPlayerUid(uid);
    if(!UID.test(uid)||!isMmoProfileRole(role))throw new BadRequestException('Invalid profile');
    const {prisma}=this.db();
    const row=await prisma.mmoBuildProfile.findUnique({where:{uid_role:{uid,role}}});
    if(!row)throw new NotFoundException('Profile not found');
    return {uid,role,name:row.name,savedAt:row.savedAt.toISOString(),capture:JSON.parse(row.capture) as unknown,
      source:{kind:'file' as const,digest:row.digest,signature:row.signature},art:row.art as ProfileArt|null};
  }

  async saveMmo(body:unknown) {
    const {prisma}=this.db();
    const request=MmoSaveSchema.safeParse(body);
    if(!request.success)throw new UploadViolation('Invalid profile request');
    const capture=this.verifySignedCapture(request.data.capture,request.data.digest,request.data.signature);
    this.requireMmoPublishable(capture);
    const uid=canonicalPlayerUid(capture.capture.subject.uid,{roleId:capture.capture.subject.roleId});
    if(!uid||!UID.test(uid))throw new BadRequestException('The file has no character UID');
    const role=request.data.role,where={uid_role:{uid,role}};
    const existing=await prisma.mmoBuildProfile.findUnique({where,select:{savedAt:true,capturedAt:true}});
    if(existing&&!request.data.overwrite)throw new ConflictException({message:'Profile already saved',savedAt:existing.savedAt.toISOString()});
    const capturedAt=new Date(capture.capture.scan?.startedAt??capture.capture.capturedAt);
    if(existing&&capturedAt<existing.capturedAt)throw new ConflictException({message:'A newer capture is already saved',savedAt:existing.savedAt.toISOString()});
    const name=capture.profile.name?.slice(0,64)??null;
    const data={name,capture:JSON.stringify(capture),digest:request.data.digest,signature:request.data.signature,
      art:request.data.art?request.data.art as Prisma.InputJsonObject:Prisma.JsonNull,capturedAt,savedAt:new Date()};
    await prisma.mmoBuildProfile.upsert({where,create:{uid,role,...data},update:data});
    return {uid,name,server:resolvePlayerServer({uid}).server?.name??null,role,overwritten:!!existing};
  }

  /** Public MMO cards, newest first, one row per character; captures and signatures are never projected. */
  async mmoDirectory(input:Record<string,unknown>):Promise<MmoProfileDirectoryResponse> {
    const parsed=MmoProfileDirectoryQuerySchema.safeParse(input);
    if(!parsed.success)throw new BadRequestException('Invalid profiles query');
    const query=parsed.data,empty={entries:[],total:0,offset:query.offset,limit:query.limit};
    if(!this.prisma)return {available:false,...empty};
    const where:Prisma.MmoBuildProfileWhereInput={...(query.role?{role:query.role}:{}),
      ...(query.q?{OR:[{uid:{startsWith:query.q}},{name:{contains:query.q,mode:'insensitive'}}]}:{})};
    const groups=await this.prisma.mmoBuildProfile.groupBy({by:['uid'],where,_max:{savedAt:true},orderBy:{_max:{savedAt:'desc'}}});
    const page=groups.slice(query.offset,query.offset+query.limit);
    const rows=page.length?await this.prisma.mmoBuildProfile.findMany({where:{uid:{in:page.map(group=>group.uid)}},
      select:{uid:true,role:true,name:true,savedAt:true,capturedAt:true},orderBy:{savedAt:'desc'}}):[];
    return {available:true,...empty,total:groups.length,entries:page.map(group=>{
      const own=rows.filter(row=>row.uid===group.uid);
      return {uid:group.uid,name:own[0]?.name??null,serverId:resolvePlayerServer({uid:group.uid}).server?.id??null,
        updatedAt:(group._max.savedAt??new Date(0)).toISOString(),profiles:sortMmo(own.map(mmoSummary))};
    })};
  }

  /** Shared import proof: a rank request cannot replace the signed gear or supply its own score. */
  verifySignedCapture(value:unknown,expectedDigest:string,signature:string) {
    const {publicKey}=this.db();
    const capture=BuildCaptureSchema.safeParse(value);
    if(!capture.success)throw new BadRequestException('Invalid card data');
    // The capture must be exactly the one this server signed on import.
    const hashes=buildCaptureSigningTexts(capture.data).map(text=>createHash('sha256').update(text).digest('hex'));
    const signed=verify('sha256',Buffer.from(`${BUILD_CAPTURE_SIGNATURE_CONTEXT}${expectedDigest}`),
      {key:publicKey,padding:constants.RSA_PKCS1_PSS_PADDING,saltLength:32},Buffer.from(signature,'base64url'));
    if(!hashes.includes(expectedDigest)||!signed)throw new UploadViolation('The card is not an unedited import of a .tofbuild file');
    return capture.data;
  }
  private requireMmoPublishable(value:unknown) {
    const capture=BuildCaptureSchema.safeParse(value);
    if(!capture.success)throw new BadRequestException('Invalid card data');
    const refusal=mmoProfileRefusal(capture.data);
    if(refusal)throw new BadRequestException(MMO_REFUSALS[refusal]);
  }
  private requirePublishable(value:unknown) {
    const capture=BuildCaptureSchema.safeParse(value);
    if(!capture.success)throw new BadRequestException('Invalid card data');
    if(!canSaveBuildCapture(capture.data.capture.scan))throw new BadRequestException('Test-server and unresolved captures cannot be saved');
  }
}

function mmoSummary(row:{role:string;name:string|null;savedAt:Date;capturedAt:Date}):MmoProfileSummary {
  return {role:row.role as MmoProfileRole,name:row.name,savedAt:row.savedAt.toISOString(),capturedAt:row.capturedAt.toISOString()};
}
const sortMmo=(rows:MmoProfileSummary[])=>rows.sort((a,b)=>MMO_PROFILE_ROLES.indexOf(a.role)-MMO_PROFILE_ROLES.indexOf(b.role));
