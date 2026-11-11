// @vitest-environment node
import {expect, it} from 'vitest';
import {artworkIdentity, trackArtworkDiscoveries} from '../../scripts/normalize-game-data/artwork-history';
import {compareArtsByAdded, filterMatchesCategory} from '../../apps/web/src/features/info-sections/arts/constants';

it('tracks additions by source identity, preserving observations across reruns, renames, removals and returns', () => {
  const old = {id: 'z_old', sourcePath: 'Hotta/Content/Old'};
  const added = {id: 'a_new', sourcePath: 'Hotta/Content/New'};
  const baseline = trackArtworkDiscoveries([old]);
  expect(baseline.metadata(old)).toEqual({addedInRevision: 0, addedInVersion: null, isNew: false});
  const update = trackArtworkDiscoveries([old, added], baseline.history, '6.5.0');
  expect(update.metadata(added)).toEqual({addedInRevision: 1, addedInVersion: '6.5.0', isNew: true});
  expect(baseline.history.entries).not.toHaveProperty(artworkIdentity(added));
  const renamed = {...added, id: 'renamed', sourcePath: 'Content\\NEW'};
  expect(trackArtworkDiscoveries([old, renamed], update.history, '6.5.1').history).toEqual(update.history);
  const next = {id: 'b_next', sourcePath: 'Hotta/Content/Next'};
  const later = trackArtworkDiscoveries([old, next], update.history, '6.6.0');
  const returned = trackArtworkDiscoveries([old, added, next], later.history, '6.6.1');
  expect(returned.history.revision).toBe(2);
  expect(returned.metadata(added)).toEqual({addedInRevision: 1, addedInVersion: '6.5.0', isNew: false});
  expect(returned.metadata(next).isNew).toBe(true);
});

it('puts newly observed art ahead of lexicographically newer IDs and filters only the latest batch', () => {
  const old = {id: 'z_old', addedInRevision: 0, isNew: false};
  const recent = {id: 'a_recent', addedInRevision: 1, isNew: false};
  const latest = {id: 'b_latest', addedInRevision: 2, isNew: true};
  expect([old, latest, recent].sort((a, b) => compareArtsByAdded(b, a))).toEqual([latest, recent, old]);
  expect([latest, old, recent].sort(compareArtsByAdded)).toEqual([old, recent, latest]);
  expect([old, recent, latest].filter(item => filterMatchesCategory(item, 'new'))).toEqual([latest]);
});
