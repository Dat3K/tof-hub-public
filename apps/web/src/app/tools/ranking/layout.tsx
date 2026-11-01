import { localeText } from '@/lib/i18n/text';
import type {Metadata} from 'next';
import type {ReactNode} from 'react';
import {resolveServerLocale} from '@/lib/i18n/server';
import {buildMetadata} from '@/lib/seo';

export async function generateMetadata():Promise<Metadata> {
  const {locale}=await resolveServerLocale();
  return buildMetadata({title:'Rankings',
    description:localeText(locale)('Best Tower of Fantasy gear and builds ranking by Global Roll Value for every element and element pair.', 'Рейтинг лучших вещей и билдов Tower of Fantasy по Global Roll Value для каждой стихии и пары стихий.'),path:'/tools/ranking/'});
}
export default function Layout({children}:{children:ReactNode}) {return <>{children}</>;}
