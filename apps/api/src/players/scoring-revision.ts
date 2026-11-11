import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type {PrismaClient} from '@prisma/client';
import type {Pool} from 'pg';
import {PlayerStoreService} from './player-store.service';
import {PrismaPlayerStoreRepository} from './prisma-player-store.repository';
import type {ScoringCatalog} from './scoring-catalog';

type Source={name:string;content:string};
/** Hash compiled runtime files, not a manually bumped version or file timestamps. */
function runtimeScoringSources():Source[] {
  const directory=path.dirname(require.resolve('@tof-hub/game-domain'));
  const sources:Source[]=[];
  const visit=(folder:string)=>{
    for(const entry of fs.readdirSync(folder,{withFileTypes:true})) {
      const file=path.join(folder,entry.name);
      if(entry.isDirectory())visit(file);
      else if(entry.isFile()&&entry.name.endsWith('.js')&&!/\.(test|spec)\.js$/.test(entry.name))sources.push({
        name:`game-domain/${path.relative(directory,file).replaceAll('\\','/')}`,content:fs.readFileSync(file,'utf8')});
    }
  };
  // Wish analytics and other tool domains do not affect stored gear/player ratings.
  // Build has no runtime imports outside this directory; its scoring dependencies remain fingerprinted.
  visit(path.join(directory,'build'));
  for(const name of ['player-store.service','prisma-player-store.repository','scoring-catalog','../ranking/best-tracks']) {
    const base=path.resolve(__dirname,name),file=fs.existsSync(base+'.js')?base+'.js':base+'.ts';
    const content=fs.readFileSync(file,'utf8');
    // This append writes only private nickname observations, never player/gear scores.
    // Keep all other repository code in the fingerprint; unmatched/multiline edits still trigger a rescore.
    const scoringContent=name==='prisma-player-store.repository'?content.replace(
      /^ *\/\/ Preserve capture dates separately[^\r\n]*\r?\n *await this\.client\.playerNameObservation\.createMany\([^\r\n]*\);\r?\n/m,''):content;
    sources.push({name:`api/${name}`,content:scoringContent});
  }
  return sources;
}

/** All scoring inputs plus the domain and persistence code; deployments cannot forget to bump this. */
export function scoringFingerprint(catalog:ScoringCatalog,sources:readonly Source[]=runtimeScoringSources()):string {
  const hash=createHash('sha256').update(JSON.stringify(catalog)).update('\0');
  for(const source of [...sources].sort((a,b)=>a.name.localeCompare(b.name)))hash.update(source.name).update('\0').update(source.content).update('\0');
  return hash.digest('hex');
}

/** Read-only check for API startup. A stale revision never blocks readiness; stored scores stay as they are. */
export async function isScoringRevisionCurrent(prisma:Pick<PrismaClient,'scoringRevision'>,catalog:ScoringCatalog,fingerprint=scoringFingerprint(catalog)) {
  const revision=await prisma.scoringRevision.findUnique({where:{id:'live-players'}});
  return revision?.fingerprint===fingerprint;
}

/**
 * Manual maintenance (rescore-players.ts), never API startup. There is no overall transaction or time limit: each player
 * commits alone, so the run can take hours on a slow server, and a rerun continues from the saved checkpoint.
 * The revision is recorded only after the last player. Until then rankings mix old and new scores.
 */
export async function ensureCurrentPlayerScores(prisma:PrismaClient,pool:Pick<Pool,'connect'>,catalog:ScoringCatalog,fingerprint=scoringFingerprint(catalog),{pauseMs=50,log=()=>{}}:{pauseMs?:number;log?:(message:string)=>void}={}) {
  // A session lock needs one held connection; the player transactions use other pool connections.
  const lock=await pool.connect();
  let locked=false;
  try {
    locked=(await lock.query('SELECT pg_try_advisory_lock(724019032) AS locked')).rows[0].locked;
    if(!locked)throw new Error('Another ranking rescore is already running.');
    const id='live-players',checkpointId='live-players:rescore';
    const previous=await prisma.scoringRevision.findUnique({where:{id}});
    if(previous?.fingerprint===fingerprint)return {rescored:false,players:0,gear:0};
    const checkpoint=(await prisma.scoringRevision.findUnique({where:{id:checkpointId}}))?.fingerprint.split('|');
    const afterId=checkpoint?.[0]===fingerprint?checkpoint[1]:undefined;
    if(afterId)log(`Continuing after player ${afterId}.`);
    // Player transactions skip per-piece revision writes; each saved batch publishes one for the ranking caches.
    const publish=new PrismaPlayerStoreRepository(prisma);
    const service=new PlayerStoreService(new PrismaPlayerStoreRepository(prisma,true),catalog);
    const result=await service.rescoreAll({afterId,pauseMs,onProgress:async({lastPlayerId,done,total})=>{
      const value=`${fingerprint}|${lastPlayerId}`;
      await prisma.scoringRevision.upsert({where:{id:checkpointId},create:{id:checkpointId,fingerprint:value},update:{fingerprint:value}});
      await publish.bumpRankingRevision();
      log(`${done}/${total} players rescored.`);
    }});
    await prisma.$transaction([
      prisma.scoringRevision.upsert({where:{id},create:{id,fingerprint},update:{fingerprint}}),
      prisma.scoringRevision.deleteMany({where:{id:checkpointId}}),
    ]);
    await publish.bumpRankingRevision();
    return {rescored:true,...result};
  } finally {
    if(locked)await lock.query('SELECT pg_advisory_unlock(724019032)').catch(()=>{});
    lock.release();
  }
}
