import {generatePageMetadata, type SeoPageProps} from '@/lib/seo/server';
import { resolveServerLocale } from '@/lib/i18n/server';
import { loadServerFood, loadServerFoodMmo } from '@/lib/game-data-server';
import { FoodCatalogView, getDefaultFoodSort } from '@/features/info-sections/food';
import { getFoodStrings } from '@/features/info-sections/food/copy';

export async function generateMetadata(props: SeoPageProps) {
  return generatePageMetadata('/info/food/', props);
}


type FoodPageSearchParams = Record<string, string | string[] | undefined>;

function firstParam(value: string | string[] | undefined): string | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

// Mirror useFoodCatalog's mount parsing (minus the location hash, which
// never reaches the server) so shared links render the selected tab and
// filters on the first paint instead of correcting after mount.
function resolveFoodInitials(
  params: FoodPageSearchParams,
  data: any,
  getDefaultSort: (tab: 'dishes' | 'ingredients' | 'potions') => string
) {
  const dishes = (data?.items || data?.dishes || []) as any[];
  const ingredients = (data?.ingredients || []) as any[];
  const potions = (data?.potions || []) as any[];

  const viewParam = firstParam(params.view);
  let tab: 'dishes' | 'ingredients' | 'potions' =
    viewParam === 'ingredients' || viewParam === 'potions' ? viewParam : 'dishes';

  let search = firstParam(params.q) || firstParam(params.search) || '';
  if (search && !viewParam) {
    const normalizedQuery = search.toLowerCase().trim();
    const matchesNameOrId = (items: any[], exact: boolean) =>
      items.some((item) =>
        [item.name_en, item.name_ru, item.id].some((value: any) => {
          const normalizedValue = typeof value === 'string' ? value.toLowerCase() : undefined;
          return exact
            ? normalizedValue === normalizedQuery
            : Boolean(normalizedValue?.includes(normalizedQuery));
        })
      );
    const exactTab = (['ingredients', 'potions', 'dishes'] as const).find((t) =>
      t === 'dishes'
        ? matchesNameOrId(dishes, true)
        : t === 'ingredients'
          ? matchesNameOrId(ingredients, true)
          : matchesNameOrId(potions, true)
    );
    if (exactTab) tab = exactTab;
    else {
      const pools = { dishes, ingredients, potions } as const;
      const matching = (['dishes', 'ingredients', 'potions'] as const).filter((t) =>
        matchesNameOrId(pools[t], false)
      );
      if (matching.length === 1) tab = matching[0];
    }
  }

  let selectedItemId: string | null = null;
  const linkId = (firstParam(params.item) || firstParam(params.dish) || firstParam(params.potion) || '').trim();
  if (linkId) {
    const target = linkId.toLowerCase();
    const matchDish = dishes.find((d) => String(d.id || '').toLowerCase() === target);
    if (matchDish) {
      tab = 'dishes';
      selectedItemId = matchDish.id;
    } else {
      const matchPotion = potions.find((p) => String(p.id || '').toLowerCase() === target);
      if (matchPotion) {
        tab = 'potions';
        selectedItemId = matchPotion.id;
      } else {
        const matchIngredient = ingredients.find((i) => String(i.id || '').toLowerCase() === target);
        if (matchIngredient) {
          tab = 'ingredients';
          search = matchIngredient.name_en || matchIngredient.name || matchIngredient.id;
        }
      }
    }
  }

  const rarityRaw = (firstParam(params.rarity) || '').toUpperCase();
  const rarity = ['GOLD', 'SSR', 'SR', 'R', 'N'].includes(rarityRaw) ? rarityRaw : null;
  const recipeRaw = firstParam(params.recipe);
  const recipe = recipeRaw === 'has-recipe' || recipeRaw === 'no-recipe' ? recipeRaw : null;
  const potionSub = firstParam(params.potionSub) || null;
  const effects = (firstParam(params.effects) || firstParam(params.effect) || '')
    .split(',')
    .map((x) => x.trim())
    .filter((x) => x && x !== 'all');

  const defaultTab =
    viewParam === 'ingredients' || viewParam === 'potions' ? viewParam : 'dishes';
  const sortParam = firstParam(params.sort);
  const hasNumericEffect = effects.some((e) => e === 'PhyAtk' || e === 'PhyDef');
  const sort = sortParam
    ? sortParam === 'default'
      ? getDefaultSort(defaultTab)
      : sortParam
    : hasNumericEffect
      ? 'effectDesc'
      : getDefaultSort(defaultTab);

  return { tab, search, selectedItemId, rarity, recipe, potionSub, effects, sort };
}

export default async function FoodPage({
  searchParams,
}: {
  searchParams?: Promise<FoodPageSearchParams>;
}) {
  const { locale } = await resolveServerLocale();
  const params = (searchParams ? await searchParams : undefined) || {};
  const initialData = await loadServerFood(locale, { throwOnNotFound: false });

  // Gacha / MMO pool: an explicit ?server= wins; MMO item links (mmo_ ids) open the MMO pool.
  const serverRaw = firstParam(params.server)?.toLowerCase();
  const linkId = (firstParam(params.item) || firstParam(params.dish) || firstParam(params.potion) || '').toLowerCase();
  const serverMode: 'gacha' | 'mmo' | null =
    serverRaw === 'gacha' || serverRaw === 'mmo' ? serverRaw : linkId.startsWith('mmo_') ? 'mmo' : null;
  const initialMmoData =
    serverMode === 'mmo' ? await loadServerFoodMmo(locale, { throwOnNotFound: false }) : null;
  const initials = resolveFoodInitials(
    params,
    serverMode === 'mmo' ? initialMmoData : initialData,
    (tab) => getDefaultFoodSort(tab, serverMode ?? 'gacha')
  );

  return (
    <FoodCatalogView
      initialData={initialData}
      initialMmoData={initialMmoData}
      initialServerMode={serverMode}
      initialLocale={locale}
      initialTab={initials.tab}
      initialSearchQuery={initials.search}
      initialRarity={initials.rarity as any}
      initialRecipe={initials.recipe as any}
      initialPotionSubcategory={initials.potionSub as any}
      initialEffects={initials.effects}
      initialSort={initials.sort}
      initialSelectedItemId={initials.selectedItemId}
    />
  );
}
