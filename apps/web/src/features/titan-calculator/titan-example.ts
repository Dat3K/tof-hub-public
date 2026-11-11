import type { TitanLevels } from './model';

// Transcribed and checked against the four images served from public/examples/titan.
export const EXAMPLE_TITAN: TitanLevels = { normal: 9, dodge: 0, skill: 6, discharge: 3, dmgBoost: 0, weakPoint: 18 };
export const EXAMPLE_WEAPONS = [
  { name: 'Rosebud', image: 'weapon-1.webp', table: `Normal Attack 374.6m 28.19g 75.25
Dodge 0 0 0
Discharge 183.9m 14.59g 79.29
Passive 0 0 0
Skill 216.4m 16.86g 77.88
Total 775.0m 59.63g 76.94` },
  { name: 'Evolution Cube', image: 'weapon-2.webp', table: `Normal Attack 181.8m 13.74g 75.58
Dodge 252.8k 16.41m 64.90
Discharge 0 0 0
Passive 0 0 0
Skill 154.4m 2181m 14.13
Total 336.5m 15.94g 47.37` },
  { name: 'Star of Oblivion', image: 'weapon-3.webp', table: `Normal Attack 10.57m 490.2m 46.39
Dodge 0 0 0
Discharge 33.29m 3086m 92.72
Passive 149.3m 13.94g 93.28
Skill 8271k 685.1m 82.83
Total 201.5m 18.2g 90.30` },
];
