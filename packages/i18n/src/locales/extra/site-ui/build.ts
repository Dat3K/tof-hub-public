import type { Locale } from '../../../constants';

// Build cards, optimizer and shared equipment labels.
// Columns: English source, German, Spanish, French, Indonesian, Japanese, Korean, Portuguese (Brazil), Thai, Simplified Chinese.
const rows = [
  ['Armor', 'Armor', 'Armor', 'Armor', 'Zirah', 'Armor', 'Armor', 'Armor', 'Armor', 'Armor'],
  ['CS at Lv. {0}', 'Kampfkraft auf Stufe {0}', 'Fuerza de combate en el nivel {0}', 'Score de combat au niveau {0}', 'Skor Tempur di Lv. {0}', 'レベル{0}の戦闘スコア', '레벨 {0} 전투력', 'Poder de combate no nível {0}', 'คะแนนพลังรบที่เลเวล {0}', '{0}级战力'],
] as const;

const columns = ['de', 'es', 'fr', 'id', 'ja', 'ko', 'pt', 'th', 'zh-CN'] as const;
export const siteUiBuildTranslations: Partial<Record<Locale, Readonly<Record<string, string>>>> = Object.fromEntries(
  columns.map((locale, index) => [locale, Object.fromEntries(rows.flatMap(row => row[index + 1] === row[0] ? [] : [[row[0], row[index + 1]]]))]),
);
