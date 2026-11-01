import { NextResponse } from 'next/server';
import { normalizeLocale } from '@tof-hub/i18n';
import { loadServerSimulacra } from '@/lib/game-data-server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ dataset: string; id: string }> }
) {
  const { dataset, id } = await params;
  if (dataset !== 'simulacra') {
    return NextResponse.json({ error: 'Unsupported dataset' }, { status: 404 });
  }

  const url = new URL(request.url);
  const locale = normalizeLocale(url.searchParams.get('locale'));
  const server = url.searchParams.get('server') === 'mmo' ? 'mmo' : 'gacha';
  const data = await loadServerSimulacra(locale, { throwOnNotFound: false, selectedId:id, selectedCollection:server });
  if (!data) {
    return NextResponse.json({ error: 'Simulacra dataset not found' }, { status: 404 });
  }

  const target = id.toLowerCase();
  const pool = server === 'mmo' ? data.mmo || [] : data.gacha || data.items || [];
  const all = [...pool, ...(data.items || []), ...(data.gacha || []), ...(data.mmo || [])];
  const item = all.find((candidate: any) =>
    [candidate.id, candidate.slug, candidate.canonical_id]
      .filter(Boolean)
      .some((value: unknown) => String(value).toLowerCase() === target)
  );

  if (!item) {
    return NextResponse.json({ error: 'Simulacra not found' }, { status: 404 });
  }

  return NextResponse.json(item, {
    headers: {
      // Catalog and detail payloads have different shapes. Caching this route
      // allowed an older compact response to survive after the detail schema
      // changed, especially on LAN origins.
      'Cache-Control': 'no-store',
    },
  });
}
