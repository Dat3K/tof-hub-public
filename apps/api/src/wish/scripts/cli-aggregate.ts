import { DatabaseSync } from 'node:sqlite';
import * as path from 'node:path';
import * as fs from 'node:fs';

interface AggregateOptions {
  includeDemo?: boolean;
  bannerId?: string;
  orderType?: string;
}

export function runAggregate(dbPath: string, options: AggregateOptions = {}) {
  if (!fs.existsSync(dbPath)) {
    console.error(`Database file not found at: ${dbPath}`);
    return null;
  }

  const db = new DatabaseSync(dbPath);
  let rows: Array<{
    banner_id: string;
    banner_title: string;
    order_type: string;
    region: string;
    total_pulls: number;
    ssr_count: number;
    sr_count: number;
    r_count: number;
    won_count: number;
    lost_count: number;
    hard_pity_count: number;
    early_ssr_count: number;
    total_cashback: number;
  }> = [];

  try {
    const conditions: string[] = ['1=1'];
    const params: (string | number)[] = [];

    if (!options.includeDemo) {
      conditions.push('p.is_demo = 0');
    }

    if (options.bannerId) {
      conditions.push('b.id = ?');
      params.push(options.bannerId);
    }

    if (options.orderType) {
      conditions.push('b.banner_type = ?');
      params.push(options.orderType);
    }

    const whereClause = conditions.join(' AND ');

    const query = `
      SELECT 
        b.id as banner_id,
        b.name as banner_title,
        b.banner_type as order_type,
        p.region,
        COUNT(r.id) as total_pulls,
        SUM(CASE WHEN r.rarity = 5 THEN 1 ELSE 0 END) as ssr_count,
        SUM(CASE WHEN r.rarity = 4 THEN 1 ELSE 0 END) as sr_count,
        SUM(CASE WHEN r.rarity = 3 THEN 1 ELSE 0 END) as r_count,
        SUM(CASE WHEN r.streak_outcome = 'win' THEN 1 ELSE 0 END) as won_count,
        SUM(CASE WHEN r.streak_outcome = 'loss' THEN 1 ELSE 0 END) as lost_count,
        SUM(CASE WHEN r.is_guaranteed_pity = 1 THEN 1 ELSE 0 END) as hard_pity_count,
        SUM(CASE WHEN r.is_guaranteed_pity = 0 AND r.rarity = 5 THEN 1 ELSE 0 END) as early_ssr_count,
        0 as total_cashback
      FROM wish_records r
      JOIN wish_banners b ON r.banner_id = b.id
      JOIN wish_profiles p ON r.profile_id = p.id
      WHERE ${whereClause}
      GROUP BY b.id, b.name, b.banner_type, p.region
    `;

    rows = db.prepare(query).all(...params) as typeof rows;
  } finally {
    db.close();
  }


  return rows.map((row) => {
    const ssrRate = row.total_pulls > 0 ? (row.ssr_count / row.total_pulls) * 100 : 0;
    const decisions = row.won_count + row.lost_count;
    const winRate = decisions > 0 ? (row.won_count / decisions) * 100 : 0;

    return {
      ...row,
      ssr_rate_percent: Number(ssrRate.toFixed(2)),
      win_rate_percent: Number(winRate.toFixed(2)),
    };
  });
}

// CLI entrypoint if executed directly
if (require.main === module || process.argv[1]?.includes('cli-aggregate')) {
  const defaultDbPath = path.resolve(process.cwd(), 'apps/api/.data/wish-local.sqlite');
  const includeDemo = process.argv.includes('--include-demo');
  const bannerArgIndex = process.argv.indexOf('--banner');
  const bannerId = bannerArgIndex !== -1 ? process.argv[bannerArgIndex + 1] : undefined;

  console.log(`--- Special Orders Aggregate Report ---`);
  console.log(`Database: ${defaultDbPath}`);
  console.log(`Include Demo: ${includeDemo}`);

  const results = runAggregate(defaultDbPath, { includeDemo, bannerId });

  if (results) {
    console.table(results);
    console.log(`Total aggregated banner groups: ${results.length}`);
  }
}
