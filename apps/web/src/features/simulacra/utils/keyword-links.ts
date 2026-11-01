import type { SimulacraDatasetItemRaw } from "@tof-hub/contracts";
import { getCleanPassives, getCleanSkills } from "./skill-scaling";

export interface SimulacraKeywordMatcher {
  regex: RegExp;
  replace: (matched: string) => string;
}

interface KeywordEntry {
  anchor: string;
  kind: "skill" | "passive" | "trait" | "advancement" | "matrix" | "self";
  category?: string;
  isPassive?: boolean;
  isTrait?: boolean;
}

const GENERIC_TERMS = new Set([
  "none",
  "attack",
  "dodge",
  "skill",
  "discharge",
  "passive",
  "other",
  "damage",
  "physical",
  "flame",
  "frost",
  "volt",
  "altered",
]);

function addEntry(termMap: Map<string, KeywordEntry>, raw: unknown, entry: KeywordEntry) {
  const term = String(raw ?? "").trim();
  if (term.length < 3 || GENERIC_TERMS.has(term.toLowerCase())) return;
  if (!termMap.has(term.toLowerCase())) termMap.set(term.toLowerCase(), entry);
}

function skillAnchor(skill: any, index: number): string {
  return `skill-${String(skill?.id || skill?.action_id || index)}`;
}

function passiveAnchor(passive: any, index: number): string {
  return `passive-${String(passive?.id || passive?.action_id || index)}`;
}

function addLocalizedName(termMap: Map<string, KeywordEntry>, value: any, entry: KeywordEntry) {
  addEntry(termMap, value?.name_en || value?.name, entry);
  addEntry(termMap, value?.name_ru, entry);
}

export function createSimulacraKeywordMatcher(
  character: SimulacraDatasetItemRaw,
): SimulacraKeywordMatcher | null {
  const termMap = new Map<string, KeywordEntry>();

  addEntry(termMap, character.name_en || character.name, {
    anchor: "sim-char-hero",
    kind: "self",
  });
  addEntry(termMap, character.name_ru, { anchor: "sim-char-hero", kind: "self" });
  addEntry(termMap, character.weapon_name_en || character.weapon_name, {
    anchor: "sim-char-hero",
    kind: "self",
  });
  addEntry(termMap, character.weapon_name_ru, { anchor: "sim-char-hero", kind: "self" });

  const matrix = (character.matrix || {}) as any;
  addEntry(termMap, matrix.suit_name_en || matrix.name_en, {
    anchor: "matrix-set",
    kind: "matrix",
  });
  addEntry(termMap, matrix.suit_name_ru || matrix.name_ru, {
    anchor: "matrix-set",
    kind: "matrix",
  });
  const matrixSetAnchors = [
    ["set2", "matrix-set2", "2-Piece Set", "Комплект из 2 предметов"],
    ["set4", "matrix-set4", "4-Piece Set", "Комплект из 4 предметов"],
  ] as const;
  for (const [pieceKey, anchor, englishLabel, russianLabel] of matrixSetAnchors) {
    const piece = matrix[pieceKey];
    if (!piece) continue;
    addEntry(termMap, englishLabel, { anchor, kind: "matrix" });
    addEntry(termMap, russianLabel, { anchor, kind: "matrix" });
    addLocalizedName(termMap, piece, { anchor, kind: "matrix" });
  }
  for (const piece of Array.isArray(matrix.pieces) ? matrix.pieces : []) {
    addLocalizedName(termMap, piece, { anchor: "matrix-set", kind: "matrix" });
  }

  const skills = getCleanSkills(character);
  skills.forEach((skill: any, index: number) => {
    const category = String(skill.category || "other").toLowerCase();
    const isPassive = category === "passive";
    const entry: KeywordEntry = {
      anchor: isPassive ? passiveAnchor(skill, index) : skillAnchor(skill, index),
      kind: isPassive ? "passive" : "skill",
      category,
      isPassive,
    };
    addLocalizedName(termMap, skill, entry);
  });

  const passives = getCleanPassives(character);
  passives.forEach((passive: any, index: number) => {
    const entry: KeywordEntry = {
      anchor: passiveAnchor(passive, index),
      kind: "passive",
      category: "passive",
      isPassive: true,
    };
    addLocalizedName(termMap, passive, entry);
  });

  const discharge = skills.find(
    (skill: any) => String(skill.category || "").toLowerCase() === "discharge",
  );
  if (discharge) {
    const entry: KeywordEntry = {
      anchor: skillAnchor(discharge, skills.indexOf(discharge)),
      kind: "skill",
      category: "discharge",
    };
    ["Discharge Damage", "Discharge Skill", "Discharge Attack", "Discharge Strike"].forEach(
      (term) => addEntry(termMap, term, entry),
    );
  }

  const firstSkill = skills.find(
    (skill: any) => String(skill.category || "").toLowerCase() === "skill",
  );
  if (firstSkill) {
    const entry: KeywordEntry = {
      anchor: skillAnchor(firstSkill, skills.indexOf(firstSkill)),
      kind: "skill",
      category: "skill",
    };
    ["Weapon Skill", "Weapon Skills", "Skills"].forEach((term) => addEntry(termMap, term, entry));
  }

  const traits = Array.isArray(character.traits) ? character.traits : [];
  traits.forEach((trait: any, index: number) => {
    const affinity = trait.affinity ?? (index === 0 ? 1200 : 4000);
    addLocalizedName(termMap, trait, {
      anchor: `trait-${affinity}`,
      kind: "trait",
      isTrait: true,
    });
  });

  const advancements = Array.isArray(character.advancements)
    ? character.advancements
    : Array.isArray((character.weapon as any)?.advancements)
      ? (character.weapon as any).advancements
      : [];
  advancements.forEach((adv: any, index: number) => {
    const star = adv.star ?? index + 1;
    addLocalizedName(termMap, adv, { anchor: `advancement-${star}`, kind: "advancement" });
  });

  const terms = [...termMap.keys()].sort((a, b) => b.length - a.length);
  if (terms.length === 0) return null;

  const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(
    `(?<![\\p{L}\\p{N}])(${terms.map(escapeRegex).join("|")})(?![\\p{L}\\p{N}])`,
    "giu",
  );

  return {
    regex,
    replace: (matched: string) => {
      const entry = termMap.get(matched.toLowerCase());
      if (!entry) return matched;
      const safeText = matched.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const safeAnchor = entry.anchor.replace(/[^a-zA-Z0-9_:-]/g, "");
      const classes = ["sim-keyword-link", `sim-keyword-link--${entry.kind}`].join(" ");
      const attrs = [
        `href="#${safeAnchor}"`,
        `data-keyword-anchor="${safeAnchor}"`,
        entry.category ? `data-skill-cat="${entry.category}"` : "",
        entry.isPassive ? 'data-is-passive="true"' : "",
        entry.isTrait ? 'data-is-trait="true"' : "",
      ]
        .filter(Boolean)
        .join(" ");
      return `<a class="${classes}" ${attrs}>${safeText}</a>`;
    },
  };
}
