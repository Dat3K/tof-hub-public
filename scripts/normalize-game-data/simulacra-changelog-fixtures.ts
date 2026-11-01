export type SimulacraChangelogCategory =
  | "Skill"
  | "Normal"
  | "Dodge"
  | "Discharge"
  | "Passive"
  | "Advancement"
  | "Trait"
  | "Matrix"
  | "Stat"
  | "Other";

export interface SimulacraChangelogChange {
  type: SimulacraChangelogCategory;
  path: string;
  old: string;
  new: string;
  field?: string;
  skill_id?: string;
  passive_id?: string;
}

export interface SimulacraChangelogEntry {
  patch: string;
  client: string;
  clientRu: string;
  date: string;
  edition: "gacha" | "mmo";
  server_mode: "gacha" | "mmo";
  changes: SimulacraChangelogChange[];
}

const gachaEntry = (
  patch: string,
  date: string,
  changes: SimulacraChangelogChange[],
): SimulacraChangelogEntry => ({
  patch,
  client: patch,
  clientRu: patch,
  date,
  edition: "gacha",
  server_mode: "gacha",
  changes,
});

/**
 * Temporary fixture history for validating the universal changelog shape.
 *
 * The 6.3.14 entry is real: legacy backup data had 36% and the current
 * legacy export has 34% in zoey.traits[1].desc_en. The -test entries are
 * deliberately broad examples for percentage edits across every supported
 * changelog category; remove them when real historical snapshots replace the
 * fixture.
 */
export function buildZoeyChangelogFixtures(
  id: string,
  serverMode: "gacha" | "mmo",
): SimulacraChangelogEntry[] {
  if (serverMode !== "gacha" || id.replace(/-mmo$/i, "").toLowerCase() !== "zoey") {
    return [];
  }

  return [
    gachaEntry("6.3.14", "2026-09-19", [
      {
        type: "Trait",
        path: "traits.1.desc_en",
        field: "desc_en",
        old: "Increases Final Damage by 18%. Increases Physical Damage by 36% when Rosebud is deployed.",
        new: "Increases Final Damage by 18%. Increases Physical Damage by 34% when Rosebud is deployed.",
      },
    ]),
  ];
}
