import {Prisma} from '@prisma/client';
import {ServerRegionCodeSchema,TOWER_OF_FANTASY_SERVERS,normalizeSearchText} from '@tof-hub/contracts';

function searchTerms(q:string) {
  const needle=q.toLowerCase();
  const servers=Object.values(TOWER_OF_FANTASY_SERVERS).filter(server=>server.id.startsWith(q)||server.name.toLowerCase().includes(needle)
    ||server.nativeName?.toLowerCase().includes(needle)).map(server=>server.id);
  const region=ServerRegionCodeSchema.safeParse(q.toUpperCase());
  return {q,name:normalizeSearchText(q),servers,region:region.success?region.data:null};
}

/** Current/former nickname, UID prefix, server name/id and region. Invisible nickname parts are normalized. */
export function playerSearch(q:string):Prisma.PlayerWhereInput {
  const {name,servers,region}=searchTerms(q);
  return {OR:[...(name?[{searchName:{contains:name}},{names:{some:{searchName:{contains:name}}}}]:[]),{uid:{startsWith:q}},
    ...(servers.length?[{serverId:{in:servers}}]:[]),...(region?[{region}]:[])]};
}

const likeLiteral=(text:string)=>text.replace(/[\\%_]/g,'\\$&');
/** Same terms for server-side numeric sorting; `p` is the players alias. All search text stays parameterized. */
export function playerSearchSql(q:string):Prisma.Sql {
  const {name,servers,region}=searchTerms(q);
  const conditions=[Prisma.sql`p.uid LIKE ${likeLiteral(q)+'%'}`];
  if(name) {
    const contains='%'+likeLiteral(name)+'%';
    conditions.push(Prisma.sql`p.search_name LIKE ${contains}`,
      Prisma.sql`EXISTS (SELECT 1 FROM player_names n WHERE n.player_id=p.id AND n.search_name LIKE ${contains})`);
  }
  if(servers.length)conditions.push(Prisma.sql`p.server_id IN (${Prisma.join(servers)})`);
  if(region)conditions.push(Prisma.sql`p.region=${region}`);
  return Prisma.sql`(${Prisma.join(conditions,' OR ')})`;
}
