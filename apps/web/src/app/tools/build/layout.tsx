import { localeText } from '@/lib/i18n/text';
import type {Metadata} from 'next';
import type {ReactNode} from 'react';
import {resolveServerLocale} from '@/lib/i18n/server';
import {buildMetadata} from '@/lib/seo';

export async function generateMetadata():Promise<Metadata> {
  const {locale}=await resolveServerLocale();
  return buildMetadata({title:'Build card',description:localeText(locale)('Tower of Fantasy build card editor.', 'Редактор карточки билда Tower of Fantasy.'),path:'/tools/build/'});
}
export default function Layout({children}:{children:ReactNode}) {return <>{children}</>;}
