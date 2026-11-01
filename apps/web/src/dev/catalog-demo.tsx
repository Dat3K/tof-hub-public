'use client';

import React, { useState, useMemo } from 'react';
import {
  CatalogControls,
  CatalogSearch,
  ServerModeSwitcher,
  FilterGroup,
  FilterChip,
  CatalogSort,
  CatalogCounter,
  ResetFiltersButton,
  EntityGrid,
  EntityCard,
  Modal,
  ModalHeader,
  ModalTitle,
  ModalClose,
  ModalBody,
  ModalFooter,
  Dialog,
  MediaLightbox,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Button,
  Badge,
} from '@tof-hub/ui';
import type {
  ServerMode,
  SortOption,
  RarityVariant,
  ElementVariant,
  RoleVariant,
  PropertyVariant,
} from '@tof-hub/ui';

// ---------------------------------------------------------------------------
// 1. Mock Data: Simulacra Roster
// ---------------------------------------------------------------------------

export interface MockSimulacrum {
  id: string;
  name: string;
  weaponName: string;
  rarity: RarityVariant;
  element: ElementVariant;
  role: RoleVariant;
  serverMode: 'both' | 'gacha' | 'mmo';
  avatarUrl: string;
  splashUrl: string;
  weaponIconUrl: string;
  releaseOrder: number;
  description: string;
  resonance: string;
  gachaTraits: string[];
  mmoTraits: string[];
}

