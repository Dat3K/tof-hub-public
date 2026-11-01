'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ZOEY_WEAPON_BANNER,
  ZOEY_MATRIX_BANNER,
  STANDARD_WEAPON_BANNER,
  STANDARD_MATRIX_BANNER,
  BLACK_NUCLEUS_BANNER,
  getZoeyWeaponPulls,
  getZoeyMatrixPulls,
  type WishBannerDto,
  type WishRecordDto,
  type WishMatrixSlot,
  type WishAnalyticsDto,
  DEMO_UID,
} from '@tof-hub/contracts';
import {
  PULL_DC_COST,
  calculateAnalytics,
  calculateCashbackSummary,
  replayPityChain,
  evaluateStreak,
} from '@tof-hub/game-domain';
import type { WishTab, BannerKind, BannerTrack, WishFilters, PrimaryCategory, ItemTypeFilter } from './types';
import { DEV_PLAYERS_DATA, type WishPlayerProfile } from './dev-players-data';
import { readImportedProfileIds, readProfileToken, rememberImportedProfileId, rememberProfileToken, toImportedProfileEntry, type ImportedProfileEntry, type ImportedProfileResponse } from './import/imported-profiles';
import { downloadBlob } from '@/lib/download';

export interface RecentSsrOutcome {
  itemId: string;
  itemName: string;
  shortNameRu: string;
  shortNameEn: string;
  bannerNameRu: string;
  bannerNameEn: string;
  pullDate: string;
  outcome?: 'win' | 'loss';
  pityAtDrop: number;
  slot?: WishMatrixSlot;
}

function combineLimitedTrackAnalytics(
  weaponPulls: readonly WishRecordDto[],
  matrixPulls: readonly WishRecordDto[],
  weaponAnalytics: WishAnalyticsDto,
  matrixAnalytics: WishAnalyticsDto,
): WishAnalyticsDto {
  const weaponPity = replayPityChain(weaponPulls, 'weapon_limited');
  const matrixPity = replayPityChain(matrixPulls, 'matrix_limited');
  const intervals = [...weaponPity.completedIntervals, ...matrixPity.completedIntervals];
  const sortedIntervals = [...intervals].sort((a, b) => a - b);
  const intervalSum = intervals.reduce((sum, interval) => sum + interval, 0);
  const middle = Math.floor(sortedIntervals.length / 2);
  const medianInterval = sortedIntervals.length === 0
    ? 0
    : sortedIntervals.length % 2 === 1
      ? sortedIntervals[middle]
      : (sortedIntervals[middle - 1] + sortedIntervals[middle]) / 2;
  const intervalDistribution: Record<string, number> = {};
  for (const interval of intervals) {
    const start = Math.floor((interval - 1) / 10) * 10 + 1;
    const label = `${start}-${start + 9}`;
    intervalDistribution[label] = (intervalDistribution[label] ?? 0) + 1;
  }

  let neutralWins = 0;
  let neutralRolls = 0;
  for (const pulls of [weaponPulls, matrixPulls]) {
    const streak: Array<'win' | 'loss' | 'unknown'> = [];
    const sortedPulls = [...pulls].sort(
      (a, b) => new Date(a.pull_timestamp).getTime() - new Date(b.pull_timestamp).getTime(),
    );
    for (const pull of sortedPulls) {
      if(pull.rarity===0){streak.length=0;continue;}
      if (pull.rarity !== 5) continue;
      const featured = Boolean(pull.is_featured ?? (pull as any).isFeatured);
      const outcome = pull.streak_outcome ?? (pull as any).streakOutcome ?? (featured ? 'win' : 'loss');
      if (outcome !== 'win' && outcome !== 'loss') {streak.length=0;continue;}
      const next = evaluateStreak(streak).nextPrediction;
      if (next !== 'forced_win' && next !== 'forced_loss') {
        neutralRolls += 1;
        if (outcome === 'win') neutralWins += 1;
      }
      streak.push(outcome);
    }
  }

  const totalPulls = weaponAnalytics.total_pulls + matrixAnalytics.total_pulls;
  const totalSsr = weaponAnalytics.total_ssr + matrixAnalytics.total_ssr;
  return {
    total_pulls: totalPulls,
    total_ssr: totalSsr,
    ssr_rate: totalPulls > 0 ? Number(((totalSsr / totalPulls) * 100).toFixed(2)) : 0,
    avg_ssr_interval: intervals.length > 0 ? Number((intervalSum / intervals.length).toFixed(1)) : 0,
    median_ssr_interval: medianInterval,
    early_ssr_count: weaponAnalytics.early_ssr_count + matrixAnalytics.early_ssr_count,
    pity_ssr_count: weaponAnalytics.pity_ssr_count + matrixAnalytics.pity_ssr_count,
    wins_count: weaponAnalytics.wins_count + matrixAnalytics.wins_count,
    losses_count: weaponAnalytics.losses_count + matrixAnalytics.losses_count,
    neutral_50_50_rate: neutralRolls > 0 ? Number(((neutralWins / neutralRolls) * 100).toFixed(2)) : 50,
    interval_distribution: intervalDistribution,
    cashback_breakdown: {
      base_currency: weaponAnalytics.cashback_breakdown.base_currency + matrixAnalytics.cashback_breakdown.base_currency,
      extra_duplicate_currency: weaponAnalytics.cashback_breakdown.extra_duplicate_currency + matrixAnalytics.cashback_breakdown.extra_duplicate_currency,
    },
    matrix_distribution: matrixAnalytics.matrix_distribution,
  };
}

export interface TrackCardSummary {
  track: BannerTrack;
  titleKey: string;
  totalPulls: number;
  featuredWinRate?: number | null;
  featuredSsrCount?: number;
  offBannerSsrCount?: number;
  unclassifiedSsrCount?: number;
  dcEquivalent: number;
  pity5: number;
  maxPity5: number;
  pity4: number;
  maxPity4: number;
  ssrCount: number;
  hasGuaranteed5: boolean;
  hasGuaranteed4: boolean;
  recentOutcomes?: RecentSsrOutcome[];
  nextPrediction?: 'forced_win' | 'forced_loss' | 'neutral_50_50' | 'unknown';
}

export interface ConsolidatedAccountSummary {
  totalPulls: number;
  dcEquivalent: number;
  ssrCount: number;
  totalBanners: number;
  eventPulls: number;
  eventDcEquivalent: number;
  standardPulls: number;
  standardWeaponCount: number;
  standardMatrixCount: number;
  standardWeaponCashback: number;
  standardMatrixCashback: number;
  blackNucleusCount: number;
  blackNucleusSsrCount: number;
  eventSsrCount: number;
  standardSsrCount: number;
}

