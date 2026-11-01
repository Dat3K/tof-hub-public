import {generatePageMetadata} from '@/lib/seo/server';
export async function generateMetadata({params}:{params:Promise<{uid:string;slot?:string}>}) {
  const {uid,slot}=await params;
  return generatePageMetadata(`/tools/build/${encodeURIComponent(uid)}/${''}`);
}

import {notFound} from 'next/navigation';
import {BuildPage} from '@/features/build/build-page';
import {loadBuildCatalog} from '../catalog';

/** Saved profiles of a character UID: opens its first profile, the bar below the card switches between them. */
export default async function Page({params}:{params:Promise<{uid:string}>}) {
  const {uid}=await params;
  if(!/^\d{6,20}$/.test(uid))notFound();
  const catalog=await loadBuildCatalog();
  if(catalog.schemaVersion!==1)throw new Error('Unsupported build catalog version');
  return <BuildPage catalog={catalog} profile={{uid,slot:null}}/>;
}