export const MOCK_SIMULACRA: MockSimulacrum[] = [
  {
    id: 'saki-fuwa',
    name: 'Saki Fuwa',
    weaponName: 'Heartstream',
    rarity: 'ssr',
    element: 'frost',
    role: 'defense',
    serverMode: 'both',
    avatarUrl: '/game-assets/avatars/saki.webp',
    splashUrl: '/game-assets/splash/saki-full.webp',
    weaponIconUrl: '/game-assets/weapons/heartstream.webp',
    releaseOrder: 10,
    description: 'Captain of the Special Security Forces in Mirroria. Dual-wielding frost katanas.',
    resonance: 'Frost Fortitude / Attack',
    gachaTraits: ['Surging Heart style', 'Active block counter', 'Frost resonance'],
    mmoTraits: ['Taunt multiplier +30%', 'Shield generation rate +25%', 'Aggro generation boost'],
  },
  {
    id: 'alyss',
    name: 'Alyss',
    weaponName: 'Immortal Wings',
    rarity: 'ssr',
    element: 'frost',
    role: 'dps',
    serverMode: 'both',
    avatarUrl: '/game-assets/avatars/alyss.webp',
    splashUrl: '/game-assets/splash/alyss-full.webp',
    weaponIconUrl: '/game-assets/weapons/immortal-wings.webp',
    releaseOrder: 11,
    description: 'Special Security Force scout adept at aerial frost attacks and graceful combat.',
    resonance: 'Frost DPS',
    gachaTraits: ['Spatial displacement', 'Latent dancer combo', 'Discharge multiplier'],
    mmoTraits: ['Shatter +15%', 'Team frost damage boost +8%'],
  },
  {
    id: 'fenrir',
    name: 'Fenrir',
    weaponName: 'Gleipnir',
    rarity: 'ssr',
    element: 'volt',
    role: 'dps',
    serverMode: 'both',
    avatarUrl: '/game-assets/avatars/fenrir.webp',
    splashUrl: '/game-assets/splash/fenrir-full.webp',
    weaponIconUrl: '/game-assets/weapons/gleipnir.webp',
    releaseOrder: 12,
    description: 'Energetic DJ in Mirroria who battles using claw strikes and high-tempo rhythm notes.',
    resonance: 'Volt DPS / Rainbow',
    gachaTraits: ['Musical claws', 'Note detonation', 'Balance resonance'],
    mmoTraits: ['Crit damage +12%', 'Burst healing on discharge'],
  },
  {
    id: 'nemesis',
    name: 'Nemesis',
    weaponName: 'Dawn',
    rarity: 'ssr',
    element: 'volt',
    role: 'support',
    serverMode: 'both',
    avatarUrl: '/game-assets/avatars/nemesis.webp',
    splashUrl: '/game-assets/splash/nemesis-full.webp',
    weaponIconUrl: '/game-assets/weapons/dawn.webp',
    releaseOrder: 1,
    description: 'Heavily modified cybernetic angel created by the Heirs of Aida.',
    resonance: 'Volt Benediction',
    gachaTraits: ['Electrode summon', 'Ring of healing', 'Volt resonance'],
    mmoTraits: ['Continuous group recovery', 'Electrode taunt pulse'],
  },
  {
    id: 'ruby',
    name: 'Ruby',
    weaponName: 'Spark',
    rarity: 'ssr',
    element: 'flame',
    role: 'dps',
    serverMode: 'both',
    avatarUrl: '/game-assets/avatars/ruby.webp',
    splashUrl: '/game-assets/splash/ruby-full.webp',
    weaponIconUrl: '/game-assets/weapons/spark.webp',
    releaseOrder: 8,
    description: 'A young girl clutching her beloved mechanical rabbit Sparky, projecting flame beams.',
    resonance: 'Flame DPS',
    gachaTraits: ['Sparky heat beam', 'Superheated burn detonation', 'Flame resonance'],
    mmoTraits: ['Burn duration +50%', 'Area scorch dot damage'],
  },
  {
    id: 'lan',
    name: 'Lan',
    weaponName: 'Vermilion Wing',
    rarity: 'ssr',
    element: 'flame',
    role: 'defense',
    serverMode: 'both',
    avatarUrl: '/game-assets/avatars/lan.webp',
    splashUrl: '/game-assets/splash/lan-full.webp',
    weaponIconUrl: '/game-assets/weapons/vermilion-wing.webp',
    releaseOrder: 13,
    description: 'The enigmatic master of Domain 9 who commands vermilion feather umbrellas.',
    resonance: 'Flame Fortitude',
    gachaTraits: ['Feather shield', 'Umbrella matrix barrier', 'Flame buff'],
    mmoTraits: ['Party damage reduction +15%', 'Aggro pulse per umbrella active'],
  },
  {
    id: 'lin',
    name: 'Lin',
    weaponName: 'Shadow Weaver',
    rarity: 'ssr',
    element: 'altered',
    role: 'dps',
    serverMode: 'both',
    avatarUrl: '/game-assets/avatars/lin.webp',
    splashUrl: '/game-assets/splash/lin-full.webp',
    weaponIconUrl: '/game-assets/weapons/shadow-weaver.webp',
    releaseOrder: 9,
    description: 'Beloved director of Mirroria armed with fan weapons and an Altered gravity field.',
    resonance: 'Altered Universal DPS',
    gachaTraits: ['Moonlight Realm field', 'Altered bloom', 'Element adaptive reaction'],
    mmoTraits: ['Teamwide final damage +10%', 'Cooldown reduction aura'],
  },
  {
    id: 'fiona',
    name: 'Fiona',
    weaponName: 'Moonstar Bracelet',
    rarity: 'ssr',
    element: 'altered',
    role: 'support',
    serverMode: 'both',
    avatarUrl: '/game-assets/avatars/fiona.webp',
    splashUrl: '/game-assets/splash/fiona-full.webp',
    weaponIconUrl: '/game-assets/weapons/moonstar-bracelet.webp',
    releaseOrder: 14,
    description: 'Graceful ruler of Innars deep ocean city wielding water-shaped light blades.',
    resonance: 'Altered Benediction',
    gachaTraits: ['Spring surge', 'Torrential heal', 'Purify debuffs'],
    mmoTraits: ['Global damage buff +20%', 'Mass dispell and revival pulse'],
  },
  {
    id: 'claudia',
    name: 'Claudia',
    weaponName: 'Guren Blade',
    rarity: 'ssr',
    element: 'physical',
    role: 'dps',
    serverMode: 'both',
    avatarUrl: '/game-assets/avatars/claudia.webp',
    splashUrl: '/game-assets/splash/claudia-full.webp',
    weaponIconUrl: '/game-assets/weapons/guren-blade.webp',
    releaseOrder: 2,
    description: 'Steely Hykros executor with rapid physical slashes and grievance affliction.',
    resonance: 'Physical DPS',
    gachaTraits: ['Swift sword dance', 'Grievance boost', 'Physical resonance'],
    mmoTraits: ['Grievance vulnerability +15%', 'Shatter amplification'],
  },
  {
    id: 'lyra',
    name: 'Lyra',
    weaponName: 'Vespers',
    rarity: 'ssr',
    element: 'physical',
    role: 'support',
    serverMode: 'both',
    avatarUrl: '/game-assets/avatars/lyra.webp',
    splashUrl: '/game-assets/splash/lyra-full.webp',
    weaponIconUrl: '/game-assets/weapons/vespers.webp',
    releaseOrder: 7,
    description: 'Venerable head administrator of the Vera foundation equipped with cybernetic arms.',
    resonance: 'Physical Benediction',
    gachaTraits: ['Enlightenment totem', 'Overheal shielding', 'Hyperbody combo'],
    mmoTraits: ['Max health shield conversion', 'Death prevention ward'],
  },
  {
    id: 'ene',
    name: 'Ene',
    weaponName: 'Pummeler',
    rarity: 'sr',
    element: 'frost',
    role: 'defense',
    serverMode: 'both',
    avatarUrl: '/game-assets/avatars/ene.webp',
    splashUrl: '/game-assets/splash/ene-full.webp',
    weaponIconUrl: '/game-assets/weapons/pummeler.webp',
    releaseOrder: 3,
    description: 'Early-generation combat android equipped with a massive freezing hammer.',
    resonance: 'Frost Fortitude',
    gachaTraits: ['Super armor swing', 'Frost shockwave'],
    mmoTraits: ['Hammer taunt', 'Armor increase +10%'],
  },
  {
    id: 'echo',
    name: 'Echo',
    weaponName: 'Thunderous Halberd',
    rarity: 'sr',
    element: 'volt',
    role: 'dps',
    serverMode: 'both',
    avatarUrl: '/game-assets/avatars/echo.webp',
    splashUrl: '/game-assets/splash/echo-full.webp',
    weaponIconUrl: '/game-assets/weapons/thunderous-halberd.webp',
    releaseOrder: 4,
    description: 'Astra shelter guard armed with a lightning halberd.',
    resonance: 'Volt DPS',
    gachaTraits: ['Paralyzing thrust', 'Halberd spin'],
    mmoTraits: ['Volt pierce +8%'],
  },
];

