'use client';

import { localeText } from '@/lib/i18n/text';
import {useEffect, useState} from 'react';
import {Button, LoadingState} from '@tof-hub/ui';
import {fetchGameData} from '@/lib/game-data-client/loader';
import {gameDataCache} from '@/lib/game-data-client/cache';
import {runtimeDetailPath} from '@/lib/game-data-runtime';

/** Detail files share the existing tab cache; stale selections never replace the active entity. */
export function useRuntimeDetail<T extends object>(item:T|null,locale:string) {
  const path = runtimeDetailPath(item);
  const key = `${locale}:${path}`;
  const [state,setState] = useState<{key:string;data:T|null;error:Error|null}>({key:'',data:null,error:null});
  const [attempt,setAttempt] = useState(0);
  const cached = path ? gameDataCache.getResolved<T>(locale,path) : undefined;
  useEffect(()=>{
    if (!path || cached) return;
    let cancelled = false;
    fetchGameData<T>(locale,path).then(data=>{
      if (!cancelled) setState({key,data,error:null});
    }).catch(error=>{
      if (!cancelled) setState({key,data:null,error:error instanceof Error ? error : new Error(String(error))});
    });
    return ()=>{cancelled=true;};
  },[path,locale,key,cached,attempt]);
  const data = !path ? item : cached || (state.key === key ? state.data : null);
  const error = path && state.key === key ? state.error : null;
  const retry = ()=>{
    if (path) gameDataCache.delete(locale,path);
    setState({key,data:null,error:null});
    setAttempt(value=>value+1);
  };
  return {data,error,isLoading:Boolean(path && !data && !error),retry};
}

export function RuntimeDetailStatus({detail,locale,onClose}:{
  detail:{isLoading:boolean;error:Error|null;retry:()=>void};locale:string;onClose:()=>void;
}) {
  const t = localeText(locale);
  if (detail.isLoading) return <LoadingState fullPage message={t('Loading details…', 'Загрузка данных…')} />;
  return <div role="alert">
    <p>{t('Could not load details.', 'Не удалось загрузить данные.')}</p>
    <Button onClick={detail.retry}>{t('Retry', 'Повторить')}</Button>
    <Button onClick={onClose}>{t('Back to catalog', 'Вернуться к каталогу')}</Button>
  </div>;
}
