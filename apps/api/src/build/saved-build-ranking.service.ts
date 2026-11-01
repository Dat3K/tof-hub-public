import {BadRequestException,Inject,Injectable,Optional} from '@nestjs/common';
import type {PrismaClient} from '@prisma/client';
import {BuildCaptureSchema,PROFILE_ELEMENTS,PROFILE_ROLES,equippedRankingTrack,captureOrigin,type EquippedBuildRanking} from '@tof-hub/contracts';
import {scoreBuildForTrack,scoreCurrentGearForTrack} from '@tof-hub/game-domain';
import {z} from 'zod';
import {PRISMA} from '../database/database.module';
import {RankingService} from '../ranking/ranking.service';
import {BuildProfilesService} from './build-profiles.service';
import {captureGearSnapshot} from '../players/capture-snapshot';
import {loadScoringCatalog} from '../players/scoring-catalog';

const Selection=z.object({role:z.enum(PROFILE_ROLES),element:z.enum(PROFILE_ELEMENTS)});
const ImportSelection=Selection.extend({capture:z.unknown(),digest:z.string().regex(/^[0-9a-f]{64}$/),signature:z.string().regex(/^[A-Za-z0-9_-]{16,1024}$/)});
const HOUR=60*60*1000,MINUTE=60*1000;

@Injectable()
export class SavedBuildRankingService {
  private cache=new Map<string,{expires:number;value:Promise<EquippedBuildRanking>}>();
  private revision:{expires:number;value:Promise<string>}|null=null;
  constructor(private readonly profiles:BuildProfilesService,private readonly ranking:RankingService,
    @Optional() @Inject(PRISMA) private readonly prisma:PrismaClient|null=null) {}

  /** Hour-long result cache; detect imports, rescoring, removals and visibility changes within a minute. */
  private boardRevision():Promise<string> {
    if(this.revision&&this.revision.expires>Date.now())return this.revision.value;
    const value=Promise.all([
      this.prisma!.playerScore.aggregate({_max:{updatedAt:true},_count:true}),
      this.prisma!.player.aggregate({_max:{updatedAt:true},_count:true}),
    ]).then(rows=>JSON.stringify(rows)).catch(error=>{this.revision=null;throw error;});
    this.revision={expires:Date.now()+MINUTE,value};
    return value;
  }

  async get(uid:string,slot:string,query:Record<string,unknown>):Promise<EquippedBuildRanking> {
    const selected=Selection.safeParse(query);
    if(!selected.success)throw new BadRequestException('Invalid ranking selection');
    if(!this.prisma)return {available:false};
    const profile=await this.profiles.get(uid,slot);
    return this.calculate(uid,profile,selected.data);
  }

  async imported(body:unknown):Promise<EquippedBuildRanking> {
    const request=ImportSelection.safeParse(body);
    if(!request.success)throw new BadRequestException('Invalid imported ranking request');
    const capture=this.profiles.verifySignedCapture(request.data.capture,request.data.digest,request.data.signature);
    // Comparing a signed file never publishes its gear or changes unresolved scan provenance.
    if(captureOrigin(capture.capture.scan)==='test')return {available:false};
    return this.calculate(capture.capture.subject.uid,{capture,source:{digest:request.data.digest}},request.data);
  }

  private async calculate(uid:string,profile:{capture:unknown;source:{digest:string}},selected:z.infer<typeof Selection>):Promise<EquippedBuildRanking> {
    if(!this.prisma)return {available:false};
    const player=await this.prisma.player.findUnique({where:{uid},select:{id:true,region:true,hidden:true}});
    const catalog=loadScoringCatalog();
    if(!player||player.hidden||!catalog)return {available:false};
    const {role,element}=selected,track=equippedRankingTrack(element);
    // Tank boards currently exist for individual resistance elements only, not elemental duos.
    if(role==='tank'&&track.length>1)return {available:false};
    if(!catalog.tracks.some(candidate=>candidate.length===track.length&&track.every(id=>candidate.includes(id))))return {available:false};
    const revision=await this.boardRevision();
    const key=JSON.stringify([uid,profile.source.digest,role,track,player.region,revision]);
    const cached=this.cache.get(key);
    if(cached&&cached.expires>Date.now())return cached.value;
    for(const [id,entry] of this.cache)if(entry.expires<=Date.now())this.cache.delete(id);
    if(this.cache.size>=500)this.cache.delete(this.cache.keys().next().value!);
    const value=(async():Promise<EquippedBuildRanking>=>{
      const capture=BuildCaptureSchema.parse(profile.capture);
      const {gear,unresolved}=captureGearSnapshot(capture.gear,catalog);
      if(unresolved.length||!gear.length)return {available:false};
      const maximum=Object.values(catalog.allowedStats).reduce((sum,allowedTypes)=>sum+
        scoreCurrentGearForTrack({rows:[],augments:[],allowedTypes},track,catalog.reference,role).maximum,0);
      const build=scoreBuildForTrack(gear,item=>item.slot,item=>{
        const allowedTypes=catalog.allowedStats[item.slot];
        return allowedTypes?{rows:item.stats,augments:item.titan||item.augmented?item.augments:[],allowedTypes}:null;
      },track,catalog.reference,role);
      if(maximum<=0||build.value<=0)return {available:false};
      const ranks=await this.ranking.equippedRanks(player.id,track.join('-'),role,{score:build.value/maximum*100,maxScore:maximum},player.region);
      return {...ranks,digest:profile.source.digest,track:track.join('-'),calculatedAt:new Date().toISOString()};
    })().catch(error=>{this.cache.delete(key);throw error;});
    this.cache.set(key,{expires:Date.now()+HOUR,value});
    return value;
  }
}
