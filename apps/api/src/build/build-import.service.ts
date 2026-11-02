import {prepareJsonImport} from '../import/json-import';
import {UploadViolation} from '../security/abuse.service';
import {BadRequestException,Inject,Injectable,Logger,type OnModuleInit,Optional,ServiceUnavailableException} from '@nestjs/common';
import {JobQueueService,hashIp,withQueueDelivery} from '../queue/job-queue.service';
import {constants,createHash,sign} from 'node:crypto';
import {BuildCaptureSchema,canonicalPlayerUid,canonicalJson,SEALED_FILES,canSaveBuildCapture,isBlockedCaptureClient,playerServerRefusal,resolvePlayerServer,type BuildCapture} from '@tof-hub/contracts';
import {PioneerService} from '../ranking/pioneer/pioneer.service';
import {decryptEnvelope,IMPORT_KEY_ID,importPublicKeyInfo,loadImportKey,sealedEnvelopeSchema} from '../import/sealed-envelope';
import {PLAYER_STORE} from '../players/players.module';
import type {PlayerStoreService} from '../players/player-store.service';
import {snapshotFromCapture} from '../players/capture-snapshot';
import {loadScoringCatalog} from '../players/scoring-catalog';
import {TestAccountsService} from '../players/test-accounts.service';
import {NegativeCombatScoreService} from '../players/negative-combat-score.service';
import {PwgIdentityService} from '../players/pwg-identity.service';
import {buildGearDestination,legacyBuildGear,outdatedCaptureApp} from '../import/capture-import-policy';
import {RankingCacheService} from '../ranking/cache/ranking-cache.service';
import {RankingCacheWarmupService} from '../ranking/cache/ranking-cache-warmup.service';
import {NotificationsService} from '../notifications/notifications.service';
import {normalizeIp} from '../wish/wish-query.validation';

const envelopeSchema=sealedEnvelopeSchema('build');

/** Domain prefix for the capture-digest signature; the web card verifier uses the same string. */
export const BUILD_CAPTURE_SIGNATURE_CONTEXT='tof-hub-build-capture:1:';

/** Small private history record; the full card, inventory and signature stay with the import response only. */
export function buildImportQueueSummary(result:Awaited<ReturnType<BuildImportService['import']>>) {
  return {
    success:result.success,
    uid:result.uid,
    name:result.name,
    region:result.region,
    server:result.server,
    gear:result.data.gear.length,
  };
}

