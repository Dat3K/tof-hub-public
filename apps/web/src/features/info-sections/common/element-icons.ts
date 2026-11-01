const DUAL_ELEMENT_ICON_PATHS: Record<string, string> = {
  'physical-flame': 'Hotta/Content/Resources/UI/wuqi/icon_element_wuhuo',
  'flame-physical': 'Hotta/Content/Resources/UI/wuqi/icon_element_huowu',
  'volt-frost': 'Hotta/Content/Resources/UI/wuqi/icon_element_leibing',
  'frost-volt': 'Hotta/Content/Resources/UI/wuqi/icon_element_binglei',
};

const normalizeElementName = (value: string) => {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'physical' || normalized === 'phys') return 'physical';
  if (normalized === 'fire' || normalized === 'flame') return 'flame';
  if (normalized === 'ice' || normalized === 'frost') return 'frost';
  if (normalized === 'thunder' || normalized === 'volt') return 'volt';
  return normalized;
};

export function getDualElementIconPath(primary?: string | null, secondary?: string | null) {
  if (!primary || !secondary) return undefined;
  return DUAL_ELEMENT_ICON_PATHS[
    `${normalizeElementName(primary)}-${normalizeElementName(secondary)}`
  ];
}
