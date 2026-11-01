export type WeaponRole = 'DPS' | 'Tank' | 'Benediction' | 'Balance';

export const WEAPON_ROLES: readonly WeaponRole[] = [
  'DPS',
  'Tank',
  'Benediction',
  'Balance',
] as const;

import {
  getLocalizedValue,
  type LocalizedText,
  type SupportedLocale,
} from './localization';

export function isWeaponRole(value: unknown): value is WeaponRole {
  return typeof value === 'string' && WEAPON_ROLES.includes(value as WeaponRole);
}

export type RoleLabelForm = 'full' | 'chip';

export const ROLE_LABELS: Record<WeaponRole, LocalizedText> = {
  DPS: { en: 'DPS', ru: 'ДПС', de: 'DPS', es: 'DPS', fr: 'DPS', id: 'DPS', ja: 'アタッカー', ko: '딜러', pt: 'DPS', th: 'ดาเมจ', 'zh-CN': '输出', 'zh-Hans': '输出', 'zh-Hans-SG': '输出' },
  Tank: { en: 'Tank', ru: 'Танк', de: 'Tank', es: 'Tanque', fr: 'Tank', id: 'Tank', ja: 'タンク', ko: '탱커', pt: 'Tanque', th: 'แทงก์', 'zh-CN': '坦克', 'zh-Hans': '坦克', 'zh-Hans-SG': '坦克' },
  Benediction: { en: 'Benediction', ru: 'Благословение', de: 'Segen', es: 'Bendición', fr: 'Bénédiction', id: 'Benediction', ja: '恩恵', ko: '은혜', pt: 'Bênção', th: 'พร', 'zh-CN': '恩赐', 'zh-Hans': '恩赐', 'zh-Hans-SG': '恩赐' },
  Balance: { en: 'Balance', ru: 'Баланс', de: 'Ausgewogen', es: 'Equilibrio', fr: 'Équilibre', id: 'Seimbang', ja: '均衡', ko: '균형', pt: 'Equilíbrio', th: 'สมดุล', 'zh-CN': '均衡', 'zh-Hans': '均衡', 'zh-Hans-SG': '均衡' },
};

export const ROLE_FULL_LABELS: Record<WeaponRole, LocalizedText> = {
  DPS: { en: 'DPS', ru: 'Атака', de: 'DPS', es: 'DPS', fr: 'DPS', id: 'DPS', ja: 'アタッカー', ko: '딜러', pt: 'DPS', th: 'ดาเมจ', 'zh-CN': '输出', 'zh-Hans': '输出', 'zh-Hans-SG': '输出' },
  Tank: { en: 'Tank', ru: 'Защита', de: 'Tank', es: 'Tanque', fr: 'Tank', id: 'Tank', ja: 'タンク', ko: '탱커', pt: 'Tanque', th: 'แทงก์', 'zh-CN': '坦克', 'zh-Hans': '坦克', 'zh-Hans-SG': '坦克' },
  Benediction: { en: 'Benediction', ru: 'Поддержка', de: 'Segen', es: 'Bendición', fr: 'Bénédiction', id: 'Benediction', ja: '恩恵', ko: '은혜', pt: 'Bênção', th: 'พร', 'zh-CN': '恩赐', 'zh-Hans': '恩赐', 'zh-Hans-SG': '恩赐' },
  Balance: { en: 'Balance', ru: 'Баланс', de: 'Ausgewogen', es: 'Equilibrio', fr: 'Équilibre', id: 'Seimbang', ja: '均衡', ko: '균형', pt: 'Equilíbrio', th: 'สมดุล', 'zh-CN': '均衡', 'zh-Hans': '均衡', 'zh-Hans-SG': '均衡' },
};

export function getRoleLabel(
  role: unknown,
  locale: SupportedLocale = 'en',
  form: RoleLabelForm = 'chip',
): string {
  const normalized = normalizeRole(typeof role === 'string' ? role : '');
  const table = form === 'full' ? ROLE_FULL_LABELS : ROLE_LABELS;
  const label = table[normalized];
  if (!label) return typeof role === 'string' ? role : '';
  return getLocalizedValue(label, locale);
}

export function normalizeRole(raw: string | null | undefined): WeaponRole {
  if (!raw) return 'DPS';
  const norm = raw.trim().toLowerCase();
  switch (norm) {
    case 'dps':
    case 'attack':
    case 'att':
      return 'DPS';
    case 'tank':
    case 'fortitude':
    case 'def':
    case 'defense':
      return 'Tank';
    case 'benediction':
    case 'support':
    case 'heal':
      return 'Benediction';
    case 'balance':
    case 'balanced':
      return 'Balance';
    default:
      return 'DPS';
  }
}

/** Role a player or a card plays (Build profiles, Ranking, Comp rows); weapons carry the `WeaponRole` resonance. */
export type PlayerRole = 'dps' | 'healer' | 'tank' | 'balance';

export const PLAYER_ROLE_LABELS: Record<PlayerRole, LocalizedText> = {
  dps: { en: 'DPS', ru: 'ДД', de: 'DPS', es: 'DPS', fr: 'DPS', id: 'DPS', ja: 'アタッカー', ko: '딜러', pt: 'DPS', th: 'ดาเมจ', 'zh-CN': '输出', 'zh-Hans': '输出', 'zh-Hans-SG': '输出' },
  healer: { en: 'Healer', ru: 'Хил', de: 'Heiler', es: 'Sanador', fr: 'Soigneur', id: 'Healer', ja: 'ヒーラー', ko: '힐러', pt: 'Curandeiro', th: 'ฮีลเลอร์', 'zh-CN': '治疗', 'zh-Hans': '治疗', 'zh-Hans-SG': '治疗' },
  tank: { en: 'Tank', ru: 'Танк', de: 'Tank', es: 'Tanque', fr: 'Tank', id: 'Tank', ja: 'タンク', ko: '탱커', pt: 'Tanque', th: 'แทงก์', 'zh-CN': '坦克', 'zh-Hans': '坦克', 'zh-Hans-SG': '坦克' },
  balance: { en: 'Balance', ru: 'Баланс', de: 'Ausgewogen', es: 'Equilibrio', fr: 'Équilibre', id: 'Seimbang', ja: '均衡', ko: '균형', pt: 'Equilíbrio', th: 'สมดุล', 'zh-CN': '均衡', 'zh-Hans': '均衡', 'zh-Hans-SG': '均衡' },
};

export function getPlayerRoleLabel(role: PlayerRole, locale: SupportedLocale = 'en'): string {
  return getLocalizedValue(PLAYER_ROLE_LABELS[role], locale);
}
