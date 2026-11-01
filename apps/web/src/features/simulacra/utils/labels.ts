import {
  getElementLabel,
  getRoleLabel,
  type RoleLabelForm,
} from '@tof-hub/game-domain';
import type { Locale } from '@tof-hub/i18n';

export interface ComboWordLabels {
  comboWordAttack: string;
  comboWordHold: string;
  comboWordJump: string;
  comboWordDodge: string;
  comboWordDodgeForward: string;
  comboWordDodgeBack: string;
}

export function getElementLabelText(value: unknown, locale: Locale): string {
  if (typeof value !== 'string' || !value) return '';
  return getElementLabel(value, locale, 'full');
}

export function getRoleLabelText(
  value: unknown,
  locale: Locale,
  form: RoleLabelForm = 'full',
): string {
  if (typeof value !== 'string' || !value) return '';
  return getRoleLabel(value, locale, form);
}

export function localizeComboStep(step: string, locale: Locale, words: ComboWordLabels): string {
  if (locale !== 'ru') return step;
  const table: Record<string, string> = {
    attack: words.comboWordAttack,
    'normal attack': words.comboWordAttack,
    hold: words.comboWordHold,
    'hold attack': words.comboWordHold,
    jump: words.comboWordJump,
    air: words.comboWordJump,
    dodge: words.comboWordDodge,
    'dodge forward': words.comboWordDodgeForward,
    'dodge back': words.comboWordDodgeBack,
  };
  return table[step.toLowerCase().trim()] || step;
}
