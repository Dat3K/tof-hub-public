import {z} from 'zod';
import {PROFILE_ELEMENTS,PROFILE_ROLES,type ProfileSummary} from './build-profiles';
import {ServerRegionCodeSchema} from './wish/servers';

export const BuildProfileDirectoryQuerySchema=z.object({
  q:z.string().trim().max(40).default(''),region:ServerRegionCodeSchema.optional(),
  role:z.enum(PROFILE_ROLES).optional(),element:z.enum(PROFILE_ELEMENTS).optional(),
  // `name` remains accepted for bookmarks created before the paired sort options.
  sort:z.enum(['updated','updated-asc','name','name-asc','name-desc','builds','builds-asc']).default('updated'),
  offset:z.coerce.number().int().min(0).max(100_000).default(0),
  limit:z.coerce.number().int().min(1).max(50).default(30),
});
export type BuildProfileDirectoryQuery=z.infer<typeof BuildProfileDirectoryQuerySchema>;
export interface BuildProfileDirectoryEntry {
  uid:string;name:string|null;region:string|null;serverId:string|null;avatarId:string|null;avatarFrameId:string|null;
  updatedAt:string;profiles:ProfileSummary[];
}
export interface BuildProfileDirectoryResponse {
  available:boolean;entries:BuildProfileDirectoryEntry[];total:number;filtered:number;offset:number;limit:number;
}
