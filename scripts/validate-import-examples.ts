import fs from 'node:fs';
import {BuildCaptureSchema,PlayerImportBundleSchema,PlayerImportEntrySchema,WishImportV2PayloadSchema,RaidRankingDatasetSchema} from '@tof-hub/contracts';
import {deserializeSquadState} from '../apps/web/src/features/comp/codecs';

const read=(name:string):unknown=>JSON.parse(fs.readFileSync('examples/import/'+name+'.json','utf8'));
BuildCaptureSchema.parse(read('build'));
BuildCaptureSchema.parse(read('build-mmo'));
const players=PlayerImportBundleSchema.parse(read('players'));
players.players.forEach(player=>PlayerImportEntrySchema.parse(player));
WishImportV2PayloadSchema.parse(read('wish'));
RaidRankingDatasetSchema.parse(read('raid-rankings'));
if(!deserializeSquadState(JSON.stringify(read('comp'))))throw new Error('Invalid Comp example');
console.log('All public JSON examples pass their shared runtime schemas.');