// ---------------------------------------------------------------------------
// 2. Mock Data: Relics Catalog
// ---------------------------------------------------------------------------

export interface MockRelic {
  id: string;
  name: string;
  rarity: RarityVariant;
  property: PropertyVariant;
  serverMode: 'both' | 'gacha' | 'mmo';
  iconUrl: string;
  splashUrl: string;
  cooldownSeconds: number;
  description: string;
  gachaEffect: string;
  mmoEffect: string;
}

export const MOCK_RELICS: MockRelic[] = [
  {
    id: 'spacetime-rift',
    name: 'Spacetime Rift',
    rarity: 'ssr',
    property: 'attack',
    serverMode: 'both',
    iconUrl: '/game-assets/relics/spacetime-rift.webp',
    splashUrl: '/game-assets/relics/spacetime-rift-art.webp',
    cooldownSeconds: 100,
    description: 'Launches a proton bomb that collapses space, pulling nearby enemies into a gravitational vortex.',
    gachaEffect: 'Deals 39.6% ATK per second for 10 seconds and prevents dodging.',
    mmoEffect: 'Applies group vulnerability: targets take +20% damage from party members.',
  },
  {
    id: 'hologram-projector',
    name: 'Hologram Projector',
    rarity: 'ssr',
    property: 'attack',
    serverMode: 'both',
    iconUrl: '/game-assets/relics/hologram-projector.webp',
    splashUrl: '/game-assets/relics/hologram-projector-art.webp',
    cooldownSeconds: 180,
    description: 'Projects a holographic clone that mimics the user weapon attacks and discharge skills.',
    gachaEffect: 'Clone deals 50% of user weapon damage for 15 seconds.',
    mmoEffect: 'Clone inherits 35% damage but generates equal threat to draw enemy focus.',
  },
  {
    id: 'omnium-shield',
    name: 'Omnium Shield',
    rarity: 'ssr',
    property: 'defense',
    serverMode: 'both',
    iconUrl: '/game-assets/relics/omnium-shield.webp',
    splashUrl: '/game-assets/relics/omnium-shield-art.webp',
    cooldownSeconds: 90,
    description: 'Deploys an Omnium energy shield that stops projectiles and boosts passing attacks.',
    gachaEffect: 'Shield stops enemy missiles. Passing through increases wanderer damage by 25%.',
    mmoEffect: 'Grants damage reduction to party members behind the shield barrier.',
  },
  {
    id: 'drone',
    name: 'Drone',
    rarity: 'ssr',
    property: 'defense',
    serverMode: 'both',
    iconUrl: '/game-assets/relics/drone.webp',
    splashUrl: '/game-assets/relics/drone-art.webp',
    cooldownSeconds: 120,
    description: 'Summons an autonomous support drone that provides damage reduction and periodic healing.',
    gachaEffect: 'Increases damage reduction by 5% every 5 seconds, up to 25%.',
    mmoEffect: 'Reduces party damage taken by 15% and increases resistance.',
  },
  {
    id: 'cybernetic-arm',
    name: 'Cybernetic Arm',
    rarity: 'sr',
    property: 'function',
    serverMode: 'both',
    iconUrl: '/game-assets/relics/cybernetic-arm.webp',
    splashUrl: '/game-assets/relics/cybernetic-arm-art.webp',
    cooldownSeconds: 30,
    description: 'Grappling hook arm used for exploration and pulling yourself toward targets.',
    gachaEffect: 'Pulls wanderer toward target, dealing 100% damage and recovering weapon charge.',
    mmoEffect: 'Pulls wanderer toward target and grants 2 seconds of hyperbody immunity.',
  },
  {
    id: 'jetpack',
    name: 'Jetpack',
    rarity: 'sr',
    property: 'function',
    serverMode: 'both',
    iconUrl: '/game-assets/relics/jetpack.webp',
    splashUrl: '/game-assets/relics/jetpack-art.webp',
    cooldownSeconds: 0,
    description: 'Personal flight propulsion system allowing gliding and vertical elevation.',
    gachaEffect: 'Consume endurance to glide across landscapes and launch air attacks.',
    mmoEffect: 'Gliding speed increased by 15% in open zones.',
  },
  {
    id: 'missile-barrage',
    name: 'Missile Barrage',
    rarity: 'sr',
    property: 'attack',
    serverMode: 'both',
    iconUrl: '/game-assets/relics/missile-barrage.webp',
    splashUrl: '/game-assets/relics/missile-barrage-art.webp',
    cooldownSeconds: 60,
    description: 'Shoulder-mounted launcher releasing a volley of homing missiles.',
    gachaEffect: 'Launches multiple homing missiles dealing 34.8% damage each.',
    mmoEffect: 'Missiles deal fire damage and reduce enemy defense by 5%.',
  },
];

