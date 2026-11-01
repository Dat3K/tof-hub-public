import { localeText } from '@/lib/i18n/text';
import type {Metadata} from 'next';
import type {ReactNode} from 'react';
import {resolveServerLocale} from '@/lib/i18n/server';
import {buildMetadata} from '@/lib/seo';

export async function generateMetadata():Promise<Metadata> {
  const {locale}=await resolveServerLocale();
  return buildMetadata({title:'Optimizer',description:localeText(locale)('Compare personal gear value and damage after replacement and Titan transfer.', 'Сравнение гира по персональному PRV и урону после замены и переноса титана.'),path:'/tools/optimizer/'});
}
export default function Layout({children}:{children:ReactNode}) {return <>{children}</>;}
