import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {Prisma,type PrismaClient} from '@prisma/client';
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

/** API startup waits for this. Scores and their revision commit together, or all changes roll back. */
export async function ensureCurrentPlayerScores(prisma:PrismaClient,catalog:ScoringCatalog,fingerprint=scoringFingerprint(catalog)) {
  return prisma.$transaction(async tx=>{
    // Startup maintenance is not reachable from an HTTP request; allow its documented 30-minute rescore.
    await tx.$executeRaw`SET LOCAL statement_timeout = '30min'`;
    // Serializes simultaneous worker starts, including the first deployment without a revision row.
    await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(724019032)`);
    const id='live-players',previous=await tx.scoringRevision.findUnique({where:{id}});
    if(previous?.fingerprint===fingerprint)return {rescored:false,players:0,gear:0};
    const service=new PlayerStoreService(new PrismaPlayerStoreRepository(tx),catalog);
    const result=await service.rescoreAll();
    await tx.scoringRevision.upsert({where:{id},create:{id,fingerprint},update:{fingerprint}});
    await tx.$executeRaw(
      Prisma.sql`INSERT INTO scoring_revisions (id, fingerprint, updated_at)
        VALUES ('ranking:players', '1', NOW())
        ON CONFLICT (id) DO UPDATE
        SET fingerprint = (scoring_revisions.fingerprint::bigint + 1)::text, updated_at = NOW()`
    ).catch(()=>{});
    return {rescored:true,...result};
  },{timeout:30*60_000,maxWait:30*60_000});
}
