import type {TemporaryAttackCatalog} from '@tof-hub/game-domain';
import type {CaptureImportCatalog} from './capture-import';

/** Generated catalogs that turn a signed capture into a card: the field mapping and the temporary ATK buffs (optional). */
export interface CaptureCatalogs {mapping:CaptureImportCatalog;temporary?:TemporaryAttackCatalog}

let loading:Promise<CaptureCatalogs>|null=null;

/**
 * Loads the capture catalogs once per page for the file import, saved profiles and the "Verified" check. A failed load
 * is forgotten, so the next import tries again.
 */
export function loadCaptureCatalogs():Promise<CaptureCatalogs> {
  loading??=Promise.all([
    fetch('/game-data/runtime/capture-card-map.json',{signal:AbortSignal.timeout(30000)}).then(response=>{
      if(!response.ok)throw new Error('The card import catalog is unavailable');
      return response.json() as Promise<CaptureImportCatalog>;
    }),
    fetch('/game-data/runtime/temporary-attack-effects.json',{signal:AbortSignal.timeout(30000)})
      .then(response=>response.ok?response.json() as Promise<TemporaryAttackCatalog>:undefined).catch(()=>undefined),
  ]).then(([mapping,temporary])=>({mapping,temporary})).catch(error=>{loading=null;throw error;});
  return loading;
}
