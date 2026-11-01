export interface KnownDataWarning {
  id: string;
  severity: "warning";
  title_en: string;
  title_ru: string;
  message_en: string;
  message_ru: string;
  paths: string[];
}

export interface KnownElementCorrection {
  element: string;
  element_secondary: string;
  warning: KnownDataWarning | null;
}

const HIPPER_WARNING: KnownDataWarning = {
  id: "ciper-commodre-naming-mismatch",
  severity: "warning",
  title_en: "Attention: developer data naming mismatch",
  title_ru: "Внимание: ошибка в названии у разработчиков",
  message_en:
    "Hipper / AF-010 Servion is correctly a Gacha dual-element weapon. The funny developer typo is that Volt Resonance is stored under Buff_Commodre_Thunder_Resonance (Commodre) instead of Commodore, so the secondary element and the Volt + Frost passive linkage had to be restored.",
  message_ru:
    "Хиппер / AF-010 Servion — это гача-оружие с двумя элементами. Забавная ошибка разработчиков: Volt Resonance записан под ключом Buff_Commodre_Thunder_Resonance (Commodre) вместо Commodore, поэтому пришлось восстановить вторичный элемент и связку пассивок Volt + Frost.",
  paths: [
    "info/simulacra/data/ciper.json",
    "datamine/shared-data/buffs.json",
    "info/matrices/data/matrices.json",
  ],
};

function isHipperGachaRecord(value: any, isMmo: boolean): boolean {
  if (isMmo) return false;
  const id = String(value?.id || value?.char_id || "").toLowerCase();
  const weaponId = String(value?.weapon_id || "").toLowerCase();
  return id === "ciper" || weaponId === "commodore_thu";
}

export function correctKnownSimulacraElements(
  summary: any,
  detail: any,
  isMmo: boolean,
): KnownElementCorrection | null {
  if (!isHipperGachaRecord(summary, isMmo) && !isHipperGachaRecord(detail, isMmo)) {
    return null;
  }

  const currentSecondary = String(
    summary?.element_secondary || detail?.element_secondary || "",
  ).toLowerCase();

  return {
    element: "Volt",
    element_secondary: "Frost",
    warning: currentSecondary === "frost" ? null : HIPPER_WARNING,
  };
}

export function correctKnownCarrierElements(carrier: any): {
  element: string;
  element_secondary: string;
} | null {
  if (!isHipperGachaRecord(carrier, false)) return null;
  return { element: "Volt", element_secondary: "Frost" };
}