// ---------------------------------------------------------------------------
// 3. Sort Options
// ---------------------------------------------------------------------------

const SIMULACRA_SORT_OPTIONS: SortOption[] = [
  { value: 'release-desc', label: 'Release Order (Newest First)' },
  { value: 'release-asc', label: 'Release Order (Oldest First)' },
  { value: 'name-asc', label: 'Name (A–Z)', dividerBefore: true },
  { value: 'name-desc', label: 'Name (Z–A)' },
  { value: 'rarity-desc', label: 'Rarity (High → Low)', dividerBefore: true },
];

const RELICS_SORT_OPTIONS: SortOption[] = [
  { value: 'quality-desc', label: 'Quality (High → Low)' },
  { value: 'quality-asc', label: 'Quality (Low → High)' },
  { value: 'name-asc', label: 'Name (A–Z)', dividerBefore: true },
  { value: 'name-desc', label: 'Name (Z–A)' },
  { value: 'cd-asc', label: 'Cooldown (Shortest First)', dividerBefore: true },
];

// ---------------------------------------------------------------------------
// 4. Component: CatalogDemo (Non-public Dev/Test Harness)
// ---------------------------------------------------------------------------

export type CatalogViewType = 'simulacra' | 'relics';

export function CatalogDemo() {
  // Catalog View Form Switcher
  const [catalogType, setCatalogType] = useState<CatalogViewType>('simulacra');

  // Shared Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [serverMode, setServerMode] = useState<ServerMode>('gacha');
  const [isLoading, setIsLoading] = useState(false);

  // Simulacra Specific Filters
  const [simElement, setSimElement] = useState<string>('all');
  const [simRarity, setSimRarity] = useState<string>('all');
  const [simRole, setSimRole] = useState<string>('all');
  const [simSort, setSimSort] = useState<string>('release-desc');

  // Relics Specific Filters
  const [relicProperty, setRelicProperty] = useState<string>('all');
  const [relicRarity, setRelicRarity] = useState<string>('all');
  const [relicSort, setRelicSort] = useState<string>('quality-desc');

  // Interactive Overlays State
  const [selectedEntity, setSelectedEntity] = useState<MockSimulacrum | MockRelic | null>(null);
  const [lightboxMedia, setLightboxMedia] = useState<{ url: string; title: string; caption: string } | null>(null);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  // Active filter computation
  const hasSimActiveFilters = useMemo(() => {
    return (
      searchQuery.trim() !== '' ||
      simElement !== 'all' ||
      simRarity !== 'all' ||
      simRole !== 'all' ||
      simSort !== 'release-desc' ||
      serverMode !== 'gacha'
    );
  }, [searchQuery, simElement, simRarity, simRole, simSort, serverMode]);

  const hasRelicActiveFilters = useMemo(() => {
    return (
      searchQuery.trim() !== '' ||
      relicProperty !== 'all' ||
      relicRarity !== 'all' ||
      relicSort !== 'quality-desc' ||
      serverMode !== 'gacha'
    );
  }, [searchQuery, relicProperty, relicRarity, relicSort, serverMode]);

  const hasActiveFilters = catalogType === 'simulacra' ? hasSimActiveFilters : hasRelicActiveFilters;

  const handleResetFilters = () => {
    setSearchQuery('');
    setServerMode('gacha');
    if (catalogType === 'simulacra') {
      setSimElement('all');
      setSimRarity('all');
      setSimRole('all');
      setSimSort('release-desc');
    } else {
      setRelicProperty('all');
      setRelicRarity('all');
      setRelicSort('quality-desc');
    }
    setIsResetConfirmOpen(false);
  };

  // -------------------------------------------------------------------------
  // Filtering & Sorting
  // -------------------------------------------------------------------------

  const filteredSimulacra = useMemo(() => {
    let list = [...MOCK_SIMULACRA];

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          item.weaponName.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          item.element.toLowerCase().includes(q)
      );
    }

    // Element filter
    if (simElement !== 'all') {
      list = list.filter((item) => item.element === simElement);
    }

    // Rarity filter
    if (simRarity !== 'all') {
      list = list.filter((item) => item.rarity === simRarity);
    }

    // Role filter
    if (simRole !== 'all') {
      list = list.filter((item) => item.role === simRole);
    }

    // Sort order
    list.sort((a, b) => {
      switch (simSort) {
        case 'release-asc':
          return a.releaseOrder - b.releaseOrder;
        case 'name-asc':
          return a.name.localeCompare(b.name);
        case 'name-desc':
          return b.name.localeCompare(a.name);
        case 'rarity-desc':
          return a.rarity === 'ssr' && b.rarity !== 'ssr' ? -1 : 1;
        case 'release-desc':
        default:
          return b.releaseOrder - a.releaseOrder;
      }
    });

    return list;
  }, [searchQuery, simElement, simRarity, simRole, simSort]);

  const filteredRelics = useMemo(() => {
    let list = [...MOCK_RELICS];

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          item.property.toLowerCase().includes(q)
      );
    }

    // Property filter
    if (relicProperty !== 'all') {
      list = list.filter((item) => item.property === relicProperty);
    }

    // Rarity filter
    if (relicRarity !== 'all') {
      list = list.filter((item) => item.rarity === relicRarity);
    }

    // Sort order
    list.sort((a, b) => {
      switch (relicSort) {
        case 'quality-asc':
          return a.rarity === 'sr' && b.rarity !== 'sr' ? -1 : 1;
        case 'name-asc':
          return a.name.localeCompare(b.name);
        case 'name-desc':
          return b.name.localeCompare(a.name);
        case 'cd-asc':
          return a.cooldownSeconds - b.cooldownSeconds;
        case 'quality-desc':
        default:
          return a.rarity === 'ssr' && b.rarity !== 'ssr' ? -1 : 1;
      }
    });

    return list;
  }, [searchQuery, relicProperty, relicRarity, relicSort]);

  const currentCount = catalogType === 'simulacra' ? filteredSimulacra.length : filteredRelics.length;
  const currentTotal = catalogType === 'simulacra' ? MOCK_SIMULACRA.length : MOCK_RELICS.length;
  const currentEntityLabel = catalogType === 'simulacra' ? 'simulacra' : 'relics';

  return (
    <div className="catalog-demo-harness w-full max-w-[1440px] mx-auto px-4 sm:px-6 py-6 font-sans text-[#f3f4f6]">
      {/* ------------------------------------------------------------------- */}
      {/* Dev Harness Action Bar (Switch Catalogs, Toggle Loading/Empty)      */}
      {/* ------------------------------------------------------------------- */}
      <div className="dev-harness-bar mb-6 p-4 rounded-xl bg-[#121622]/90 border border-white/10 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wider font-bold text-[#9ca3af]">
            Dev Harness Catalog Shape:
          </span>
          <div className="inline-flex rounded-lg bg-black/40 p-1 border border-white/10">
            <button
              type="button"
              onClick={() => {
                setCatalogType('simulacra');
                setSearchQuery('');
              }}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                catalogType === 'simulacra'
                  ? 'bg-[#3b82f6] text-white shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Simulacra Catalog (Gacha/MMO)
            </button>
            <button
              type="button"
              onClick={() => {
                setCatalogType('relics');
                setSearchQuery('');
              }}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                catalogType === 'relics'
                  ? 'bg-[#3b82f6] text-white shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Relics Catalog (Properties/CD)
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={isLoading ? 'primary' : 'secondary'}
            onClick={() => setIsLoading(!isLoading)}
          >
            {isLoading ? 'Disable Skeleton Loading' : 'Simulate Skeleton Loading'}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setSearchQuery('__zero_results_query__')}
          >
            Force Empty State
          </Button>
          {hasActiveFilters && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsResetConfirmOpen(true)}
            >
              Dialog: Confirm Reset
            </Button>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* Master Catalog Controls Bar (.sim-controls-bar)                     */}
      {/* ------------------------------------------------------------------- */}
      <CatalogControls
        id={`${catalogType}-controls`}
        className="mb-8"
        ariaLabel={`${catalogType} Catalog Filters`}
      >
        {/* Tier 1: Search & Server Mode Switcher */}
        <CatalogControls.Top>
          <CatalogSearch
            id={`${catalogType}-search`}
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder={
              catalogType === 'simulacra'
                ? 'Search simulacrum name, weapon, or effect...'
                : 'Search relic name, property, or effect...'
            }
          />
          <ServerModeSwitcher
            value={serverMode}
            onChange={setServerMode}
            gachaLabel="Gacha"
            mmoLabel="MMO"
          />
        </CatalogControls.Top>

        {/* Tier 2: Two-column Filters & Sort Listbox */}
        <CatalogControls.Middle>
          <CatalogControls.Left>
            {catalogType === 'simulacra' ? (
              <>
                {/* Element Filter Group */}
                <FilterGroup label="Element:" id="sim-element-group">
                  <FilterChip
                    active={simElement === 'all'}
                    onClick={() => setSimElement('all')}
                  >
                    All
                  </FilterChip>
                  <FilterChip
                    variant="physical"
                    active={simElement === 'physical'}
                    onClick={() => setSimElement('physical')}
                  >
                    Phys
                  </FilterChip>
                  <FilterChip
                    variant="flame"
                    active={simElement === 'flame'}
                    onClick={() => setSimElement('flame')}
                  >
                    Flame
                  </FilterChip>
                  <FilterChip
                    variant="frost"
                    active={simElement === 'frost'}
                    onClick={() => setSimElement('frost')}
                  >
                    Frost
                  </FilterChip>
                  <FilterChip
                    variant="volt"
                    active={simElement === 'volt'}
                    onClick={() => setSimElement('volt')}
                  >
                    Volt
                  </FilterChip>
                  <FilterChip
                    variant="altered"
                    active={simElement === 'altered'}
                    onClick={() => setSimElement('altered')}
                  >
                    Altered
                  </FilterChip>
                </FilterGroup>

                {/* Rarity Filter Group */}
                <FilterGroup label="Rarity:" id="sim-rarity-group">
                  <FilterChip
                    active={simRarity === 'all'}
                    onClick={() => setSimRarity('all')}
                  >
                    All
                  </FilterChip>
                  <FilterChip
                    variant="ssr"
                    active={simRarity === 'ssr'}
                    onClick={() => setSimRarity('ssr')}
                  >
                    SSR
                  </FilterChip>
                  <FilterChip
                    variant="sr"
                    active={simRarity === 'sr'}
                    onClick={() => setSimRarity('sr')}
                  >
                    SR
                  </FilterChip>
                </FilterGroup>

                {/* Role Filter Group */}
                <FilterGroup label="Role:" id="sim-role-group">
                  <FilterChip
                    active={simRole === 'all'}
                    onClick={() => setSimRole('all')}
                  >
                    All
                  </FilterChip>
                  <FilterChip
                    variant="attack"
                    active={simRole === 'dps'}
                    onClick={() => setSimRole('dps')}
                  >
                    DPS
                  </FilterChip>
                  <FilterChip
                    variant="defense"
                    active={simRole === 'defense'}
                    onClick={() => setSimRole('defense')}
                  >
                    Defense
                  </FilterChip>
                  <FilterChip
                    variant="assist"
                    active={simRole === 'support'}
                    onClick={() => setSimRole('support')}
                  >
                    Support
                  </FilterChip>
                </FilterGroup>
              </>
            ) : (
              <>
                {/* Relics Property Filter Group */}
                <FilterGroup label="Property:" id="relic-property-group">
                  <FilterChip
                    active={relicProperty === 'all'}
                    onClick={() => setRelicProperty('all')}
                  >
                    All
                  </FilterChip>
                  <FilterChip
                    variant="attack"
                    active={relicProperty === 'attack'}
                    onClick={() => setRelicProperty('attack')}
                  >
                    Attack
                  </FilterChip>
                  <FilterChip
                    variant="defense"
                    active={relicProperty === 'defense'}
                    onClick={() => setRelicProperty('defense')}
                  >
                    Defense
                  </FilterChip>
                  <FilterChip
                    variant="function"
                    active={relicProperty === 'function'}
                    onClick={() => setRelicProperty('function')}
                  >
                    Function
                  </FilterChip>
                </FilterGroup>

                {/* Relics Quality Filter Group */}
                <FilterGroup label="Grade:" id="relic-rarity-group">
                  <FilterChip
                    active={relicRarity === 'all'}
                    onClick={() => setRelicRarity('all')}
                  >
                    All
                  </FilterChip>
                  <FilterChip
                    variant="ssr"
                    active={relicRarity === 'ssr'}
                    onClick={() => setRelicRarity('ssr')}
                  >
                    SSR
                  </FilterChip>
                  <FilterChip
                    variant="sr"
                    active={relicRarity === 'sr'}
                    onClick={() => setRelicRarity('sr')}
                  >
                    SR
                  </FilterChip>
                </FilterGroup>
              </>
            )}
          </CatalogControls.Left>

          {/* Right: Sort Listbox */}
          <CatalogControls.Right>
            <CatalogSort
              id={`${catalogType}-sort`}
              value={catalogType === 'simulacra' ? simSort : relicSort}
              onChange={catalogType === 'simulacra' ? setSimSort : setRelicSort}
              options={catalogType === 'simulacra' ? SIMULACRA_SORT_OPTIONS : RELICS_SORT_OPTIONS}
              label="Sort by:"
            />
          </CatalogControls.Right>
        </CatalogControls.Middle>

        {/* Tier 3: Counter Status & Reset Button */}
        <CatalogControls.Bottom>
          <CatalogCounter
            id={`${catalogType}-counter`}
            count={currentCount}
            total={currentTotal}
            entityLabel={currentEntityLabel}
          />
          {hasActiveFilters && (
            <ResetFiltersButton
              id={`${catalogType}-reset`}
              onClick={handleResetFilters}
              label="Reset Filters"
            />
          )}
        </CatalogControls.Bottom>
      </CatalogControls>

      {/* ------------------------------------------------------------------- */}
      {/* Entity Cards Grid (.sim-grid)                                       */}
      {/* ------------------------------------------------------------------- */}
      <EntityGrid
        loading={isLoading}
        skeletonCount={6}
        empty={currentCount === 0}
        emptyTitle={`No ${currentEntityLabel} found`}
        emptyDescription="Try adjusting your search criteria or resetting your active filter chips."
        emptyAction={
          <Button variant="primary" size="sm" onClick={handleResetFilters}>
            Reset all filters
          </Button>
        }
      >
        {catalogType === 'simulacra'
          ? filteredSimulacra.map((item) => (
              <EntityCard
                key={item.id}
                title={item.name}
                subtitle={item.weaponName}
                description={item.description}
                rarity={item.rarity}
                element={item.element}
                image={item.avatarUrl}
                role={item.role}
                aspectRatio="square"
                onClick={() => setSelectedEntity(item)}
                cornerSlot={
                  <div
                    className="w-9 h-9 rounded-md bg-[#0b0e16]/85 border border-white/10 p-1 flex items-center justify-center shadow-md cursor-pointer hover:border-white/30"
                    title={`View ${item.weaponName} weapon art`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setLightboxMedia({
                        url: item.splashUrl,
                        title: `${item.name} — Full Splash Art`,
                        caption: `${item.name} (${item.weaponName}) - High resolution official illustration`,
                      });
                    }}
                  >
                    <span className="text-[10px] font-bold text-amber-300">ART</span>
                  </div>
                }
              />
            ))
          : filteredRelics.map((relic) => (
              <EntityCard
                key={relic.id}
                title={relic.name}
                subtitle={`${relic.cooldownSeconds > 0 ? `${relic.cooldownSeconds}s CD` : 'Continuous'}`}
                description={relic.description}
                rarity={relic.rarity}
                property={relic.property}
                aspectRatio="square"
                onClick={() => setSelectedEntity(relic)}
                cornerSlot={
                  <div
                    className="w-9 h-9 rounded-md bg-[#0b0e16]/85 border border-white/10 p-1 flex items-center justify-center shadow-md cursor-pointer hover:border-white/30"
                    title={`View ${relic.name} illustration`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setLightboxMedia({
                        url: relic.splashUrl,
                        title: `${relic.name} — Relic Schematic`,
                        caption: `Official relic illustration and specification`,
                      });
                    }}
                  >
                    <span className="text-[10px] font-bold text-cyan-300">PREV</span>
                  </div>
                }
              />
            ))}
      </EntityGrid>

      {/* ------------------------------------------------------------------- */}
      {/* Detail Modal Dialog                                                 */}
      {/* ------------------------------------------------------------------- */}
      {selectedEntity && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedEntity(null)}
          size="lg"
          ariaLabel={`${selectedEntity.name} Details`}
        >
          <ModalHeader>
            <div className="flex items-center gap-3">
              <ModalTitle>{selectedEntity.name}</ModalTitle>
              <Badge variant={selectedEntity.rarity} size="sm">
                {selectedEntity.rarity.toUpperCase()}
              </Badge>
              {'element' in selectedEntity && selectedEntity.element && (
                <Badge variant={selectedEntity.element} size="sm">
                  {selectedEntity.element}
                </Badge>
              )}
              {'property' in selectedEntity && selectedEntity.property && (
                <Badge variant={selectedEntity.property} size="sm">
                  {selectedEntity.property}
                </Badge>
              )}
            </div>
            <ModalClose onClick={() => setSelectedEntity(null)} />
          </ModalHeader>

          <ModalBody>
            <div className="flex flex-col gap-5">
              {/* Header meta box */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03] border border-white/10">
                <div className="text-xs text-[#9ca3af]">
                  Active Server Balance:{' '}
                  <span className="font-bold text-white uppercase tracking-wider">
                    {serverMode}
                  </span>
                </div>
                <div className="text-xs text-[#9ca3af]">
                  {'weaponName' in selectedEntity && (
                    <>
                      Weapon: <strong className="text-white">{selectedEntity.weaponName}</strong>
                    </>
                  )}
                  {'cooldownSeconds' in selectedEntity && (
                    <>
                      Cooldown: <strong className="text-white">{selectedEntity.cooldownSeconds}s</strong>
                    </>
                  )}
                </div>
              </div>

              {/* Tabs for detail sections */}
              <Tabs defaultValue="overview">
                <TabsList>
                  <TabsTrigger value="overview">Overview & Lore</TabsTrigger>
                  <TabsTrigger value="combat">
                    {serverMode === 'mmo' ? 'MMO Balance Multipliers' : 'Gacha Trait Abilities'}
                  </TabsTrigger>
                  <TabsTrigger value="media">Media & High-Res Art</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="pt-4 text-sm text-[#d7d0dd] leading-relaxed">
                  <p>{selectedEntity.description}</p>
                  {'resonance' in selectedEntity && (
                    <div className="mt-3 p-2 rounded bg-black/30 border border-white/5 text-xs">
                      Resonance Affinity: <strong className="text-amber-300">{selectedEntity.resonance}</strong>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="combat" className="pt-4 text-sm">
                  {'gachaTraits' in selectedEntity && (
                    <div className="space-y-2">
                      <div className="text-xs font-bold uppercase tracking-wider text-blue-400">
                        {serverMode === 'mmo' ? 'MMO Raid / Dungeon Passives' : 'Standard Gacha Awakening Traits'}
                      </div>
                      <ul className="list-disc list-inside space-y-1 text-xs text-[#d7d0dd]">
                        {(serverMode === 'mmo'
                          ? selectedEntity.mmoTraits
                          : selectedEntity.gachaTraits
                        ).map((trait, idx) => (
                          <li key={idx}>{trait}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {'gachaEffect' in selectedEntity && (
                    <div className="space-y-2">
                      <div className="text-xs font-bold uppercase tracking-wider text-amber-400">
                        {serverMode === 'mmo' ? 'MMO Relic Tuning' : 'Standard Relic Effect'}
                      </div>
                      <p className="text-xs text-[#d7d0dd]">
                        {serverMode === 'mmo'
                          ? selectedEntity.mmoEffect
                          : selectedEntity.gachaEffect}
                      </p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="media" className="pt-4">
                  <p className="text-xs text-[#9ca3af] mb-3">
                    View official high-resolution illustrations in the full-screen lightbox modal.
                  </p>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      setLightboxMedia({
                        url: selectedEntity.splashUrl,
                        title: `${selectedEntity.name} — Splash Art`,
                        caption: `Official character illustration with high-resolution details`,
                      });
                    }}
                  >
                    Open Fullscreen Lightbox
                  </Button>
                </TabsContent>
              </Tabs>
            </div>
          </ModalBody>

          <ModalFooter>
            <Button variant="secondary" size="sm" onClick={() => setSelectedEntity(null)}>
              Close
            </Button>
          </ModalFooter>
        </Modal>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* Media Lightbox                                                      */}
      {/* ------------------------------------------------------------------- */}
      {lightboxMedia && (
        <MediaLightbox
          isOpen={true}
          onClose={() => setLightboxMedia(null)}
          src={lightboxMedia.url}
          title={lightboxMedia.title}
          caption={lightboxMedia.caption}
        />
      )}

      {/* ------------------------------------------------------------------- */}
      {/* Confirmation Dialog                                                 */}
      {/* ------------------------------------------------------------------- */}
      <Dialog
        isOpen={isResetConfirmOpen}
        onClose={() => setIsResetConfirmOpen(false)}
        title="Reset All Catalog Filters?"
        description="This will clear your current search query, reset element, rarity, and role filters, and restore default sorting."
        variant="warning"
        confirmLabel="Yes, Reset Filters"
        cancelLabel="Cancel"
        onConfirm={handleResetFilters}
      />
    </div>
  );
}

export default CatalogDemo;
