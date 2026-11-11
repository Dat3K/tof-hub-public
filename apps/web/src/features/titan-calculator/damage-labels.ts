import type { localeText } from '@/lib/i18n/text';
import type { DamageCategory } from './model';

export const categoryLabel = (category: DamageCategory, t: ReturnType<typeof localeText>) => ({
  normal: t('Normal Attack', 'Обычная атака'),
  dodge: t('Dodge', 'Уклонение'),
  discharge: t('Discharge', 'Разряд'),
  passive: t('Passive', 'Пассивный'),
  skill: t('Skill', 'Навык'),
})[category];