const DEFAULT_FILTERS: WishFilters = {
  primaryCategory: 'all',
  itemType: 'all',
  bannerId: 'all',
  rarity: 'ALL',
  outcome: 'ALL',
  isGuaranteed: 'ALL',
  slot: 'ALL',
  hideLosses: false,
  search: '',
};

const CURRENT_WISH_PROFILE_STORAGE_KEY = 'tof-wish-current-profile';

export function useWishData() {
  const [activeTab, setActiveTab] = useState<WishTab>('history');
  const [activeTrack, setActiveTrack] = useState<BannerTrack>('weapon_limited');
  const [activeBannerId, setActiveBannerId] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [filters, setFilters] = useState<WishFilters>(DEFAULT_FILTERS);
  const [currentProfileId, setCurrentProfileId] = useState<string>('full-history-demo');
  const [importedEntries, setImportedEntries] = useState<ImportedProfileEntry[]>([]);
  const [areImportedProfilesLoaded, setAreImportedProfilesLoaded] = useState(false);
  const [isProfileSelectionReady, setIsProfileSelectionReady] = useState(false);
  const [page, setPage] = useState<number>(1);
  const pageSize = 100;
  const allPlayerProfiles = useMemo(
    () => importedEntries.length > 0 ? importedEntries.map((entry) => entry.player) : DEV_PLAYERS_DATA,
    [importedEntries],
  );

  const refreshProfiles = useCallback(async (selectId?: string) => {
    const ids = readImportedProfileIds();
    const entries = await Promise.allSettled(ids.map(async (id) => {
      const token = readProfileToken(id);
      const response = await fetch(`/api/v1/wish/profiles/${encodeURIComponent(id)}/imported`, {
        cache: 'no-store',
        ...(token ? { headers: { 'x-wish-token': token } } : {}),
      });
      if (!response.ok) return null;
      const data = await response.json() as ImportedProfileResponse;
      return toImportedProfileEntry(data);
    }));
    const loaded = entries.flatMap((entry) => entry.status === 'fulfilled' && entry.value ? [entry.value] : []);
    setImportedEntries(loaded);
    setAreImportedProfilesLoaded(true);
    if (selectId) {
      setCurrentProfileId(selectId);
      try {
        window.localStorage.setItem(CURRENT_WISH_PROFILE_STORAGE_KEY, selectId);
      } catch {}
    }
    return loaded;
  }, []);

  useEffect(() => {
    let cancelled = false;
    // A shared link may carry ?profileId=…&token=… (second device): adopt the
    // token into storage once, then drop it from the address bar.
    try {
      const params = new URLSearchParams(window.location.search);
      const sharedProfile = params.get('profileId');
      const sharedToken = params.get('token');
      if (sharedProfile && sharedToken) {
        rememberImportedProfileId(sharedProfile);
        rememberProfileToken(sharedProfile, sharedToken);
        params.delete('token');
        window.history.replaceState(null, '', `${window.location.pathname}${params.size ? `?${params}` : ''}${window.location.hash}`);
      }
    } catch {
      // Token adoption is best effort; known IPs still load without it.
    }
    void refreshProfiles();
    return () => { cancelled = true; };
  }, [refreshProfiles]);

  // Derive BannerKind ('weapon' | 'matrix') for backward compatibility
  const activeKind: BannerKind = useMemo(() => {
    return activeTrack === 'matrix_limited' || activeTrack === 'standard_matrix'
      ? 'matrix'
      : 'weapon';
  }, [activeTrack]);

  // Read URL query params on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get('tab') as WishTab | null;
    const trackParam = urlParams.get('track') as BannerTrack | null;
    const bannerIdParam = urlParams.get('banner') || urlParams.get('bannerId');
    const legacyKindParam = urlParams.get('kind') as BannerKind | null;
    const profileIdParam = urlParams.get('profileId') || urlParams.get('player') || urlParams.get('uid');

    let storedProfileId: string | null = null;
    try {
      storedProfileId = window.localStorage.getItem(CURRENT_WISH_PROFILE_STORAGE_KEY);
    } catch {
      // Continue with URL or default profile when browser storage is unavailable.
    }
    const match = [profileIdParam, storedProfileId]
      .filter((id): id is string => Boolean(id))
      .map((id) => allPlayerProfiles.find((profile) => profile.id === id || profile.uid === id))
      .find((profile) => profile !== undefined);
    if (match) {
      setCurrentProfileId(match.id);
      try {
        window.localStorage.setItem(CURRENT_WISH_PROFILE_STORAGE_KEY, match.id);
      } catch {
        // The selected profile still works for this page view without storage.
      }
    }
    // Wait until imported profiles are available before rendering the default
    // profile; this lets the URL and saved account resolve in one stable pass.
    setIsProfileSelectionReady(areImportedProfilesLoaded);

    if (tabParam && ['overview', 'history', 'analytics', 'simulation'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
    const selectedKnownBanner = bannerIdParam
      ? [ZOEY_WEAPON_BANNER, ZOEY_MATRIX_BANNER,
          STANDARD_WEAPON_BANNER, STANDARD_MATRIX_BANNER, BLACK_NUCLEUS_BANNER]
          .find((candidate) => candidate.id === bannerIdParam)
      : undefined;
    if (selectedKnownBanner) {
      setActiveTrack(selectedKnownBanner.banner_type);
    } else if (
      trackParam &&
      [
        'weapon_limited',
        'matrix_limited',
        'standard_weapon',
        'standard_matrix',
        'black_nucleus',
      ].includes(trackParam)
    ) {
      setActiveTrack(trackParam);
    } else if (legacyKindParam) {
      setActiveTrack(legacyKindParam === 'matrix' ? 'matrix_limited' : 'weapon_limited');
    }
    if (bannerIdParam) {
      setActiveBannerId(bannerIdParam);
    } else if (trackParam === 'standard_weapon') {
      setActiveBannerId(STANDARD_WEAPON_BANNER.id);
    } else if (trackParam === 'standard_matrix') {
      setActiveBannerId(STANDARD_MATRIX_BANNER.id);
    } else if (trackParam === 'black_nucleus') {
      setActiveBannerId(BLACK_NUCLEUS_BANNER.id);
    }
  }, [allPlayerProfiles, areImportedProfilesLoaded]);

  const updateUrl = useCallback(
    (newTab: WishTab, newTrack: BannerTrack, newBannerId: string, profileId?: string) => {
      if (typeof window === 'undefined') return;
      const url = new URL(window.location.href);
      url.searchParams.set('tab', newTab);
      url.searchParams.set('track', newTrack);
      if (newBannerId && newBannerId !== 'all') {
        url.searchParams.set('banner', newBannerId);
      } else {
        url.searchParams.delete('banner');
      }
      const targetProfileId = profileId ?? currentProfileId;
      if (targetProfileId && targetProfileId !== 'full-history-demo') {
        url.searchParams.set('profileId', targetProfileId);
      } else {
        url.searchParams.delete('profileId');
      }
      // Also keep legacy kind for deep links
      const legacyKind = newTrack.includes('matrix') ? 'matrix' : 'weapon';
      url.searchParams.set('kind', legacyKind);
      window.history.replaceState({}, '', url.toString());
    },
    [currentProfileId]
  );

  const currentProfile: WishPlayerProfile = useMemo(() => {
    return allPlayerProfiles.find((p) => p.id === currentProfileId) ?? allPlayerProfiles[0] ?? DEV_PLAYERS_DATA[0];
  }, [currentProfileId, allPlayerProfiles]);

  const profilePulls = useMemo(() => {
    return currentProfile.getPulls();
  }, [currentProfile]);

  // All banners that player has pulls on
  const allPlayerBanners: WishBannerDto[] = useMemo(() => {
    return [
      ZOEY_WEAPON_BANNER,
      ZOEY_MATRIX_BANNER,
      STANDARD_WEAPON_BANNER,
      STANDARD_MATRIX_BANNER,
      BLACK_NUCLEUS_BANNER,
      ...(importedEntries.find((entry) => entry.player.id === currentProfileId)?.banners ?? []),
    ];
  }, [currentProfileId, importedEntries]);

  const handleTabChange = useCallback(
    (tab: WishTab) => {
      setActiveTab(tab);
      updateUrl(tab, activeTrack, activeBannerId);
    },
    [activeTrack, activeBannerId, updateUrl]
  );

  const handleTrackChange = useCallback(
    (track: BannerTrack) => {
      setActiveTrack(track);
      setActiveBannerId('all');
      setFilters((prev) => ({ ...prev, bannerId: 'all' }));
      setPage(1);
      updateUrl(activeTab, track, 'all');
    },
    [activeTab, updateUrl]
  );

  // Backward-compatible kind change handler
  const handleKindChange = useCallback(
    (kind: BannerKind) => {
      const nextTrack: BannerTrack = kind === 'weapon' ? 'weapon_limited' : 'matrix_limited';
      handleTrackChange(nextTrack);
    },
    [handleTrackChange]
  );

  // API Live Pulls (for Zoey demo)
  const [apiWeaponPulls, setApiWeaponPulls] = useState<WishRecordDto[] | null>(null);
  const [apiMatrixPulls, setApiMatrixPulls] = useState<WishRecordDto[] | null>(null);
  const [bannerArchive, setBannerArchive] = useState<WishBannerDto[]>([]);

  useEffect(() => {
    let isCancelled = false;
    fetch('/game-data/runtime/wish-banners.json')
      .then((response) => response.ok ? response.json() : [])
      .then((payload: unknown) => {
        if (!isCancelled && Array.isArray(payload)) {
          setBannerArchive(payload as WishBannerDto[]);
        }
      })
      .catch(() => {
        // Keep the local demo banner list available when the archive is absent.
      });
    return () => { isCancelled = true; };
  }, []);

  useEffect(() => {
    let isCancelled = false;
    async function fetchPullsFromApi() {
      try {
        const [weaponRes, matrixRes] = await Promise.all([
          fetch(
            `/api/v1/wish/profiles/demo-user-profile/pulls?bannerId=${ZOEY_WEAPON_BANNER.id}&limit=500`
          ),
          fetch(
            `/api/v1/wish/profiles/demo-user-profile/pulls?bannerId=${ZOEY_MATRIX_BANNER.id}&limit=500`
          ),
        ]);

        if (weaponRes.ok) {
          const wJson = await weaponRes.json();
          if (
            !isCancelled &&
            wJson?.success &&
            Array.isArray(wJson.data?.items) &&
            wJson.data.items.length > 0
          ) {
            setApiWeaponPulls(
              [...wJson.data.items].sort(
                (a, b) =>
                  new Date(a.pull_timestamp).getTime() - new Date(b.pull_timestamp).getTime()
              )
            );
          }
        }
        if (matrixRes.ok) {
          const mJson = await matrixRes.json();
          if (
            !isCancelled &&
            mJson?.success &&
            Array.isArray(mJson.data?.items) &&
            mJson.data.items.length > 0
          ) {
            setApiMatrixPulls(
              [...mJson.data.items].sort(
                (a, b) =>
                  new Date(a.pull_timestamp).getTime() - new Date(b.pull_timestamp).getTime()
              )
            );
          }
        }
      } catch {
        // Fallback to local fixtures
      }
    }

    fetchPullsFromApi();
    return () => {
      isCancelled = true;
    };
  }, []);

  // Track Banners Configuration
  const availableBannersInTrack: WishBannerDto[] = useMemo(() => {
    const imported = importedEntries.find((entry) => entry.player.id === currentProfileId)?.banners ?? [];
    const archived = [...imported, ...bannerArchive].filter((banner) => banner.banner_type === activeTrack);
    if (archived.length > 0) return archived;
    switch (activeTrack) {
      case 'weapon_limited':
        return [ZOEY_WEAPON_BANNER];
      case 'matrix_limited':
        return [ZOEY_MATRIX_BANNER];
      case 'standard_weapon':
        return [STANDARD_WEAPON_BANNER];
      case 'standard_matrix':
        return [STANDARD_MATRIX_BANNER];
      case 'black_nucleus':
        return [BLACK_NUCLEUS_BANNER];
    }
  }, [activeTrack, bannerArchive, importedEntries, currentProfileId]);

  const allKnownBanners = useMemo(() => {
    const banners = new Map<string, WishBannerDto>();
    for (const banner of [
      ZOEY_WEAPON_BANNER,
      ZOEY_MATRIX_BANNER,
      STANDARD_WEAPON_BANNER,
      STANDARD_MATRIX_BANNER,
      BLACK_NUCLEUS_BANNER,
      ...bannerArchive,
      ...importedEntries.flatMap((entry) => entry.banners),
    ]) banners.set(banner.id, banner);
    return [...banners.values()];
  }, [bannerArchive, importedEntries]);

  const handleBannerSelect = useCallback(
    (bannerId: string) => {
      setActiveBannerId(bannerId);
      setFilters((prev) => ({ ...prev, bannerId }));
      setPage(1);

      const targetTrack = bannerId === 'all' || bannerId === 'characters'
        ? 'weapon_limited'
        : bannerId === 'matrices'
          ? 'matrix_limited'
          : allKnownBanners.find((candidate) => candidate.id === bannerId)?.banner_type ?? activeTrack;
      setActiveTrack(targetTrack);
      updateUrl(activeTab, targetTrack, bannerId);
    },
    [activeTab, activeTrack, allKnownBanners, updateUrl],
  );

  // Archive banners arrive after the initial URL is read. Resolve deep links to
  // their actual track once the catalog is available.
  useEffect(() => {
    if (activeBannerId === 'all' || activeBannerId === 'characters' || activeBannerId === 'matrices') return;
    const selectedBanner = allKnownBanners.find((candidate) => candidate.id === activeBannerId);
    if (selectedBanner && selectedBanner.banner_type !== activeTrack) {
      setActiveTrack(selectedBanner.banner_type);
    }
  }, [activeBannerId, activeTrack, allKnownBanners]);

  const allKnownBannersByTrack = useMemo(
    () => allKnownBanners.filter((banner) => banner.banner_type === activeTrack),
    [allKnownBanners, activeTrack],
  );

  // Selected banner entity for showcase card
  const banner: WishBannerDto = useMemo(() => {
    if (activeBannerId !== 'all') {
      const match = allKnownBanners.find((b) => b.id === activeBannerId && b.banner_type === activeTrack);
      if (match) return match;
    }
    return allKnownBannersByTrack[0] ?? allKnownBanners[0];
  }, [allKnownBanners, allKnownBannersByTrack, activeBannerId, activeTrack]);

  // Individual category datasets
  const limitedWeaponPulls: WishRecordDto[] = useMemo(() => {
    if (currentProfileId === 'demo-user-profile' && apiWeaponPulls && apiWeaponPulls.length > 0) {
      // The API request fetches only Zoey; keep the other event banners in the
      // shared weapon history so selecting All can replay pity across them.
      return [...apiWeaponPulls, ...profilePulls.weaponLimited.filter((pull) => pull.banner_id !== ZOEY_WEAPON_BANNER.id)]
        .sort((a, b) => a.pull_timestamp.localeCompare(b.pull_timestamp)
          || (a.group_ticks ?? '').localeCompare(b.group_ticks ?? '')
          || (a.item_index ?? 0) - (b.item_index ?? 0));
    }
    return profilePulls.weaponLimited;
  }, [currentProfileId, apiWeaponPulls, profilePulls.weaponLimited]);

  const limitedMatrixPulls: WishRecordDto[] = useMemo(() => {
    if (currentProfileId === 'demo-user-profile' && apiMatrixPulls && apiMatrixPulls.length > 0) {
      return apiMatrixPulls;
    }
    return profilePulls.matrixLimited;
  }, [currentProfileId, apiMatrixPulls, profilePulls.matrixLimited]);

  const standardWeaponPulls: WishRecordDto[] = useMemo(() => {
    return profilePulls.standardWeapon;
  }, [profilePulls.standardWeapon]);

  const standardMatrixPulls: WishRecordDto[] = useMemo(() => {
    return profilePulls.standardMatrix;
  }, [profilePulls.standardMatrix]);

  const blackNucleusPulls: WishRecordDto[] = useMemo(() => {
    return profilePulls.blackNucleus;
  }, [profilePulls.blackNucleus]);

  // Pulls by active Track (for Track-specific Pity & KPIs)
  const trackAllPulls: WishRecordDto[] = useMemo(() => {
    switch (activeTrack) {
      case 'weapon_limited':
        return limitedWeaponPulls;
      case 'matrix_limited':
        return limitedMatrixPulls;
      case 'standard_weapon':
        return standardWeaponPulls;
      case 'standard_matrix':
        return standardMatrixPulls;
      case 'black_nucleus':
        return blackNucleusPulls;
    }
  }, [
    activeTrack,
    limitedWeaponPulls,
    limitedMatrixPulls,
    standardWeaponPulls,
    standardMatrixPulls,
    blackNucleusPulls,
  ]);

  // Consolidated Pulls across ALL banners and categories
  const allConsolidatedPulls: WishRecordDto[] = useMemo(() => {
    return [
      ...limitedWeaponPulls,
      ...limitedMatrixPulls,
      ...standardWeaponPulls,
      ...standardMatrixPulls,
      ...blackNucleusPulls,
    ].sort((a, b) =>
      a.pull_timestamp.localeCompare(b.pull_timestamp) ||
      (a.group_ticks ?? '').localeCompare(b.group_ticks ?? '') ||
      (a.item_index ?? 0) - (b.item_index ?? 0)
    );
  }, [
    limitedWeaponPulls,
    limitedMatrixPulls,
    standardWeaponPulls,
    standardMatrixPulls,
    blackNucleusPulls,
  ]);

  // Pulls for currently selected banner (or all in track if 'all')
  const activeBannerPulls: WishRecordDto[] = useMemo(() => {
    if (activeBannerId !== 'all' && activeBannerId !== 'characters' && activeBannerId !== 'matrices') {
      return allConsolidatedPulls.filter((p) => p.banner_id === activeBannerId);
    }
    return trackAllPulls;
  }, [allConsolidatedPulls, trackAllPulls, activeBannerId]);

  // Map of pull counts per banner
  const bannerPullCounts: Record<string, number> = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of allConsolidatedPulls) {
      counts[p.banner_id] = (counts[p.banner_id] ?? 0) + 1;
    }
    return counts;
  }, [allConsolidatedPulls]);

  // Pity state for active track
  const pityState = useMemo(() => {
    return replayPityChain(trackAllPulls, activeTrack, {currentPity: currentProfile.pitySnapshots?.find(snapshot => snapshot.banner_type === activeTrack)?.current_pity});
  }, [trackAllPulls, activeTrack, currentProfile]);

  const streakEval = useMemo(() => {
    return evaluateStreak(pityState.streaks);
  }, [pityState.streaks]);

  const cashback = useMemo(() => {
    return calculateCashbackSummary(activeBannerPulls, {
      expectedCashbackCurrency: banner.cashback_currency,
    });
  }, [activeBannerPulls, banner.cashback_currency]);

  const weaponAnalytics: WishAnalyticsDto = useMemo(
    () => calculateAnalytics(limitedWeaponPulls, 'weapon_limited'),
    [limitedWeaponPulls],
  );
  const matrixAnalytics: WishAnalyticsDto = useMemo(
    () => calculateAnalytics(limitedMatrixPulls, 'matrix_limited'),
    [limitedMatrixPulls],
  );
  const analytics: WishAnalyticsDto = useMemo(() => {
    if (activeBannerId === 'all') {
      return combineLimitedTrackAnalytics(
        limitedWeaponPulls,
        limitedMatrixPulls,
        weaponAnalytics,
        matrixAnalytics,
      );
    }
    return calculateAnalytics(trackAllPulls, activeTrack);
  }, [
    activeBannerId,
    activeTrack,
    trackAllPulls,
    limitedWeaponPulls,
    limitedMatrixPulls,
    weaponAnalytics,
    matrixAnalytics,
  ]);

  const bannerSsrFeed = useMemo(() => {
    if (activeBannerId !== 'all') {
      return pityState.ssrFeed.filter((item) =>
        activeBannerPulls.some(
          (p) => p.item_id === item.item_id && p.pull_timestamp === item.timestamp
        )
      );
    }
    return pityState.ssrFeed;
  }, [activeBannerId, pityState.ssrFeed, activeBannerPulls]);

  // Summary object for KPI cards and showcase
  const summary = useMemo(() => {
    const isSpecificBanner = activeBannerId !== 'all';
    const totalPulls = isSpecificBanner ? activeBannerPulls.length : trackAllPulls.length;
    const ssrCount = isSpecificBanner
      ? activeBannerPulls.filter((p) => p.rarity === 5).length
      : pityState.totalSsr;
    const hardPityCount = isSpecificBanner
      ? activeBannerPulls.filter((p) => p.rarity === 5 && p.is_guaranteed_pity).length
      : pityState.pitySsrCount;
    const earlySsrCount = isSpecificBanner
      ? activeBannerPulls.filter((p) => p.rarity === 5 && !p.is_guaranteed_pity).length
      : pityState.earlySsrCount;

    return {
      profileId: currentProfile.id,
      bannerId: banner.id,
      orderType: activeTrack,
      totalPulls,
      currentPity:
        activeTrack === 'black_nucleus'
          ? pityState.currentIncompleteInterval
          : pityState.currentPity,
      maxPity: pityState.pityTarget,
      pityRemaining: pityState.pullsToGuarantee,
      ssrCount,
      hardPityCount,
      earlySsrCount,
      cashbackTotal: cashback.totalCurrencyAwarded,
      baseCashback: cashback.baseCurrency,
      extraCashback: cashback.extraDuplicateCurrency,
      currencyId: banner.cashback_currency,
      streakState: {
        lastOutcomes: pityState.streaks.slice(-2),
        predictedNextOutcome: streakEval.nextPrediction,
        confidence: streakEval.winProbability,
      },
      recentSsrFeed: bannerSsrFeed,
    };
  }, [
    banner,
    activeTrack,
    activeBannerId,
    activeBannerPulls,
    trackAllPulls.length,
    pityState,
    cashback,
    streakEval,
    bannerSsrFeed,
  ]);

  const extractShortCharacterName = useCallback(
    (itemName: string, itemNameRu?: string, locale: 'ru' | 'en' = 'ru'): string => {
      let result = '';
      if (locale === 'ru') {
        const source = itemNameRu || itemName;
        const parenMatch = source.match(/\(([^)]+)\)/);
        if (parenMatch && parenMatch[1]) {
          result = parenMatch[1].trim();
        } else if (source.includes(':')) {
          result = source.split(':')[0].trim();
        } else {
          const ruMatrixCharMap: Record<string, string> = {
            'Голоса сомнения': 'Лира',
            'Поток сердца': 'Саки',
            'Взгляд сквозь рассвет': 'Саки',
            'Ткач теней': 'Лин',
            'Веспер': 'Лира',
            'Венера': 'Немезида',
          };
          const trimmed = source.trim();
          if (ruMatrixCharMap[trimmed]) {
            result = ruMatrixCharMap[trimmed];
          } else {
            result = source
              .replace(/^Матрица\s*/i, '')
              .replace(/\[.*?\]/g, '')
              .trim();
          }
        }
        if (result === 'Саки Фува') return 'Саки';
        if (result === 'Коко Риттер') return 'Коко';
        return result || source;
      }

      const enMap: Record<string, string> = {
        Vesper: 'Lyra',
        Heartstream: 'Saki',
        Venus: 'Nemesis',
        'EM Dual Stars': 'Samir',
        'Scythe of the Crow': 'KING',
        'Rosy Edge': 'Meryl',
        Thunderblades: 'Crow',
        'Negating Cube': 'Zero',
        'Icewind Arrow': 'Tsubasa',
        'Chakram of the Seas': 'Shiro',
        'Absolute Zero': 'Coco',
        'Molten Shield V2': 'Huma',
        'Guren Blade': 'Claudia',
        'Shadow Weaver': 'Lin',
        Balmung: 'Frigg',
        Spark: 'Ruby',
        'Giga Cedar': 'Fiona',
        Gleipnir: 'Fenrir',
        'Unyielding Wing': 'Alyss',
        'Free Flow': 'Icarus',
        'Vermilion Bird': 'Lan',
        'Pine Comet': 'Liu Huo',
        'Alabaster Tiger': 'Yulan',
        Unity: 'Zeke',
        'Onyx Tortoise': 'Huang',
        Equinox: 'Fei Se',
        'Moonstar Bracelet': 'Ji Yu',
        'Voices of Doubt': 'Lyra',
      };

      if (enMap[itemName]) return enMap[itemName];

      if (itemName.includes(':')) {
        const prefix = itemName.split(':')[0].trim();
        return prefix === 'Cocoritter' ? 'Coco' : prefix;
      }

      const parenMatch = itemName.match(/\(([^)]+)\)/);
      if (parenMatch && parenMatch[1]) {
        const val = parenMatch[1].trim();
        return val === 'Saki Fuwa' ? 'Saki' : val;
      }

      return itemName
        .replace(/\s*Matrix.*$/i, '')
        .replace(/\[.*?\]/g, '')
        .trim();
    },
    []
  );

  const calculate4Pity = useCallback((pulls: readonly WishRecordDto[]): number => {
    if (pulls.length === 0) return -1;
    let count = 0;
    for (let i = pulls.length - 1; i >= 0; i--) {
      if (pulls[i].rarity >= 4) return count;
      if (i > 0 && pulls[i].track_pull_number !== undefined && pulls[i - 1].track_pull_number !== undefined
        && pulls[i].track_pull_number! !== pulls[i - 1].track_pull_number! + 1) return -1;
      count++;
    }
    return pulls.some((pull) => pull.raw_banner_code) ? -1 : count;
  }, []);

  const trackSummaries: Record<BannerTrack, TrackCardSummary> = useMemo(() => {
    const limitedWeaponPityState = replayPityChain(limitedWeaponPulls, 'weapon_limited', {currentPity: currentProfile.pitySnapshots?.find(snapshot => snapshot.banner_type === 'weapon_limited')?.current_pity});
    const limitedMatrixPityState = replayPityChain(limitedMatrixPulls, 'matrix_limited', {currentPity: currentProfile.pitySnapshots?.find(snapshot => snapshot.banner_type === 'matrix_limited')?.current_pity});
    const standardWeaponPityState = replayPityChain(standardWeaponPulls, 'standard_weapon', {currentPity: currentProfile.pitySnapshots?.find(snapshot => snapshot.banner_type === 'standard_weapon')?.current_pity});
    const standardMatrixPityState = replayPityChain(standardMatrixPulls, 'standard_matrix', {currentPity: currentProfile.pitySnapshots?.find(snapshot => snapshot.banner_type === 'standard_matrix')?.current_pity});
    const blackNucleusPityState = replayPityChain(blackNucleusPulls, 'black_nucleus');
    const getBannerNames = (bannerId: string) => {
      const sourceBanner = allKnownBanners.find((banner) => banner.id === bannerId);
      return {
        bannerNameRu: sourceBanner?.name_ru ?? bannerId,
        bannerNameEn: sourceBanner?.name_en ?? bannerId,
      };
    };

    const getRecentSsrDrops = (pulls: readonly WishRecordDto[]): RecentSsrOutcome[] =>
      [...pulls]
        .filter((pull) => pull.rarity === 5)
        .sort((a, b) => a.pull_timestamp.localeCompare(b.pull_timestamp) || (a.item_index ?? 0) - (b.item_index ?? 0))
        .slice(-3)
        .map((pull) => ({
          itemId: pull.item_id,
          itemName: pull.item_name,
          shortNameRu: extractShortCharacterName(pull.item_name, pull.item_name_ru, 'ru'),
          shortNameEn: extractShortCharacterName(pull.item_name, pull.item_name_ru, 'en'),
          ...getBannerNames(pull.banner_id),
          pullDate: pull.pull_timestamp,
          pityAtDrop: pull.pity_count,
          slot: pull.slot,
        }));

    const weaponSsrs = limitedWeaponPulls.filter((p) => p.rarity === 5);
    const recentWeaponOutcomes: RecentSsrOutcome[] = weaponSsrs.slice(-3).map((p) => {
      const isKnown = p.streak_outcome === 'win' || p.streak_outcome === 'loss' || !p.streak_outcome;
      const isWin = p.streak_outcome ? p.streak_outcome === 'win' : Boolean(p.is_featured);
      return {
        itemId: p.item_id,
        itemName: p.item_name,
        shortNameRu: extractShortCharacterName(p.item_name, p.item_name_ru, 'ru'),
        shortNameEn: extractShortCharacterName(p.item_name, p.item_name_ru, 'en'),
        ...getBannerNames(p.banner_id),
        pullDate: p.pull_timestamp,
        outcome: isKnown ? (isWin ? 'win' : 'loss') : undefined,
        pityAtDrop: p.pity_count,
      };
    });
    const weaponStreakEval = evaluateStreak(limitedWeaponPityState.streaks);

    const matrixSsrs = limitedMatrixPulls.filter((p) => p.rarity === 5);
    const recentMatrixOutcomes: RecentSsrOutcome[] = matrixSsrs.slice(-3).map((p) => {
      const isKnown = p.streak_outcome === 'win' || p.streak_outcome === 'loss' || !p.streak_outcome;
      const isWin = p.streak_outcome ? p.streak_outcome === 'win' : Boolean(p.is_featured);
      return {
        itemId: p.item_id,
        itemName: p.item_name,
        shortNameRu: extractShortCharacterName(p.item_name, p.item_name_ru, 'ru'),
        shortNameEn: extractShortCharacterName(p.item_name, p.item_name_ru, 'en'),
        ...getBannerNames(p.banner_id),
        pullDate: p.pull_timestamp,
        outcome: isKnown ? (isWin ? 'win' : 'loss') : undefined,
        pityAtDrop: p.pity_count,
        slot: p.slot,
      };
    });
    const matrixStreakEval = evaluateStreak(limitedMatrixPityState.streaks);
    const getFeaturedWinRate = (pulls: readonly WishRecordDto[]) => {
      const ssrs = pulls.filter((pull) => pull.rarity === 5 && pull.streak_outcome !== 'unknown');
      if (ssrs.length === 0) return null;
      const wins = ssrs.filter((pull) => (pull.streak_outcome ?? (pull.is_featured ? 'win' : 'loss')) === 'win').length;
      return (wins / ssrs.length) * 100;
    };
    const getLimitedSsrOutcomes = (pulls: readonly WishRecordDto[]) => {
      const ssrs = pulls.filter((pull) => pull.rarity === 5);
      return {
        featuredSsrCount: ssrs.filter((pull) => (pull.streak_outcome ?? (pull.is_featured ? 'win' : 'loss')) === 'win').length,
        offBannerSsrCount: ssrs.filter((pull) => (pull.streak_outcome ?? (pull.is_featured ? 'win' : 'loss')) === 'loss').length,
        unclassifiedSsrCount: ssrs.filter((pull) => pull.streak_outcome === 'unknown').length,
      };
    };

    return {
      weapon_limited: {
        track: 'weapon_limited',
        titleKey: 'trackLimitedWeapon',
        totalPulls: limitedWeaponPulls.length,
        featuredWinRate: getFeaturedWinRate(limitedWeaponPulls),
        ...getLimitedSsrOutcomes(limitedWeaponPulls),
        dcEquivalent: limitedWeaponPulls.length * PULL_DC_COST,
        pity5: currentProfile.pitySnapshots?.find(snapshot => snapshot.banner_type === 'weapon_limited')?.current_pity ?? (limitedWeaponPulls.length ? limitedWeaponPityState.currentPity : -1),
        maxPity5: 80,
        pity4: calculate4Pity(limitedWeaponPulls),
        maxPity4: 10,
        ssrCount: limitedWeaponPityState.totalSsr,
        hasGuaranteed5: true,
        hasGuaranteed4: true,
        recentOutcomes: recentWeaponOutcomes,
        nextPrediction: weaponStreakEval.nextPrediction,
      },
      matrix_limited: {
        track: 'matrix_limited',
        titleKey: 'trackLimitedMatrix',
        totalPulls: limitedMatrixPulls.length,
        featuredWinRate: getFeaturedWinRate(limitedMatrixPulls),
        ...getLimitedSsrOutcomes(limitedMatrixPulls),
        dcEquivalent: limitedMatrixPulls.length * PULL_DC_COST,
        pity5: currentProfile.pitySnapshots?.find(snapshot => snapshot.banner_type === 'matrix_limited')?.current_pity ?? (limitedMatrixPulls.length ? limitedMatrixPityState.currentPity : -1),
        maxPity5: 40,
        pity4: calculate4Pity(limitedMatrixPulls),
        maxPity4: 10,
        ssrCount: limitedMatrixPityState.totalSsr,
        hasGuaranteed5: true,
        hasGuaranteed4: true,
        recentOutcomes: recentMatrixOutcomes,
        nextPrediction: matrixStreakEval.nextPrediction,
      },
      standard_weapon: {
        track: 'standard_weapon',
        titleKey: 'trackStandardWeapon',
        totalPulls: standardWeaponPulls.length,
        dcEquivalent: standardWeaponPulls.length * PULL_DC_COST,
        pity5: currentProfile.pitySnapshots?.find(snapshot => snapshot.banner_type === 'standard_weapon')?.current_pity ?? (standardWeaponPulls.length ? standardWeaponPityState.currentPity : -1),
        maxPity5: 80,
        pity4: calculate4Pity(standardWeaponPulls),
        maxPity4: 10,
        ssrCount: standardWeaponPityState.totalSsr,
        hasGuaranteed5: true,
        hasGuaranteed4: true,
        recentOutcomes: getRecentSsrDrops(standardWeaponPulls),
      },
      standard_matrix: {
        track: 'standard_matrix',
        titleKey: 'trackStandardMatrix',
        totalPulls: standardMatrixPulls.length,
        dcEquivalent: standardMatrixPulls.length * PULL_DC_COST,
        pity5: currentProfile.pitySnapshots?.find(snapshot => snapshot.banner_type === 'standard_matrix')?.current_pity ?? (standardMatrixPulls.length ? standardMatrixPityState.currentPity : -1),
        maxPity5: 40,
        pity4: calculate4Pity(standardMatrixPulls),
        maxPity4: 10,
        ssrCount: standardMatrixPityState.totalSsr,
        hasGuaranteed5: true,
        hasGuaranteed4: true,
        recentOutcomes: getRecentSsrDrops(standardMatrixPulls),
      },
      black_nucleus: {
        track: 'black_nucleus',
        titleKey: 'trackBlackNucleus',
        totalPulls: blackNucleusPulls.length,
        dcEquivalent: 0,
        pity5: blackNucleusPityState.currentPity < 0 ? -1 : blackNucleusPityState.currentIncompleteInterval,
        maxPity5: 0,
        pity4: calculate4Pity(blackNucleusPulls),
        maxPity4: 0,
        ssrCount: blackNucleusPityState.totalSsr,
        hasGuaranteed5: false,
        hasGuaranteed4: false,
        recentOutcomes: getRecentSsrDrops(blackNucleusPulls),
      },
    };
  }, [
    limitedWeaponPulls,
    limitedMatrixPulls,
    standardWeaponPulls,
    standardMatrixPulls,
    blackNucleusPulls,
    allKnownBanners,
    calculate4Pity,
    currentProfile,
    extractShortCharacterName,
  ]);

  const consolidatedAccountSummary: ConsolidatedAccountSummary = useMemo(() => {
    // Event (Limited) pulls: limited weapon + limited matrix
    const eventPulls = limitedWeaponPulls.length + limitedMatrixPulls.length;
    // Dark Crystals spent on event pulls
    const eventDcEquivalent = eventPulls * PULL_DC_COST;

    // Standard pulls include only the regular weapon and matrix pools.
    const standardWeaponCount = standardWeaponPulls.length;
    const standardMatrixCount = standardMatrixPulls.length;
    const blackNucleusCount = blackNucleusPulls.length;
    const standardPulls = standardWeaponCount + standardMatrixCount;
    const standardWeaponCashback = calculateCashbackSummary(standardWeaponPulls, {
      expectedCashbackCurrency: STANDARD_WEAPON_BANNER.cashback_currency,
    }).totalCurrencyAwarded;
    const standardMatrixCashback = calculateCashbackSummary(standardMatrixPulls, {
      expectedCashbackCurrency: STANDARD_MATRIX_BANNER.cashback_currency,
    }).totalCurrencyAwarded;
    // The consolidated order count excludes Black Nucleus pulls; those have their own row.
    const totalPulls = eventPulls + standardPulls;
    const blackNucleusSsrCount = blackNucleusPulls.filter((p) => p.rarity === 5).length;

    // Event SSRs (5-stars from limited weapon and limited matrix banners)
    const eventSsrCount =
      limitedWeaponPulls.filter((p) => p.rarity === 5).length +
      limitedMatrixPulls.filter((p) => p.rarity === 5).length;

    // Standard SSRs (5-stars from standard weapon and standard matrix banners)
    const standardSsrCount =
      standardWeaponPulls.filter((p) => p.rarity === 5).length +
      standardMatrixPulls.filter((p) => p.rarity === 5).length;

    const ssrCount = allConsolidatedPulls.filter((p) => p.rarity === 5).length;
    const totalBanners = Object.keys(bannerPullCounts).length;

    return {
      totalPulls,
      dcEquivalent: eventDcEquivalent,
      ssrCount,
      totalBanners,
      eventPulls,
      eventDcEquivalent,
      standardPulls,
      standardWeaponCount,
      standardMatrixCount,
      standardWeaponCashback,
      standardMatrixCashback,
      blackNucleusCount,
      blackNucleusSsrCount,
      eventSsrCount,
      standardSsrCount,
    };
  }, [
    allConsolidatedPulls,
    limitedWeaponPulls,
    limitedMatrixPulls,
    standardWeaponPulls,
    standardMatrixPulls,
    blackNucleusPulls,
    bannerPullCounts,
  ]);

  // Filtered pulls for Endfield-style history view
  const filteredPulls = useMemo(() => {
    return allConsolidatedPulls.filter((item) => {
      const selectedBannerId = activeBannerId !== 'all' ? activeBannerId : filters.bannerId;

      // 1. Primary filter by active banner or track
      if (selectedBannerId === 'characters') {
        if (item.banner_type !== 'weapon_limited') return false;
      } else if (selectedBannerId === 'matrices') {
        if (item.banner_type !== 'matrix_limited') return false;
      } else if (selectedBannerId !== 'all') {
        if (item.banner_id !== selectedBannerId) return false;
      } else {
        if (item.banner_type !== 'weapon_limited' && item.banner_type !== 'matrix_limited') return false;
      }

      // 2. Primary Category ('all' | 'limited' | 'standard' | 'black_nucleus')
      if (filters.primaryCategory !== 'all') {
        if (filters.primaryCategory === 'limited') {
          if (item.banner_type !== 'weapon_limited' && item.banner_type !== 'matrix_limited')
            return false;
        } else if (filters.primaryCategory === 'standard') {
          if (item.banner_type !== 'standard_weapon' && item.banner_type !== 'standard_matrix')
            return false;
        } else if (filters.primaryCategory === 'black_nucleus') {
          if (item.banner_type !== 'black_nucleus') return false;
        }
      }

      // 3. Item Type ('all' | 'weapon' | 'matrix')
      if (filters.itemType !== 'all') {
        if (item.item_type !== filters.itemType) return false;
      }

      // 4. Rarity filter
      if (filters.rarity !== 'ALL' && String(item.rarity) !== filters.rarity) {
        return false;
      }

      // 5. Hide 50/50 losses
      if (filters.hideLosses && item.streak_outcome === 'loss') {
        return false;
      }

      // 6. 50/50 Outcome filter
      if (filters.outcome !== 'ALL') {
        if (filters.outcome === 'win' && item.streak_outcome !== 'win') return false;
        if (filters.outcome === 'loss' && item.streak_outcome !== 'loss') return false;
      }

      // 7. Guaranteed Pity filter
      if (filters.isGuaranteed !== 'ALL') {
        if (filters.isGuaranteed === 'guaranteed' && !item.is_guaranteed_pity) return false;
        if (filters.isGuaranteed === 'early' && item.is_guaranteed_pity) return false;
      }

      // 8. Matrix Slot filter
      if (filters.slot !== 'ALL') {
        if (item.slot !== filters.slot) return false;
      }

      // 9. Search query
      if (filters.search.trim()) {
        const query = filters.search.toLowerCase().trim();
        const matchesName = item.item_name.toLowerCase().includes(query);
        const matchesRu = item.item_name_ru?.toLowerCase().includes(query) ?? false;
        const matchesId = item.item_id.toLowerCase().includes(query);
        if (!matchesName && !matchesRu && !matchesId) return false;
      }

      return true;
    });
  }, [allConsolidatedPulls, activeBannerId, activeTrack, filters]);

  // Keep the pity sequence readable from oldest to newest, including within a ten-pull batch.
  const paginatedPulls = useMemo(() => {
    return filteredPulls.slice(0, page * pageSize);
  }, [filteredPulls, page, pageSize]);

  const hasMore = paginatedPulls.length < filteredPulls.length;

  const loadMore = useCallback(() => {
    setPage((prev) => prev + 1);
  }, []);

  // Universal luck section weapon & matrix pull providers (reactive to selected profile)
  const weaponPullsForLuck: WishRecordDto[] = useMemo(() => {
    return limitedWeaponPulls;
  }, [limitedWeaponPulls]);

  const matrixPullsForLuck: WishRecordDto[] = useMemo(() => {
    return limitedMatrixPulls;
  }, [limitedMatrixPulls]);

  const selectPlayerProfile = useCallback(
    (profileId: string, targetTrack?: BannerTrack) => {
      setCurrentProfileId(profileId);
      try {
        window.localStorage.setItem(CURRENT_WISH_PROFILE_STORAGE_KEY, profileId);
      } catch {
        // The selected profile still works for this page view without storage.
      }
      const trackToSet = targetTrack ?? 'weapon_limited';
      setActiveTrack(trackToSet);
      setActiveTab('history');
      setActiveBannerId('all');
      setFilters((prev) => ({ ...prev, bannerId: 'all' }));
      setPage(1);
      updateUrl('history', trackToSet, 'all', profileId);
    },
    [updateUrl]
  );

  useEffect(() => {
    if (!areImportedProfilesLoaded || importedEntries.length === 0) return;
    const urlParams = new URLSearchParams(window.location.search);
    let preferredId = urlParams.get('profileId') || urlParams.get('player') || urlParams.get('uid');
    if (!preferredId) {
      try {
        preferredId = window.localStorage.getItem(CURRENT_WISH_PROFILE_STORAGE_KEY);
      } catch {
        // Use the first imported account when browser storage is unavailable.
      }
    }
    const preferredEntry = importedEntries.find(
      (entry) => entry.player.id === preferredId || entry.player.uid === preferredId,
    );
    const nextProfileId = preferredEntry?.player.id ?? importedEntries[0].player.id;
    if (nextProfileId !== currentProfileId) {
      setCurrentProfileId(nextProfileId);
      try {
        window.localStorage.setItem(CURRENT_WISH_PROFILE_STORAGE_KEY, nextProfileId);
      } catch {
        // The selected profile still works for this page view without storage.
      }
      // Initial profile resolution must not reset the tab, track, or banner
      // selected by the deep link.
      updateUrl(activeTab, activeTrack, activeBannerId, nextProfileId);
    }
  }, [
    activeBannerId,
    activeTab,
    activeTrack,
    areImportedProfilesLoaded,
    currentProfileId,
    importedEntries,
    updateUrl,
  ]);

  const handleExport = useCallback(() => {
    const exportData = {
      formatVersion: '2.0.0',
      exportedAt: new Date().toISOString(),
      clientPlatform: 'tof-hub',
      profile: {
        profileId: currentProfile.id,
        region: currentProfile.serverRegion,
        server: currentProfile.server,
        uid: currentProfile.uid,
        isDemo: true,
      },
      activeTrack,
      banners: allPlayerBanners,
      records: allConsolidatedPulls,
    };

    downloadBlob(
      JSON.stringify(exportData, null, 2),
      'application/json;charset=utf-8',
      `tof-wish-export-${currentProfile.uid}-${new Date().toISOString().slice(0, 10)}.json`,
    );
  }, [currentProfile, activeTrack, allPlayerBanners, allConsolidatedPulls]);

  return {
    activeTab,
    setActiveTab: handleTabChange,
    activeTrack,
    setActiveTrack: handleTrackChange,
    activeBannerId,
    setActiveBannerId: handleBannerSelect,
    availableBannersInTrack,
    allPlayerBanners,
    bannerCatalog: allKnownBanners,
    bannerPullCounts,
    activeKind,
    setActiveKind: handleKindChange,
    viewMode,
    setViewMode,
    filters,
    setFilters,
    banner,
    summary,
    analytics,
    weaponAnalytics,
    matrixAnalytics,
    allTrackPulls: trackAllPulls,
    activeBannerPulls,
    allConsolidatedPulls,
    rawPulls: filteredPulls,
    allPulls: filteredPulls,

    filteredPulls,
    paginatedPulls,
    weaponPulls: weaponPullsForLuck,
    matrixPulls: matrixPullsForLuck,
    hasMore,
    loadMore,
    handleExport,
    trackSummaries,
    consolidatedAccountSummary,

    // Developer / Multi-Player Profiles
    currentProfile,
    currentProfileId,
    isProfileSelectionReady,
    areImportedProfilesLoaded,
    allPlayerProfiles,
    selectPlayerProfile,
    refreshProfiles,
  };
}
