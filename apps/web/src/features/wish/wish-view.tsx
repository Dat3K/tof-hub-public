'use client';
import { localeText } from '@/lib/i18n/text';
import { localized } from '@tof-hub/i18n';
import { formatWishPosition } from './format-wish-position';

import React from 'react';
import { useLocale } from '@/lib/i18n';
import { useVersionStatus, VERSION_STATUS_STRINGS } from '@/lib/version-status';
import { DemoCallToAction, Dialog, ProfileAvatar, Tabs, TabsList, TabsTrigger, TabsContent } from '@tof-hub/ui';
import { useSiteHeaderInset } from '@/components/site-shell/use-site-header-inset';
import { scrollToSection } from '@/lib/scroll-to-section';
import { calculateLuckSummary, evaluateStreak, replayPityChain } from '@tof-hub/game-domain';
import { useWishData } from './use-wish-data';
import { WISH_TRANSLATIONS, type WishLocale } from './wish-i18n';
import { WishHeader } from './components/wish-header';
import { WishTrackSummaryCards } from './components/wish-track-summary-cards';
import { WishBannerCard } from './components/wish-banner-card';
import { OverviewTab } from './components/tabs/overview-tab';
import { HistoryTab } from './components/tabs/history-tab';
import { AnalyticsTab } from './components/tabs/analytics-tab';
import { SimulationTab } from './components/tabs/simulation-tab';
import luckStyles from './components/wish-luck.module.css';
import styles from './wish-view.module.css';
import { getLuckMultiplierPresentation, getWinRateColor } from './wish-luck-color';
import { forgetImportedProfileId, readImportedProfileIds, readProfileToken, rememberImportedProfileId, rememberProfileToken } from './import/imported-profiles';
import type { JobStatus } from '../queue/types';
import { queueMessage } from '../queue/client';
import { submitSealedFile } from '../queue/sealed-upload';
import { QueueNotice } from '../queue/queue-notice';
import { useToast } from '@tof-hub/ui';

const HIDDEN_WISH_PROFILES_STORAGE_KEY = 'tof-wish-hidden-profiles';

