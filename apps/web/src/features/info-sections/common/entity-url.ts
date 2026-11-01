export type EntityQuery = 'suit' | 'item' | 'outfit' | 'art';

/** Keep filters, put the entity where a server/social crawler can read it, and clear an old entity hash. */
export function setEntitySelection(url: URL, key: EntityQuery, id: string | null): void {
  for (const alias of key === 'item' ? ['dish', 'potion'] : key === 'art' || key === 'outfit' ? ['id'] : []) url.searchParams.delete(alias);
  if (id) url.searchParams.set(key, id);
  else url.searchParams.delete(key);
  url.hash = '';
}

export function replaceEntitySelection(key: EntityQuery, id: string | null): void {
  const url = new URL(window.location.href);
  setEntitySelection(url, key, id);
  window.history.replaceState(window.history.state, '', url.pathname + url.search);
}
