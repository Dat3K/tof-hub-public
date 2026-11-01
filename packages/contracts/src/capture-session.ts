import {z} from 'zod';

const time=z.string().datetime({offset:true});
const IPV4='(?:25[0-5]|2[0-4]\\d|1?\\d?\\d)(?:\\.(?:25[0-5]|2[0-4]\\d|1?\\d?\\d)){3}';
const address=z.string().regex(new RegExp(`^${IPV4}$`)),endpoint=z.string().regex(new RegExp(`^${IPV4}:\\d{1,5}$`));
/** Capture boundaries and client provenance, independent of the collector's DEV/USER flavor. */
export const CaptureSessionSchema=z.object({
  scanId:z.string().uuid(),
  source:z.enum(['native','replay']),
  environment:z.enum(['live','test','unknown']),
  environmentSource:z.enum(['manual','verified-rule','unknown']),
  /** Client family is independent of UID/region: Pioneer can reuse live server ids. */
  distribution:z.enum(['global-live','global-pioneer','taiwan-live','taiwan-dev','korea-dev','unknown']).optional(),
  /**
   * Client read from the running game's install by the collector (2026-10-10): updater branch/app/CDN and versions, no
   * paths. `verified` only when the resource branch, app PatcherConfig, CDN and launcher channel form one known pair.
   */
  install:z.object({status:z.enum(['verified','conflict','unknown']),
    distribution:z.enum(['global-live','global-pioneer','taiwan-live','taiwan-dev','korea-dev','unknown']),
    resourceBranch:z.string().max(64).nullable(),launcherBranch:z.string().max(64).nullable(),appId:z.string().max(64).nullable(),
    cdn:z.enum(['global','taiwan']).nullable(),appVersion:z.string().max(64).nullable(),resVersion:z.string().max(64).nullable(),
    reasons:z.array(z.string().max(200)).max(10)}).strict().optional(),
  /** General machine configuration, without host/user names, addresses or hardware identifiers. */
  pc:z.object({platform:z.string().min(1).max(32),architecture:z.string().min(1).max(32),osVersion:z.string().min(1).max(120),
    cpuModel:z.string().max(120).nullable(),logicalCores:z.number().int().min(1).max(4096),memoryMiB:z.number().int().min(1).max(268435456)}).strict().optional(),
  /**
   * Game servers of the current login (capture app 1.3+): `gateway` is the remote end of the TCP login connection,
   * `zone` the world endpoint from the zone-session packet (opcode 1121), both IPv4 `address:port`; `player` the PC's
   * own IPv4 address on that connection (behind a router usually a LAN address, not the public one).
   */
  servers:z.object({gateway:endpoint.nullable(),zone:endpoint.nullable(),player:address.nullable().optional(),observedAt:time}).strict().optional(),
  launcher:z.object({name:z.string().min(1).max(120).nullable(),source:z.enum(['manual','verified-rule','unknown'])}).strict(),
  client:z.object({processName:z.string().max(120).nullable(),fileVersion:z.string().max(120).nullable(),
    parentNames:z.array(z.string().max(120)).max(8)}).strict(),
  startedAt:time.nullable(),finishedAt:time.nullable(),
  status:z.enum(['idle','capturing','completed','interrupted']),
}).strict().superRefine((scan,ctx)=>{
  if(scan.environment!=='unknown'&&scan.environmentSource==='unknown')ctx.addIssue({code:'custom',message:'Environment needs provenance'});
  if(scan.distribution&&['global-pioneer','taiwan-dev','korea-dev'].includes(scan.distribution)&&scan.environment!=='test')ctx.addIssue({code:'custom',message:'Development client needs test environment'});
  // A verified test client can never be a live scan.
  if(scan.install?.status==='verified'&&['global-pioneer','taiwan-dev','korea-dev'].includes(scan.install.distribution)&&scan.environment!=='test')
    ctx.addIssue({code:'custom',message:'Detected test client needs test environment'});
  if(scan.status==='completed'&&(!scan.startedAt||!scan.finishedAt))ctx.addIssue({code:'custom',message:'Completed scan needs both boundaries'});
  if(scan.status!=='completed'&&scan.finishedAt!==null)ctx.addIssue({code:'custom',message:'Only completed scans have a confirmed finish'});
  if(scan.finishedAt&&scan.startedAt&&Date.parse(scan.finishedAt)<Date.parse(scan.startedAt))ctx.addIssue({code:'custom',message:'Scan ends before it starts'});
});
export type CaptureSession=z.infer<typeof CaptureSessionSchema>;
export type CaptureOrigin='legacy'|'live'|'test'|'unknown';
/**
 * Collectors up to 1.2 knew only `HTIntlOB` for Global Live and recorded other store launchers (Steam `HTIntlSteam`, an
 * Epic build likewise; same `OBPC_*` branch, app 1000129, global CDN) as an install conflict with an unresolved
 * environment. Read exactly that conflict as the verified Global Live install current collectors report (Pioneer's
 * `HTIntlPTR` never qualifies); the file itself keeps its raw provenance.
 */
export function resolveCaptureScan<Scan extends CaptureSession|undefined>(scan:Scan):Scan {
  const install=scan?.install,channel=install?.launcherBranch??'';
  if(!scan||!install||install.status!=='conflict'||!/^HTIntl[A-Za-z]{1,32}$/.test(channel)||channel==='HTIntlPTR'||install.appId!=='1000129'||install.cdn!=='global'
    ||!/^OBPC_\d+(?:_\d+)*$/.test(install.resourceBranch??'')||install.reasons.length!==1
    ||install.reasons[0]!==`launcher channel ${channel} contradicts the resource branch`
    ||scan.distribution||scan.environment==='test')return scan;
  return {...scan,install:{...install,status:'verified',distribution:'global-live',reasons:[]},distribution:'global-live',
    ...(scan.environment==='unknown'?{environment:'live',environmentSource:'verified-rule'}:{})};
}
/** Legacy exports keep their existing behavior; new unresolved or unfinished captures are view-only. */
export function captureOrigin(scan:CaptureSession|undefined):CaptureOrigin {
  scan=resolveCaptureScan(scan);
  if(!scan)return 'legacy';
  if(scan.environment==='test')return 'test';
  return scan.environment==='live'&&scan.environmentSource!=='unknown'&&(scan.status==='completed'||scan.status==='capturing')?'live':'unknown';
}
export function canPublishCapture(scan:CaptureSession|undefined):boolean {
  const origin=captureOrigin(scan);return origin==='live'||origin==='legacy';
}
/** Gear observations remain useful regardless of whether recording has finished. Client pools stay isolated. */
export function canPublishGearCapture(scan:CaptureSession|undefined):boolean {
  scan=resolveCaptureScan(scan);
  return !scan||(scan.environment==='live'&&scan.environmentSource!=='unknown'&&!isBlockedCaptureClient(scan));
}
/** A complete card needs a completed recording; gear ingestion has its own independent policy. */
export function canSaveBuildCapture(scan:CaptureSession|undefined):boolean {
  scan=resolveCaptureScan(scan);
  return !scan||(scan.environment==='live'&&scan.environmentSource!=='unknown'&&scan.status==='completed');
}
export function isBlockedCaptureClient(scan:CaptureSession|undefined):boolean {
  return scan?.distribution==='taiwan-dev'||scan?.distribution==='korea-dev';
}
export function isPioneerCapture(scan:CaptureSession|undefined):boolean {
  return scan?.distribution==='global-pioneer'&&scan.environment==='test'&&scan.environmentSource!=='unknown';
}
