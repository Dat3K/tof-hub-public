import {captureOrigin,canSaveBuildCapture,canPublishGearCapture} from '@tof-hub/contracts';
import {Toast} from '@tof-hub/ui';
import {localeText} from '@/lib/i18n/text';
import type {BuildDraft,BuildLocale} from './types';

export function restrictedCaptureOrigin(draft:BuildDraft):'pioneer-server'|'test-server'|'unknown-server'|'incomplete-capture'|null {
  if(draft.captureSource?.capture.capture.scan?.distribution==='global-pioneer')return 'pioneer-server';
  if(canSaveBuildCapture(draft.captureSource?.capture.capture.scan))return null;
  if(canPublishGearCapture(draft.captureSource?.capture.capture.scan))return 'incomplete-capture';
  const origin=captureOrigin(draft.captureSource?.capture.capture.scan);
  return origin==='test'?'test-server':origin==='unknown'?'unknown-server':null;
}
/** `distribution`: the scan's detected client, so a Korea or Taiwan DEV client is named as such. */
export function captureOriginLabel(origin:'pioneer-server'|'test-server'|'unknown-server'|'incomplete-capture',locale:BuildLocale,presentation:'page'|'export'='export',distribution?:string):string {
  if(origin==='unknown-server'&&presentation==='page')return '';
  const t=localeText(locale);
  if(origin==='incomplete-capture')return t('Incomplete capture');
  if(origin==='test-server'&&distribution==='korea-dev')return t('Korea DEV client');
  if(origin==='test-server'&&distribution==='taiwan-dev')return t('Taiwan DEV client');
  return origin==='pioneer-server'?'Global Pioneer · DEV':origin==='test-server'?t('Test server · DEV'):t('Unresolved capture');
}
/** Shared by Build and Optimizer; the unresolved-source label appears only at export. */
export function CaptureOriginNotice({draft,locale}:{draft:BuildDraft;locale:BuildLocale}) {
  const origin=restrictedCaptureOrigin(draft),scan=draft.captureSource?.capture.capture.scan;
  if(draft.demo||!scan||!origin)return null;
  const t=localeText(locale);
  const label=origin?captureOriginLabel(origin,locale,'page',scan.distribution):'';
  return <Toast eventKey={[scan.scanId,scan.status,origin,locale].join(':')} duration={10000}><div className="flex flex-col gap-1" data-capture-origin={origin??'live'}>
    {label&&<strong>{label}</strong>}
    {origin&&<span>{origin==='incomplete-capture'?t('Gear is included in Ranking. The unfinished capture cannot verify or save a build card.'):origin==='pioneer-server'?t('Gear contributes to the separate Pioneer ranking. Build saving is unavailable.'):t('Viewing and calculations only. Saving and publishing to Ranking are unavailable.')}</span>}
  </div></Toast>;
}
