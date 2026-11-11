'use client';

import dynamic from 'next/dynamic';
import {Button,EmptyState} from '@tof-hub/ui';
import {useI18n} from '@/lib/i18n';
import {useGameData} from '@/lib/game-data-client';
import {RouteLoading} from '@/components/site-shell/route-loading';
import type {HandbookTitanData} from '@/features/datamine/contracts/handbook';
import type {TitanCatalog} from './weapon-match';

const TitanCalculatorView=dynamic(()=>import('./titan-calculator-view').then(module=>module.TitanCalculatorView),{loading:RouteLoading});

export function TitanCalculatorPage({catalog, hasExampleMedia}:{catalog:TitanCatalog; hasExampleMedia:boolean}) {
  const {t}=useI18n();
  const source=useGameData<HandbookTitanData>('titan',{namespace:'handbook'});
  if(source.error)return <EmptyState title={t('common.status.error.title')} action={<Button onClick={()=>{void source.reload().catch(()=>{});}}>{t('common.retry')}</Button>}/>;
  if(!source.data)return <RouteLoading/>;
  return <TitanCalculatorView data={source.data} catalog={catalog} hasExampleMedia={hasExampleMedia}/>;
}
