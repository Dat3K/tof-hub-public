import {PlayerImportEntrySchema as playerSchema,PlayerImportBundleSchema as bundleSchema} from '@tof-hub/contracts';
import {prepareJsonImport} from '../import/json-import';
import {UploadViolation} from '../security/abuse.service';
import {BadRequestException,Inject,Injectable,Logger,type OnModuleInit,Optional,ServiceUnavailableException} from '@nestjs/common';
import {JobQueueService,hashIp} from '../queue/job-queue.service';
import {createHash} from 'node:crypto';
import {z} from 'zod';
import {decryptEnvelope,IMPORT_KEY_ID,loadImportKey,sealedEnvelopeSchema} from '../import/sealed-envelope';
import {readSealedText,SealedFileError} from '../import/sealed-file';
import {PLAYER_STORE} from '../players/players.module';
import type {PlayerStoreService} from '../players/player-store.service';
import {snapshotFromInspect,type InspectPayload} from '../players/inspect-snapshot';
import {SEALED_FILES,BuildCaptureSchema,CaptureSessionSchema,canonicalPlayerUid,canPublishGearCapture,isPioneerCapture,isBlockedCaptureClient,resolvePlayerServer} from '@tof-hub/contracts';
import {PioneerService} from './pioneer/pioneer.service';
import {loadScoringCatalog} from '../players/scoring-catalog';
import {captureGearSnapshot} from '../players/capture-snapshot';
import {TestAccountsService,canonicalTestDistribution,testObservationInterval,type TestAccountObservation} from '../players/test-accounts.service';
import {outdatedCaptureApp,testCaptureDistribution} from '../import/capture-import-policy';
import {NegativeCombatScoreService} from '../players/negative-combat-score.service';
import {NotificationsService} from '../notifications/notifications.service';

/** Upload limits of one `.tofplayers` file: the sealed text (SEALED_FILES.players) and the decrypted bundle. */
const PLAYERS_FILE={format:SEALED_FILES.players.format,maxBytes:SEALED_FILES.players.maxBytes};
const MAX_PLAYERS_PLAINTEXT_BYTES=96*1024*1024;
const MAX_PLAYERS=5000;

const envelopeSchema=sealedEnvelopeSchema('players',{maxCiphertext:Math.ceil(SEALED_FILES.players.maxBytes*4/3)});
export interface InspectImportPlayer {
  uid: string | null;
  name: string | null;
  gear: number;
  status: 'new' | 'repeated' | 'rejected' | 'observed';
}

export interface InspectImportResult {
  collectorUid?: string;
  files: number;
  stored: number;
  duplicates: number;
  rejected: number;
  region?: string | null;
  server?: string | null;
  players: InspectImportPlayer[];
  observationsOnly?:boolean;
  observed?:number;
}

/** Compact private history kept after the uploaded file and queue payload are cleared. */
export function playersImportQueueSummary(result:InspectImportResult) {
  return {
    ...(result.collectorUid ? {collectorUid:result.collectorUid} : {}),
    total:result.players.length,
    stored:result.stored,
    duplicates:result.duplicates,
    rejected:result.rejected,
    region:result.region??null,
    server:result.server??null,
    players:result.players.map(({uid,name,gear,status})=>({uid,name,gear,status})),
    ...(result.observationsOnly?{observationsOnly:true,observed:result.observed??0,files:result.files}:{}),
  };
}

import {RankingCacheService} from './cache/ranking-cache.service';
import {RankingCacheWarmupService} from './cache/ranking-cache-warmup.service';

/**
 * `players-<date>.tofplayers` from the capture app: one sealed text file with every observed player.
 * A file that fails the first gate (size, text, signature, JSON), the envelope schema, the key or the AES-GCM tag is
 * refused as a whole before any player is read; then each player is validated and stored on its own.
 */
@Injectable()
export class InspectImportService implements OnModuleInit {
  private readonly privateKey=loadImportKey();
  private readonly logger=new Logger('InspectImport');
  constructor(@Optional() @Inject(PLAYER_STORE) private readonly store:PlayerStoreService|null=null,@Optional() @Inject(JobQueueService) private readonly queue:JobQueueService|null=null,@Optional() @Inject(PioneerService) private readonly pioneer:PioneerService|null=null,@Optional() @Inject(TestAccountsService) private readonly testAccounts:TestAccountsService|null=null,@Optional() @Inject(NegativeCombatScoreService) private readonly negativeCs:NegativeCombatScoreService|null=null,
    @Optional() @Inject(RankingCacheService) private readonly cache:RankingCacheService|null=null,
    @Optional() @Inject(RankingCacheWarmupService) private readonly warmup:RankingCacheWarmupService|null=null,
    @Optional() @Inject(NotificationsService) private readonly notifications:NotificationsService|null=null) {}
  onModuleInit() {this.queue?.register('players-import',async(payload,{ip})=>playersImportQueueSummary(await this.import(payload,ip)));}

