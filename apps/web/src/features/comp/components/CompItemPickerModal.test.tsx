import { describe, expect, it } from 'vitest';
import { fireEvent, render as renderUi, screen, within } from '@testing-library/react';
import {ToastProvider} from '@tof-hub/ui';
import type {ReactNode} from 'react';
const render=(node:ReactNode)=>renderUi(<ToastProvider>{node}</ToastProvider>);
import type { CompCatalogView, CompMatrixView, CompSimulacrumView, CompWeaponView } from '../data';
import { CompItemPickerModal } from './CompItemPickerModal';

const localized = (value: string) => ({ en: value, ru: value });

function weapon(id: string, element: CompWeaponView['element'], secondary: CompWeaponView['elementSecondary']): CompWeaponView {
  return {
    id,
    weaponId: id,
    simulacrumId: id,
    name: localized(id),
    simName: localized(id),
    element,
    elementSecondary: secondary,
    role: 'DPS',
    canonicalRole: 'dps',
    rarity: 'SSR',
    matrixSuitId: null,
    icon: 'test-weapon',
    avatar: 'test-avatar',
  };
}

function matrix(id: string, carrierElement?: string): CompMatrixView {
  return {
    id,
    name: localized(id),
    quality: 'SSR',
    icon: 'test-matrix',
    suitPortrait: 'test-portrait',
    remouldIcon: null,
    desc2p: null,
    desc3p: null,
    desc4p: null,
    simulacrumId: id === 'Flame Matrix' ? 'flame-matrix-owner' : null,
    carriers: carrierElement ? [{ id, name: localized(id), element: carrierElement }] : [],
  };
}

function simulacrum(id: string, serverMode: 'standard' | 'mmo'): CompSimulacrumView {
  return {
    id,
    serverMode,
    name: localized('Echo'),
    avatar: 'test-avatar',
    weaponId: 'spear_thunder',
    weaponName: localized('Thunderous Halberd'),
    weaponIcon: 'test-weapon',
    element: 'Volt',
    elementSecondary: null,
    elementComboIcon: null,
    role: 'DPS',
    roleIcon: 'test-role',
    rarity: 'SSR',
    matrixSuitId: null,
    card: 'test-card',
    traitName: localized('Echo trait'),
    traitDesc: localized('Echo trait'),
  };
}

const catalog: CompCatalogView = {
  roles: [],
  simulacra: [{
    id: 'flame-matrix-owner',
    name: localized('Flame owner'),
    avatar: 'test-avatar',
    weaponId: 'flame-weapon',
    weaponName: localized('Flame weapon'),
    weaponIcon: 'test-weapon',
    element: 'Flame',
    elementSecondary: 'Physical',
    elementComboIcon: null,
    role: 'DPS',
    roleIcon: 'test-role',
    rarity: 'SSR',
    matrixSuitId: 'Flame Matrix',
    card: 'test-card',
    traitName: localized('Flame trait'),
    traitDesc: localized('Flame trait'),
  }, simulacrum('echo-standard', 'standard'), simulacrum('echo-mmo', 'mmo')],
  weapons: [
    weapon('Physical Flame', 'Physical', 'Flame'),
    weapon('Pure Physical', 'Physical', null),
    weapon('Flame Physical', 'Flame', 'Physical'),
  ],
  matrices: [matrix('Physical Matrix', 'Physical'), matrix('Flame Matrix', 'Flame')],
  relics: [],
  pets: [],
};

function renderPicker(type: 'weapon' | 'matrix') {
  render(<CompItemPickerModal
    isOpen
    type={type}
    playerIndex={0}
    slotIndex={0}
    catalog={catalog}
    locale="en"
    server="standard"
    onClose={() => {}}
    onSelectItem={() => {}}
    onClearSlot={() => {}}
    onUploadCustomPhoto={() => {}}
  />);
  const dialog = screen.getByRole('dialog');
  fireEvent.click(dialog.querySelector<HTMLButtonElement>('button[data-val="Physical"]')!);
  return dialog;
}

function renderTraitPicker(server: 'standard' | 'mmo') {
  render(<CompItemPickerModal
    isOpen
    type="trait"
    playerIndex={0}
    slotIndex={0}
    catalog={catalog}
    locale="en"
    server={server}
    onClose={() => {}}
    onSelectItem={() => {}}
    onClearSlot={() => {}}
    onUploadCustomPhoto={() => {}}
  />);
  return screen.getByRole('dialog');
}

describe('Comp picker element filters', () => {
  it('shows only primary Physical weapons', () => {
    const dialog = renderPicker('weapon');
    expect(dialog.querySelector('button[data-id="Physical Flame"]')).not.toBeNull();
    expect(dialog.querySelector('button[data-id="Pure Physical"]')).not.toBeNull();
    expect(dialog.querySelector('button[data-id="Flame Physical"]')).toBeNull();
  });

  it('uses matrix carrier primary elements', () => {
    const dialog = renderPicker('matrix');
    const choice=within(dialog).getByRole('button', { name: /Physical Matrix/i });
    expect(choice.querySelector('[data-presentation="icon"]')).not.toBeNull();
    expect(within(dialog).queryByRole('button', { name: /Flame Matrix/i })).toBeNull();
    fireEvent.click(dialog.querySelector<HTMLButtonElement>('button[data-val="Physical"]')!);
    const duo=dialog.querySelector('[data-id="Flame Matrix"]');
    expect(duo?.querySelector('.tool-picker-card-badges img')?.getAttribute('src')).toContain('icon_element_huowu');
    expect(duo?.textContent).toContain('Flame / Physical');
  });
});

describe('Comp trait picker server filter', () => {
  it('hides MMO-only simulacra on the standard server', () => {
    const dialog = renderTraitPicker('standard');
    expect(dialog.querySelector('[data-id="echo-standard"]')).not.toBeNull();
    expect(dialog.querySelector('[data-id="echo-mmo"]')).toBeNull();
  });

  it('shows MMO-only simulacra on the MMO server', () => {
    const dialog = renderTraitPicker('mmo');
    expect(dialog.querySelector('[data-id="echo-mmo"]')).not.toBeNull();
    expect(dialog.querySelector('[data-id="echo-standard"]')).toBeNull();
  });
});
