/**
 * The standard combat-pet tables store gameplay values in a different scale
 * from the values shown in the in-game pet panel.
 *
 * Source: Hotta/Content/Resources/CoreBlueprints/DataTable/Pet/
 * PetModifyDataTable.json, FightPet1_Attribute_<level>.
 */
const STANDARD_PET_ATK_BASE_BY_LEVEL = [
  2125, 2318, 2511, 2704, 2897, 3090, 3283, 3476, 3669, 3862,
  4055, 4248, 4441, 4634, 4827, 5020, 5213, 5406, 5599, 5792,
  5985, 6178, 6371, 6564, 6757, 6950, 7143, 7336, 7529, 7722,
  7915, 8108, 8301, 8494, 8687, 8880, 9073, 9266, 9459, 9652,
  9845, 10038, 10231, 10424, 10617, 10810, 11003, 11196, 11389, 11582,
  11775, 11968, 12161, 12354, 12547, 12740, 12933, 13126, 13319, 13512,
  13705, 13898, 14091, 14284, 14477, 14670, 14863, 15056, 15249, 15442,
  15635, 15828, 16021, 16214, 16407, 16600, 16793, 16986, 17179, 17372,
  17565, 17758, 17952, 18146, 18340, 18534, 18728, 18922, 19116, 19310,
  19504, 19698, 19892, 20086, 20280, 20474, 20668, 20862, 21056, 21250,
] as const;

const STANDARD_PET_CRIT_BY_LEVEL = [
  1800, 1867, 1934, 2001, 2068, 2135, 2202, 2269, 2336, 2403,
  2470, 2537, 2604, 2671, 2738, 2805, 2872, 2939, 3006, 3073,
  3140, 3207, 3274, 3341, 3408, 3475, 3542, 3609, 3676, 3743,
  3810, 3877, 3944, 4012, 4080, 4148, 4216, 4284, 4352, 4420,
  4488, 4556, 4624, 4692, 4760, 4828, 4896, 4964, 5032, 5100,
  5168, 5236, 5304, 5372, 5440, 5508, 5576, 5644, 5712, 5780,
  5848, 5916, 5984, 6052, 6120, 6188, 6256, 6324, 6392, 6460,
  6528, 6596, 6664, 6732, 6800, 6868, 6936, 7004, 7072, 7140,
  7208, 7276, 7344, 7412, 7480, 7548, 7616, 7684, 7752, 7820,
  7888, 7956, 8024, 8092, 8160, 8228, 8296, 8364, 8432, 8500,
] as const;

const STANDARD_PET_ATK_UI_DIVISOR = 3.1;
const STANDARD_PET_CRIT_UI_MULTIPLIER = 0.7;

export interface StandardPetStatLevel {
  level: number;
  atk: number;
  crit: number;
  crit_dmg: number;
}

/** Convert raw FightPet1 attributes to the grey values shown by the game UI. */
export function getStandardPetStatsAtLevel(level: number): StandardPetStatLevel {
  const safeLevel = Math.min(Math.max(Math.trunc(level) || 1, 1), 100);
  const index = safeLevel - 1;

  return {
    level: safeLevel,
    atk: Math.round(STANDARD_PET_ATK_BASE_BY_LEVEL[index] / STANDARD_PET_ATK_UI_DIVISOR),
    crit: Math.round(STANDARD_PET_CRIT_BY_LEVEL[index] * STANDARD_PET_CRIT_UI_MULTIPLIER),
    crit_dmg: 0.5,
  };
}
