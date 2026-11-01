import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { runAggregate } from '../scripts/cli-aggregate';

describe('Developer CLI Aggregation', () => {
  const testDbPath = path.resolve(__dirname, 'test-cli-aggregate.sqlite');

  beforeEach(() => {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    const db = new DatabaseSync(testDbPath);
    db.exec(`
      CREATE TABLE wish_profiles (
        id TEXT PRIMARY KEY,
        uid TEXT NOT NULL,
        is_demo INTEGER NOT NULL DEFAULT 0,
        region TEXT NOT NULL DEFAULT 'global'
      );

      CREATE TABLE wish_banners (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        banner_type TEXT NOT NULL
      );
      CREATE TABLE wish_records (
        id TEXT PRIMARY KEY,
        profile_id TEXT NOT NULL,
        banner_id TEXT NOT NULL,
        rarity INTEGER NOT NULL,
        streak_outcome TEXT,
        is_guaranteed_pity INTEGER NOT NULL DEFAULT 0
      );

      -- Insert real user profile and demo profile
      INSERT INTO wish_profiles (id, uid, is_demo) VALUES ('prof_real', 'UID123', 0);
      INSERT INTO wish_profiles (id, uid, is_demo) VALUES ('prof_demo', 'UID_DEMO', 1);

      INSERT INTO wish_banners (id, name, banner_type) VALUES ('b_weapon', 'Yanmiao Weapon', 'weapon');

      -- Real user: 3 pulls, 1 SSR won, 1 SR, 1 R
      INSERT INTO wish_records (id, profile_id, banner_id, rarity, streak_outcome, is_guaranteed_pity)
      VALUES 
        ('r1', 'prof_real', 'b_weapon', 3, NULL, 0),
        ('r2', 'prof_real', 'b_weapon', 4, NULL, 0),
        ('r3', 'prof_real', 'b_weapon', 5, 'win', 0);

      -- Demo user: 1 pull, 1 SSR lost
      INSERT INTO wish_records (id, profile_id, banner_id, rarity, streak_outcome, is_guaranteed_pity)
      VALUES 
        ('d1', 'prof_demo', 'b_weapon', 5, 'loss', 1);
    `);
    db.close();
  });


  afterEach(() => {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  it('excludes demo profiles by default', () => {
    const results = runAggregate(testDbPath, { includeDemo: false });
    expect(results).toHaveLength(1);
    expect(results![0].total_pulls).toBe(3);
    expect(results![0].ssr_count).toBe(1);
    expect(results![0].won_count).toBe(1);
    expect(results![0].lost_count).toBe(0);
  });

  it('includes demo profiles when explicitly requested', () => {
    const results = runAggregate(testDbPath, { includeDemo: true });
    expect(results).toHaveLength(1);
    expect(results![0].total_pulls).toBe(4);
    expect(results![0].ssr_count).toBe(2);
    expect(results![0].won_count).toBe(1);
    expect(results![0].lost_count).toBe(1);
    expect(results![0].win_rate_percent).toBe(50);
  });
});
