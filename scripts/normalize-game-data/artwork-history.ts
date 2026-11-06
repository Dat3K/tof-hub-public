import fs from 'node:fs';
import {ArtworkDiscoveryHistorySchema, type ArtworkDiscoveryHistory} from '../../packages/contracts/src/datasets/arts-dataset';

export function readArtworkHistory(file: string): ArtworkDiscoveryHistory | undefined {
  if (!fs.existsSync(file)) return;
  const value = JSON.parse(fs.readFileSync(file, 'utf8'));
  const history = value.discoveryHistory ?? (value.entries ? value : undefined);
  return history ? ArtworkDiscoveryHistorySchema.parse(history) : undefined;
}

export function artworkIdentity(item: {sourcePath?: string; id: string}): string {
  const source = item.sourcePath?.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').replace(/^Content\//i, 'Hotta/Content/');
  return source ? source.toLowerCase() : `id:${item.id.toLowerCase()}`;
}

/** Catalog observations, not inferred game release dates. Removed paths remain known. */
export function trackArtworkDiscoveries(items: {id: string; sourcePath?: string}[], previous?: ArtworkDiscoveryHistory, version: string | null = null) {
  const entries = {...previous?.entries};
  const added = items.filter(item => !entries[artworkIdentity(item)]);
  const revision = previous ? previous.revision + (added.length > 0 ? 1 : 0) : 0;
  for (const item of added) entries[artworkIdentity(item)] = {revision, version: previous ? version : null};
  const history: ArtworkDiscoveryHistory = {revision, entries};
  return {
    history,
    metadata: (item: {id: string; sourcePath?: string}) => {
      const entry = entries[artworkIdentity(item)];
      return {addedInRevision: entry.revision, addedInVersion: entry.version, isNew: revision > 0 && entry.revision === revision};
    },
  };
}
