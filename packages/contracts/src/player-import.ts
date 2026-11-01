import {z} from 'zod';
import {BuildCaptureSchema} from './build-capture';
import {CaptureSessionSchema} from './capture-session';
import {canonicalPlayerUid} from './wish/servers';
const MAX_PLAYERS=5000;
export const PlayerImportOwnerSchema=z.object({uid:z.string().regex(/^\d{6,24}$/),role_id:z.string().regex(/^\d{1,24}$/),name:z.string().max(64).nullable(),
    level:z.number().nullable(),cs:z.number().nullable(),max_cs:z.number().nullable(),guild:z.string().max(64).nullable(),title:z.string().max(64).nullable(),
    captured_at:z.string().datetime({offset:true}),gear:BuildCaptureSchema.shape.gear}).passthrough()
  .transform(row=>{row.uid=canonicalPlayerUid(row.uid,{roleId:row.role_id});return row;});

export const PlayerImportEntrySchema=z.object({uid:z.string().max(32).nullable(),role_id:z.string().max(32).nullable(),name:z.string().max(64).nullable(),
  level:z.number().nullable(),cs:z.number().nullable(),max_cs:z.number().nullable(),guild:z.string().max(64).nullable(),title:z.string().max(64).nullable(),
  properties:z.record(z.string().max(80),z.unknown()),last_seen_at:z.string().max(40),profile_captured_at:z.string().max(40).nullable(),scan:CaptureSessionSchema.optional()}).passthrough()
  .transform(row=>{if(row.uid)row.uid=canonicalPlayerUid(row.uid,{roleId:row.role_id});return row;});
export const PlayerImportBundleSchema=z.object({version:z.literal(1),
  export_metadata:z.object({exporter_name:z.string().max(80),exporter_version:z.string().max(32),scan:CaptureSessionSchema.optional()}).passthrough(),
  observer:z.object({uid:z.string().max(32).nullable(),role_id:z.string().max(32).nullable(),server_id:z.string().max(16).nullable()})
    .transform(row=>{if(row.uid)row.uid=canonicalPlayerUid(row.uid,{roleId:row.role_id,serverId:row.server_id});return row;}),
  players:z.array(z.unknown()).max(MAX_PLAYERS),owner:PlayerImportOwnerSchema.nullable().optional(),
}).passthrough().refine(bundle=>bundle.players.length>0||!!bundle.owner,{message:'No profiles in the file'});

