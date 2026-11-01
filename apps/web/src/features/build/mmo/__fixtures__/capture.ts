import {BuildCaptureSchema} from '@tof-hub/contracts';
import base from '../../../../../../../packages/contracts/src/__fixtures__/build-capture.json';
import {scanFixture} from '../../../../../../../packages/contracts/src/__fixtures__/scan-session';
import mmo from './observation-mmo-capture.json';
const {$comment:comment,...snapshot}=mmo;void comment;

/** Full import contract for regression tests; gameplay fields come from the existing stripped MMO fixture. */
export const fullMmoCapture=BuildCaptureSchema.parse({...base,...snapshot,
  capture:{...base.capture,...mmo.capture,exporterVersion:'2.0.0',scan:scanFixture('test')},
  combat:{...base.combat,...mmo.combat},
  gear:mmo.gear.map(piece=>({...piece,enhancement:0,stars:0,stats:piece.stats.map(stat=>({...stat,tag:'None'}))})),
});
