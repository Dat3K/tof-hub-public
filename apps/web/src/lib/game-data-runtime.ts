import { RUNTIME_DATASETS } from '@tof-hub/contracts';

/** Root datasets have pipeline-generated, minified runtime projections. */
export { RUNTIME_DATASETS };

export function runtimeDatasetName(dataset: string): string {
  return RUNTIME_DATASETS.has(dataset) || /^link-preview(?:s|-paths)(?:-[a-z-]+)?$/.test(dataset)
    ? `runtime/${dataset}` : dataset;
}

export function matchesRuntimeEntity(item: unknown, id: string): boolean {
  const row = item as {id?:string;slug?:string;canonical_id?:string};
  const target = id.toLowerCase();
  return [row.id,row.slug,row.canonical_id].some(value=>value?.toLowerCase() === target);
}

export function runtimeDetailPath(item: unknown): string | null {
  const value = (item as {_detail?:unknown} | null)?._detail;
  return typeof value === 'string' && /^runtime\/details\/[a-z-]+\/[a-f0-9]{24}$/.test(value) ? value : null;
}