  /** POST /ranking/inspect: configuration, the first gate, the envelope and the key answer at once; the rest waits in the shared queue. */
  async enqueue(body:unknown,ip:string) {
    if(!this.privateKey||!this.queue)throw new ServiceUnavailableException('Import is not configured');
    let accepted:unknown;
    try {
      const envelope=envelopeSchema.safeParse(prepareJsonImport('players',body,this.privateKey));
      if(!envelope.success)throw new SealedFileError('Invalid .tofplayers envelope');
      if(envelope.data.key_id!==IMPORT_KEY_ID)throw new BadRequestException('The file was sealed for another site key');
      accepted=envelope.data;
    } catch(error) {
      if(error instanceof SealedFileError)throw new UploadViolation(error.message);
      throw error;
    }
    return this.queue.enqueue('players-import',Buffer.from(JSON.stringify(accepted)),ip);
  }

  /** The queued work (also callable directly). */
  async import(body:unknown,ip=''):Promise<InspectImportResult> {
    if(!this.privateKey)throw new ServiceUnavailableException('Import is not configured');
    const catalog=loadScoringCatalog();
    let bundle:z.infer<typeof bundleSchema>;
    let acceptedEnvelope:unknown;
    try {
      const envelope=envelopeSchema.safeParse(prepareJsonImport('players',body,this.privateKey));
      if(!envelope.success)throw new SealedFileError('Invalid .tofplayers envelope');
      if(envelope.data.key_id!==IMPORT_KEY_ID)throw new BadRequestException('The file was sealed for another site key');
      let plaintext:unknown;
      try {plaintext=decryptEnvelope(envelope.data,this.privateKey,MAX_PLAYERS_PLAINTEXT_BYTES);}
      catch {throw new SealedFileError('The file is damaged or was changed after export');}
      const parsed=bundleSchema.safeParse(plaintext);
      if(!parsed.success)throw new SealedFileError('Invalid players data');
      bundle=parsed.data;
      acceptedEnvelope=envelope.data;
    } catch(error) {
      if(error instanceof SealedFileError)throw new UploadViolation(error.message);
      throw error;
    }
    const outdated=outdatedCaptureApp(bundle.export_metadata.exporter_version);
    if(outdated)throw new BadRequestException(`The capture app is older than ${outdated}: update it and export again`);
    const owner=bundle.owner;
    if(owner&&((bundle.observer.uid!==null&&owner.uid!==bundle.observer.uid)||(bundle.observer.role_id!==null&&owner.role_id!==bundle.observer.role_id)))
      throw new UploadViolation('Owner does not match the scan observer');
    const distribution=testCaptureDistribution(bundle.export_metadata.scan);
    const observationsOnly=!!distribution&&['korea-dev','taiwan-dev'].includes(canonicalTestDistribution(distribution));
    const pioneer=isPioneerCapture(bundle.export_metadata.scan);
    if(pioneer&&!this.pioneer)throw new ServiceUnavailableException('Pioneer storage is not configured');
    if(!observationsOnly&&(isBlockedCaptureClient(bundle.export_metadata.scan)||(!pioneer&&!canPublishGearCapture(bundle.export_metadata.scan))))throw new BadRequestException('Test-server and unresolved players cannot enter Ranking');
    // Check every source before the first write: a bundle can contain earlier capture sessions.
    for(const raw of bundle.players) {
      const scan=(raw as {scan?:unknown}|null)?.scan;
      if(pioneer&&scan===undefined)throw new BadRequestException('Each Pioneer player needs its source scan');
      if(scan!==undefined) {
        const parsed=CaptureSessionSchema.safeParse(scan);
        if(!parsed.success)throw new UploadViolation('Invalid source scan');
        if(observationsOnly) {
          const own=testCaptureDistribution(parsed.data);
          if(!own||canonicalTestDistribution(own)!==canonicalTestDistribution(distribution!))throw new BadRequestException('Mixed test-client sources');
        } else if(isBlockedCaptureClient(parsed.data)||isPioneerCapture(parsed.data)!==pioneer||(!pioneer&&!canPublishGearCapture(parsed.data)))throw new BadRequestException('Test-server and unresolved players cannot enter Ranking');
      }
    }
    const observerProfile=owner?null:bundle.players.map(raw=>playerSchema.safeParse(raw))
      .find(player=>player.success&&player.data.uid===bundle.observer.uid);
    await this.notifications?.acceptedImport('players',acceptedEnvelope,{uid:owner?.uid??bundle.observer.uid,
      nickname:owner?.name??(observerProfile?.success?observerProfile.data.name:null)});
    await this.negativeCs?.observe([
      ...(owner?[{uid:owner.uid,cs:owner.cs,scan:bundle.export_metadata.scan,capturedAt:owner.captured_at}]:[]),
      ...bundle.players.flatMap(raw=>{
        const player=playerSchema.safeParse(raw);
        return player.success?[{uid:player.data.uid,cs:player.data.cs,scan:player.data.scan??bundle.export_metadata.scan,
          capturedAt:player.data.profile_captured_at,lastSeenAt:player.data.last_seen_at}]:[];
      }),
    ],{kind:'players',fileHash:createHash('sha256').update(JSON.stringify(bundle)).digest('hex')});
    if(observationsOnly&&(!this.testAccounts||this.testAccounts.available===false))throw new ServiceUnavailableException('Test participation storage is not configured');
    if(!observationsOnly&&(!this.store||!catalog))throw new ServiceUnavailableException('Player storage needs Postgres and the generated build catalog');
    const observations:TestAccountObservation[]=[
      ...(owner?[{uid:owner.uid,roleId:owner.role_id,nickname:owner.name,scan:bundle.export_metadata.scan,capturedAt:owner.captured_at}]:[]),
      ...bundle.players.flatMap(raw=>{
        const player=playerSchema.safeParse(raw);
        return player.success?[{uid:player.data.uid,roleId:player.data.role_id,nickname:player.data.name,scan:player.data.scan??bundle.export_metadata.scan,
          firstSeenAt:typeof player.data.first_seen_at==='string'?player.data.first_seen_at:null,lastSeenAt:player.data.last_seen_at,capturedAt:player.data.profile_captured_at}]:[];
      }),
    ];
    // An exact owner/profile observation must not be widened by its duplicate observer scan boundaries.
    if(!observations.some(row=>row.uid===bundle.observer.uid&&testObservationInterval(row,new Date())))
      observations.unshift({uid:bundle.observer.uid,roleId:bundle.observer.role_id,scan:bundle.export_metadata.scan});
    const observed=await this.testAccounts?.observe(observations,{kind:'players',fileHash:createHash('sha256').update(JSON.stringify(bundle)).digest('hex')});
    if(observationsOnly) {
      const players:InspectImportPlayer[]=bundle.players.map(raw=>{
        const parsed=playerSchema.safeParse(raw);
        const valid=parsed.success&&!!parsed.data.uid&&/^\d{6,24}$/.test(parsed.data.uid)&&!!testObservationInterval({uid:parsed.data.uid,
          firstSeenAt:typeof parsed.data.first_seen_at==='string'?parsed.data.first_seen_at:null,lastSeenAt:parsed.data.last_seen_at,
          capturedAt:parsed.data.profile_captured_at,scan:parsed.data.scan??bundle.export_metadata.scan},new Date());
        return {uid:parsed.success?parsed.data.uid:null,name:parsed.success?parsed.data.name:null,gear:0,status:valid?'observed':'rejected'};
      });
      if(owner)players.push({uid:owner.uid,name:owner.name,gear:0,status:'observed'});
      return {collectorUid:bundle.observer.uid&&/^\d{6,24}$/.test(bundle.observer.uid)?bundle.observer.uid:undefined,
        files:players.length,stored:0,duplicates:0,rejected:players.filter(row=>row.status==='rejected').length,
        region:canonicalTestDistribution(distribution!)==='korea-dev'?'KR DEV':'TW DEV',server:null,players,observationsOnly:true,observed:observed??0};
    }
    // Prefer the owner's equipped records to a second inspected copy of the same UID or RoleID.
    const rawProfiles=bundle.players.filter(raw=>{
      const player=playerSchema.safeParse(raw);
      return !owner||!player.success||(player.data.uid!==owner.uid&&player.data.role_id!==owner.role_id);
    });
    const profiles=[...rawProfiles.map(raw=>({raw,owner:false})),...(owner?[{raw:owner,owner:true}]:[])];
    const firstUid=owner?.uid??bundle.observer.uid??(bundle.players.find(p=>typeof (p as Record<string,unknown>)?.uid==='string') as {uid:string}|undefined)?.uid;
    const {server,regionCode}=resolvePlayerServer({
      uid:firstUid,
      serverId:bundle.observer.server_id??null,
    });
    const resolvedRegion=pioneer?'PIONEER':(regionCode??server?.regionCode??null);
    const result:InspectImportResult={
      collectorUid:bundle.observer.uid&&/^\d{6,24}$/.test(bundle.observer.uid)?bundle.observer.uid:undefined,
      files:profiles.length,
      stored:0,
      duplicates:0,
      rejected:0,
      region:resolvedRegion,
      server:server?.name??null,
      players:[],
    };
    const ipHash=hashIp(ip);
    for(const [index,entry] of profiles.entries()) {
      try {
        const raw=entry.raw;
        if(entry.owner&&owner) {
          const {snapshot}=snapshotFromInspect({version:1,observer:bundle.observer,player:{...owner,properties:{},last_seen_at:owner.captured_at,profile_captured_at:owner.captured_at}},catalog!);
          const mapped=captureGearSnapshot(owner.gear,catalog!);snapshot.source='self';snapshot.gear=mapped.gear;
          if(mapped.unresolved.length)this.logger.warn(`owner: unresolved ${mapped.unresolved.slice(0,5).join(', ')}`);
          const fileSha256=createHash('sha256').update(JSON.stringify({observer:bundle.observer,owner})).digest('hex');
          const stored=pioneer?await this.pioneer!.store(snapshot,{scan:bundle.export_metadata.scan!,collectorUid:owner.uid,fileHash:fileSha256,ipHash})
            :await this.store!.store(snapshot,{kind:'inspect',fileSha256,exporterName:bundle.export_metadata.exporter_name,exporterVersion:bundle.export_metadata.exporter_version,ipHash});
          const status=stored.duplicate?'repeated':'new';
          if(stored.duplicate)result.duplicates++;else result.stored++;
          result.players.push({uid:owner.uid,name:owner.name,gear:snapshot.gear.length,status});
          continue;
        }
        const player=playerSchema.parse(raw);
        const payload={version:1,observer:bundle.observer,server_utc_offset_minutes:bundle.server_utc_offset_minutes,player} as unknown as InspectPayload;
        const {snapshot,unresolved}=snapshotFromInspect(payload,catalog!);
        if(unresolved.length)this.logger.warn(`player ${index}: unresolved ${unresolved.slice(0,5).join(', ')}`);
        // One fingerprint per player profile: re-uploading the same bundle stores nothing new.
        const fileSha256=createHash('sha256').update(JSON.stringify({observer:bundle.observer,player})).digest('hex');
        const stored=pioneer
          ?await this.pioneer!.store(snapshot,{scan:player.scan??bundle.export_metadata.scan!,collectorUid:bundle.observer.uid,fileHash:fileSha256,ipHash})
          :await this.store!.store(snapshot,{kind:'inspect',fileSha256,
            exporterName:bundle.export_metadata.exporter_name,exporterVersion:bundle.export_metadata.exporter_version,ipHash});
        const status=stored.duplicate?'repeated':'new';
        if(stored.duplicate)result.duplicates++;else result.stored++;
        result.players.push({uid:player.uid,name:player.name,gear:snapshot.gear?.length??0,status});
      } catch(error) {
        result.rejected++;
        const rawAny=entry.raw as Record<string,unknown>|null;
        const fallbackName=typeof rawAny?.name==='string'?rawAny.name:(entry.owner?owner?.name??null:null);
        const fallbackUid=typeof rawAny?.uid==='string'?rawAny.uid:(entry.owner?owner?.uid??null:null);
        result.players.push({uid:fallbackUid,name:fallbackName,gear:0,status:'rejected'});
        this.logger.warn(`player ${index}: rejected (${error instanceof Error?error.name:'storage error'})`);
      }
    }
    if(!pioneer) {
      this.pioneer?.invalidateGlobal();
      if(result.stored > 0) {
        await this.cache?.bumpRevision();
      }
    }
    return result;
  }
}
