import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {buildMetadata} from '@/lib/seo';
import {MmoBuildPage} from '@/features/build/mmo/mmo-build-page';
import {loadMmoBuildCatalog} from '../catalog';

export async function generateMetadata({params}:{params:Promise<{uid:string}>}):Promise<Metadata> {
  const {uid}=await params;
  return buildMetadata({title:`MMO build · ${uid}`,description:'A public Tower of Fantasy MMO (Warp) build card.',path:`/tools/build/mmo/${encodeURIComponent(uid)}/`});
}
/** Public MMO builds of a character UID: opens its first role; the toolbar switches between roles. */
export default async function Page({params}:{params:Promise<{uid:string}>}) {
  const {uid}=await params;
  if(!/^\d{6,20}$/.test(uid))notFound();
  return <MmoBuildPage catalog={await loadMmoBuildCatalog()} profile={{uid,role:null}}/>;
}
