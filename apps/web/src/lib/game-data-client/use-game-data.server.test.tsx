// @vitest-environment node
import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { GameDataCache } from './cache';
import { useGameData } from './use-game-data';

function Probe({ cache, initialData }: { cache: GameDataCache; initialData: { name: string } }) {
  const { data } = useGameData<{ name: string }>('simulacra', { locale: 'en', initialData }, cache);
  return <span>{data?.name}</span>;
}

describe('useGameData on the server', () => {
  it("renders this request's initial data, never another request's cached dataset", () => {
    const cache = new GameDataCache();
    cache.seed('en', 'simulacra', { name: 'compact catalog' });
    expect(renderToString(<Probe cache={cache} initialData={{ name: 'full profile' }} />)).toContain('full profile');
    // Nothing from this request is kept in the process-wide cache either.
    expect(cache.getResolved<{ name: string }>('en', 'simulacra')?.name).toBe('compact catalog');
  });
});
