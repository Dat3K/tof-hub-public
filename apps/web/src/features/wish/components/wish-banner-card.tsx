'use client';
import { fillText, localeText } from '@/lib/i18n/text';
import { localized } from '@tof-hub/i18n';
import { formatWishPosition } from '../format-wish-position';

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { WishBannerDto, WishRecordDto } from '@tof-hub/contracts';
import { calculateLuckSummary, evaluateStreak, replayPityChain, getLocalizedFields } from '@tof-hub/game-domain';
import { Tooltip, useDismiss, useToast } from '@tof-hub/ui';
import { WISH_TRANSLATIONS, type WishLocale } from '../wish-i18n';
import { resolvePullMedia, useWishMediaMap } from '../pull-media';
import { getMatrixSlotVisual } from '../matrix-slot-visual';
import { formatPullDate } from '../format-pull-date';
import { formatNumber } from '@/lib/i18n/format';
import {loadLocalArtwork,saveLocalArtwork,saveLocalArtworkSettings,removeLocalArtwork} from '@/lib/local-artwork';
import { getLuckMultiplierPresentation, getWinRateColor } from '../wish-luck-color';
import type { WishExportProfile } from '../wish-banner-export';
import luckStyles from './wish-luck.module.css';
import styles from './wish-banner-card.module.css';

interface WishBannerCardProps {
  banner: WishBannerDto;
  activeBannerId: string;
  onBannerIdChange: (bannerId: string) => void;
  availableBanners: WishBannerDto[];
  allPlayerBanners?: WishBannerDto[];
  bannerArchive?: WishBannerDto[];
  bannerPullCounts?: Record<string, number>;
  locale: WishLocale;
  cashbackTotal: number;
  weaponPulls: readonly WishRecordDto[];
  matrixPulls: readonly WishRecordDto[];
  allPulls?: readonly WishRecordDto[];
  currentBannerPulls?: readonly WishRecordDto[];
  currentTrackPulls?: readonly WishRecordDto[];
  profile?: WishExportProfile;
}

function formatDropName(name: string, omitMatrixSlot = false): string {
  const cleanName = name.replace(/^\s*\d+\s+/, '').trim();
  return omitMatrixSlot
    ? cleanName.replace(/\s*(?:\[(?:MIND|MEMORY|BELIEF|EMOTION)\]|\((?:MIND|MEMORY|BELIEF|EMOTION)\))\s*$/i, '').trim()
    : cleanName;
}

function getPredictionColorClass(prediction: string): string {
  if (prediction === 'forced_win') return 'text-emerald-300';
  if (prediction === 'forced_loss') return 'text-rose-300';
  if (prediction === 'neutral_50_50') return 'text-amber-200';
  return 'text-white/55';
}

/** Brightness multiplier range for a custom aggregate image (1 = unchanged). */
const ARTWORK_BRIGHTNESS = { min: 0.3, max: 1.3 };

interface AdaptiveArtworkColor {
  red: number;
  green: number;
  blue: number;
  /** Mean relative luminance (0–1) of the upper half, where the title sits. */
  luminance: number;
}

