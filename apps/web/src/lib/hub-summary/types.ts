import { localized } from '@tof-hub/i18n';
import { type Locale } from '@tof-hub/i18n';
// Shape of game-data/hub-summary.json (scripts/generators/build-hub-summary.cjs).

export interface HubLocalized {
  en: string | null;
  ru: string | null;
  [culture: string]: string | null | undefined;
}

export interface HubSimulacrumSlot {
  /** `latest`/`previous` releases, `altered` = latest Altered simulacrum, `earlier` = third release when it was already shown. */
  slot: 'latest' | 'previous' | 'altered' | 'earlier';
  slug: string;
  name: HubLocalized;
  weapon: HubLocalized;
  element: string;
  elementSecondary: string | null;
  elementIcon: string | null;
  role: string | null;
  roleIcon: string | null;
  avatar: string | null;
  /** Transparent detail art (Info profile); drawn behind the featured card. */
  portrait?: string | null;
  /** MMO season of the release (MMO only). */
  season: number | null;
  matrixSuitId: string | null;
}

export interface HubSummaryStripItem {
  id: string;
  name: HubLocalized;
  image: string;
}

/** Latest simulacrum: matrix portrait (Comp strip) and weapon item icon (Build card miniature). */
export interface HubCompEntry extends HubSummaryStripItem {
  weaponIcon?: string | null;
}

export interface HubSummaryPreview {
  facts: { key: string; value: number }[];
  strip: HubSummaryStripItem[];
}

export type HubInfoSection = 'matrices' | 'relics' | 'pets' | 'food' | 'cosmetics' | 'arts';

export interface HubOowSeason {
  /** File / URL season number (`?s=`). */
  season: number;
  /** Number shown as `S<n>`, as the OOW page: MMO seasons by list position; absent in older summaries. */
  displayNumber?: number;
  startDate: string;
  endDate: string;
  floorCount: number | null;
  /** Season boss as shown in the OOW season rail. */
  boss: { name: HubLocalized; image: string | null } | null;
  finalBossHp: number | null;
  finalBossEffectiveHp: number | null;
  /** Last floor of the season; effectiveHp covers all of its mobs. */
  finalFloor: { floor: number; effectiveHp: number | null } | null;
}

export interface HubOowMode {
  total: number;
  seasons: HubOowSeason[];
}

export interface HubFceBoss {
  nameColor?: string | null;
  slug: string;
  name: HubLocalized;
  image: string | null;
  ladderLevel: number | null;
  mechanicsCount: number;
  mechanic: HubLocalized;
}

export interface HubRaid {
  id: string;
  index: number;
  name: HubLocalized;
  image: string | null;
  mechanicsCount: number;
  mechanic: HubLocalized | null;
}

export type HubCurve = [number, number][];

export interface HubSummary {
  schemaVersion: 1;
  info: {
    counts: Record<'simulacra' | 'simulacraMmo' | HubInfoSection, number>;
    simulacra: Record<'gacha' | 'mmo', HubSimulacrumSlot[]>;
  } & Record<HubInfoSection, HubSummaryPreview>;
  datamine: {
    counts: Record<'oow' | 'fce' | 'bygone' | 'seq' | 'multype' | 'items' | 'raids', number>;
    oow: { gacha: HubOowMode; mmo: HubOowMode };
    fce: { bosses: HubFceBoss[] };
    /** The eight newest team raids, oldest first (the latest is last). */
    raids?: { entries: HubRaid[] };
    bygone: { curve: HubCurve };
    seq: { curve: HubCurve };
    multype: { modules: { key: string; label: string | null; count: number }[] };
    /** Trial weapon rows of the latest simulacra; `name` is null when the table repeats the id. */
    items: {
      sample: {
        id: string;
        original: string | null;
        name: string | null;
        icon: string | null;
        /** Simulacrum whose weapon the row is. */
        owner: { slug: string; name: HubLocalized };
      }[];
    };
  };
  tools: Record<'ranking' | 'build' | 'optimizer', { strip: HubSummaryStripItem[] }> & {
    comp: { strip: HubCompEntry[] };
    /** Latest limited banner; no dates (the banner file follows the CN schedule). */
    wish: {
      id: string;
      characterSlug: string;
      name: HubLocalized;
      /** Character splash and banner background as public paths (Wish page media). */
      image: string | null;
      background: string | null;
    } | null;
  };
}

/** Localized text with the English value as fallback. */
export function hubText(value: HubLocalized | null | undefined, locale: Locale): string {
  return localized(value, locale) ?? value?.en ?? '';
}