export function WishView() {
  const { locale } = useLocale();
  const t = localized(WISH_TRANSLATIONS, locale) ?? WISH_TRANSLATIONS.en;
  const { status: versionStatus, isLoading: isVersionStatusLoading } = useVersionStatus();
  const [hiddenProfileIds, setHiddenProfileIds] = React.useState<Set<string>>(() => new Set());
  const [removingProfile, setRemovingProfile] = React.useState<{ id: string; name: string } | null>(null);
  const fileInput = React.useRef<HTMLInputElement>(null);
  const [importing, setImporting] = React.useState(false);
  const [queueJob, setQueueJob] = React.useState<JobStatus | null>(null);
  const { notify } = useToast();
  const polling = React.useRef<AbortController | null>(null);
  React.useEffect(() => () => polling.current?.abort(), []);
  const closeRemoval = React.useCallback(() => setRemovingProfile(null), []);
  const removalInset = useSiteHeaderInset(removingProfile !== null);
  const accountSummary = React.useRef<HTMLElement>(null);
  const bannerSection = React.useRef<HTMLDivElement>(null);
  const [appRequest,setAppRequest]=React.useState(0);
  React.useEffect(() => {
    try {
      const storedIds: unknown = JSON.parse(window.localStorage.getItem(HIDDEN_WISH_PROFILES_STORAGE_KEY) ?? '[]');
      if (Array.isArray(storedIds)) {
        setHiddenProfileIds(new Set(storedIds.filter((id): id is string => typeof id === 'string')));
      }
    } catch {
      setHiddenProfileIds(new Set());
    }
  }, []);

  const {
    activeTab,
    setActiveTab,
    activeTrack,
    activeBannerId,
    setActiveBannerId,
    availableBannersInTrack,
    activeKind,
    viewMode,
    setViewMode,
    filters,
    setFilters,
    banner,
    summary,
    analytics,
    weaponAnalytics,
    matrixAnalytics,
    allTrackPulls,
    activeBannerPulls,
    weaponPulls,
    matrixPulls,
    allConsolidatedPulls,
    allPulls,
    filteredPulls,
    paginatedPulls,
    allPlayerBanners,
    bannerCatalog,
    bannerPullCounts,
    hasMore,
    loadMore,
    trackSummaries,
    consolidatedAccountSummary,
    currentProfileId,
    isProfileSelectionReady,
    allPlayerProfiles,
    selectPlayerProfile,
    areImportedProfilesLoaded,
    refreshProfiles,
  } = useWishData();

  const openImport = React.useCallback(() => {
    if (!importing) fileInput.current?.click();
  }, [importing]);

  async function handleImportFile(file: File) {
    if (!file || importing) return;
    setImporting(true);
    setQueueJob(null);
    polling.current?.abort();
    polling.current = new AbortController();
    let lastJob: JobStatus | null = null;
    try {
      const result = await submitSealedFile<NonNullable<JobStatus['result']>>('wish', file, {
        url: '/api/v1/wish/import/jobs',
        locale,
        headers: {
          'x-wish-import-tokens': readImportedProfileIds().flatMap((id) => {
            const token = readProfileToken(id);
            return token ? [token] : [];
          }).join(','),
        },
        onUpdate: (next) => {
          lastJob = next as JobStatus;
          setQueueJob(lastJob);
        },
        signal: polling.current.signal,
      });

      if (result?.profileId) {
        rememberImportedProfileId(result.profileId);
        if (result.accessToken) rememberProfileToken(result.profileId, result.accessToken);
        try {
          const hidden: unknown = JSON.parse(window.localStorage.getItem(HIDDEN_WISH_PROFILES_STORAGE_KEY) ?? '[]');
          if (Array.isArray(hidden)) {
            window.localStorage.setItem(HIDDEN_WISH_PROFILES_STORAGE_KEY, JSON.stringify(hidden.filter((id) => id !== result.profileId)));
          }
        } catch { /* Browser storage is optional. */ }

        setHiddenProfileIds((prev) => {
          const next = new Set(prev);
          next.delete(result.profileId);
          return next;
        });

        await refreshProfiles(result.profileId);

        const summaryText = locale === 'ru'
          ? `Импорт завершён: ${result.inserted} новых записей, ${result.duplicates} уже было.`
          : `Import complete: ${result.inserted} new records, ${result.duplicates} already present.`;
        notify(summaryText, { id: 'wish-import-status', tone: 'info' });
      }
    } catch (reason) {
      if (polling.current?.signal.aborted) return;
      if ((lastJob as JobStatus | null)?.state !== 'failed') {
        const errorText = queueMessage(
          reason,
          locale === 'ru',
          localeText(locale)('Could not import this file.', 'Не удалось импортировать этот файл.')
        );
        notify(errorText, { id: 'wish-import-status', tone: 'error' });
      }
    } finally {
      setImporting(false);
      setQueueJob(null);
    }
  }
  const showDemoHistoryNotice = areImportedProfilesLoaded && allPlayerProfiles.every((profile) => profile.id === 'full-history-demo');
  const simulationHistory = React.useMemo(() => ({
    profileId: currentProfileId,
    weapon: (() => {
      const state = replayPityChain(weaponPulls, 'weapon_limited');
      return { currentPity: state.currentPity, lastOutcomes: state.streaks.slice(-2) };
    })(),
    matrix: (() => {
      const state = replayPityChain(matrixPulls, 'matrix_limited');
      return { currentPity: state.currentPity, lastOutcomes: state.streaks.slice(-2) };
    })(),
  }), [currentProfileId, weaponPulls, matrixPulls]);

  const accountPullStats = React.useMemo(
    () =>
      allPlayerProfiles.map((profile) => {
        const pulls = profile.getPulls();
        const nonPurplePulls = [
          ...pulls.weaponLimited,
          ...pulls.matrixLimited,
          ...pulls.standardWeapon,
          ...pulls.standardMatrix,
        ];
        const eventDropRate = calculateLuckSummary(
          [...pulls.weaponLimited, ...pulls.matrixLimited],
          'current'
        ).dropRateLuck;
        const eventOutcomes = [...pulls.weaponLimited, ...pulls.matrixLimited]
          .filter((pull) => pull.rarity === 5)
          .map((pull) => pull.streak_outcome ?? (pull.is_featured ? 'win' : 'loss'))
          .filter((outcome) => outcome === 'win' || outcome === 'loss');
        const eventWins = eventOutcomes.filter((outcome) => outcome === 'win').length;
        const eventWinRate = eventOutcomes.length > 0 ? (eventWins / eventOutcomes.length) * 100 : null;
        const eventPity = replayPityChain(pulls.weaponLimited, 'weapon_limited');
        const matrixPity = replayPityChain(pulls.matrixLimited, 'matrix_limited');
        const standardWeaponPity = replayPityChain(pulls.standardWeapon, 'standard_weapon');
        const standardMatrixPity = replayPityChain(pulls.standardMatrix, 'standard_matrix');

        return {
          profile,
          nonPurplePullCount: nonPurplePulls.length,
          nonPurpleSsrCount: nonPurplePulls.filter((pull) => pull.rarity === 5).length,
          eventDropRate,
          eventWinRate,
          eventPity,
          matrixPity,
          standardWeaponPity,
          standardMatrixPity,
          eventNext: evaluateStreak(eventPity.streaks).nextPrediction,
          matrixNext: evaluateStreak(matrixPity.streaks).nextPrediction,
        };
      }),
    [allPlayerProfiles]
  );
  const visibleAccountPullStats = accountPullStats
    .filter(({ profile }) => !hiddenProfileIds.has(profile.id))
    .sort((a, b) => Number(b.profile.id === currentProfileId) - Number(a.profile.id === currentProfileId));
  const removePlayerProfile = (profileId: string) => {
    try {
      if (profileId.startsWith('import-')) forgetImportedProfileId(profileId);
    } catch {
      // Hiding still works for this page view without browser storage.
    }
    const nextHiddenProfileIds = new Set(hiddenProfileIds);
    nextHiddenProfileIds.add(profileId);
    setHiddenProfileIds(nextHiddenProfileIds);
    try {
      window.localStorage.setItem(HIDDEN_WISH_PROFILES_STORAGE_KEY, JSON.stringify([...nextHiddenProfileIds]));
    } catch {
      // Keep the current page usable if browser storage is unavailable.
    }

    if (profileId === currentProfileId) {
      const fallbackProfile = accountPullStats.find(({ profile }) => profile.id !== profileId && !nextHiddenProfileIds.has(profile.id));
      if (fallbackProfile) selectPlayerProfile(fallbackProfile.profile.id);
    }
    closeRemoval();
    accountSummary.current?.focus({ preventScroll: true });
  };

  const getNextOutcomeLabel = (prediction: 'forced_win' | 'forced_loss' | 'neutral_50_50' | 'unknown') => {
    if (prediction === 'forced_win') return t.cardPredictionForcedWin;
    if (prediction === 'forced_loss') return t.cardPredictionForcedLoss;
    if (prediction === 'neutral_50_50') return t.cardPredictionNeutral;
    return t.cardStreakNoData;
  };

  const getNextOutcomeClass = (prediction: 'forced_win' | 'forced_loss' | 'neutral_50_50' | 'unknown') => {
    if (prediction === 'forced_win') return 'border-emerald-300/25 bg-emerald-300/10 text-emerald-200';
    if (prediction === 'forced_loss') return 'border-rose-300/30 bg-rose-400/15 text-rose-200';
    if (prediction === 'neutral_50_50') return 'border-amber-300/25 bg-amber-300/10 text-amber-100';
    return 'border-white/10 bg-white/[0.04] text-slate-400';
  };

  return (
    <div
      className="info-ui min-h-screen bg-[#0b0d13] text-[#d7d0dd] px-4 py-6 md:px-8 max-w-7xl mx-auto"
      suppressHydrationWarning
    >
      <WishHeader
        locale={locale}
        appRequest={appRequest}
        page="tracker"
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onFocusBanner={isProfileSelectionReady ? () => scrollToSection(bannerSection.current) : undefined}
        onImport={openImport}
        importing={importing}
      />
      <input
        ref={fileInput}
        type="file"
        accept=".tofwish,application/json"
        className="sr-only"
        disabled={importing}
        aria-label={localeText(locale)('Wish history file')}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) void handleImportFile(file);
        }}
      />
      <QueueNotice job={queueJob} locale={locale} />
      
      {!isProfileSelectionReady ? (
        <div className="min-h-[30vh]" aria-busy="true" />
      ) : activeTab === 'simulation' ? (
        <div className="pt-3">
          <SimulationTab history={simulationHistory} locale={locale} />
        </div>
      ) : (
        <>

      {/* Main Menu: Track Summary Cards (Endfield-style Clear Statistics Grid) */}
      {showDemoHistoryNotice && (
        <aside className={styles.demoNotice}>
          <DemoCallToAction
            label={t.demoHistoryNotice}
            importLabel={t.uploadHistory}
            onImport={openImport}
            disabled={importing}
          />
        </aside>
      )}
      <WishTrackSummaryCards
        trackSummaries={trackSummaries}
        consolidatedAccountSummary={consolidatedAccountSummary}
        locale={locale}
      />

      {/* Account selector directly above the banner */}
      <section className="mb-5 rounded-xl border border-amber-500/25 bg-[#13101c] p-3 shadow-md" aria-label={t.accountSwitcher}>
        <details className={`group ${styles.accountDetails}`} open>
          <summary ref={accountSummary} className="mb-2 flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
            <span role="heading" aria-level={2} className="text-xs font-bold text-white">{t.accountSwitcher}</span>
            <span className="inline-flex h-7 items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-2.5 text-[11px] font-semibold text-slate-300 transition-colors hover:border-amber-300/30 hover:text-white">
              <span className="hidden group-open:inline">{t.accountCollapse}</span>
              <span className="group-open:hidden">{t.accountExpand}</span>
              <span className={styles.accountArrow} aria-hidden="true">
                <span className={styles.accountArrowGlyph} />
              </span>
            </span>
          </summary>
          <div className={styles.accountDetailsContent}>
            <div className="space-y-2">
          {visibleAccountPullStats.map(({ profile, nonPurplePullCount, nonPurpleSsrCount, eventDropRate, eventWinRate, eventPity, matrixPity, standardWeaponPity, standardMatrixPity, eventNext, matrixNext }) => {
            const isCurrent = profile.id === currentProfileId;
            return (
              <div
                key={profile.id}
                className={`grid items-center gap-2.5 rounded-lg border p-2.5 xl:grid-cols-[minmax(230px,300px)_minmax(0,1fr)_auto] ${
                  isCurrent ? 'border-amber-400/50 bg-[#0d0b13]' : 'border-white/10 bg-[#0d0b13]'
                }`}
              >
                {/* Profile identity stays beside the five track summaries on wide screens. */}
                <div className="flex min-w-0 items-center gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <ProfileAvatar size={32} avatar={profile.avatarCosmetic ?? (profile.avatar ? {icon:profile.avatar} : undefined)} frame={profile.avatarFrameCosmetic} avatarLabel={profile.nickname} className="text-xs font-bold text-amber-200" style={{background:'rgba(252,211,77,.1)',borderRadius:'50%'}}><span aria-hidden="true">{profile.nickname.slice(0, 1).toUpperCase()}</span></ProfileAvatar>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs font-bold text-white">{profile.nickname}</span>
                        <span className="rounded border border-amber-400/25 bg-amber-400/10 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-amber-300">
                          UID: {profile.uid}
                        </span>
                        <span className="text-[9px] text-[#aaa2b1]">
                          {profile.server}
                        </span>
                      </div>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[10px] text-[#c2bbc9]">
                        <span>
                          {nonPurplePullCount} {localeText(locale)('pulls')} <span className="text-white/30">·</span> {nonPurpleSsrCount} SSR
                        </span>
                        <span className="text-[9px] text-slate-500">
                          {localized(VERSION_STATUS_STRINGS, locale).updated}: {isVersionStatusLoading ? '…' : localized(versionStatus.formattedExportDate, locale)}
                        </span>
                      </p>
                    </div>
                  </div>

                </div>

                {/* Five compact track summaries */}
                <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                  <div className="min-w-0 rounded-md border border-amber-300/20 bg-amber-300/[0.07] px-2 py-1.5" title={t.accountEventWeapon}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[9px] font-bold uppercase tracking-wide text-amber-200">{t.accountEventWeapon}</p>
                      <p className="font-mono text-xs font-bold text-white">{profile.pullsByTrack.weapon_limited}</p>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-1">
                      <span className="text-[9px] font-medium text-slate-400">{formatWishPosition(eventPity.currentPity)}/{eventPity.pityTarget} {t.accountPity}</span>
                      <span className={`inline-flex rounded border px-1.5 py-0 text-[9px] font-bold ${getNextOutcomeClass(eventNext)}`}>
                        {getNextOutcomeLabel(eventNext)}
                      </span>
                    </div>
                  </div>
                  <div className="min-w-0 rounded-md border border-violet-300/20 bg-violet-300/[0.06] px-2 py-1.5" title={t.accountMatrices}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[9px] font-bold uppercase tracking-wide text-violet-200">{t.accountMatrices}</p>
                      <p className="font-mono text-xs font-bold text-white">{profile.pullsByTrack.matrix_limited}</p>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-1">
                      <span className="text-[9px] font-medium text-slate-400">{formatWishPosition(matrixPity.currentPity)}/{matrixPity.pityTarget} {t.accountPity}</span>
                      <span className={`inline-flex rounded border px-1.5 py-0 text-[9px] font-bold ${getNextOutcomeClass(matrixNext)}`}>
                        {getNextOutcomeLabel(matrixNext)}
                      </span>
                    </div>
                  </div>
                  <div className="min-w-0 rounded-md border border-white/10 bg-white/[0.035] px-2 py-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="min-w-0 whitespace-nowrap text-[8px] font-bold uppercase tracking-tight text-slate-300">{localeText(locale)('Standard Characters', 'Персонажи стандарта')}</p>
                      <p className="shrink-0 font-mono text-xs font-bold text-white">{profile.pullsByTrack.standard_weapon}</p>
                    </div>
                    <p className="mt-0.5 text-[9px] leading-snug text-slate-400">
                      {formatWishPosition(standardWeaponPity.currentPity)}/{standardWeaponPity.pityTarget} {t.accountPity}
                    </p>
                  </div>
                  <div className="min-w-0 rounded-md border border-slate-300/15 bg-slate-300/[0.04] px-2 py-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="min-w-0 whitespace-nowrap text-[8px] font-bold uppercase tracking-tight text-slate-300">{localeText(locale)('Standard Matrices', 'Матрицы стандарта')}</p>
                      <p className="shrink-0 font-mono text-xs font-bold text-white">{profile.pullsByTrack.standard_matrix}</p>
                    </div>
                    <p className="mt-1 text-[9px] text-slate-400">{formatWishPosition(standardMatrixPity.currentPity)}/{standardMatrixPity.pityTarget} {t.accountPity}</p>
                  </div>
                  <div className="min-w-0 rounded-md border border-white/10 bg-[#14161a] px-2 py-1.5">
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-[9px] font-bold uppercase tracking-wide text-slate-300">{t.accountEventWinRate}</p>
                      <p className="font-mono text-xs font-bold" style={eventWinRate === null ? undefined : { color: getWinRateColor(eventWinRate) }}>{eventWinRate === null ? '—' : `${eventWinRate.toFixed(1)}%`}</p>
                    </div>
                    <p className="mt-1 flex flex-wrap items-center gap-x-1 text-[9px] text-slate-400">
                      <span>{t.accountEventDropRate}:</span>
                      {eventDropRate.totalPulls > 0 && eventDropRate.hasReliableExposure !== false ? (
                        <>
                          <span>{eventDropRate.actualRate.toFixed(2)}%</span>
                          <span>·</span>
                          <span {...getLuckMultiplierPresentation(eventDropRate.multiplier, luckStyles.luckShimmer)}>
                            {eventDropRate.multiplier.toFixed(2)}×
                          </span>
                        </>
                      ) : <span>—</span>}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center justify-end gap-1.5">
                  {isCurrent ? (
                    <button
                      type="button"
                      onClick={openImport}
                      disabled={importing}
                      className="inline-flex h-7 min-w-[82px] shrink-0 cursor-pointer items-center justify-center whitespace-nowrap rounded-lg border border-amber-400/35 bg-amber-400/10 px-2 text-center text-[11px] font-bold text-amber-300 transition-colors hover:bg-amber-400 hover:text-[#080b10] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      + {t.addAccount}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => selectPlayerProfile(profile.id)}
                      className="inline-flex h-7 min-w-[82px] shrink-0 items-center justify-center whitespace-nowrap rounded-lg border border-sky-400/35 bg-sky-400/10 px-2 text-center text-[11px] font-bold text-sky-300 transition-colors hover:bg-sky-400 hover:text-[#080b10]"
                    >
                      {t.showAccount}
                    </button>
                  )}
                  {visibleAccountPullStats.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setRemovingProfile({ id: profile.id, name: profile.nickname })}
                      aria-label={`${t.removeAccount}: ${profile.nickname}`}
                      title={t.removeAccount}
                      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-white/10 text-sm font-bold text-slate-400 transition-colors hover:border-rose-400/40 hover:bg-rose-400/10 hover:text-rose-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-300"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
            );
          })}
            </div>
          </div>
        </details>
      </section>

      {/* Banner selection, focused showcase, banner luck, and its pull history */}
      <div ref={bannerSection} data-wish-banner-section>
      <WishBannerCard
        banner={banner}
        activeBannerId={activeBannerId}
        onBannerIdChange={setActiveBannerId}
        availableBanners={availableBannersInTrack}
        allPlayerBanners={allPlayerBanners}
        bannerArchive={bannerCatalog}
        bannerPullCounts={bannerPullCounts}
        locale={locale}
        cashbackTotal={summary.cashbackTotal}
        weaponPulls={weaponPulls}
        matrixPulls={matrixPulls}
        allPulls={allConsolidatedPulls}
        currentBannerPulls={activeBannerPulls}
        currentTrackPulls={allTrackPulls}
        profile={allPlayerProfiles.find((profile) => profile.id === currentProfileId)}
      />
      </div>

      {/* Navigation Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as any)}
        className="w-full"
      >
        <TabsList className="mb-6 flex border-b border-white/10 w-full justify-start overflow-x-auto">
          <TabsTrigger value="history" className="px-5 py-2.5 text-xs font-bold">
            {t.tabHistory}
          </TabsTrigger>
          <TabsTrigger value="overview" className="px-5 py-2.5 text-xs font-bold">
            {t.tabOverview}
          </TabsTrigger>
          <TabsTrigger value="analytics" className="px-5 py-2.5 text-xs font-bold">
            {t.tabAnalytics}
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: History */}
        <TabsContent value="history">
          <HistoryTab
            pulls={paginatedPulls}
            exportPulls={filteredPulls}
            totalFiltered={filteredPulls.length}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            filters={filters}
            onFilterChange={setFilters}
            hasMore={hasMore}
            onLoadMore={loadMore}
            activeKind={activeKind}
            activeBannerId={activeBannerId}
            onBannerSelect={setActiveBannerId}
            allPlayerBanners={allPlayerBanners}
            bannerPullCounts={bannerPullCounts}
            locale={locale}
          />
        </TabsContent>

        {/* Tab 2: Overview */}
        <TabsContent value="overview">
          <OverviewTab
            summary={summary}
            allPulls={allPulls}
            weaponPulls={weaponPulls}
            matrixPulls={matrixPulls}
            activeBannerId={activeBannerId}
            activeTrack={activeTrack}
            locale={locale}
          />
        </TabsContent>

        {/* Tab 3: Personal Analytics */}
        <TabsContent value="analytics">
          <AnalyticsTab
            analytics={analytics}
            weaponAnalytics={weaponAnalytics}
            matrixAnalytics={matrixAnalytics}
            activeBannerId={activeBannerId}
            activeKind={activeKind}
            locale={locale}
          />
        </TabsContent>

      </Tabs>
        </>
      )}
      <Dialog isOpen={removingProfile !== null} onClose={closeRemoval} appearance="table" type="warning" viewportTopInset={removalInset}
        title={t.removeAccountTitle}
        description={<>{removingProfile?.name}. {t.removeAccountDescription}</>}
        cancelLabel={t.cancelRemoval} confirmLabel={t.removeAccount}
        onConfirm={() => { if (removingProfile) removePlayerProfile(removingProfile.id); }}/>
    </div>
  );
}