async function getAdaptiveArtworkColor(source: string): Promise<AdaptiveArtworkColor | null> {
  const image = new Image();
  image.src = source;
  try {
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const bins = Array.from({ length: 24 }, () => ({ weight: 0, red: 0, green: 0, blue: 0 }));
    let fallbackWeight = 0;
    let fallbackRed = 0;
    let fallbackGreen = 0;
    let fallbackBlue = 0;
    let topLuminance = 0;
    let topWeight = 0;

    for (let index = 0; index < pixels.length; index += 4) {
      const alpha = (pixels[index + 3] ?? 0) / 255;
      if (alpha < 0.2) continue;
      const red = pixels[index] ?? 0;
      const green = pixels[index + 1] ?? 0;
      const blue = pixels[index + 2] ?? 0;
      const maximum = Math.max(red, green, blue);
      const minimum = Math.min(red, green, blue);
      const delta = maximum - minimum;
      const saturation = maximum === 0 ? 0 : delta / maximum;
      const pixelWeight = alpha * Math.max(0.15, saturation);
      fallbackWeight += alpha;
      fallbackRed += red * alpha;
      fallbackGreen += green * alpha;
      fallbackBlue += blue * alpha;
      if (index < pixels.length / 2) {
        topLuminance += (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255 * alpha;
        topWeight += alpha;
      }
      if (saturation < 0.16 || delta === 0) continue;

      let hue: number;
      if (maximum === red) hue = ((green - blue) / delta + (green < blue ? 6 : 0)) * 60;
      else if (maximum === green) hue = ((blue - red) / delta + 2) * 60;
      else hue = ((red - green) / delta + 4) * 60;
      const bin = bins[Math.min(23, Math.floor(hue / 15))];
      bin.weight += pixelWeight;
      bin.red += red * pixelWeight;
      bin.green += green * pixelWeight;
      bin.blue += blue * pixelWeight;
    }

    const dominant = bins.reduce((best, bin) => bin.weight > best.weight ? bin : best, bins[0]!);
    const weight = dominant.weight || fallbackWeight;
    if (!weight) return null;
    const red = dominant.weight ? dominant.red : fallbackRed;
    const green = dominant.weight ? dominant.green : fallbackGreen;
    const blue = dominant.weight ? dominant.blue : fallbackBlue;
    return {
      red: Math.round(red / weight),
      green: Math.round(green / weight),
      blue: Math.round(blue / weight),
      luminance: topWeight > 0 ? topLuminance / topWeight : 0,
    };
  } catch {
    return null;
  }
}

export function WishBannerCard({
  banner,
  activeBannerId,
  onBannerIdChange,
  availableBanners,
  allPlayerBanners = [],
  bannerArchive = [],
  bannerPullCounts = {},
  locale,
  cashbackTotal,
  weaponPulls,
  matrixPulls,
  allPulls,
  currentBannerPulls,
  currentTrackPulls,
  profile,
}: WishBannerCardProps) {
  const {notify,dismiss}=useToast();
  const artworkNoticeId=useId();
  const artworkUploadRequest=useRef(0);
  const persistedArtworkUrl=useRef('');
  useEffect(()=>()=>{artworkUploadRequest.current+=1;dismiss(artworkNoticeId);},[dismiss,artworkNoticeId]);
  const showcaseRef = useRef<HTMLElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const customArtworkRef = useRef<HTMLImageElement>(null);
  const artworkDragOffset = useRef<{ x: number; y: number } | null>(null);
  const artworkColorRequest = useRef(0);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [pinnedDropTooltipId, setPinnedDropTooltipId] = useState<string | null>(null);
  const [customAggregateArtwork, setCustomAggregateArtwork] = useState<string | null>(null);
  const [customArtworkPosition, setCustomArtworkPosition] = useState({ x: 68, y: 58 });
  const [customArtworkScale, setCustomArtworkScale] = useState(1);
  const [customArtworkBrightness, setCustomArtworkBrightness] = useState(1);
  const [customArtworkColor, setCustomArtworkColor] = useState<AdaptiveArtworkColor | null>(null);
  const [artworkRestored,setArtworkRestored]=useState(false);
  useEffect(()=>{
    let active=true;
    const restoreRequest=artworkUploadRequest.current;
    void loadLocalArtwork<{x:number;y:number;scale:number;brightness?:number}>('wish').then(saved=>{
      if(!active||!saved||artworkUploadRequest.current!==restoreRequest)return;
      const {x,y,scale}=saved.settings;
      if(![x,y,scale].every(Number.isFinite)||scale<=0)return;
      // Settings saved before the brightness control have none: keep the image as it was.
      const brightness=Number.isFinite(saved.settings.brightness)?Math.min(ARTWORK_BRIGHTNESS.max,Math.max(ARTWORK_BRIGHTNESS.min,saved.settings.brightness!)):1;
      const url=URL.createObjectURL(saved.file);
      persistedArtworkUrl.current=url;
      setCustomAggregateArtwork(url);setCustomArtworkPosition({x,y});setCustomArtworkScale(scale);setCustomArtworkBrightness(brightness);
      const request=++artworkColorRequest.current;
      void getAdaptiveArtworkColor(url).then(color=>{if(active&&request===artworkColorRequest.current)setCustomArtworkColor(color);});
    }).catch(()=>{}).finally(()=>{if(active)setArtworkRestored(true);});
    return()=>{active=false;};
  },[]);
  useEffect(()=>{
    if(!artworkRestored||!customAggregateArtwork||persistedArtworkUrl.current!==customAggregateArtwork)return;
    try {saveLocalArtworkSettings('wish',{...customArtworkPosition,scale:customArtworkScale,brightness:customArtworkBrightness});}
    catch {notify(localeText(locale)('The browser could not save image settings.', 'Браузер не смог сохранить настройки картинки.'),{id:artworkNoticeId,tone:'error'});}
  },[artworkRestored,customAggregateArtwork,customArtworkPosition,customArtworkScale,customArtworkBrightness,notify,locale,artworkNoticeId]);
  const t = localized(WISH_TRANSLATIONS, locale) ?? WISH_TRANSLATIONS.en;
  const isAllBanners = activeBannerId === 'all';
  const isCharacterGroup = activeBannerId === 'characters';
  const isMatrixGroup = activeBannerId === 'matrices';
  const isAggregate = isAllBanners || isCharacterGroup || isMatrixGroup;
  const isSharedPityAggregate = isCharacterGroup || isMatrixGroup;
  const mediaMap = useWishMediaMap();
  const aggregateKey=isAllBanners?'all':isCharacterGroup?'characters':isMatrixGroup?'matrices':null;
  const publicAggregateArtwork=aggregateKey?mediaMap?.aggregateArtworks?.[aggregateKey]:undefined;
  useEffect(()=>{
    if(customAggregateArtwork||!publicAggregateArtwork)return;
    const request=++artworkColorRequest.current;
    void getAdaptiveArtworkColor(publicAggregateArtwork.image).then(color=>{
      if(artworkColorRequest.current===request)setCustomArtworkColor(color);
    });
  },[customAggregateArtwork,publicAggregateArtwork]);
  const cashbackIcon = mediaMap?.byKey[banner.cashback_currency]?.image ?? null;
  const [cashbackIconError, setCashbackIconError] = useState(false);
  useEffect(() => setCashbackIconError(false), [cashbackIcon]);
  const [titleImgError, setTitleImgError] = useState(false);
  useEffect(() => setTitleImgError(false), [banner.id, locale]);
  useEffect(() => setPinnedDropTooltipId(null), [activeBannerId]);
  useDismiss({ refs: [showcaseRef], onDismiss: () => setPinnedDropTooltipId(null), enabled: !!pinnedDropTooltipId, ignore: '[role="tooltip"]', capture: true });
  useEffect(() => () => {
    if (customAggregateArtwork) URL.revokeObjectURL(customAggregateArtwork);
  }, [customAggregateArtwork]);
  const handleCustomArtworkChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      notify(localeText(locale)('Choose a PNG, JPEG or WebP image.'),{id:artworkNoticeId,tone:'error'});
      return;
    }
    const uploadRequest=++artworkUploadRequest.current;
    notify(localeText(locale)('Preparing image…', 'Подготавливаем картинку…'),{id:artworkNoticeId,duration:null});
    const imageUrl = URL.createObjectURL(file);
    try {
      const image=new Image();
      image.src=imageUrl;
      await image.decode();
      if(artworkUploadRequest.current!==uploadRequest){URL.revokeObjectURL(imageUrl);return;}
      let persisted=true;
      try {await saveLocalArtwork('wish',file,{x:68,y:58,scale:1,brightness:1});}catch {persisted=false;}
      if(artworkUploadRequest.current!==uploadRequest){URL.revokeObjectURL(imageUrl);return;}
      if(persisted)persistedArtworkUrl.current=imageUrl;
      const colorRequest = ++artworkColorRequest.current;
      setCustomArtworkColor(null);
      setCustomAggregateArtwork(imageUrl);
      setCustomArtworkPosition({ x: 68, y: 58 });
      setCustomArtworkScale(1);
      setCustomArtworkBrightness(1);
      const color=await getAdaptiveArtworkColor(imageUrl);
      if(artworkUploadRequest.current!==uploadRequest)return;
      if (artworkColorRequest.current === colorRequest) setCustomArtworkColor(color);
      notify(persisted?(localeText(locale)('Image added.')):(localeText(locale)('Image added, but the browser could not save it for reload.', 'Картинка добавлена, но браузер не смог сохранить её для перезагрузки.')),{id:artworkNoticeId,tone:persisted?'info':'error'});
    } catch {
      URL.revokeObjectURL(imageUrl);
      if(artworkUploadRequest.current===uploadRequest)notify(localeText(locale)('Could not open the image. Choose another file.', 'Не удалось открыть картинку. Выберите другой файл.'),{id:artworkNoticeId,tone:'error'});
    }
  };

  const moveCustomArtwork = (x: number, y: number) => {
    setCustomArtworkPosition({ x, y });
  };

  const handleArtworkPointerDown = (event: React.PointerEvent<HTMLImageElement>) => {
    if (!heroRef.current) return;
    const heroRect = heroRef.current.getBoundingClientRect();
    artworkDragOffset.current = {
      x: heroRect.left + heroRect.width * customArtworkPosition.x / 100 - event.clientX,
      y: heroRect.top + heroRect.height * customArtworkPosition.y / 100 - event.clientY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const handleArtworkPointerMove = (event: React.PointerEvent<HTMLImageElement>) => {
    const hero = heroRef.current;
    const artwork = customArtworkRef.current;
    const offset = artworkDragOffset.current;
    if (!hero || !artwork || !offset) return;
    const heroRect = hero.getBoundingClientRect();
    const centerX = event.clientX + offset.x - heroRect.left;
    const centerY = event.clientY + offset.y - heroRect.top;
    moveCustomArtwork(centerX / heroRect.width * 100, centerY / heroRect.height * 100);
  };

  const handleArtworkKeyDown = (event: React.KeyboardEvent<HTMLImageElement>) => {
    const step = event.shiftKey ? 5 : 1;
    if (event.key === 'ArrowLeft') moveCustomArtwork(customArtworkPosition.x - step, customArtworkPosition.y);
    else if (event.key === 'ArrowRight') moveCustomArtwork(customArtworkPosition.x + step, customArtworkPosition.y);
    else if (event.key === 'ArrowUp') moveCustomArtwork(customArtworkPosition.x, customArtworkPosition.y - step);
    else if (event.key === 'ArrowDown') moveCustomArtwork(customArtworkPosition.x, customArtworkPosition.y + step);
    else return;
    event.preventDefault();
  };

  const handleArtworkPointerUp = (event: React.PointerEvent<HTMLImageElement>) => {
    artworkDragOffset.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const bannerTitle = locale === 'ru' ? banner.name_ru : banner.name_en;
  const title = isAllBanners ? t.bannerAll : isCharacterGroup ? t.bannerCharacters : isMatrixGroup ? t.accountMatrices : bannerTitle;
  const cashbackUnit = {
    flame_gold: t.cashbackUnitFg,
    overclocking_chip: t.cashbackUnitChip,
    black_gold: t.cashbackUnitBlackGold,
    base_chip: t.cashbackUnitBaseChip,
    none: '',
  }[banner.cashback_currency];
  const titleImages = getLocalizedFields(banner.assets, 'title_image');
  const translatedTitle = titleImages[locale];
  const titleImage = typeof translatedTitle === 'string' && translatedTitle ? translatedTitle : locale === 'ru'
    ? banner.assets.title_image_ru || banner.assets.title_image_en
    : banner.assets.title_image_en || banner.assets.title_image_ru;
  const hasTitleImage = !isAggregate && Boolean(titleImage) && !titleImgError;
  const backgroundImage = !isAggregate && banner.assets.background && !banner.assets.background.startsWith('/Game/')
    ? banner.assets.background
    : undefined;
  const splashImage = !isAggregate && banner.assets.splash && !banner.assets.splash.startsWith('/Game/')
    ? banner.assets.splash
    : undefined;
  const isPermanent = banner.end_date.startsWith('2030');
  const isUnresolved = banner.id.startsWith('unresolved-');
  const period = isAggregate
    ? t.bannerAllPeriod
    : isUnresolved
    ? localeText(locale)('Period unknown', 'Период не определён')
    : isPermanent
    ? localeText(locale)('Permanent banner', 'Постоянный баннер')
    // wish-banners.json follows the CN schedule, so its dates are not shown for Global banners (2026-10-16).
    : t.periodUnavailable;

  const bannerPulls = useMemo(() => {
    const source = allPulls ?? [...weaponPulls, ...matrixPulls];
    return isAllBanners
      ? source.filter((pull) => pull.banner_type === 'weapon_limited' || pull.banner_type === 'matrix_limited')
      : isCharacterGroup
        ? source.filter((pull) => pull.banner_type === 'weapon_limited')
        : isMatrixGroup
          ? source.filter((pull) => pull.banner_type === 'matrix_limited')
          : source.filter((pull) => pull.banner_id === banner.id);
  }, [allPulls, weaponPulls, matrixPulls, banner.id, isAllBanners, isCharacterGroup, isMatrixGroup]);

  const bannerLuck = useMemo(() => {
    const trackType = isCharacterGroup
      ? 'weapon_limited'
      : isMatrixGroup ? 'matrix_limited' : banner.banner_type;
    const trackPulls = [...(currentTrackPulls ?? [])]
      .filter((pull) => pull.banner_type === trackType)
      .sort((a, b) => a.pull_timestamp.localeCompare(b.pull_timestamp)
        || (a.group_ticks ?? '').localeCompare(b.group_ticks ?? '')
        || (a.item_index ?? 0) - (b.item_index ?? 0));
    const firstBannerIndex = isSharedPityAggregate
      ? -1
      : trackPulls.findIndex((pull) => pull.banner_id === banner.id);
    let lastBannerIndex = -1;
    if (!isSharedPityAggregate) {
      for (let index = trackPulls.length - 1; index >= 0; index--) {
        if (trackPulls[index].banner_id === banner.id) {
          lastBannerIndex = index;
          break;
        }
      }
    }
    const beforeBanner = firstBannerIndex < 0 ? trackPulls : trackPulls.slice(0, firstBannerIndex);
    const exitPulls = lastBannerIndex < 0 ? trackPulls : trackPulls.slice(0, lastBannerIndex + 1);
    const startingPity = replayPityChain(beforeBanner, trackType);
    const endingPity = replayPityChain(exitPulls, trackType);
    const outcomes = bannerPulls
      .filter((pull) => pull.rarity === 5 && (isAggregate
        ? (isAllBanners || isCharacterGroup) && pull.banner_type === 'weapon_limited' || (isAllBanners || isMatrixGroup) && pull.banner_type === 'matrix_limited'
        : true))
      .map((pull) => pull.streak_outcome ?? (pull.is_featured ? 'win' : 'loss'));
    const streaksByTrack: Record<'weapon_limited' | 'matrix_limited', Array<'win' | 'loss'>> = {
      weapon_limited: [],
      matrix_limited: [],
    };
    let forcedWins = 0;
    let forcedLosses = 0;
    let pureWins = 0;
    let pureOutcomes = 0;
    const orderedOutcomePulls = bannerPulls
      .filter((pull) => (pull.rarity === 5 || pull.rarity === 0) && (pull.banner_type === 'weapon_limited' || pull.banner_type === 'matrix_limited') && (isAggregate
        ? (isAllBanners || isCharacterGroup) && pull.banner_type === 'weapon_limited' || (isAllBanners || isMatrixGroup) && pull.banner_type === 'matrix_limited'
        : true))
      .sort((a, b) => a.pull_timestamp.localeCompare(b.pull_timestamp)
        || (a.group_ticks ?? '').localeCompare(b.group_ticks ?? '')
        || (a.item_index ?? 0) - (b.item_index ?? 0));
    for (const pull of orderedOutcomePulls) {
      const track = pull.banner_type as 'weapon_limited' | 'matrix_limited';
      if(pull.rarity===0){streaksByTrack[track].length=0;continue;}
      const outcome = pull.streak_outcome ?? (pull.is_featured ? 'win' : 'loss');
      if (outcome !== 'win' && outcome !== 'loss') {streaksByTrack[track].length=0;continue;}

      const prediction = evaluateStreak(streaksByTrack[track]).nextPrediction;
      if (prediction === 'forced_win' && outcome === 'win') forcedWins++;
      if (prediction === 'forced_loss' && outcome === 'loss') forcedLosses++;
      if (prediction !== 'forced_win' && prediction !== 'forced_loss') {
        pureOutcomes++;
        if (outcome === 'win') pureWins++;
      }
      streaksByTrack[track].push(outcome);
    }
    const wins = outcomes.filter((outcome) => outcome === 'win').length;
    const losses = outcomes.filter((outcome) => outcome === 'loss').length;
    const outcomeCount = wins + losses;
    const isLimited = isAggregate || trackType === 'weapon_limited' || trackType === 'matrix_limited';
    const unknownSource = isAllBanners || banner.id.startsWith('unresolved-');
    const startingPrediction = unknownSource ? 'unknown' as const : evaluateStreak(startingPity.streaks).nextPrediction;
    const nextPrediction = unknownSource ? 'unknown' as const : evaluateStreak(endingPity.streaks).nextPrediction;
    const displayPrediction = (prediction: typeof startingPrediction) =>
      isLimited && prediction === 'unknown' && !banner.id.startsWith('unresolved-') ? 'neutral_50_50' as const : prediction;

    return {
      pulls: bannerPulls.length,
      startingPity: isAllBanners ? 0 : bannerPulls[0]?.raw_banner_code
        ? bannerPulls[0].track_pull_number === undefined ? -1 : (bannerPulls[0].track_pull_number - 1) % endingPity.pityTarget
        : startingPity.currentPity,
      currentPity: isAllBanners ? 0 : endingPity.currentPity,
      currentIncompleteInterval: endingPity.currentIncompleteInterval,
      pityTarget: isAllBanners ? 0 : endingPity.pityTarget,
      pullsToGuarantee: isAllBanners ? 0 : endingPity.pullsToGuarantee,
      startingPrediction: displayPrediction(startingPrediction),
      nextPrediction: displayPrediction(nextPrediction),
      wins,
      losses,
      forcedWins,
      forcedLosses,
      pureWins,
      pureOutcomes,
      pureWinRate: pureOutcomes > 0 ? pureWins / pureOutcomes * 100 : null,
      winRate: outcomeCount > 0 ? (wins / outcomeCount) * 100 : null,
      isLimited,
    };
  }, [banner.id, banner.banner_type, banner.start_date, banner.end_date, bannerPulls, currentTrackPulls, isAggregate, isAllBanners, isCharacterGroup, isMatrixGroup]);

  const allBannerPity = useMemo(() => {
    if (!isAllBanners) return null;
    const source = allPulls ?? [...weaponPulls, ...matrixPulls];
    const orderedPulls = source
      .filter((pull) => pull.banner_type === 'weapon_limited' || pull.banner_type === 'matrix_limited')
      .map((pull) => {
        const generatedRarity = resolvePullMedia(mediaMap, pull, locale).rarity;
        return generatedRarity && generatedRarity !== pull.rarity
          ? { ...pull, rarity: generatedRarity }
          : pull;
      })
      .sort((a, b) => a.pull_timestamp.localeCompare(b.pull_timestamp)
        || (a.group_ticks ?? '').localeCompare(b.group_ticks ?? '')
        || (a.item_index ?? 0) - (b.item_index ?? 0));

    return {
      weapon: replayPityChain(orderedPulls.filter((pull) => pull.banner_type === 'weapon_limited'), 'weapon_limited'),
      matrix: replayPityChain(orderedPulls.filter((pull) => pull.banner_type === 'matrix_limited'), 'matrix_limited'),
    };
  }, [allPulls, isAllBanners, locale, matrixPulls, mediaMap, weaponPulls]);

  const bannerLuckSummary = useMemo(
    () => calculateLuckSummary(bannerPulls, 'current'),
    [bannerPulls]
  );
  const eventSsrDrops = useMemo(() => {
    const isEventWeapon = banner.banner_type === 'weapon_limited';
    const isEventMatrix = banner.banner_type === 'matrix_limited';
    if ((isAggregate && !isCharacterGroup && !isMatrixGroup) || (!isEventWeapon && !isEventMatrix)) return [];
    const drops = bannerPulls
      .filter((pull) => pull.rarity === 5)
      .sort((a, b) => a.pull_timestamp.localeCompare(b.pull_timestamp) || (a.item_index ?? 0) - (b.item_index ?? 0));
    return drops;
  }, [banner.banner_type, bannerPulls, isAggregate, isCharacterGroup, isMatrixGroup]);
  const standardSsrDrops = useMemo(
    () => !isAggregate && (banner.banner_type === 'standard_weapon' || banner.banner_type === 'standard_matrix' || banner.banner_type === 'black_nucleus')
      ? [...bannerPulls]
          .sort((a, b) => a.pull_timestamp.localeCompare(b.pull_timestamp) || (a.item_index ?? 0) - (b.item_index ?? 0))
          .flatMap((pull, index) => pull.rarity === 5 ? [{ pull, pullNumber: pull.track_pull_number ?? (pull.raw_banner_code ? -1 : index + 1) }] : [])
      : [],
    [banner.banner_type, bannerPulls, isAggregate]
  );
  const { dropRateLuck, winRateLuck } = bannerLuckSummary;
  const blackNucleusDropPresentation = getLuckMultiplierPresentation(dropRateLuck.multiplier, luckStyles.luckShimmer);
  const dropAvgInterval = dropRateLuck.expectedRate > 0
    ? (100 / dropRateLuck.expectedRate).toFixed(1)
    : '50.0';
  const unknownRarityCount=bannerPulls.filter(pull=>pull.rarity===0).length;
  const unknownRarityExplanation=fillText(localeText(locale)('{0} pulls have unknown rarity. Pull counts are preserved; drop statistics remain incomplete until the catalog is updated.', '{0} круток с неизвестной редкостью. Количество круток сохранено; статистика выпадений неполная до обновления каталога.'), [unknownRarityCount]);
  const dropRateExplanation = unknownRarityCount>0 ? unknownRarityExplanation : dropRateLuck.hasReliableExposure === false ? t.importHistoryUnanchored : t.luckDropRateCaption
    .replace('{{actual}}', String(dropRateLuck.actualCount))
    .replace('{{pulls}}', String(dropRateLuck.totalPulls))
    .replace('{{rate}}', dropRateLuck.actualRate.toFixed(2))
    .replace('{{expectedCount}}', dropRateLuck.expectedCount.toFixed(1))
    .replace('{{expectedRate}}', dropRateLuck.expectedRate.toFixed(2))
    .replace('{{avgInterval}}', dropAvgInterval);
  const winRateExplanation = t.luckWinRateCaption
    .replace('{{wins}}', String(winRateLuck.winsCount))
    .replace('{{total}}', String(winRateLuck.totalOutcomes))
    .replace('{{rate}}', winRateLuck.actualWinRate.toFixed(1));

  const nextPredictionLabel = bannerLuck.nextPrediction === 'forced_win'
    ? t.cardPredictionForcedWin
    : bannerLuck.nextPrediction === 'forced_loss'
    ? t.cardPredictionForcedLoss
    : bannerLuck.nextPrediction === 'neutral_50_50'
    ? t.cardPredictionNeutral
    : t.cardStreakNoData;
  const startingPredictionLabel = bannerLuck.startingPrediction === 'forced_win'
    ? t.cardPredictionForcedWin
    : bannerLuck.startingPrediction === 'forced_loss'
    ? t.cardPredictionForcedLoss
    : bannerLuck.startingPrediction === 'neutral_50_50'
    ? t.cardPredictionNeutral
    : t.cardStreakNoData;

  const selectorBanners = useMemo(() => {
    const known = new Map<string, WishBannerDto>();
    const addBanner = (next: WishBannerDto) => {
      const previous = known.get(next.id);
      known.set(next.id, previous
        ? {
            ...previous,
            ...next,
            assets: {
              ...previous.assets,
              ...next.assets,
              icon: next.assets.icon || previous.assets.icon,
            },
          }
        : next);
    };
    for (const playerBanner of allPlayerBanners) addBanner(playerBanner);
    for (const available of availableBanners) addBanner(available);
    for (const archivedBanner of bannerArchive) addBanner(archivedBanner);
    if (!known.has(banner.id) && bannerPulls.length > 0) known.set(banner.id, banner);
    return [...known.values()].filter((item) => {
      const recordedPulls = bannerPullCounts[item.id] ?? 0;
      const selectedBannerPulls = item.id === banner.id ? bannerPulls.length : 0;
      return Math.max(recordedPulls, selectedBannerPulls) > 0;
    });
  }, [bannerArchive, allPlayerBanners, availableBanners, banner, bannerPullCounts, bannerPulls]);
  const characterBanners = selectorBanners.filter((item) => item.banner_type === 'weapon_limited');
  const matrixBanners = selectorBanners.filter((item) => item.banner_type === 'matrix_limited');
  const standardWeaponBanners = selectorBanners.filter((item) => item.banner_type === 'standard_weapon');
  const standardMatrixBanners = selectorBanners.filter((item) => item.banner_type === 'standard_matrix');
  const blackNucleusBanners = selectorBanners.filter((item) => item.banner_type === 'black_nucleus');
  const sourcePulls = allPulls ?? [...weaponPulls, ...matrixPulls];
  const totalRecordedPulls = sourcePulls.filter((pull) => pull.banner_type === 'weapon_limited' || pull.banner_type === 'matrix_limited').length;
  const characterPullCount = sourcePulls.filter((pull) => pull.banner_type === 'weapon_limited').length;
  const matrixPullCount = sourcePulls.filter((pull) => pull.banner_type === 'matrix_limited').length;
  const allBannersIcon = mediaMap?.currencyIcons?.all_banners;

  const renderBannerButton = (item: WishBannerDto) => {
    const selected = activeBannerId === item.id;
    const pullCount = Math.max(bannerPullCounts[item.id] ?? 0, item.id === banner.id && !isAggregate ? bannerPulls.length : 0);
    const pullCurrency =
      item.banner_type === 'standard_weapon'
        ? 'gold_nucleus'
        : item.banner_type === 'standard_matrix'
          ? 'proof_of_purchase'
          : item.banner_type === 'black_nucleus'
            ? 'black_nucleus'
            : null;
    const bannerMediaKeys = [item.weapon_id, item.character_id, ...item.featured_ssr];
    const bannerMedia = bannerMediaKeys
      .map((key) => key?.trim().toLowerCase())
      .filter((key): key is string => Boolean(key))
      .map((key) => mediaMap?.byKey[key])
      .find((entry) => entry?.image || entry?.weapon_icon);
    const providedIcon = item.assets.icon && !item.assets.icon.toLowerCase().startsWith('/game/')
      ? item.assets.icon
      : null;
    const icon = pullCurrency
      ? mediaMap?.currencyIcons?.[pullCurrency] ?? bannerMedia?.image ?? bannerMedia?.weapon_icon ?? providedIcon
      : bannerMedia?.image ?? bannerMedia?.weapon_icon ?? providedIcon;
    return (
      <button
        key={item.id}
        type="button"
        onClick={() => onBannerIdChange(item.id)}
        aria-pressed={selected}
        className={`flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${selected ? 'border-amber-300/50 bg-amber-300/15 text-white' : 'border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20 hover:text-white'}`}
      >
        {icon && <img src={icon} alt="" className="h-6 w-6 object-contain" />}
        <span>{locale === 'ru' ? item.name_ru : item.name_en}</span>
        <span className="font-mono text-[10px] text-slate-500">{pullCount}</span>
      </button>
    );
  };

  const handleCardExport = async () => {
    if (!showcaseRef.current || !profile || isExporting) return;
    setIsExporting(true);
    setExportError(false);
    try {
      const { exportWishBannerCard } = await import('../wish-banner-export');
      await exportWishBannerCard(showcaseRef.current, profile, activeBannerId, locale);
    } catch (error) {
      console.error('[Wish] Banner PNG export failed:', error);
      setExportError(true);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="mb-6 space-y-4">
      <section
          className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-1 rounded-xl border border-white/10 bg-[#10131b] p-1.5 sm:gap-x-3 sm:gap-y-2 sm:p-2"
          aria-label={localeText(locale)('Banner selection', 'Выбор баннера')}
        >
          <button
            type="button"
            onClick={() => onBannerIdChange('all')}
            aria-pressed={isAllBanners}
            className={`row-span-2 min-h-[74px] w-[100px] self-stretch rounded-lg border px-2 py-1.5 text-[10px] font-bold transition-colors sm:min-h-0 sm:w-auto sm:px-4 sm:py-2 sm:text-xs ${isAllBanners ? 'border-amber-300/50 bg-amber-300/15 text-white' : 'border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20 hover:text-white'}`}
          >
            <span className="relative flex w-full items-center justify-center gap-1.5 sm:w-auto">
              {allBannersIcon && <img src={allBannersIcon} alt="" className="absolute left-0 h-4 w-4 shrink-0 object-contain sm:static sm:h-6 sm:w-6" />}
              <span className="text-center leading-tight">{t.bannerAll}</span>
            </span>
            <span className="mt-0.5 block font-mono text-[9px] text-slate-500 sm:mt-1 sm:text-[10px]">{totalRecordedPulls}</span>
          </button>
          {[
            {
              label: t.bannerCharacters,
              id: 'characters',
              count: characterPullCount,
              items: [...characterBanners, ...standardWeaponBanners, ...blackNucleusBanners],
            },
            {
              label: t.accountMatrices,
              id: 'matrices',
              count: matrixPullCount,
              items: [...matrixBanners, ...standardMatrixBanners],
            },
          ].map((row) => {
            const groupIcon = mediaMap?.currencyIcons?.[row.id];
            return (
              <div key={row.id} className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-1 sm:gap-2">
                <div className="flex min-w-0 gap-1.5 overflow-x-auto scrollbar-thin sm:gap-2">
                  <button
                    type="button"
                    onClick={() => onBannerIdChange(row.id)}
                    aria-pressed={activeBannerId === row.id}
                    className={`flex w-36 shrink-0 items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-left text-xs font-bold transition-colors sm:py-2 ${activeBannerId === row.id ? 'border-amber-300/50 bg-amber-300/15 text-white' : 'border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20 hover:text-white'}`}
                  >
                    <span className="flex min-w-0 items-center gap-1.5 whitespace-nowrap">
                      {groupIcon && <img src={groupIcon} alt="" className="h-6 w-6 shrink-0 object-contain" />}
                      {row.label}
                    </span>
                    <span className="shrink-0 font-mono text-[10px] text-slate-500">{row.count}</span>
                  </button>
                  {row.items.length > 0 ? row.items.map(renderBannerButton) : (
                    <span className="px-2 py-2 text-xs italic text-slate-600">{t.bannerNoPulls}</span>
                  )}
                </div>
              </div>
            );
          })}
      </section>

      <div className={styles.bannerFrame}>
        {isCollapsed && (
          <div className={styles.collapsedSummary}>
            <span className={styles.collapsedTitle}>{title}</span>
            <span className={styles.collapsedCount}>{formatNumber(bannerLuck.pulls, locale)} {t.bannerPullCount}</span>
          </div>
        )}
        <div className={styles.bannerControls}>
          <button
            type="button"
            onClick={handleCardExport}
            disabled={!profile || isExporting}
            className={styles.exportButton}
            title={t.cardExportPng}
          >
            <svg viewBox="0 0 20 20" width="16" height="16" fill="none" aria-hidden="true">
              <path d="M10 2.5v9m0 0 3.25-3.25M10 11.5 6.75 8.25M3 13.25v2.5A1.25 1.25 0 0 0 4.25 17h11.5A1.25 1.25 0 0 0 17 15.75v-2.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>{isExporting ? t.cardExporting : t.cardExportPng}</span>
          </button>
          <button
            type="button"
            onClick={() => setIsCollapsed((previous) => !previous)}
            aria-label={isCollapsed ? t.cardExpand : t.cardCollapse}
            aria-expanded={!isCollapsed}
            aria-controls="wish-banner-showcase"
            title={isCollapsed ? t.cardExpand : t.cardCollapse}
            className={styles.collapseButton}
          >
            <svg className={isCollapsed ? styles.chevronDown : ''} viewBox="0 0 20 20" width="16" height="16" fill="none" aria-hidden="true">
              <path d="m4.5 12 5.5-5 5.5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {exportError && <span role="alert" className={styles.exportError}>{t.cardExportError}</span>}
        </div>

      <section
        ref={showcaseRef}
        id="wish-banner-showcase"
        className={`${styles.showcase} ${isAggregate ? styles.aggregate : ''} ${isCharacterGroup || isMatrixGroup ? styles.historyWideAggregate : ''} ${!bannerLuck.isLimited ? styles.compactShowcase : ''} ${isCollapsed ? styles.collapsedShowcase : ''} ${(customAggregateArtwork||publicAggregateArtwork) && customArtworkColor && isAggregate ? styles.adaptiveArtwork : ''}`}
        data-artwork-tone={(customAggregateArtwork||publicAggregateArtwork) && isAggregate ? ((customArtworkColor?.luminance ?? 0) * (customAggregateArtwork ? customArtworkBrightness : 1) > 0.5 ? 'light' : 'dark') : undefined}
        style={customArtworkColor && isAggregate ? { '--wish-custom-artwork-rgb': `${customArtworkColor.red}, ${customArtworkColor.green}, ${customArtworkColor.blue}` } as React.CSSProperties : undefined}
        aria-label={title}
        onMouseLeave={() => setPinnedDropTooltipId(null)}
        onClick={(event) => {
          const target = event.target;
          if (!(target instanceof Element) || target.closest('[role="tooltip"], [data-banner-drop-tooltip-trigger]')) return;
          setPinnedDropTooltipId(null);
        }}
      >
        <div ref={heroRef} className={styles.hero}>
          {backgroundImage && <div className={styles.heroBackground} style={{ backgroundImage: `url(${backgroundImage})` }} aria-hidden="true" />}
          {splashImage && (
            <img src={splashImage} alt="" className={styles.bannerCharacter} loading="eager" />
          )}
          {isAggregate && (customAggregateArtwork ? (
            <img
              ref={customArtworkRef}
              src={customAggregateArtwork}
              alt=""
              aria-label={localeText(locale)('Custom image. Move with arrow keys or by dragging.', 'Пользовательская картинка. Перемещайте стрелками или перетаскиванием.')}
              tabIndex={0}
              draggable={false}
              className={styles.aggregateCustomArtwork}
              style={{ left: `${customArtworkPosition.x}%`, top: `${customArtworkPosition.y}%`, transform: `translate(-50%, -50%) scale(${customArtworkScale})`, '--wish-artwork-brightness': customArtworkBrightness } as React.CSSProperties}
              onPointerDown={handleArtworkPointerDown}
              onPointerMove={handleArtworkPointerMove}
              onPointerUp={handleArtworkPointerUp}
              onPointerCancel={handleArtworkPointerUp}
              onKeyDown={handleArtworkKeyDown}
            />
          ) : publicAggregateArtwork?<img src={publicAggregateArtwork.image} alt="" aria-hidden="true" data-wish-public-art={publicAggregateArtwork.id} className={styles.aggregateCustomArtwork} style={{left:`${publicAggregateArtwork.position.x}%`,top:`${publicAggregateArtwork.position.y}%`,transform:`translate(-50%, -50%) scale(${publicAggregateArtwork.scale})`,pointerEvents:'none'}}/>:<div className={styles.aggregateArtwork} aria-hidden="true"><span>✦</span></div>)}
          {isAllBanners && (
            <div className={styles.aggregateArtworkControls} data-wish-artwork-controls>
              {customAggregateArtwork && (
                <label className={styles.aggregateArtworkSize}>
                  <span>{localeText(locale)('Size')}</span>
                  <input
                    type="range"
                    min="0.2"
                    max="4"
                    step="0.05"
                    value={customArtworkScale}
                    aria-label={localeText(locale)('Custom image size')}
                    onChange={(event) => setCustomArtworkScale(Number(event.currentTarget.value))}
                  />
                </label>
              )}
              {customAggregateArtwork && (
                <label className={styles.aggregateArtworkSize}>
                  <span>{localeText(locale)('Brightness', 'Яркость')}</span>
                  <input
                    type="range"
                    min={ARTWORK_BRIGHTNESS.min}
                    max={ARTWORK_BRIGHTNESS.max}
                    step="0.05"
                    value={customArtworkBrightness}
                    aria-label={localeText(locale)('Custom image brightness', 'Яркость пользовательской картинки')}
                    onChange={(event) => setCustomArtworkBrightness(Number(event.currentTarget.value))}
                  />
                </label>
              )}
              <div className={styles.aggregateArtworkActions}>
                <label className={styles.aggregateArtworkButton}>
                  <span>{customAggregateArtwork ? (localeText(locale)('Change image', 'Заменить картинку')) : (localeText(locale)('Add image'))}</span>
                  <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleCustomArtworkChange} />
                </label>
                {customAggregateArtwork && (
                  <button
                    type="button"
                    className={styles.aggregateArtworkButton}
                    onClick={() => {
                      artworkUploadRequest.current += 1;
                      dismiss(artworkNoticeId);
                      persistedArtworkUrl.current='';
                      void removeLocalArtwork('wish').catch(()=>notify(localeText(locale)('Could not remove the saved image.', 'Не удалось удалить сохранённую картинку.'),{id:artworkNoticeId,tone:'error'}));
                      artworkColorRequest.current += 1;
                      setCustomAggregateArtwork(null);
                      setCustomArtworkColor(null);
                      setCustomArtworkPosition({ x: 68, y: 58 });
                      setCustomArtworkScale(1);
                      setCustomArtworkBrightness(1);
                    }}
                  >
                    {localeText(locale)('Remove', 'Убрать')}
                  </button>
                )}
              </div>
            </div>
          )}
          <div className={styles.heroContent}>
            <div className={styles.identityMeta}>
              <p className={styles.eyebrow}>{isAggregate ? t.bannerSummaryLabel : t.periodLabel}</p>
              <p className={styles.period}>{period}{unknownRarityCount>0&&<span title={unknownRarityExplanation}> · {localeText(locale)('Unknown rarity', 'Неизвестная редкость')}: {unknownRarityCount}</span>}</p>
            </div>
            <div className={`${styles.titleLockup} ${hasTitleImage ? styles.logoLockup : ''}`}>
              <h2 className={styles.heroTitle}>{title}</h2>
              {hasTitleImage && (
                <img src={titleImage} alt="" onError={() => setTitleImgError(true)} className={styles.titleImage} loading="eager" />
              )}
            </div>
          </div>
        </div>
        <div className={styles.dashboard}>
          <div className={styles.statsPanel}>
            <div className={styles.metrics}>
              <div className={styles.metric}>
                <p className={styles.metricLabel}>{t.bannerPullCount}</p>
                <p className={styles.metricValue}>{formatNumber(bannerLuck.pulls, locale)}</p>
              </div>
                {bannerLuck.isLimited && (
                  <div className={`${styles.metric} ${isAggregate ? styles.winRateWithPure : ''}`}>
                    <div>
                      <p className={styles.metricLabel}>{t.bannerWinRate}</p>
                      <p
                        className={styles.metricValue}
                        style={bannerLuck.winRate === null ? undefined : { color: getWinRateColor(bannerLuck.winRate) }}
                      >
                        {bannerLuck.winRate === null ? '—' : `${bannerLuck.winRate.toFixed(1)}%`}
                      </p>
                    </div>
                    {isAggregate && (
                      <div className={styles.pureWinRateInline}>
                        <p className={styles.pureWinRateLabel}>{t.bannerPureWinRate}</p>
                        <p
                          className={styles.pureWinRateValue}
                          style={bannerLuck.pureWinRate === null ? undefined : { color: getWinRateColor(bannerLuck.pureWinRate) }}
                        >
                          {bannerLuck.pureWinRate === null ? '—' : `${bannerLuck.pureWinRate.toFixed(2)}%`}
                        </p>
                        <p className={styles.pureWinRateHint}>{t.bannerPureWinRateHint}</p>
                      </div>
                    )}
                  </div>
                )}
                {!isAggregate && cashbackUnit && (
                  <div className={styles.metric}>
                    <p className={styles.metricLabel}>{t.cashbackLabel}</p>
                    <p className={`${styles.metricValue} ${styles.cashbackValue} ${styles.cashbackAmount}`}>
                      {formatNumber(cashbackTotal, locale)}
                      {cashbackIcon && !cashbackIconError ? (
                        <img src={cashbackIcon} alt={cashbackUnit} className={styles.cashbackIcon} onError={() => setCashbackIconError(true)} />
                      ) : (
                        <span className={styles.metricUnit}>{cashbackUnit}</span>
                      )}
                    </p>
                  </div>
                )}
            </div>

            {bannerLuck.isLimited ? (
              <>
                <div className={styles.outcomes}>
                  <span className={`${styles.outcomeCount} ${styles.outcomeWins}`}>
                    {t.bannerWins} <strong className="ml-1 font-mono text-white">{bannerLuck.wins}</strong>
                  </span>
                  <span className={`${styles.outcomeCount} ${styles.outcomeLosses}`}>
                    {t.bannerLosses} <strong className="ml-1 font-mono text-white">{bannerLuck.losses}</strong>
                  </span>
                  {isAggregate && (
                    <>
                      <span className={styles.outcomeCount}>
                        {t.bannerForcedWins} <strong className="ml-1 font-mono text-white">{bannerLuck.forcedWins}</strong>
                      </span>
                      <span className={styles.outcomeCount}>
                        {t.bannerForcedLosses} <strong className="ml-1 font-mono text-white">{bannerLuck.forcedLosses}</strong>
                      </span>
                    </>
                  )}
                  {!isAggregate && <>
                    <span>
                      {t.bannerNextEntry} <strong className={`ml-1 ${getPredictionColorClass(bannerLuck.startingPrediction)}`}>{startingPredictionLabel}</strong>
                    </span>
                    <span>
                      {t.bannerNextExit} <strong className={`ml-1 ${getPredictionColorClass(bannerLuck.nextPrediction)}`}>{nextPredictionLabel}</strong>
                    </span>
                  </>}
                </div>
                {eventSsrDrops.length > 0 && (
                  <div className={`${styles.dropRow} ${eventSsrDrops.length === 1 && !isCharacterGroup && !isMatrixGroup ? styles.singleDrop : ''}`}>
                    <span className={styles.dropLabel}>
                      {isAggregate
                        ? t.bannerRecentSsrDrops
                        : banner.banner_type === 'matrix_limited'
                        ? t.bannerMatrixDrops
                        : t.bannerSsrDrops}
                    </span>
                    {eventSsrDrops.map((pull) => {
                      const outcome = pull.streak_outcome ?? (pull.is_featured ? 'win' : 'loss');
                      const isWin = outcome === 'win';
                      const isLoss = outcome === 'loss';
                      const pullMedia = resolvePullMedia(mediaMap, pull, locale);
                      // A source name can be stale or mislocalized. The stable item id
                      // resolved through generated game data is authoritative here.
                      const itemName = pullMedia.displayName;
                      const slotVisual = banner.banner_type === 'matrix_limited'
                        ? getMatrixSlotVisual(pull.slot, locale)
                        : null;
                      return (
                        <Tooltip
                          key={pull.id}
                          placement="top"
                          portal
                          open={pinnedDropTooltipId ? pinnedDropTooltipId === pull.id : undefined}
                          interactive={pinnedDropTooltipId === pull.id}
                          className="w-64 whitespace-normal"
                          content={(
                            <div className="space-y-1">
                              <p className="text-[10px] font-bold uppercase tracking-wide text-sky-300">{bannerTitle}</p>
                              <div className="flex items-center gap-2">
                                {pullMedia.image && (
                                  <img
                                    src={pullMedia.image}
                                    alt={pullMedia.primaryName}
                                    className="h-12 w-12 shrink-0 rounded-md border border-white/10 bg-black/25 p-1 object-contain"
                                  />
                                )}
                                <div className="min-w-0">
                                  <p className="text-xs font-semibold text-white">{formatDropName(itemName, pull.item_type === 'matrix')}</p>
                                  {slotVisual && <p className="mt-1 flex items-center gap-1.5 text-[10px] text-white/75"><img src={slotVisual.image} alt="" className="h-5 w-5 object-contain" />{slotVisual.label}</p>}
                                </div>
                              </div>
                              <p className="text-[10px] text-white/70">{t.bannerDropDate} {formatPullDate(pull.pull_timestamp, locale)}</p>
                              <div className="flex items-center gap-2 text-[10px]">
                                <span className={isWin ? 'font-bold text-emerald-300' : isLoss ? 'font-bold text-rose-300' : 'text-white/70'}>{isWin ? localeText(locale)('WIN') : isLoss ? localeText(locale)('LOSS') : '?'}</span>
                                <span className="text-white/70">{formatWishPosition(pull.pity_count)} {t.pullDistance}</span>
                              </div>
                            </div>
                          )}
                        >
                          <span
                            tabIndex={0}
                            data-banner-drop-tooltip-trigger
                            onClick={() => setPinnedDropTooltipId((current) => current === pull.id ? null : pull.id)}
                            className={`${styles.dropChip} ${isWin ? styles.dropChipWin : isLoss ? styles.dropChipLoss : ''}`}
                            title={slotVisual?.label}
                          >
                            {slotVisual && <img src={slotVisual.image} alt="" className="h-4 w-4 shrink-0 object-contain" />}
                            <span className={styles.dropName}>{formatDropName(
                              pull.item_type === 'matrix'
                                ? pullMedia.characterName || itemName
                                : pullMedia.primaryName,
                              pull.item_type === 'matrix',
                            )}</span>
                            <strong className={styles.dropCount}>{formatWishPosition(pull.pity_count)}</strong>
                          </span>
                        </Tooltip>
                      );
                    })}
                  </div>
                )}
                {isSharedPityAggregate && <div className={styles.aggregateHistoryReserve} aria-hidden="true" />}
                <div className={styles.luckGrid}>
                  {[
                    {
                      kind: 'winRate' as const,
                      label: t.luckMetricWinRate,
                      metric: winRateLuck,
                      value: `${winRateLuck.multiplier.toFixed(2)}x`,
                      explanation: winRateExplanation,
                      hasData: winRateLuck.totalOutcomes > 0,
                    },
                    {
                      kind: 'dropRate' as const,
                      label: t.luckMetricDropRate,
                      metric: dropRateLuck,
                      value: dropRateLuck.hasReliableExposure === false ? '?' : `${dropRateLuck.multiplier.toFixed(2)}x`,
                      explanation: dropRateExplanation,
                      hasData: dropRateLuck.totalPulls > 0 && dropRateLuck.hasReliableExposure !== false,
                    },
                  ].map((item) => {
                    const luckPresentation = getLuckMultiplierPresentation(item.metric.multiplier, luckStyles.luckShimmer);
                    const luckValue = (
                      <span className={`${luckStyles.luckValueFrame} ${item.metric.multiplier > 2 ? luckStyles.luckValueFrameHigh : ''} ${item.metric.multiplier > 3 ? luckStyles.luckValueFrameExtreme : ''}`}>
                        <span className={`shrink-0 font-mono text-[11px] ${luckPresentation.className}`} style={luckPresentation.style}>
                        {item.value} · {t[`luckTier${item.metric.tier.split('_').map((part) => part[0].toUpperCase() + part.slice(1)).join('')}` as keyof typeof t]}
                        </span>
                      </span>
                    );
                    return (
                    <div key={item.label} className={styles.luckItem}>
                      <div className={`${styles.luckMetricHeader} text-[11px] font-bold uppercase tracking-[0.08em] text-white/70`}>
                        <span className={styles.luckHeading}>
                          <span className={styles.luckHeadingPrefix}>{t.luckVsExpectedPrefix}</span>
                          <strong className={item.kind === 'dropRate'
                            ? item.metric.multiplier > 3 ? styles.luckHeadingDropExtreme : styles.luckHeadingDrop
                            : styles.luckHeadingWin}>{item.label}</strong>
                        </span>
                        {luckValue}
                      </div>
                      <div
                        className={styles.luckTrack}
                        role="img"
                        aria-label={`${item.label}: ${item.value}`}
                      >
                        <span
                          className={styles.luckMarker}
                          style={{ left: `${Math.min(100, Math.max(0, item.metric.positionPct))}%` }}
                          aria-hidden="true"
                        />
                      </div>
                      <div className="mt-1 flex justify-between text-[9px] font-medium text-white/50">
                        <span>{t.luckScaleUnlucky}</span>
                        <span>{t.luckScaleExpected}</span>
                        <span>{t.luckScaleVeryLucky}</span>
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-white/65">
                        {item.hasData ? item.explanation : <span className="italic">{t.luckNoData}</span>}
                      </p>
                    </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="mt-3 text-[11px] text-white/60">{t.bannerNo5050}</p>
            )}

            {standardSsrDrops.length > 0 && (
              <div className={`${styles.dropRow} ${standardSsrDrops.length === 1 ? styles.singleDrop : ''}`}>
                <span className={styles.dropLabel}>{banner.banner_type === 'black_nucleus' ? t.bannerBlackNucleusDrops : t.bannerStandardSsrDrops}</span>
                {standardSsrDrops.map(({ pull, pullNumber }) => {
                  const pullMedia = resolvePullMedia(mediaMap, pull, locale);
                  const itemName = pullMedia.characterName || pullMedia.primaryName;
                  const slotVisual = banner.banner_type === 'standard_matrix'
                    ? getMatrixSlotVisual(pull.slot, locale)
                    : null;
                  return <Tooltip
                    key={pull.id}
                    placement="top"
                    portal
                    open={pinnedDropTooltipId ? pinnedDropTooltipId === pull.id : undefined}
                    interactive={pinnedDropTooltipId === pull.id}
                    className="w-64 whitespace-normal"
                    content={(
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-sky-300">{bannerTitle}</p>
                        <div className="flex items-center gap-2">
                          {pullMedia.image && (
                            <img
                              src={pullMedia.image}
                              alt={pullMedia.primaryName}
                              className="h-12 w-12 shrink-0 rounded-md border border-white/10 bg-black/25 p-1 object-contain"
                            />
                          )}
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-white">{formatDropName(itemName, pull.item_type === 'matrix')}</p>
                            {slotVisual && <p className="mt-1 flex items-center gap-1.5 text-[10px] text-white/75"><img src={slotVisual.image} alt="" className="h-5 w-5 object-contain" />{slotVisual.label}</p>}
                          </div>
                        </div>
                        <p className="text-[10px] text-white/70">{t.bannerDropDate} {formatPullDate(pull.pull_timestamp, locale)}</p>
                        <p className="text-[10px] text-white/70">{t.bannerPullNumber} {formatWishPosition(pullNumber)}</p>
                        <p className="text-[10px] text-white/70">
                          {banner.banner_type === 'black_nucleus' ? t.bannerPullsSincePrevious : t.bannerPityAtDrop} {formatWishPosition(pull.pity_count)} {t.pullDistance}
                        </p>
                      </div>
                    )}
                  >
                    <span
                      tabIndex={0}
                      data-banner-drop-tooltip-trigger
                      onClick={() => setPinnedDropTooltipId((current) => current === pull.id ? null : pull.id)}
                      className={styles.dropChip}
                      title={slotVisual?.label}
                    >
                      {slotVisual && <img src={slotVisual.image} alt="" className="h-4 w-4 shrink-0 object-contain" />}
                      <span className={styles.dropName}>{formatDropName(itemName, pull.item_type === 'matrix')}</span>
                      <strong className={styles.dropCount}>#{formatWishPosition(pullNumber)}</strong>
                      <span className={styles.dropDistance}>{formatWishPosition(pull.pity_count)}</span>
                    </span>
                  </Tooltip>;
                })}
              </div>
            )}

            {banner.banner_type === 'black_nucleus' && (
              <div className={`${styles.luckGrid} ${styles.luckGridSingle}`}>
                <div className={styles.luckItem}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2 text-[11px] font-bold uppercase tracking-[0.08em] text-white/70">
                    <span>{t.luckVsExpectedDropRate}</span>
                    <span className={`shrink-0 font-mono text-[11px] ${blackNucleusDropPresentation.className}`} style={blackNucleusDropPresentation.style}>
                      {dropRateLuck.hasReliableExposure === false ? '?' : `${dropRateLuck.multiplier.toFixed(2)}x`} · {t[`luckTier${dropRateLuck.tier.split('_').map((part) => part[0].toUpperCase() + part.slice(1)).join('')}` as keyof typeof t]}
                    </span>
                  </div>
                  <div className={styles.luckTrack} role="img" aria-label={`${t.luckVsExpectedDropRate}: ${dropRateLuck.multiplier.toFixed(2)}x`}>
                    <span className={styles.luckMarker} style={{ left: `${Math.min(100, Math.max(0, dropRateLuck.positionPct))}%` }} aria-hidden="true" />
                  </div>
                  <div className="mt-1 flex justify-between text-[9px] font-medium text-white/50">
                    <span>{t.luckScaleUnlucky}</span>
                    <span>{t.luckScaleExpected}</span>
                    <span>{t.luckScaleVeryLucky}</span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-white/65">
                    {dropRateLuck.totalPulls > 0 ? dropRateExplanation : <span className="italic">{t.luckNoData}</span>}
                  </p>
                </div>
              </div>
            )}

            {allBannerPity ? (
              <div className={`${styles.pityPanel} ${styles.aggregatePityPanel}`}>
                {([
                  { key: 'weapon', label: t.trackLimitedWeapon, state: allBannerPity.weapon },
                  { key: 'matrix', label: t.trackLimitedMatrix, state: allBannerPity.matrix },
                ] as const).map(({ key, label, state }) => {
                  const prediction = evaluateStreak(state.streaks).nextPrediction;
                  const predictionLabel = prediction === 'forced_win'
                    ? t.cardPredictionForcedWin
                    : prediction === 'forced_loss'
                    ? t.cardPredictionForcedLoss
                    : prediction === 'neutral_50_50'
                    ? t.cardPredictionNeutral
                    : t.cardStreakNoData;
                  return (
                    <div key={key} className={styles.aggregatePityCard}>
                      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[10px]">
                        <span className="font-semibold text-white/75">{label}</span>
                        <span className="font-mono font-bold text-amber-200">{t.bannerPityNow} {formatWishPosition(state.currentPity)}/{state.pityTarget}</span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-[10px]">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="text-white/50">{t.cardStreakNext}</span>
                          <strong className={`rounded border px-1.5 py-0.5 font-bold ${getPredictionColorClass(prediction)}`}>{predictionLabel}</strong>
                        </span>
                        <span className="font-semibold text-amber-200">{t.bannerPityRemaining}: {formatWishPosition(state.pullsToGuarantee)}</span>
                      </div>
                      <div className={styles.pityTrack}>
                        <div className={styles.pityFill} style={{ width: `${Math.max(0, Math.min(100, (state.currentPity / state.pityTarget) * 100))}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : bannerLuck.pityTarget > 0 ? (
              <div className={styles.pityPanel}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-[10px]">
                  {isSharedPityAggregate ? (
                    <>
                      <span className="text-white/65">
                        {t.pity5Title} · {t.bannerPityNow} <strong className="font-mono text-amber-200">{formatWishPosition(bannerLuck.currentPity)}/{bannerLuck.pityTarget}</strong>
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="text-white/50">{t.cardStreakNext}</span>
                        <strong className={`rounded border px-1.5 py-0.5 font-bold ${getPredictionColorClass(bannerLuck.nextPrediction)}`}>{nextPredictionLabel}</strong>
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-white/65">
                        {t.bannerPityStart} <strong className="font-mono text-white">{formatWishPosition(bannerLuck.startingPity)}/{bannerLuck.pityTarget}</strong>
                        <span className="mx-1.5 text-white/35">→</span>
                        {t.bannerPityNow} <strong className="font-mono text-amber-200">{formatWishPosition(bannerLuck.currentPity)}/{bannerLuck.pityTarget}</strong>
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="text-white/50">{t.cardStreakNext}</span>
                        <strong className={`rounded border px-1.5 py-0.5 font-bold ${getPredictionColorClass(bannerLuck.nextPrediction)}`}>{nextPredictionLabel}</strong>
                      </span>
                    </>
                  )}
                  <span className="font-semibold text-amber-200">{t.bannerPityRemaining}: {formatWishPosition(bannerLuck.pullsToGuarantee)}</span>
                </div>
                <div className={styles.pityTrack}>
                  <div className={styles.pityFill} style={{ width: `${Math.max(0, Math.min(100, (bannerLuck.currentPity / bannerLuck.pityTarget) * 100))}%` }} />
                  {!isSharedPityAggregate && (
                    <span
                      className={styles.pityStartMark}
                      style={{ left: `${Math.min(100, (bannerLuck.startingPity / bannerLuck.pityTarget) * 100)}%` }}
                      title={`${t.bannerPityStart}: ${formatWishPosition(bannerLuck.startingPity)}/${bannerLuck.pityTarget}`}
                    />
                  )}
                </div>
              </div>
            ) : banner.banner_type === 'black_nucleus' ? (
              <p className="mt-3 border-t border-white/10 pt-2.5 text-[10px] text-white/65">
                {t.bannerSinceLastSsr}:{' '}
                <strong className="font-mono text-amber-200">{bannerLuck.currentIncompleteInterval}</strong>
              </p>
            ) : (
              <p className="mt-3 border-t border-white/10 pt-2.5 text-[10px] text-white/55">{t.bannerNoPity}</p>
            )}
          </div>
        </div>
      </section>
      </div>

    </div>
  );
}
