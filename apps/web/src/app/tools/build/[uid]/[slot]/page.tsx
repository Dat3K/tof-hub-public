import {generatePageMetadata} from '@/lib/seo/server';
export async function generateMetadata({params}:{params:Promise<{uid:string;slot?:string}>}) {
  const {uid,slot}=await params;
  return generatePageMetadata(`/tools/build/${encodeURIComponent(uid)}/${slot ? `${encodeURIComponent(slot)}/` : ''}`);
}

import {notFound} from 'next/navigation';
import {BuildPage} from '@/features/build/build-page';
import {loadBuildCatalog} from '../../catalog';
import {parseProfileSlot} from '@/features/build/profiles';

/** One saved profile: /tools/build/<uid>/<role>-<element>/ (for example dps-frost). */
export default async function Page({params}:{params:Promise<{uid:string;slot:string}>}) {
  const {uid,slot}=await params;
  if(!/^\d{6,20}$/.test(uid)||!parseProfileSlot(slot))notFound();
  const catalog=await loadBuildCatalog();
  if(catalog.schemaVersion!==1)throw new Error('Unsupported build catalog version');
  return <BuildPage catalog={catalog} profile={{uid,slot}}/>;
}