@Injectable()
export class BuildImportService implements OnModuleInit {
  private readonly privateKey=loadImportKey();
  private readonly logger=new Logger('BuildImport');
  constructor(
    @Optional() @Inject(PLAYER_STORE) private readonly store:PlayerStoreService|null=null,
    @Optional() @Inject(JobQueueService) private readonly queue:JobQueueService|null=null,
    @Optional() @Inject(PioneerService) private readonly pioneer:PioneerService|null=null,
    @Optional() @Inject(TestAccountsService) private readonly testAccounts:TestAccountsService|null=null,
    @Optional() @Inject(NegativeCombatScoreService) private readonly negativeCs:NegativeCombatScoreService|null=null,
    @Optional() @Inject(PwgIdentityService) private readonly pwgIdentities:PwgIdentityService|null=null,
    @Optional() @Inject(RankingCacheService) private readonly rankingCache:RankingCacheService|null=null,
    @Optional() @Inject(RankingCacheWarmupService) private readonly warmup:RankingCacheWarmupService|null=null,
    @Optional() @Inject(NotificationsService) private readonly notifications:NotificationsService|null=null,
  ) {}
  onModuleInit() {this.queue?.register('build-import',async(payload,{ip})=>{
    const result=await this.import(JSON.parse(payload.toString('utf8')),ip);
    // Refusals travel with the card: the browser reads the delivery, not the summary, and says why nothing was stored.
    return withQueueDelivery(buildImportQueueSummary(result),{data:result.data,...(result.inventory?{inventory:result.inventory}:{}),source:result.source,
      ...(result.serverRefusal?{serverRefusal:result.serverRefusal}:{}),...(result.outdatedExporter?{outdatedExporter:result.outdatedExporter}:{})});
  });}
  getPublicKey() {return importPublicKeyInfo(this.privateKey);}
  /** The size limit, the envelope schema and the key: answered before the work is queued and again inside it. */
  private envelope(body:unknown) {
    body=prepareJsonImport('build',body,this.privateKey);
    if(Buffer.byteLength(JSON.stringify(body??null))>SEALED_FILES.build.maxBytes)throw new UploadViolation('Build file exceeds 1 MiB');
    const parsed=envelopeSchema.safeParse(body);
    if(!parsed.success)throw new UploadViolation('Invalid .tofbuild envelope or key');
    if(parsed.data.key_id!==IMPORT_KEY_ID)throw new BadRequestException('The file was sealed for another site key; export it again');
    return parsed.data;
  }
  /** POST /build/import: the envelope is checked at once; decryption, storing and signing wait in the shared queue. */
  async enqueue(body:unknown,ip:string) {
    if(!this.privateKey||!this.queue)throw new ServiceUnavailableException('Build import is not configured');
    return this.queue.enqueue('build-import',Buffer.from(JSON.stringify(this.envelope(body))),ip);
  }
  /** The queued work (also callable directly). */
  async import(body:unknown,ip='') {
    if(!this.privateKey)throw new ServiceUnavailableException('Build import is not configured');
    const envelope=this.envelope(body);
    let payload:unknown;
    try {payload=decryptEnvelope(envelope,this.privateKey,768*1024);}catch {throw new UploadViolation('Invalid encrypted build file');}
    const capture=BuildCaptureSchema.safeParse(payload);
    // Valid encryption authenticates the envelope bytes, not the sender/game facts. New exporters can change schema.
    if(!capture.success)throw new BadRequestException({code:'INCOMPATIBLE_CAPTURE',message:'The capture data format is not supported. Update the site and capture app, then export again.'});
    const subject=capture.data.capture.subject;
    if(subject.uid)subject.uid=canonicalPlayerUid(subject.uid,{roleId:subject.roleId});
    await this.negativeCs?.observe([{uid:capture.data.capture.subject.uid,cs:capture.data.profile.cs,
      scan:capture.data.capture.scan,capturedAt:capture.data.capture.capturedAt}],
      {kind:'build',fileHash:createHash('sha256').update(JSON.stringify(payload)).digest('hex')});
    await this.testAccounts?.observe([{uid:capture.data.capture.subject.uid,roleId:capture.data.capture.subject.roleId,
      nickname:capture.data.profile.name,scan:capture.data.capture.scan,capturedAt:capture.data.capture.capturedAt}],
      {kind:'build',fileHash:createHash('sha256').update(JSON.stringify(payload)).digest('hex')});
    // Taiwan and Korea DEV clients: the card is shown (the page marks the DEV client), nothing is stored or ranked.
    // Their participation is already recorded above (test accounts).
    const devClient=isBlockedCaptureClient(capture.data.capture.scan);
    // Buffs describe the observed login state; they do not invalidate a profile import.
    // Duplicate slots would otherwise overwrite one another during mapping.
    for(const keys of [capture.data.weapons.map(x=>x.slot),capture.data.gear.map(x=>x.slotKey),
      capture.data.matrices.map(x=>`${x.weaponSlot}:${x.slot}`),capture.data.relics.map(x=>x.slot)]) {
      if(new Set<string|number>(keys).size!==keys.length)throw new UploadViolation('Duplicate build slot');
    }
    await this.notifications?.acceptedImport('build',envelope,{uid:capture.data.capture.subject.uid,nickname:capture.data.profile.name});
    // The backpack goes back to the browser for the Optimizer only: never signed, stored or published with the card
    // (docs/imports.md: the full backpack is not stored).
    const {inventory,...card}=capture.data;
    const digest=createHash('sha256').update(canonicalJson(card)).digest('hex');
    // Unknown and Warp (MMO) live servers: the card is still returned for viewing, but nothing of it is stored.
    // Pioneer test captures keep their own test-client policy.
    const outdatedExporter=outdatedCaptureApp(card.capture.exporterVersion);
    const serverRefusal=buildGearDestination(card)==='pioneer'?null:playerServerRefusal({uid:card.capture.subject.uid});
    if(devClient) {/* view only */}
    else if(!serverRefusal) {
      if(card.pwg&&!this.pwgIdentities)throw new ServiceUnavailableException('PWG identity storage is not configured');
      await this.pwgIdentities?.remember(card,digest);
      await this.remember(card,digest,ip,inventory);
    }
    // A verified live MMO (Warp) card stores its player only: no gear, build or ranking for Warp.
    else if(card.mmo&&serverRefusal==='unsupported-game'&&buildGearDestination(card)==='live')await this.rememberMmo(card,digest,ip);
    // The browser checks this RSA-PSS signature on PNG export to mark a card unchanged since import.
    // One signature per import; verification needs only the public key.
    const signature=sign('sha256',Buffer.from(`${BUILD_CAPTURE_SIGNATURE_CONTEXT}${digest}`),
      {key:this.privateKey,padding:constants.RSA_PKCS1_PSS_PADDING,saltLength:32}).toString('base64url');
    const {server,regionCode}=resolvePlayerServer({uid:card.capture.subject.uid});
    return {
      success:true as const,
      data:card,
      ...(inventory?{inventory}:{}),
      source:{kind:'file' as const,digest,signature},
      uid:card.capture.subject.uid,
      name:card.profile.name,
      region:regionCode,
      server:server?.name??null,
      ...(serverRefusal?{serverRefusal}:{}),
      // Viewable, but its gear is not verified (buildGearDestination): the browser asks for a newer capture app.
      ...(outdatedExporter?{outdatedExporter}:{}),
    };
  }

