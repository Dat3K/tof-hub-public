import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SectionHubCard, sparklinePath } from './section-hub';
import { pickHubPreview } from './pick-preview';

const BOSSES = { head: 2, middle: 4, tail: 2 };

describe('SectionHubCard', () => {
  it('links the whole card through its title and keeps preview links separate', () => {
    render(
      <SectionHubCard id="oow" href="/datamine/oow/" title="Origin of War" actionLabel="Open page">
        <a href="/datamine/oow/?s=23">S23</a>
      </SectionHubCard>
    );
    expect(screen.getByRole('link', { name: 'Origin of War' }).getAttribute('href')).toMatch(/^\/datamine\/oow\/?$/);
    expect(screen.getByRole('link', { name: 'S23' }).getAttribute('href')).toBe('/datamine/oow/?s=23');
    // The action text is decorative; the title link is the only card-wide link.
    expect(screen.queryByRole('link', { name: 'Open page' })).toBeNull();
  });
});

describe('sparklinePath', () => {
  it('spans the chart width and keeps larger values higher', () => {
    const path = sparklinePath([[1, 10], [2, 100], [3, 1000]], true);
    expect(path).toBe('M0.0,44.0 L100.0,23.0 L200.0,2.0');
  });

  it('returns no path for fewer than two points', () => {
    expect(sparklinePath([[1, 10]], false)).toBe('');
  });
});

describe('pickHubPreview', () => {
  const ladder = Array.from({ length: 12 }, (_, index) => index);

  it('keeps the first two and last two bosses around four from the middle', () => {
    const picked = pickHubPreview(ladder, BOSSES, () => 0.5);
    expect(picked).toHaveLength(8);
    expect(picked.slice(0, 2)).toEqual([0, 1]);
    expect(picked.slice(-2)).toEqual([10, 11]);
    expect(new Set(picked).size).toBe(8);
    expect(picked.slice(2, 6).every((boss: number) => boss >= 2 && boss <= 9)).toBe(true);
  });

  it('picks evenly spaced middle bosses without a random source (server render)', () => {
    expect(pickHubPreview(ladder, BOSSES)).toEqual([0, 1, 3, 5, 7, 9, 10, 11]);
  });

  it('shows short ladders whole', () => {
    expect(pickHubPreview([1, 2, 3], BOSSES)).toEqual([1, 2, 3]);
  });

  it('keeps the newest items first when there is no tail (matrices)', () => {
    const picked = pickHubPreview(ladder, { head: 2, middle: 2 }, () => 0.3);
    expect(picked.slice(0, 2)).toEqual([0, 1]);
    expect(picked).toHaveLength(4);
    expect(picked.slice(2).every((item) => item >= 2)).toBe(true);
  });
});
