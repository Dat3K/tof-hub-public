import type {PlayerTopEntry,TopGear} from './types';

/** Known originals also exist on inspected gear; this alone does not grant verification (provenance `self` is required). */
export const hasKnownBase=(gear:Pick<TopGear,'statsBeforeTitan'>)=>!!gear.statsBeforeTitan?.some(value=>value!==null);
export const hasKnownBuildBase=(gear:Pick<TopGear,'statsBeforeTitan'>[])=>gear.length>0&&gear.every(hasKnownBase);
/** The gold seal requires own .tofbuild provenance and known pre-Titan rolls, Titan or not (2026-10-10); unknown provenance fails closed. */
export const isVerifiedGear=(gear:Pick<TopGear,'source'|'statsBeforeTitan'>)=>gear.source==='self'&&hasKnownBase(gear);
export const isVerifiedBuild=(gear:Pick<TopGear,'source'|'statsBeforeTitan'>[])=>gear.length>0&&gear.every(isVerifiedGear);
/** The player badge records their own profile upload, not the provenance of a synthetic best set. */
export const isVerifiedPlayer=(entry:Pick<PlayerTopEntry,'verified'>)=>entry.verified===true;
