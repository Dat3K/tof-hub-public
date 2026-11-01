import {createHash,randomUUID} from 'node:crypto';
import {gearChampions,type CurrentGearScoreInput} from '@tof-hub/game-domain';
import {PlayerSnapshotGearSchema,type PlayerSnapshot,type PlayerSnapshotGear,type CaptureSession} from '@tof-hub/contracts';
import type {ScoringCatalog} from '../../players/scoring-catalog';

export interface PioneerPiece {id:string;fingerprint:string;piece:PlayerSnapshotGear;observedAt:string;provenance:unknown;ownerNickname?:string|null;ownerRegion?:string|null;ownerServerId?:string|null}
export interface PioneerProvenance {scan:CaptureSession;collectorUid:string|null;fileHash:string;ipHash:string;legacyBuild?:{exporterVersion:string;exportedAt:string}}
export function pioneerInput(piece:PlayerSnapshotGear,catalog:ScoringCatalog):CurrentGearScoreInput|null {
  const allowedTypes=catalog.allowedStats[piece.slot];
  return allowedTypes?{rows:piece.stats,augments:piece.titan||piece.augmented?piece.augments:[],allowedTypes}:null;
}
/** Immutable observations, never a combination of different versions of one item's fields. */
export function pioneerObservations(snapshot:PlayerSnapshot,provenance:PioneerProvenance):PioneerPiece[] {
  return (snapshot.gear??[]).map(raw=>{
    const piece=PlayerSnapshotGearSchema.parse(raw);
    const fingerprint=createHash('sha256').update(JSON.stringify(piece)).digest('hex');
    return {id:randomUUID(),fingerprint,piece,observedAt:snapshot.capturedAt,
      provenance:{...provenance,ownerNickname:snapshot.player.nickname??null,ownerUid:snapshot.player.uid??null,ownerRoleId:snapshot.player.roleId??null,source:snapshot.source}};
  });
}
export function retainPioneer(existing:PioneerPiece[],incoming:PioneerPiece[],catalog:ScoringCatalog) {
  const pool=new Map(existing.map(piece=>[piece.fingerprint,piece]));
  for(const piece of incoming)if(!pool.has(piece.fingerprint))pool.set(piece.fingerprint,piece);
  const winners=gearChampions([...pool.values()],item=>item.piece.slot,item=>pioneerInput(item.piece,catalog),catalog.tracks,catalog.reference);
  const ids=new Set(winners.map(winner=>winner.piece.id));
  return {pieces:[...pool.values()].filter(piece=>ids.has(piece.id)),winners};
}
