/**
 * Editorial boss-name colors for the raid card (presentation only, not game data).
 * Same characters reuse the `name_color` chosen for /datamine/fce/ in
 * scripts/game-processors/curated/datamine/fce/data/bosses/*.json; the others were
 * picked from the raid title artwork. Raids without exported art keep the default.
 */
export const RAID_NAME_COLORS: Record<string, string> = {
  Team8P_01: '#d4ba3e', // Apophis (FCE)
  Team8P_02: '#ef62bd', // Frigg (FCE)
  Team8P_03: '#f0a24a', // Dark Star / Nemesis (orange artwork)
  Team8P_04: '#9adf3e', // Rudolph (FCE)
  Team8P_05: '#cf86c1', // Eva (FCE)
  Team8P_06: '#ff5a4d', // Zhuyan (FCE)
  Team8P_07: '#4fd0d6', // Taotie (teal artwork)
  Team8P_08: '#ef73ba', // Xing Tian (FCE)
  Team8P_09: '#a78fe7', // Ying Zhao (FCE)
  Team8P_10: '#d2db4f', // Fei Lian (FCE)
  Team8P_11: '#73d9ee', // Sphere (FCE)
  Team8P_12: '#b7e84a', // Scorpion (FCE)
  Team8P_13: '#5ccfe6', // Defender: Gunner (white/cyan artwork)
  Team8P_14: '#bb313d', // Asurada (FCE)
  Team8P_15: '#69718c', // Ground Controller (FCE)
  Team8P_16: '#c06be8', // Queen Xeno (violet artwork)
  Team8P_17: '#e0424a', // Laurent (red cloak artwork)
  Team8P_18: '#f39a2b', // Calamity No. 5 (orange plating artwork)
  Team8P_19: '#49a6ee', // Nanto (FCE)
  Team8P_20: '#c9a35c', // Baggis (brown/bronze artwork)
  Team8P_21: '#9a7be0', // Cursed Skull (purple artwork, lightened for the outlined text)
  Team8P_22: '#e8a94a', // Favored Ironclad (brass artwork)
};

export const DEFAULT_RAID_NAME_COLOR = '#72d4ca';
