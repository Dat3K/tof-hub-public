/** Protocol attribute names shared by capture import and persisted capture normalization. */
export const CAPTURE_ELEMENT_ATTRIBUTES={
  Physical:['PhysicalAttack','PhyAtkDisplayBase','PhysicalDef'],Flame:['FireAtk','FireAtkDisplayBase','FireDefense'],
  Frost:['IceAtk','IceAtkDisplayBase','IceDefense'],Volt:['ThunderAtk','ThunderAtkDisplayBase','ThunderDefense'],
  Altered:['SuperpowerAtk','SuperpowerAtkDisplayBase','SuperpowerDefense'],
} as const;
