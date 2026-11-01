import { localized } from '@tof-hub/i18n';
import {normalizeCharacterTitle} from '@tof-hub/game-domain';
import type {BuildCatalog,BuildLocale} from './types';

/** Repair localized legacy captures only when the original code confirms the saved text. */
export function characterTitleCode(value:string|undefined,titles:BuildCatalog['titles'],capturedId?:string|null) {
  const saved=value??'';
  const original=capturedId?titles?.[capturedId]:undefined;
  return original&&(saved===original.en||saved===original.ru)?capturedId!:saved;
}

/** Game text colour and plate art of a known title code; custom text keeps the card's plain style. */
export function characterTitleStyle(value:string|undefined,catalog:Pick<BuildCatalog,'titles'|'titleStyles'>,capturedId?:string|null) {
  return catalog.titleStyles?.[normalizeCharacterTitle(characterTitleCode(value,catalog.titles,capturedId))];
}

export function characterTitleLabel(value:string|undefined,catalog:Pick<BuildCatalog,'titles'>,locale:BuildLocale,capturedId?:string|null) {
  const code=normalizeCharacterTitle(characterTitleCode(value,catalog.titles,capturedId));
  return localized(catalog.titles?.[code], locale)||code;
}
