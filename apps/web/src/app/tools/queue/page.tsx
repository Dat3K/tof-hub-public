import type {Metadata} from 'next';
import {buildMetadata} from '@/lib/seo';
import {QueueView} from '@/features/queue/queue-view';

export const metadata:Metadata=buildMetadata({
  title:'Processing queue',
  description:'The shared queue of ToF Hub: wish history imports, players uploads, build card imports and saved builds run one at a time.',
  path:'/tools/queue/',
});

export default function Page() {return <QueueView/>;}
