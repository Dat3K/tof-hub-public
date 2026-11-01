import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {isMmoProfileRole} from '@tof-hub/contracts';
import {buildMetadata} from '@/lib/seo';
import {MmoBuildPage} from '@/features/build/mmo/mmo-build-page';
import {loadMmoBuildCatalog} from '../../catalog';

export async function generateMetadata({params}:{params:Promise<{uid:string;role:string}>}):Promise<Metadata> {
  const {uid,role}=await params;
  return buildMetadata({title:`MMO build · ${uid}`,description:'A public Tower of Fantasy MMO (Warp) build card.',path:`/tools/build/mmo/${encodeURIComponent(uid)}/${encodeURIComponent(role)}/`});
}
/** One public MMO build: /tools/build/mmo/<uid>/<role>/ (dps, tank, healer or balance). */
export default async function Page({params}:{params:Promise<{uid:string;role:string}>}) {
  const {uid,role}=await params;
  if(!/^\d{6,20}$/.test(uid)||!isMmoProfileRole(role))notFound();
  return <MmoBuildPage catalog={await loadMmoBuildCatalog()} profile={{uid,role}}/>;
}
