'use client';

import dynamic from 'next/dynamic';
import {useMemo} from 'react';
import {Button, EmptyState} from '@tof-hub/ui';
import {useI18n} from '@/lib/i18n';
import {useGameData} from '@/lib/game-data-client';
import {RouteLoading} from '@/components/site-shell/route-loading';
import type {BuildCatalog, CharacterTitleStyle} from '@/features/build/types';
import type {OptimizerDemo} from '@/features/optimizer/model';

const Build = dynamic(()=>import('@/features/build/build-page').then(module=>module.BuildPage),{loading:RouteLoading});
const Optimizer = dynamic(()=>import('@/features/optimizer/optimizer-view').then(module=>module.OptimizerView),{loading:RouteLoading});

/** Interactive editors share the static browser catalog instead of serializing it through every SSR request. */
export function CatalogPage({tool}:{tool:'build'|'optimizer'}) {
  const {t} = useI18n();
  const source = useGameData<BuildCatalog>('build-page',{namespace:''});
  const titles = useGameData<{titles?:Record<string,CharacterTitleStyle>}>('build-title-styles',{namespace:'',enabled:tool==='build'});
  const demo = useGameData<OptimizerDemo>('optimizer-demo',{namespace:'',enabled:tool==='optimizer'});
  const catalog = useMemo(()=>source.data && titles.data?.titles ? {...source.data,titleStyles:titles.data.titles} : source.data,[source.data,titles.data]);
  const error = source.error || tool === 'optimizer' && demo.error;
  if (error) return <EmptyState title={t('common.status.error.title')}
    action={<Button onClick={()=>{void source.reload().catch(()=>{});if(tool==='optimizer')void demo.reload().catch(()=>{});}}>{t('common.retry')}</Button>}/>;
  if (!catalog || tool === 'optimizer' && !demo.data || tool === 'build' && titles.isLoading) return <RouteLoading/>;
  if (catalog.schemaVersion !== 1 || tool === 'optimizer' && demo.data?.schemaVersion !== 1) return <EmptyState title={t('common.status.error.title')}/>;
  return tool === 'build' ? <Build catalog={catalog}/> : <Optimizer catalog={catalog} demo={demo.data!}/>;
}
