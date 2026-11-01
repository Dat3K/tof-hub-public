import type {BuildDraft} from './types';

/** Appearance, RV display, the enemy level and the header role do not change imported player data
 * (the same exclusions as the PNG check in card-verification.ts). */
export function markCaptureEdit(previous:BuildDraft,next:BuildDraft):void {
  if(next.captureSource?.kind!=='file')return;
  const data=(draft:BuildDraft)=>{
    const {art,rv,updatedAt,captureSource,enemyLevel,...fields}=draft;
    void art;void rv;void updatedAt;void captureSource;void enemyLevel;
    const {role,...profile}=fields.profile;void role;
    return {...fields,profile};
  };
  if(JSON.stringify(data(previous))!==JSON.stringify(data(next)))next.captureSource.kind='manual';
}
