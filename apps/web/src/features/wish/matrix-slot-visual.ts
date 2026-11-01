import type { WishMatrixSlot } from '@tof-hub/contracts';
import { gameAsset } from '@tof-hub/game-assets';
import { MATRIX_SLOTS_DEF } from '../simulacra/constants';
import type { WishLocale } from './wish-i18n';

export function getMatrixSlotVisual(slot: WishMatrixSlot | undefined, locale: WishLocale) {
  const definition = MATRIX_SLOTS_DEF.find((item) => item.id === slot);
  if (!definition?.icon) return null;
  return {
    number: definition.num,
    label: locale === 'ru' ? definition.name_ru : definition.name_en,
    image: gameAsset(definition.icon),
  };
}
