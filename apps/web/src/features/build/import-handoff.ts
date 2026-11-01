import type {BuildCapture,PlayerServerRefusal} from '@tof-hub/contracts';

/** The server's answer to `POST /api/v1/build/import`: the decrypted, signed card and what the site did not store. */
export interface BuildImportResult {
  data:BuildCapture;
  inventory?:BuildCapture['inventory'];
  source:{digest:string;signature?:string};
  serverRefusal?:PlayerServerRefusal;
  outdatedExporter?:string;
}
export type BuildImportPage='gacha'|'mmo';

/** MMO (Warp) characters have their own Build page and card model. */
export function buildImportPage(result:BuildImportResult):BuildImportPage {return result.data.mmo?'mmo':'gacha';}

/**
 * A `.tofbuild` imported on the other Build page (Gacha ↔ MMO): its server result moves to the right page through this
 * tab's session storage, so the file is not sent twice. The right page finishes the import once on arrival.
 */
const HANDOFF_KEY='tof-hub:build-import-handoff';
export const BUILD_IMPORT_ROUTES:Record<BuildImportPage,string>={gacha:'/tools/build/',mmo:'/tools/build/mmo/'};

export function stashBuildImport(result:BuildImportResult):boolean {
  try {sessionStorage.setItem(HANDOFF_KEY,JSON.stringify(result));return true;}catch {return false;}
}
export function takeBuildImport(page:BuildImportPage):BuildImportResult|null {
  try {
    const raw=sessionStorage.getItem(HANDOFF_KEY);if(!raw)return null;
    const result=JSON.parse(raw) as BuildImportResult;
    if(!result?.data?.capture||buildImportPage(result)!==page)return null;
    sessionStorage.removeItem(HANDOFF_KEY);
    return result;
  } catch {return null;}
}