  /** MMO player identity, profile and account counters (docs/imports.md); the card stays in the browser. */
  private async rememberMmo(capture:BuildCapture,digest:string,ip:string) {
    const catalog=loadScoringCatalog();
    if(!catalog||!this.store)throw new ServiceUnavailableException('Player storage is not configured');
    try {
      const {snapshot}=snapshotFromCapture(capture,catalog);
      delete snapshot.gear;delete snapshot.backpack;delete snapshot.build;
      await this.store.store(snapshot,{kind:'build-mmo',fileSha256:digest,exporterName:'tof-live-capture',exporterVersion:capture.capture.exporterVersion,
        ipHash:hashIp(ip),ip:normalizeIp(ip)==='unknown'?null:normalizeIp(ip)},{profileOnly:true});
    } catch(error) {
      this.logger.error(`Could not store the MMO capture (${error instanceof Error?error.name:'storage error'})`);
      throw new ServiceUnavailableException('Could not save the imported MMO player. Please retry the import.');
    }
  }

  /** Rankable cards update the player and gear before reporting successful import. */
  private async remember(capture:BuildCapture,digest:string,ip:string,inventory?:BuildCapture['inventory']) {
    const destination=buildGearDestination(capture),pioneer=destination==='pioneer',legacy=legacyBuildGear(capture);
    if(!destination)return;
    const catalog=loadScoringCatalog();
    if(!catalog||(!pioneer&&!this.store)||(pioneer&&!this.pioneer))throw new ServiceUnavailableException('Ranking storage is not configured');
    try {
      // Titan backpack pieces are offered to the ranking; the store keeps only those that beat known gear (ranking.md).
      const {snapshot,unresolved}=snapshotFromCapture(capture,catalog,inventory);
      if(legacy||!canSaveBuildCapture(capture.capture.scan))delete snapshot.build;
      if(unresolved.length)this.logger.warn(`Unresolved capture fields: ${unresolved.slice(0,10).join(', ')}`);
      if(pioneer)await this.pioneer?.store(snapshot,{scan:capture.capture.scan!,collectorUid:capture.capture.subject.uid,fileHash:digest,ipHash:hashIp(ip),
        ...(legacy?{legacyBuild:{exporterVersion:capture.capture.exporterVersion,exportedAt:capture.capture.exportedAt!}}:{})});
      else {
        await this.store!.store(snapshot,{kind:'build',fileSha256:digest,exporterName:'tof-live-capture',exporterVersion:capture.capture.exporterVersion,
          ipHash:hashIp(ip),ip:normalizeIp(ip)==='unknown'?null:normalizeIp(ip)});
        this.pioneer?.invalidateGlobal();
        await this.rankingCache?.bumpRevision();
      }
    } catch(error) {
      this.logger.error(`Could not store the build capture (${error instanceof Error?error.name:'storage error'})`);
      throw new ServiceUnavailableException('Could not save the imported gear to ranking. Please retry the import.');
    }
  }
}
