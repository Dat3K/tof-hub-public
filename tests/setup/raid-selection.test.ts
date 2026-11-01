import { describe, expect, it } from 'vitest';
import { normalizeRaidSelection, selectedRaidSeason } from '../../apps/web/src/features/datamine/raids/raid-selection';
import type { RaidRankingDataset } from '@tof-hub/game-domain';

const seasons = [
  {id: 'S9', label: 'S9', raidId: 'raid-nine'},
  {id: 'S14', label: 'S14', raidId: 'raid-fourteen'},
  {id: 'S16', label: 'S16', raidId: 'raid-sixteen'},
] as RaidRankingDataset['seasons'];

describe('raid page selection', () => {
  it('uses the latest season and omits implicit page defaults', () => {
    const params = new URLSearchParams('tab=ranking&season=S16&raid=raid-sixteen&region=all&layout=teams&unique=0&names=historical&sort=time&places=region');
    expect(normalizeRaidSelection(params, seasons).toString()).toBe('tab=ranking');
    expect(selectedRaidSeason(params, seasons)?.id).toBe('S16');
  });

  it('preserves the raid season when crossing description and ranking tabs', () => {
    const params = new URLSearchParams('raid=raid-fourteen');
    normalizeRaidSelection(params, seasons);
    expect(params.toString()).toBe('season=S14');
    params.set('tab', 'ranking');
    expect(selectedRaidSeason(params, seasons)?.raidId).toBe('raid-fourteen');
    params.set('tab', 'overview');
    expect(normalizeRaidSelection(params, seasons).toString()).toBe('season=S14');
  });

  it('retains explicit filters and gives the selected season priority over a stale raid', () => {
    const params = new URLSearchParams('season=S14&raid=raid-sixteen&region=EU&layout=list&unique=1&names=current&sort=time-desc');
    expect(selectedRaidSeason(params, seasons)?.id).toBe('S14');
    normalizeRaidSelection(params, seasons);
    expect(params.get('region')).toBe('EU');
    expect(params.get('layout')).toBe('list');
    expect(params.get('names')).toBe('current');
  });

  it('accepts future seasons from the dataset without hardcoded season limits', () => {
    const future = [...seasons, {id: 'S17', label: 'S17', raidId: 'new-raid'}] as RaidRankingDataset['seasons'];
    expect(selectedRaidSeason(new URLSearchParams(), future)?.id).toBe('S17');
    expect(normalizeRaidSelection(new URLSearchParams('season=S16'), future).toString()).toBe('season=S16');
    expect(normalizeRaidSelection(new URLSearchParams('season=S17'), future).toString()).toBe('');
  });
});
