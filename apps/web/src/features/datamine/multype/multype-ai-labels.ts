import { translateUiText } from '@tof-hub/i18n';
/**
 * AI Guess enriched entity knowledge and resolvers.
 * Formats game entities into player-friendly naming:
 * - Matrices: "Матрицы Линсис 2p" (RU) / "Lyncis 2p" (EN) with set title in tooltip
 * - Traits: "Черта: [Имя]" (RU) / "[Name] Trait" (EN)
 * - Resonances: "[Стихия] резонанс ([Имя])" (RU) / "[Element] Resonance ([Name])" (EN)
 * - Relics: "[Имя реликвии]" (RU) / "[RelicName]" (EN)
 */

export interface MatrixKnowledge {
  charRu: string;
  charEn: string;
  suitRu: string;
  suitEn: string;
  pc: '2p' | '4p';
}

export interface EnrichedAiGuess {
  label: string;
  suitName?: string;
  matchedType: 'matrix' | 'trait' | 'resonance' | 'relic' | 'generic';
}

export const MATRIX_AI_KNOWLEDGE: Record<string, MatrixKnowledge> = {
  "buff_matrix_n_1": {
    "charRu": "",
    "charEn": "",
    "suitRu": "Дикая кровь",
    "suitEn": "Savage Bloodline",
    "pc": "2p"
  },
  "buff_matrix_n_2": {
    "charRu": "",
    "charEn": "",
    "suitRu": "Взмах",
    "suitEn": "Swipe",
    "pc": "2p"
  },
  "buff_matrix_r_1_level1": {
    "charRu": "",
    "charEn": "",
    "suitRu": "Саморазрушение",
    "suitEn": "Self-explosive",
    "pc": "2p"
  },
  "buff_matrix_r_1": {
    "charRu": "",
    "charEn": "",
    "suitRu": "Саморазрушение",
    "suitEn": "Self-explosive",
    "pc": "2p"
  },
  "buff_matrix_r_2_level1": {
    "charRu": "",
    "charEn": "",
    "suitRu": "Функциональный рывок",
    "suitEn": "Functional Dash",
    "pc": "2p"
  },
  "buff_matrix_r_2": {
    "charRu": "",
    "charEn": "",
    "suitRu": "Функциональный рывок",
    "suitEn": "Functional Dash",
    "pc": "2p"
  },
  "buff_matrix_r_3_level1": {
    "charRu": "",
    "charEn": "",
    "suitRu": "Стандартная операция",
    "suitEn": "Standard Operation",
    "pc": "2p"
  },
  "buff_matrix_r_3": {
    "charRu": "",
    "charEn": "",
    "suitRu": "Стандартная операция",
    "suitEn": "Standard Operation",
    "pc": "2p"
  },
  "buff_matrix_r_4_level1": {
    "charRu": "",
    "charEn": "",
    "suitRu": "Грабеж",
    "suitEn": "Plunder",
    "pc": "2p"
  },
  "buff_matrix_r_4": {
    "charRu": "",
    "charEn": "",
    "suitRu": "Грабеж",
    "suitEn": "Plunder",
    "pc": "2p"
  },
  "buff_matrix_r_6_level1": {
    "charRu": "",
    "charEn": "",
    "suitRu": "Клинок ветра",
    "suitEn": "Wind Blade",
    "pc": "2p"
  },
  "buff_matrix_r_6": {
    "charRu": "",
    "charEn": "",
    "suitRu": "Клинок ветра",
    "suitEn": "Wind Blade",
    "pc": "2p"
  },
  "buff_matrix_r_7_level1": {
    "charRu": "",
    "charEn": "",
    "suitRu": "Устранение препятствий",
    "suitEn": "Obstacle Removal",
    "pc": "2p"
  },
  "buff_matrix_r_7": {
    "charRu": "",
    "charEn": "",
    "suitRu": "Устранение препятствий",
    "suitEn": "Obstacle Removal",
    "pc": "2p"
  },
  "buff_matrix_sr_1_level1": {
    "charRu": "",
    "charEn": "",
    "suitRu": "Поглотитель",
    "suitEn": "Devourer",
    "pc": "2p"
  },
  "buff_matrix_sr_1": {
    "charRu": "",
    "charEn": "",
    "suitRu": "Поглотитель",
    "suitEn": "Devourer",
    "pc": "2p"
  },
  "buff_matrix_sr_1_level2": {
    "charRu": "",
    "charEn": "",
    "suitRu": "Поглотитель",
    "suitEn": "Devourer",
    "pc": "2p"
  },
  "buff_matrix_sr_1_level3": {
    "charRu": "",
    "charEn": "",
    "suitRu": "Поглотитель",
    "suitEn": "Devourer",
    "pc": "2p"
  },
  "buff_matrix_sr_7_level1": {
    "charRu": "Эхо",
    "charEn": "Echo",
    "suitRu": "Искоренение",
    "suitEn": "Uproot",
    "pc": "2p"
  },
  "buff_matrix_sr_7": {
    "charRu": "Эхо",
    "charEn": "Echo",
    "suitRu": "Искоренение",
    "suitEn": "Uproot",
    "pc": "2p"
  },
  "buff_matrix_sr_7_level2": {
    "charRu": "Эхо",
    "charEn": "Echo",
    "suitRu": "Искоренение",
    "suitEn": "Uproot",
    "pc": "2p"
  },
  "buff_matrix_sr_7_level3": {
    "charRu": "Эхо",
    "charEn": "Echo",
    "suitRu": "Искоренение",
    "suitEn": "Uproot",
    "pc": "2p"
  },
  "buff_matrix_sr_2_level1": {
    "charRu": "",
    "charEn": "",
    "suitRu": "Внутренняя борьба",
    "suitEn": "Internal Struggle",
    "pc": "2p"
  },
  "buff_matrix_sr_2": {
    "charRu": "",
    "charEn": "",
    "suitRu": "Внутренняя борьба",
    "suitEn": "Internal Struggle",
    "pc": "2p"
  },
  "buff_matrix_sr_2_level2": {
    "charRu": "",
    "charEn": "",
    "suitRu": "Внутренняя борьба",
    "suitEn": "Internal Struggle",
    "pc": "2p"
  },
  "buff_matrix_sr_2_level3": {
    "charRu": "",
    "charEn": "",
    "suitRu": "Внутренняя борьба",
    "suitEn": "Internal Struggle",
    "pc": "2p"
  },
  "buff_matrix_sr_3_level1": {
    "charRu": "",
    "charEn": "",
    "suitRu": "Экстремальный холод",
    "suitEn": "Extreme Zero",
    "pc": "2p"
  },
  "buff_matrix_sr_3": {
    "charRu": "",
    "charEn": "",
    "suitRu": "Экстремальный холод",
    "suitEn": "Extreme Zero",
    "pc": "2p"
  },
  "buff_matrix_sr_3_level2": {
    "charRu": "",
    "charEn": "",
    "suitRu": "Экстремальный холод",
    "suitEn": "Extreme Zero",
    "pc": "2p"
  },
  "buff_matrix_sr_3_level3": {
    "charRu": "",
    "charEn": "",
    "suitRu": "Экстремальный холод",
    "suitEn": "Extreme Zero",
    "pc": "2p"
  },
  "buff_matrix_sr_4_level1": {
    "charRu": "",
    "charEn": "",
    "suitRu": "Болотная тень",
    "suitEn": "Swamp Shadow",
    "pc": "2p"
  },
  "buff_matrix_sr_4": {
    "charRu": "",
    "charEn": "",
    "suitRu": "Болотная тень",
    "suitEn": "Swamp Shadow",
    "pc": "2p"
  },
  "buff_matrix_sr_4_level2": {
    "charRu": "",
    "charEn": "",
    "suitRu": "Болотная тень",
    "suitEn": "Swamp Shadow",
    "pc": "2p"
  },
  "buff_matrix_sr_4_level3": {
    "charRu": "",
    "charEn": "",
    "suitRu": "Болотная тень",
    "suitEn": "Swamp Shadow",
    "pc": "2p"
  },
  "buff_matrix_sr_5_level1_add": {
    "charRu": "",
    "charEn": "",
    "suitRu": "Двойной кошмар",
    "suitEn": "Double Nightmares",
    "pc": "2p"
  },
  "buff_matrix_sr_5": {
    "charRu": "",
    "charEn": "",
    "suitRu": "Двойной кошмар",
    "suitEn": "Double Nightmares",
    "pc": "2p"
  },
  "buff_matrix_sr_5_level2_add": {
    "charRu": "",
    "charEn": "",
    "suitRu": "Двойной кошмар",
    "suitEn": "Double Nightmares",
    "pc": "2p"
  },
  "buff_matrix_sr_5_level3_add": {
    "charRu": "",
    "charEn": "",
    "suitRu": "Двойной кошмар",
    "suitEn": "Double Nightmares",
    "pc": "2p"
  },
  "buff_matrix_sr_6_level1": {
    "charRu": "Пеппер",
    "charEn": "Pepper",
    "suitRu": "Без остановки",
    "suitEn": "Nonstop",
    "pc": "2p"
  },
  "buff_matrix_sr_6": {
    "charRu": "Пеппер",
    "charEn": "Pepper",
    "suitRu": "Без остановки",
    "suitEn": "Nonstop",
    "pc": "2p"
  },
  "buff_matrix_sr_6_level2": {
    "charRu": "Пеппер",
    "charEn": "Pepper",
    "suitRu": "Без остановки",
    "suitEn": "Nonstop",
    "pc": "2p"
  },
  "buff_matrix_sr_6_level3": {
    "charRu": "Пеппер",
    "charEn": "Pepper",
    "suitRu": "Без остановки",
    "suitEn": "Nonstop",
    "pc": "2p"
  },
  "buff_matrix_sr_13_level1": {
    "charRu": "Хильда",
    "charEn": "Hilda",
    "suitRu": "Парабола",
    "suitEn": "Parabola",
    "pc": "2p"
  },
  "buff_matrix_sr_13": {
    "charRu": "Хильда",
    "charEn": "Hilda",
    "suitRu": "Парабола",
    "suitEn": "Parabola",
    "pc": "2p"
  },
  "buff_matrix_sr_13_level2": {
    "charRu": "Хильда",
    "charEn": "Hilda",
    "suitRu": "Парабола",
    "suitEn": "Parabola",
    "pc": "2p"
  },
  "buff_matrix_sr_13_level3": {
    "charRu": "Хильда",
    "charEn": "Hilda",
    "suitRu": "Парабола",
    "suitEn": "Parabola",
    "pc": "2p"
  },
  "buff_matrix_sr_12_level1": {
    "charRu": "Ина",
    "charEn": "Ene",
    "suitRu": "Перегрузка",
    "suitEn": "Overload",
    "pc": "2p"
  },
  "buff_matrix_sr_12": {
    "charRu": "Ина",
    "charEn": "Ene",
    "suitRu": "Перегрузка",
    "suitEn": "Overload",
    "pc": "2p"
  },
  "buff_matrix_sr_12_level2": {
    "charRu": "Ина",
    "charEn": "Ene",
    "suitRu": "Перегрузка",
    "suitEn": "Overload",
    "pc": "2p"
  },
  "buff_matrix_sr_12_level3": {
    "charRu": "Ина",
    "charEn": "Ene",
    "suitRu": "Перегрузка",
    "suitEn": "Overload",
    "pc": "2p"
  },
  "buff_matrix_sr_10_level1": {
    "charRu": "Бай Лин",
    "charEn": "Bai Ling",
    "suitRu": "Смертельный захват",
    "suitEn": "Deadly Lock",
    "pc": "2p"
  },
  "buff_matrix_sr_10": {
    "charRu": "Бай Лин",
    "charEn": "Bai Ling",
    "suitRu": "Смертельный захват",
    "suitEn": "Deadly Lock",
    "pc": "2p"
  },
  "buff_matrix_sr_10_level2": {
    "charRu": "Бай Лин",
    "charEn": "Bai Ling",
    "suitRu": "Смертельный захват",
    "suitEn": "Deadly Lock",
    "pc": "2p"
  },
  "buff_matrix_sr_10_level3": {
    "charRu": "Бай Лин",
    "charEn": "Bai Ling",
    "suitRu": "Смертельный захват",
    "suitEn": "Deadly Lock",
    "pc": "2p"
  },
  "buff_matrix_ssr_1_level1": {
    "charRu": "Мерил",
    "charEn": "Meryl",
    "suitRu": "Белоснежный страж",
    "suitEn": "Pure White Guardian",
    "pc": "2p"
  },
  "buff_matrix_ssr_1": {
    "charRu": "Мерил",
    "charEn": "Meryl",
    "suitRu": "Белоснежный страж",
    "suitEn": "Pure White Guardian",
    "pc": "2p"
  },
  "buff_matrix_ssr_1_level2": {
    "charRu": "Мерил",
    "charEn": "Meryl",
    "suitRu": "Белоснежный страж",
    "suitEn": "Pure White Guardian",
    "pc": "2p"
  },
  "buff_matrix_ssr_1_level3": {
    "charRu": "Мерил",
    "charEn": "Meryl",
    "suitRu": "Белоснежный страж",
    "suitEn": "Pure White Guardian",
    "pc": "2p"
  },
  "buff_matrix_ssr_1_level4": {
    "charRu": "Мерил",
    "charEn": "Meryl",
    "suitRu": "Белоснежный страж",
    "suitEn": "Pure White Guardian",
    "pc": "2p"
  },
  "buff_matrix_ssr2_sea_level1": {
    "charRu": "Мерил",
    "charEn": "Meryl",
    "suitRu": "Белоснежный страж",
    "suitEn": "Pure White Guardian",
    "pc": "4p"
  },
  "buff_matrix_ssr2_sea": {
    "charRu": "Мерил",
    "charEn": "Meryl",
    "suitRu": "Белоснежный страж",
    "suitEn": "Pure White Guardian",
    "pc": "4p"
  },
  "buff_matrix_ssr2_sea_level2": {
    "charRu": "Мерил",
    "charEn": "Meryl",
    "suitRu": "Белоснежный страж",
    "suitEn": "Pure White Guardian",
    "pc": "4p"
  },
  "buff_matrix_ssr2_sea_level3": {
    "charRu": "Мерил",
    "charEn": "Meryl",
    "suitRu": "Белоснежный страж",
    "suitEn": "Pure White Guardian",
    "pc": "4p"
  },
  "buff_matrix_ssr2_sea_level4": {
    "charRu": "Мерил",
    "charEn": "Meryl",
    "suitRu": "Белоснежный страж",
    "suitEn": "Pure White Guardian",
    "pc": "4p"
  },
  "buff_matrix_ssr_19_level1": {
    "charRu": "Юма",
    "charEn": "Huma",
    "suitRu": "Легкое пробуждение",
    "suitEn": "Slightly Awakened",
    "pc": "2p"
  },
  "buff_matrix_ssr_19": {
    "charRu": "Юма",
    "charEn": "Huma",
    "suitRu": "Легкое пробуждение",
    "suitEn": "Slightly Awakened",
    "pc": "2p"
  },
  "buff_matrix_ssr_19_level2": {
    "charRu": "Юма",
    "charEn": "Huma",
    "suitRu": "Легкое пробуждение",
    "suitEn": "Slightly Awakened",
    "pc": "2p"
  },
  "buff_matrix_ssr_19_level3": {
    "charRu": "Юма",
    "charEn": "Huma",
    "suitRu": "Легкое пробуждение",
    "suitEn": "Slightly Awakened",
    "pc": "2p"
  },
  "buff_matrix_ssr_19_level4": {
    "charRu": "Юма",
    "charEn": "Huma",
    "suitRu": "Легкое пробуждение",
    "suitEn": "Slightly Awakened",
    "pc": "2p"
  },
  "buff_matrix_ssr_20_level1_os": {
    "charRu": "Юма",
    "charEn": "Huma",
    "suitRu": "Легкое пробуждение",
    "suitEn": "Slightly Awakened",
    "pc": "4p"
  },
  "buff_matrix_ssr_20": {
    "charRu": "Юма",
    "charEn": "Huma",
    "suitRu": "Легкое пробуждение",
    "suitEn": "Slightly Awakened",
    "pc": "4p"
  },
  "buff_matrix_ssr_20_level2_os": {
    "charRu": "Юма",
    "charEn": "Huma",
    "suitRu": "Легкое пробуждение",
    "suitEn": "Slightly Awakened",
    "pc": "4p"
  },
  "buff_matrix_ssr_20_level3_os": {
    "charRu": "Юма",
    "charEn": "Huma",
    "suitRu": "Легкое пробуждение",
    "suitEn": "Slightly Awakened",
    "pc": "4p"
  },
  "buff_matrix_ssr_20_level4_os": {
    "charRu": "Юма",
    "charEn": "Huma",
    "suitRu": "Легкое пробуждение",
    "suitEn": "Slightly Awakened",
    "pc": "4p"
  },
  "buff_matrix_ssr21_sea_level1": {
    "charRu": "Кроу",
    "charEn": "Crow",
    "suitRu": "Фанатичное преследование",
    "suitEn": "Fanatical Pursuit",
    "pc": "2p"
  },
  "buff_matrix_ssr21_sea": {
    "charRu": "Кроу",
    "charEn": "Crow",
    "suitRu": "Фанатичное преследование",
    "suitEn": "Fanatical Pursuit",
    "pc": "2p"
  },
  "buff_matrix_ssr21_sea_level2": {
    "charRu": "Кроу",
    "charEn": "Crow",
    "suitRu": "Фанатичное преследование",
    "suitEn": "Fanatical Pursuit",
    "pc": "2p"
  },
  "buff_matrix_ssr21_sea_level3": {
    "charRu": "Кроу",
    "charEn": "Crow",
    "suitRu": "Фанатичное преследование",
    "suitEn": "Fanatical Pursuit",
    "pc": "2p"
  },
  "buff_matrix_ssr21_sea_level4": {
    "charRu": "Кроу",
    "charEn": "Crow",
    "suitRu": "Фанатичное преследование",
    "suitEn": "Fanatical Pursuit",
    "pc": "2p"
  },
  "buff_matrix_ssr22_sea_level1": {
    "charRu": "Кроу",
    "charEn": "Crow",
    "suitRu": "Фанатичное преследование",
    "suitEn": "Fanatical Pursuit",
    "pc": "4p"
  },
  "buff_matrix_ssr22_sea": {
    "charRu": "Кроу",
    "charEn": "Crow",
    "suitRu": "Фанатичное преследование",
    "suitEn": "Fanatical Pursuit",
    "pc": "4p"
  },
  "buff_matrix_ssr22_sea_level2": {
    "charRu": "Кроу",
    "charEn": "Crow",
    "suitRu": "Фанатичное преследование",
    "suitEn": "Fanatical Pursuit",
    "pc": "4p"
  },
  "buff_matrix_ssr22_sea_level3": {
    "charRu": "Кроу",
    "charEn": "Crow",
    "suitRu": "Фанатичное преследование",
    "suitEn": "Fanatical Pursuit",
    "pc": "4p"
  },
  "buff_matrix_ssr22_sea_level4": {
    "charRu": "Кроу",
    "charEn": "Crow",
    "suitRu": "Фанатичное преследование",
    "suitEn": "Fanatical Pursuit",
    "pc": "4p"
  },
  "buff_matrix_ssr23_level1": {
    "charRu": "Марк",
    "charEn": "Marc",
    "suitRu": "Авангард",
    "suitEn": "Vanguard",
    "pc": "2p"
  },
  "buff_matrix_ssr23": {
    "charRu": "Марк",
    "charEn": "Marc",
    "suitRu": "Авангард",
    "suitEn": "Vanguard",
    "pc": "2p"
  },
  "buff_matrix_ssr23_level2": {
    "charRu": "Марк",
    "charEn": "Marc",
    "suitRu": "Авангард",
    "suitEn": "Vanguard",
    "pc": "2p"
  },
  "buff_matrix_ssr23_level3": {
    "charRu": "Марк",
    "charEn": "Marc",
    "suitRu": "Авангард",
    "suitEn": "Vanguard",
    "pc": "2p"
  },
  "buff_matrix_ssr23_level4": {
    "charRu": "Марк",
    "charEn": "Marc",
    "suitRu": "Авангард",
    "suitEn": "Vanguard",
    "pc": "2p"
  },
  "buff_matrix_ssr24_level1": {
    "charRu": "Марк",
    "charEn": "Marc",
    "suitRu": "Авангард",
    "suitEn": "Vanguard",
    "pc": "4p"
  },
  "buff_matrix_ssr24": {
    "charRu": "Марк",
    "charEn": "Marc",
    "suitRu": "Авангард",
    "suitEn": "Vanguard",
    "pc": "4p"
  },
  "buff_matrix_ssr24_level2": {
    "charRu": "Марк",
    "charEn": "Marc",
    "suitRu": "Авангард",
    "suitEn": "Vanguard",
    "pc": "4p"
  },
  "buff_matrix_ssr24_level3": {
    "charRu": "Марк",
    "charEn": "Marc",
    "suitRu": "Авангард",
    "suitEn": "Vanguard",
    "pc": "4p"
  },
  "buff_matrix_ssr24_level4": {
    "charRu": "Марк",
    "charEn": "Marc",
    "suitRu": "Авангард",
    "suitEn": "Vanguard",
    "pc": "4p"
  },
  "buff_matrix_ssr25_level1": {
    "charRu": "Бай Юкеи",
    "charEn": "Bai Yuekui",
    "suitRu": "Сублимация мотива",
    "suitEn": "Motive Sublimation",
    "pc": "2p"
  },
  "buff_matrix_ssr25": {
    "charRu": "Бай Юкеи",
    "charEn": "Bai Yuekui",
    "suitRu": "Сублимация мотива",
    "suitEn": "Motive Sublimation",
    "pc": "2p"
  },
  "buff_matrix_ssr25_level2": {
    "charRu": "Бай Юкеи",
    "charEn": "Bai Yuekui",
    "suitRu": "Сублимация мотива",
    "suitEn": "Motive Sublimation",
    "pc": "2p"
  },
  "buff_matrix_ssr25_level3": {
    "charRu": "Бай Юкеи",
    "charEn": "Bai Yuekui",
    "suitRu": "Сублимация мотива",
    "suitEn": "Motive Sublimation",
    "pc": "2p"
  },
  "buff_matrix_ssr25_level4": {
    "charRu": "Бай Юкеи",
    "charEn": "Bai Yuekui",
    "suitRu": "Сублимация мотива",
    "suitEn": "Motive Sublimation",
    "pc": "2p"
  },
  "buff_matrix_ssr26_level1": {
    "charRu": "Бай Юкеи",
    "charEn": "Bai Yuekui",
    "suitRu": "Сублимация мотива",
    "suitEn": "Motive Sublimation",
    "pc": "4p"
  },
  "buff_matrix_ssr26": {
    "charRu": "Бай Юкеи",
    "charEn": "Bai Yuekui",
    "suitRu": "Сублимация мотива",
    "suitEn": "Motive Sublimation",
    "pc": "4p"
  },
  "buff_matrix_ssr26_level2": {
    "charRu": "Бай Юкеи",
    "charEn": "Bai Yuekui",
    "suitRu": "Сублимация мотива",
    "suitEn": "Motive Sublimation",
    "pc": "4p"
  },
  "buff_matrix_ssr26_level3": {
    "charRu": "Бай Юкеи",
    "charEn": "Bai Yuekui",
    "suitRu": "Сублимация мотива",
    "suitEn": "Motive Sublimation",
    "pc": "4p"
  },
  "buff_matrix_ssr26_level4": {
    "charRu": "Бай Юкеи",
    "charEn": "Bai Yuekui",
    "suitRu": "Сублимация мотива",
    "suitEn": "Motive Sublimation",
    "pc": "4p"
  },
  "buff_matrix_ssr27_level1_os": {
    "charRu": "Немезида",
    "charEn": "Nemesis",
    "suitRu": "Мосты жизни",
    "suitEn": "Life Bridging",
    "pc": "2p"
  },
  "buff_matrix_ssr27": {
    "charRu": "Немезида",
    "charEn": "Nemesis",
    "suitRu": "Мосты жизни",
    "suitEn": "Life Bridging",
    "pc": "2p"
  },
  "buff_matrix_ssr27_level2_os": {
    "charRu": "Немезида",
    "charEn": "Nemesis",
    "suitRu": "Мосты жизни",
    "suitEn": "Life Bridging",
    "pc": "2p"
  },
  "buff_matrix_ssr27_level3_os": {
    "charRu": "Немезида",
    "charEn": "Nemesis",
    "suitRu": "Мосты жизни",
    "suitEn": "Life Bridging",
    "pc": "2p"
  },
  "buff_matrix_ssr27_level4_os": {
    "charRu": "Немезида",
    "charEn": "Nemesis",
    "suitRu": "Мосты жизни",
    "suitEn": "Life Bridging",
    "pc": "2p"
  },
  "buff_matirx_ssr28_level1": {
    "charRu": "Немезида",
    "charEn": "Nemesis",
    "suitRu": "Мосты жизни",
    "suitEn": "Life Bridging",
    "pc": "4p"
  },
  "buff_matirx_ssr28": {
    "charRu": "Немезида",
    "charEn": "Nemesis",
    "suitRu": "Мосты жизни",
    "suitEn": "Life Bridging",
    "pc": "4p"
  },
  "buff_matirx_ssr28_level2": {
    "charRu": "Немезида",
    "charEn": "Nemesis",
    "suitRu": "Мосты жизни",
    "suitEn": "Life Bridging",
    "pc": "4p"
  },
  "buff_matirx_ssr28_level3": {
    "charRu": "Немезида",
    "charEn": "Nemesis",
    "suitRu": "Мосты жизни",
    "suitEn": "Life Bridging",
    "pc": "4p"
  },
  "buff_matirx_ssr28_level4": {
    "charRu": "Немезида",
    "charEn": "Nemesis",
    "suitRu": "Мосты жизни",
    "suitEn": "Life Bridging",
    "pc": "4p"
  },
  "buff_matrix_ssr29_level1_os": {
    "charRu": "Фригг",
    "charEn": "Frigg",
    "suitRu": "Железный разум и тело",
    "suitEn": "Iron Mind and Body",
    "pc": "2p"
  },
  "buff_matrix_ssr29": {
    "charRu": "Фригг",
    "charEn": "Frigg",
    "suitRu": "Железный разум и тело",
    "suitEn": "Iron Mind and Body",
    "pc": "2p"
  },
  "buff_matrix_ssr29_level2_os": {
    "charRu": "Фригг",
    "charEn": "Frigg",
    "suitRu": "Железный разум и тело",
    "suitEn": "Iron Mind and Body",
    "pc": "2p"
  },
  "buff_matrix_ssr29_level3_os": {
    "charRu": "Фригг",
    "charEn": "Frigg",
    "suitRu": "Железный разум и тело",
    "suitEn": "Iron Mind and Body",
    "pc": "2p"
  },
  "buff_matrix_ssr29_level4_os": {
    "charRu": "Фригг",
    "charEn": "Frigg",
    "suitRu": "Железный разум и тело",
    "suitEn": "Iron Mind and Body",
    "pc": "2p"
  },
  "buff_matrix_ssr30_level1": {
    "charRu": "Фригг",
    "charEn": "Frigg",
    "suitRu": "Железный разум и тело",
    "suitEn": "Iron Mind and Body",
    "pc": "4p"
  },
  "buff_matrix_ssr30": {
    "charRu": "Фригг",
    "charEn": "Frigg",
    "suitRu": "Железный разум и тело",
    "suitEn": "Iron Mind and Body",
    "pc": "4p"
  },
  "buff_matrix_ssr30_level2": {
    "charRu": "Фригг",
    "charEn": "Frigg",
    "suitRu": "Железный разум и тело",
    "suitEn": "Iron Mind and Body",
    "pc": "4p"
  },
  "buff_matrix_ssr30_level3": {
    "charRu": "Фригг",
    "charEn": "Frigg",
    "suitRu": "Железный разум и тело",
    "suitEn": "Iron Mind and Body",
    "pc": "4p"
  },
  "buff_matrix_ssr30_level4": {
    "charRu": "Фригг",
    "charEn": "Frigg",
    "suitRu": "Железный разум и тело",
    "suitEn": "Iron Mind and Body",
    "pc": "4p"
  },
  "buff_matrix_31_level1": {
    "charRu": "Руби",
    "charEn": "Ruby",
    "suitRu": "Танец белого кролика",
    "suitEn": "White Rabbit Dance",
    "pc": "2p"
  },
  "buff_matrix_31": {
    "charRu": "Руби",
    "charEn": "Ruby",
    "suitRu": "Танец белого кролика",
    "suitEn": "White Rabbit Dance",
    "pc": "2p"
  },
  "buff_matrix_31_level2": {
    "charRu": "Руби",
    "charEn": "Ruby",
    "suitRu": "Танец белого кролика",
    "suitEn": "White Rabbit Dance",
    "pc": "2p"
  },
  "buff_matrix_31_level3": {
    "charRu": "Руби",
    "charEn": "Ruby",
    "suitRu": "Танец белого кролика",
    "suitEn": "White Rabbit Dance",
    "pc": "2p"
  },
  "buff_matrix_31_level4": {
    "charRu": "Руби",
    "charEn": "Ruby",
    "suitRu": "Танец белого кролика",
    "suitEn": "White Rabbit Dance",
    "pc": "2p"
  },
  "buff_matrix_32_level1": {
    "charRu": "Руби",
    "charEn": "Ruby",
    "suitRu": "Танец белого кролика",
    "suitEn": "White Rabbit Dance",
    "pc": "4p"
  },
  "buff_matrix_32": {
    "charRu": "Руби",
    "charEn": "Ruby",
    "suitRu": "Танец белого кролика",
    "suitEn": "White Rabbit Dance",
    "pc": "4p"
  },
  "buff_matrix_32_level2": {
    "charRu": "Руби",
    "charEn": "Ruby",
    "suitRu": "Танец белого кролика",
    "suitEn": "White Rabbit Dance",
    "pc": "4p"
  },
  "buff_matrix_32_level3": {
    "charRu": "Руби",
    "charEn": "Ruby",
    "suitRu": "Танец белого кролика",
    "suitEn": "White Rabbit Dance",
    "pc": "4p"
  },
  "buff_matrix_32_level4": {
    "charRu": "Руби",
    "charEn": "Ruby",
    "suitRu": "Танец белого кролика",
    "suitEn": "White Rabbit Dance",
    "pc": "4p"
  },
  "buff_matrix_33_level1": {
    "charRu": "Саки Фува",
    "charEn": "Saki Fuwa",
    "suitRu": "Суперпоток",
    "suitEn": "Super Flow",
    "pc": "2p"
  },
  "buff_matrix_33": {
    "charRu": "Саки Фува",
    "charEn": "Saki Fuwa",
    "suitRu": "Суперпоток",
    "suitEn": "Super Flow",
    "pc": "2p"
  },
  "buff_matrix_33_level2": {
    "charRu": "Саки Фува",
    "charEn": "Saki Fuwa",
    "suitRu": "Суперпоток",
    "suitEn": "Super Flow",
    "pc": "2p"
  },
  "buff_matrix_33_level3": {
    "charRu": "Саки Фува",
    "charEn": "Saki Fuwa",
    "suitRu": "Суперпоток",
    "suitEn": "Super Flow",
    "pc": "2p"
  },
  "buff_matrix_33_level4": {
    "charRu": "Саки Фува",
    "charEn": "Saki Fuwa",
    "suitRu": "Суперпоток",
    "suitEn": "Super Flow",
    "pc": "2p"
  },
  "buff_matrix_34_level1": {
    "charRu": "Саки Фува",
    "charEn": "Saki Fuwa",
    "suitRu": "Суперпоток",
    "suitEn": "Super Flow",
    "pc": "4p"
  },
  "buff_matrix_34": {
    "charRu": "Саки Фува",
    "charEn": "Saki Fuwa",
    "suitRu": "Суперпоток",
    "suitEn": "Super Flow",
    "pc": "4p"
  },
  "buff_matrix_34_level2": {
    "charRu": "Саки Фува",
    "charEn": "Saki Fuwa",
    "suitRu": "Суперпоток",
    "suitEn": "Super Flow",
    "pc": "4p"
  },
  "buff_matrix_34_level3": {
    "charRu": "Саки Фува",
    "charEn": "Saki Fuwa",
    "suitRu": "Суперпоток",
    "suitEn": "Super Flow",
    "pc": "4p"
  },
  "buff_matrix_34_level4": {
    "charRu": "Саки Фува",
    "charEn": "Saki Fuwa",
    "suitRu": "Суперпоток",
    "suitEn": "Super Flow",
    "pc": "4p"
  },
  "buff_matrix_ssr35_level1": {
    "charRu": "Линь",
    "charEn": "Lin",
    "suitRu": "Ночной город никогда не спит",
    "suitEn": "Night City Never Sleeps",
    "pc": "2p"
  },
  "buff_matrix_ssr35": {
    "charRu": "Линь",
    "charEn": "Lin",
    "suitRu": "Ночной город никогда не спит",
    "suitEn": "Night City Never Sleeps",
    "pc": "2p"
  },
  "buff_matrix_ssr35_level2": {
    "charRu": "Линь",
    "charEn": "Lin",
    "suitRu": "Ночной город никогда не спит",
    "suitEn": "Night City Never Sleeps",
    "pc": "2p"
  },
  "buff_matrix_ssr35_level3": {
    "charRu": "Линь",
    "charEn": "Lin",
    "suitRu": "Ночной город никогда не спит",
    "suitEn": "Night City Never Sleeps",
    "pc": "2p"
  },
  "buff_matrix_ssr35_level4": {
    "charRu": "Линь",
    "charEn": "Lin",
    "suitRu": "Ночной город никогда не спит",
    "suitEn": "Night City Never Sleeps",
    "pc": "2p"
  },
  "buff_matrix_ssr36_level1": {
    "charRu": "Линь",
    "charEn": "Lin",
    "suitRu": "Ночной город никогда не спит",
    "suitEn": "Night City Never Sleeps",
    "pc": "4p"
  },
  "buff_matrix_ssr36": {
    "charRu": "Линь",
    "charEn": "Lin",
    "suitRu": "Ночной город никогда не спит",
    "suitEn": "Night City Never Sleeps",
    "pc": "4p"
  },
  "buff_matrix_ssr36_level2": {
    "charRu": "Линь",
    "charEn": "Lin",
    "suitRu": "Ночной город никогда не спит",
    "suitEn": "Night City Never Sleeps",
    "pc": "4p"
  },
  "buff_matrix_ssr36_level3": {
    "charRu": "Линь",
    "charEn": "Lin",
    "suitRu": "Ночной город никогда не спит",
    "suitEn": "Night City Never Sleeps",
    "pc": "4p"
  },
  "buff_matrix_ssr36_level4": {
    "charRu": "Линь",
    "charEn": "Lin",
    "suitRu": "Ночной город никогда не спит",
    "suitEn": "Night City Never Sleeps",
    "pc": "4p"
  },
  "buff_matrix_37_level1": {
    "charRu": "Лира",
    "charEn": "Lyra",
    "suitRu": "Признание памяти",
    "suitEn": "The Confession of Memory",
    "pc": "2p"
  },
  "buff_matrix_37": {
    "charRu": "Лира",
    "charEn": "Lyra",
    "suitRu": "Признание памяти",
    "suitEn": "The Confession of Memory",
    "pc": "2p"
  },
  "buff_matrix_37_level2": {
    "charRu": "Лира",
    "charEn": "Lyra",
    "suitRu": "Признание памяти",
    "suitEn": "The Confession of Memory",
    "pc": "2p"
  },
  "buff_matrix_37_level3": {
    "charRu": "Лира",
    "charEn": "Lyra",
    "suitRu": "Признание памяти",
    "suitEn": "The Confession of Memory",
    "pc": "2p"
  },
  "buff_matrix_37_level4": {
    "charRu": "Лира",
    "charEn": "Lyra",
    "suitRu": "Признание памяти",
    "suitEn": "The Confession of Memory",
    "pc": "2p"
  },
  "buff_matrix_38_level1": {
    "charRu": "Лира",
    "charEn": "Lyra",
    "suitRu": "Признание памяти",
    "suitEn": "The Confession of Memory",
    "pc": "4p"
  },
  "buff_matrix_38": {
    "charRu": "Лира",
    "charEn": "Lyra",
    "suitRu": "Признание памяти",
    "suitEn": "The Confession of Memory",
    "pc": "4p"
  },
  "buff_matrix_38_level2": {
    "charRu": "Лира",
    "charEn": "Lyra",
    "suitRu": "Признание памяти",
    "suitEn": "The Confession of Memory",
    "pc": "4p"
  },
  "buff_matrix_38_level3": {
    "charRu": "Лира",
    "charEn": "Lyra",
    "suitRu": "Признание памяти",
    "suitEn": "The Confession of Memory",
    "pc": "4p"
  },
  "buff_matrix_38_level4": {
    "charRu": "Лира",
    "charEn": "Lyra",
    "suitRu": "Признание памяти",
    "suitEn": "The Confession of Memory",
    "pc": "4p"
  },
  "buff_matrix_ssr_7_level1_overseas": {
    "charRu": "Цубаса",
    "charEn": "Tsubasa",
    "suitRu": "Око ветра",
    "suitEn": "Eye of Wind",
    "pc": "2p"
  },
  "buff_matrix_ssr_7": {
    "charRu": "Цубаса",
    "charEn": "Tsubasa",
    "suitRu": "Око ветра",
    "suitEn": "Eye of Wind",
    "pc": "2p"
  },
  "buff_matrix_ssr_7_level2_overseas": {
    "charRu": "Цубаса",
    "charEn": "Tsubasa",
    "suitRu": "Око ветра",
    "suitEn": "Eye of Wind",
    "pc": "2p"
  },
  "buff_matrix_ssr_7_level3_overseas": {
    "charRu": "Цубаса",
    "charEn": "Tsubasa",
    "suitRu": "Око ветра",
    "suitEn": "Eye of Wind",
    "pc": "2p"
  },
  "buff_matrix_ssr_7_level4": {
    "charRu": "Цубаса",
    "charEn": "Tsubasa",
    "suitRu": "Око ветра",
    "suitEn": "Eye of Wind",
    "pc": "2p"
  },
  "buff_matrix_ssr_8_level1": {
    "charRu": "Цубаса",
    "charEn": "Tsubasa",
    "suitRu": "Око ветра",
    "suitEn": "Eye of Wind",
    "pc": "4p"
  },
  "buff_matrix_ssr_8": {
    "charRu": "Цубаса",
    "charEn": "Tsubasa",
    "suitRu": "Око ветра",
    "suitEn": "Eye of Wind",
    "pc": "4p"
  },
  "buff_matrix_ssr_8_level2": {
    "charRu": "Цубаса",
    "charEn": "Tsubasa",
    "suitRu": "Око ветра",
    "suitEn": "Eye of Wind",
    "pc": "4p"
  },
  "buff_matrix_ssr_8_level3": {
    "charRu": "Цубаса",
    "charEn": "Tsubasa",
    "suitRu": "Око ветра",
    "suitEn": "Eye of Wind",
    "pc": "4p"
  },
  "buff_matrix_ssr_8_level4": {
    "charRu": "Цубаса",
    "charEn": "Tsubasa",
    "suitRu": "Око ветра",
    "suitEn": "Eye of Wind",
    "pc": "4p"
  },
  "buff_matrix_ssr39_level1": {
    "charRu": "Тянь Лан",
    "charEn": "Tian Lang",
    "suitRu": "Дикий волк",
    "suitEn": "Savage Wolf",
    "pc": "2p"
  },
  "buff_matrix_ssr39": {
    "charRu": "Тянь Лан",
    "charEn": "Tian Lang",
    "suitRu": "Дикий волк",
    "suitEn": "Savage Wolf",
    "pc": "2p"
  },
  "buff_matrix_ssr39_level2": {
    "charRu": "Тянь Лан",
    "charEn": "Tian Lang",
    "suitRu": "Дикий волк",
    "suitEn": "Savage Wolf",
    "pc": "2p"
  },
  "buff_matrix_ssr39_level3": {
    "charRu": "Тянь Лан",
    "charEn": "Tian Lang",
    "suitRu": "Дикий волк",
    "suitEn": "Savage Wolf",
    "pc": "2p"
  },
  "buff_matrix_ssr39_level4": {
    "charRu": "Тянь Лан",
    "charEn": "Tian Lang",
    "suitRu": "Дикий волк",
    "suitEn": "Savage Wolf",
    "pc": "2p"
  },
  "buff_matrix_ssr40_level1": {
    "charRu": "Тянь Лан",
    "charEn": "Tian Lang",
    "suitRu": "Дикий волк",
    "suitEn": "Savage Wolf",
    "pc": "4p"
  },
  "buff_matrix_ssr40": {
    "charRu": "Тянь Лан",
    "charEn": "Tian Lang",
    "suitRu": "Дикий волк",
    "suitEn": "Savage Wolf",
    "pc": "4p"
  },
  "buff_matrix_ssr40_level2": {
    "charRu": "Тянь Лан",
    "charEn": "Tian Lang",
    "suitRu": "Дикий волк",
    "suitEn": "Savage Wolf",
    "pc": "4p"
  },
  "buff_matrix_ssr40_level3": {
    "charRu": "Тянь Лан",
    "charEn": "Tian Lang",
    "suitRu": "Дикий волк",
    "suitEn": "Savage Wolf",
    "pc": "4p"
  },
  "buff_matrix_ssr40_level4": {
    "charRu": "Тянь Лан",
    "charEn": "Tian Lang",
    "suitRu": "Дикий волк",
    "suitEn": "Savage Wolf",
    "pc": "4p"
  },
  "buff_matrix_ssr41_level1": {
    "charRu": "Аннабелла",
    "charEn": "Annabella",
    "suitRu": "Кровавая история",
    "suitEn": "Bloody Anecdote",
    "pc": "2p"
  },
  "buff_matrix_ssr41": {
    "charRu": "Аннабелла",
    "charEn": "Annabella",
    "suitRu": "Кровавая история",
    "suitEn": "Bloody Anecdote",
    "pc": "2p"
  },
  "buff_matrix_ssr41_level2": {
    "charRu": "Аннабелла",
    "charEn": "Annabella",
    "suitRu": "Кровавая история",
    "suitEn": "Bloody Anecdote",
    "pc": "2p"
  },
  "buff_matrix_ssr41_level3": {
    "charRu": "Аннабелла",
    "charEn": "Annabella",
    "suitRu": "Кровавая история",
    "suitEn": "Bloody Anecdote",
    "pc": "2p"
  },
  "buff_matrix_ssr41_level4": {
    "charRu": "Аннабелла",
    "charEn": "Annabella",
    "suitRu": "Кровавая история",
    "suitEn": "Bloody Anecdote",
    "pc": "2p"
  },
  "buff_matrix_ssr42_level1": {
    "charRu": "Аннабелла",
    "charEn": "Annabella",
    "suitRu": "Кровавая история",
    "suitEn": "Bloody Anecdote",
    "pc": "4p"
  },
  "buff_matrix_ssr42": {
    "charRu": "Аннабелла",
    "charEn": "Annabella",
    "suitRu": "Кровавая история",
    "suitEn": "Bloody Anecdote",
    "pc": "4p"
  },
  "buff_matrix_ssr42_level2": {
    "charRu": "Аннабелла",
    "charEn": "Annabella",
    "suitRu": "Кровавая история",
    "suitEn": "Bloody Anecdote",
    "pc": "4p"
  },
  "buff_matrix_ssr42_level3": {
    "charRu": "Аннабелла",
    "charEn": "Annabella",
    "suitRu": "Кровавая история",
    "suitEn": "Bloody Anecdote",
    "pc": "4p"
  },
  "buff_matrix_ssr42_level4": {
    "charRu": "Аннабелла",
    "charEn": "Annabella",
    "suitRu": "Кровавая история",
    "suitEn": "Bloody Anecdote",
    "pc": "4p"
  },
  "buff_matrix_ssr43_level1": {
    "charRu": "Алисс",
    "charEn": "Alyss",
    "suitRu": "Духовная реконструкция",
    "suitEn": "Spiritual Reconstruction",
    "pc": "2p"
  },
  "buff_matrix_ssr43": {
    "charRu": "Алисс",
    "charEn": "Alyss",
    "suitRu": "Духовная реконструкция",
    "suitEn": "Spiritual Reconstruction",
    "pc": "2p"
  },
  "buff_matrix_ssr43_level2": {
    "charRu": "Алисс",
    "charEn": "Alyss",
    "suitRu": "Духовная реконструкция",
    "suitEn": "Spiritual Reconstruction",
    "pc": "2p"
  },
  "buff_matrix_ssr43_level3": {
    "charRu": "Алисс",
    "charEn": "Alyss",
    "suitRu": "Духовная реконструкция",
    "suitEn": "Spiritual Reconstruction",
    "pc": "2p"
  },
  "buff_matrix_ssr43_level4": {
    "charRu": "Алисс",
    "charEn": "Alyss",
    "suitRu": "Духовная реконструкция",
    "suitEn": "Spiritual Reconstruction",
    "pc": "2p"
  },
  "buff_matrix_ssr44_level1": {
    "charRu": "Алисс",
    "charEn": "Alyss",
    "suitRu": "Духовная реконструкция",
    "suitEn": "Spiritual Reconstruction",
    "pc": "4p"
  },
  "buff_matrix_ssr44": {
    "charRu": "Алисс",
    "charEn": "Alyss",
    "suitRu": "Духовная реконструкция",
    "suitEn": "Spiritual Reconstruction",
    "pc": "4p"
  },
  "buff_matrix_ssr44_level2": {
    "charRu": "Алисс",
    "charEn": "Alyss",
    "suitRu": "Духовная реконструкция",
    "suitEn": "Spiritual Reconstruction",
    "pc": "4p"
  },
  "buff_matrix_ssr44_level3": {
    "charRu": "Алисс",
    "charEn": "Alyss",
    "suitRu": "Духовная реконструкция",
    "suitEn": "Spiritual Reconstruction",
    "pc": "4p"
  },
  "buff_matrix_ssr44_level4": {
    "charRu": "Алисс",
    "charEn": "Alyss",
    "suitRu": "Духовная реконструкция",
    "suitEn": "Spiritual Reconstruction",
    "pc": "4p"
  },
  "buff_matrix_ssr47_level1": {
    "charRu": "Уми",
    "charEn": "Umi",
    "suitRu": "Парный фокус",
    "suitEn": "Double Magic",
    "pc": "2p"
  },
  "buff_matrix_ssr47": {
    "charRu": "Уми",
    "charEn": "Umi",
    "suitRu": "Парный фокус",
    "suitEn": "Double Magic",
    "pc": "2p"
  },
  "buff_matrix_ssr47_level2": {
    "charRu": "Уми",
    "charEn": "Umi",
    "suitRu": "Парный фокус",
    "suitEn": "Double Magic",
    "pc": "2p"
  },
  "buff_matrix_ssr47_level3": {
    "charRu": "Уми",
    "charEn": "Umi",
    "suitRu": "Парный фокус",
    "suitEn": "Double Magic",
    "pc": "2p"
  },
  "buff_matrix_ssr47_level4": {
    "charRu": "Уми",
    "charEn": "Umi",
    "suitRu": "Парный фокус",
    "suitEn": "Double Magic",
    "pc": "2p"
  },
  "buff_matrix_ssr48_level1": {
    "charRu": "Уми",
    "charEn": "Umi",
    "suitRu": "Парный фокус",
    "suitEn": "Double Magic",
    "pc": "4p"
  },
  "buff_matrix_ssr48": {
    "charRu": "Уми",
    "charEn": "Umi",
    "suitRu": "Парный фокус",
    "suitEn": "Double Magic",
    "pc": "4p"
  },
  "buff_matrix_ssr48_level2": {
    "charRu": "Уми",
    "charEn": "Umi",
    "suitRu": "Парный фокус",
    "suitEn": "Double Magic",
    "pc": "4p"
  },
  "buff_matrix_ssr48_level3": {
    "charRu": "Уми",
    "charEn": "Umi",
    "suitRu": "Парный фокус",
    "suitEn": "Double Magic",
    "pc": "4p"
  },
  "buff_matrix_ssr48_level4": {
    "charRu": "Уми",
    "charEn": "Umi",
    "suitRu": "Парный фокус",
    "suitEn": "Double Magic",
    "pc": "4p"
  },
  "buff_matrix_ssr45_level1": {
    "charRu": "Фенрир",
    "charEn": "Fenrir",
    "suitRu": "Симфония жизни",
    "suitEn": "Symphony of Life",
    "pc": "2p"
  },
  "buff_matrix_ssr45": {
    "charRu": "Фенрир",
    "charEn": "Fenrir",
    "suitRu": "Симфония жизни",
    "suitEn": "Symphony of Life",
    "pc": "2p"
  },
  "buff_matrix_ssr45_level2": {
    "charRu": "Фенрир",
    "charEn": "Fenrir",
    "suitRu": "Симфония жизни",
    "suitEn": "Symphony of Life",
    "pc": "2p"
  },
  "buff_matrix_ssr45_level3": {
    "charRu": "Фенрир",
    "charEn": "Fenrir",
    "suitRu": "Симфония жизни",
    "suitEn": "Symphony of Life",
    "pc": "2p"
  },
  "buff_matrix_ssr45_level4": {
    "charRu": "Фенрир",
    "charEn": "Fenrir",
    "suitRu": "Симфония жизни",
    "suitEn": "Symphony of Life",
    "pc": "2p"
  },
  "buff_matrix_ssr46_level1": {
    "charRu": "Фенрир",
    "charEn": "Fenrir",
    "suitRu": "Симфония жизни",
    "suitEn": "Symphony of Life",
    "pc": "4p"
  },
  "buff_matrix_ssr46": {
    "charRu": "Фенрир",
    "charEn": "Fenrir",
    "suitRu": "Симфония жизни",
    "suitEn": "Symphony of Life",
    "pc": "4p"
  },
  "buff_matrix_ssr46_level2": {
    "charRu": "Фенрир",
    "charEn": "Fenrir",
    "suitRu": "Симфония жизни",
    "suitEn": "Symphony of Life",
    "pc": "4p"
  },
  "buff_matrix_ssr46_level3": {
    "charRu": "Фенрир",
    "charEn": "Fenrir",
    "suitRu": "Симфония жизни",
    "suitEn": "Symphony of Life",
    "pc": "4p"
  },
  "buff_matrix_ssr46_level4": {
    "charRu": "Фенрир",
    "charEn": "Fenrir",
    "suitRu": "Симфония жизни",
    "suitEn": "Symphony of Life",
    "pc": "4p"
  },
  "buff_matrix_ssr53_level1": {
    "charRu": "",
    "charEn": "",
    "suitRu": "Пепельный дождь",
    "suitEn": "Volcanic Ash Rain",
    "pc": "2p"
  },
  "buff_matrix_ssr53": {
    "charRu": "",
    "charEn": "",
    "suitRu": "Пепельный дождь",
    "suitEn": "Volcanic Ash Rain",
    "pc": "2p"
  },
  "buff_matrix_ssr53_level2": {
    "charRu": "",
    "charEn": "",
    "suitRu": "Пепельный дождь",
    "suitEn": "Volcanic Ash Rain",
    "pc": "2p"
  },
  "buff_matrix_ssr53_level3": {
    "charRu": "",
    "charEn": "",
    "suitRu": "Пепельный дождь",
    "suitEn": "Volcanic Ash Rain",
    "pc": "2p"
  },
  "buff_matrix_ssr53_level4": {
    "charRu": "",
    "charEn": "",
    "suitRu": "Пепельный дождь",
    "suitEn": "Volcanic Ash Rain",
    "pc": "2p"
  },
  "buff_matrix_ssr54_level1": {
    "charRu": "",
    "charEn": "",
    "suitRu": "Пепельный дождь",
    "suitEn": "Volcanic Ash Rain",
    "pc": "4p"
  },
  "buff_matrix_ssr54": {
    "charRu": "",
    "charEn": "",
    "suitRu": "Пепельный дождь",
    "suitEn": "Volcanic Ash Rain",
    "pc": "4p"
  },
  "buff_matrix_ssr54_level2": {
    "charRu": "",
    "charEn": "",
    "suitRu": "Пепельный дождь",
    "suitEn": "Volcanic Ash Rain",
    "pc": "4p"
  },
  "buff_matrix_ssr54_level3": {
    "charRu": "",
    "charEn": "",
    "suitRu": "Пепельный дождь",
    "suitEn": "Volcanic Ash Rain",
    "pc": "4p"
  },
  "buff_matrix_ssr54_level4": {
    "charRu": "",
    "charEn": "",
    "suitRu": "Пепельный дождь",
    "suitEn": "Volcanic Ash Rain",
    "pc": "4p"
  },
  "buff_matrix_ssr55_level1": {
    "charRu": "",
    "charEn": "",
    "suitRu": "Отзвуки барабанов",
    "suitEn": "Reverberating Drums",
    "pc": "2p"
  },
  "buff_matrix_ssr55": {
    "charRu": "",
    "charEn": "",
    "suitRu": "Отзвуки барабанов",
    "suitEn": "Reverberating Drums",
    "pc": "2p"
  },
  "buff_matrix_ssr55_level2": {
    "charRu": "",
    "charEn": "",
    "suitRu": "Отзвуки барабанов",
    "suitEn": "Reverberating Drums",
    "pc": "2p"
  },
  "buff_matrix_ssr55_level3": {
    "charRu": "",
    "charEn": "",
    "suitRu": "Отзвуки барабанов",
    "suitEn": "Reverberating Drums",
    "pc": "2p"
  },
  "buff_matrix_ssr55_level4": {
    "charRu": "",
    "charEn": "",
    "suitRu": "Отзвуки барабанов",
    "suitEn": "Reverberating Drums",
    "pc": "2p"
  },
  "buff_matrix_ssr56_level1": {
    "charRu": "",
    "charEn": "",
    "suitRu": "Отзвуки барабанов",
    "suitEn": "Reverberating Drums",
    "pc": "4p"
  },
  "buff_matrix_ssr56": {
    "charRu": "",
    "charEn": "",
    "suitRu": "Отзвуки барабанов",
    "suitEn": "Reverberating Drums",
    "pc": "4p"
  },
  "buff_matrix_ssr56_level2": {
    "charRu": "",
    "charEn": "",
    "suitRu": "Отзвуки барабанов",
    "suitEn": "Reverberating Drums",
    "pc": "4p"
  },
  "buff_matrix_ssr56_level3": {
    "charRu": "",
    "charEn": "",
    "suitRu": "Отзвуки барабанов",
    "suitEn": "Reverberating Drums",
    "pc": "4p"
  },
  "buff_matrix_ssr56_level4": {
    "charRu": "",
    "charEn": "",
    "suitRu": "Отзвуки барабанов",
    "suitEn": "Reverberating Drums",
    "pc": "4p"
  },
  "buff_matrix_ssr51_level1": {
    "charRu": "Лань",
    "charEn": "Lan",
    "suitRu": "Огненный шторм",
    "suitEn": "Firestorm",
    "pc": "2p"
  },
  "buff_matrix_ssr51": {
    "charRu": "Лань",
    "charEn": "Lan",
    "suitRu": "Огненный шторм",
    "suitEn": "Firestorm",
    "pc": "2p"
  },
  "buff_matrix_ssr51_level2": {
    "charRu": "Лань",
    "charEn": "Lan",
    "suitRu": "Огненный шторм",
    "suitEn": "Firestorm",
    "pc": "2p"
  },
  "buff_matrix_ssr51_level3": {
    "charRu": "Лань",
    "charEn": "Lan",
    "suitRu": "Огненный шторм",
    "suitEn": "Firestorm",
    "pc": "2p"
  },
  "buff_matrix_ssr51_level4": {
    "charRu": "Лань",
    "charEn": "Lan",
    "suitRu": "Огненный шторм",
    "suitEn": "Firestorm",
    "pc": "2p"
  },
  "buff_matrix_ssr52_level1": {
    "charRu": "Лань",
    "charEn": "Lan",
    "suitRu": "Огненный шторм",
    "suitEn": "Firestorm",
    "pc": "4p"
  },
  "buff_matrix_ssr52": {
    "charRu": "Лань",
    "charEn": "Lan",
    "suitRu": "Огненный шторм",
    "suitEn": "Firestorm",
    "pc": "4p"
  },
  "buff_matrix_ssr52_level2": {
    "charRu": "Лань",
    "charEn": "Lan",
    "suitRu": "Огненный шторм",
    "suitEn": "Firestorm",
    "pc": "4p"
  },
  "buff_matrix_ssr52_level3": {
    "charRu": "Лань",
    "charEn": "Lan",
    "suitRu": "Огненный шторм",
    "suitEn": "Firestorm",
    "pc": "4p"
  },
  "buff_matrix_ssr52_level4": {
    "charRu": "Лань",
    "charEn": "Lan",
    "suitRu": "Огненный шторм",
    "suitEn": "Firestorm",
    "pc": "4p"
  },
  "buff_matrix_ssr57_level1": {
    "charRu": "Икар",
    "charEn": "Icarus",
    "suitRu": "С холодом",
    "suitEn": "With Frost",
    "pc": "2p"
  },
  "buff_matrix_ssr57": {
    "charRu": "Икар",
    "charEn": "Icarus",
    "suitRu": "С холодом",
    "suitEn": "With Frost",
    "pc": "2p"
  },
  "buff_matrix_ssr57_level2": {
    "charRu": "Икар",
    "charEn": "Icarus",
    "suitRu": "С холодом",
    "suitEn": "With Frost",
    "pc": "2p"
  },
  "buff_matrix_ssr57_level3": {
    "charRu": "Икар",
    "charEn": "Icarus",
    "suitRu": "С холодом",
    "suitEn": "With Frost",
    "pc": "2p"
  },
  "buff_matrix_ssr57_level4": {
    "charRu": "Икар",
    "charEn": "Icarus",
    "suitRu": "С холодом",
    "suitEn": "With Frost",
    "pc": "2p"
  },
  "buff_matrix_ssr58_level1": {
    "charRu": "Икар",
    "charEn": "Icarus",
    "suitRu": "С холодом",
    "suitEn": "With Frost",
    "pc": "4p"
  },
  "buff_matrix_ssr58": {
    "charRu": "Икар",
    "charEn": "Icarus",
    "suitRu": "С холодом",
    "suitEn": "With Frost",
    "pc": "4p"
  },
  "buff_matrix_ssr58_level2": {
    "charRu": "Икар",
    "charEn": "Icarus",
    "suitRu": "С холодом",
    "suitEn": "With Frost",
    "pc": "4p"
  },
  "buff_matrix_ssr58_level3": {
    "charRu": "Икар",
    "charEn": "Icarus",
    "suitRu": "С холодом",
    "suitEn": "With Frost",
    "pc": "4p"
  },
  "buff_matrix_ssr58_level4": {
    "charRu": "Икар",
    "charEn": "Icarus",
    "suitRu": "С холодом",
    "suitEn": "With Frost",
    "pc": "4p"
  },
  "buff_matrix_ssr61_level1": {
    "charRu": "Фиона",
    "charEn": "Fiona",
    "suitRu": "Стимул",
    "suitEn": "Stimulus",
    "pc": "2p"
  },
  "buff_matrix_ssr61": {
    "charRu": "Фиона",
    "charEn": "Fiona",
    "suitRu": "Стимул",
    "suitEn": "Stimulus",
    "pc": "2p"
  },
  "buff_matrix_ssr61_level2": {
    "charRu": "Фиона",
    "charEn": "Fiona",
    "suitRu": "Стимул",
    "suitEn": "Stimulus",
    "pc": "2p"
  },
  "buff_matrix_ssr61_level3": {
    "charRu": "Фиона",
    "charEn": "Fiona",
    "suitRu": "Стимул",
    "suitEn": "Stimulus",
    "pc": "2p"
  },
  "buff_matrix_ssr61_level4": {
    "charRu": "Фиона",
    "charEn": "Fiona",
    "suitRu": "Стимул",
    "suitEn": "Stimulus",
    "pc": "2p"
  },
  "buff_matrix_ssr62_level1": {
    "charRu": "Фиона",
    "charEn": "Fiona",
    "suitRu": "Стимул",
    "suitEn": "Stimulus",
    "pc": "4p"
  },
  "buff_matrix_ssr62": {
    "charRu": "Фиона",
    "charEn": "Fiona",
    "suitRu": "Стимул",
    "suitEn": "Stimulus",
    "pc": "4p"
  },
  "buff_matrix_ssr62_level2": {
    "charRu": "Фиона",
    "charEn": "Fiona",
    "suitRu": "Стимул",
    "suitEn": "Stimulus",
    "pc": "4p"
  },
  "buff_matrix_ssr62_level3": {
    "charRu": "Фиона",
    "charEn": "Fiona",
    "suitRu": "Стимул",
    "suitEn": "Stimulus",
    "pc": "4p"
  },
  "buff_matrix_ssr62_level4": {
    "charRu": "Фиона",
    "charEn": "Fiona",
    "suitRu": "Стимул",
    "suitEn": "Stimulus",
    "pc": "4p"
  },
  "buff_matrix_ssr_3_level1": {
    "charRu": "Коко Риттер",
    "charEn": "Cocoritter",
    "suitRu": "Доказательство доверия",
    "suitEn": "Proof of Trust",
    "pc": "2p"
  },
  "buff_matrix_ssr_3": {
    "charRu": "Коко Риттер",
    "charEn": "Cocoritter",
    "suitRu": "Доказательство доверия",
    "suitEn": "Proof of Trust",
    "pc": "2p"
  },
  "buff_matrix_ssr_3_level2": {
    "charRu": "Коко Риттер",
    "charEn": "Cocoritter",
    "suitRu": "Доказательство доверия",
    "suitEn": "Proof of Trust",
    "pc": "2p"
  },
  "buff_matrix_ssr_3_level3": {
    "charRu": "Коко Риттер",
    "charEn": "Cocoritter",
    "suitRu": "Доказательство доверия",
    "suitEn": "Proof of Trust",
    "pc": "2p"
  },
  "buff_matrix_ssr_3_level4": {
    "charRu": "Коко Риттер",
    "charEn": "Cocoritter",
    "suitRu": "Доказательство доверия",
    "suitEn": "Proof of Trust",
    "pc": "2p"
  },
  "buff_matrix_ssr_4_level1_os": {
    "charRu": "Коко Риттер",
    "charEn": "Cocoritter",
    "suitRu": "Доказательство доверия",
    "suitEn": "Proof of Trust",
    "pc": "4p"
  },
  "buff_matrix_ssr_4": {
    "charRu": "Коко Риттер",
    "charEn": "Cocoritter",
    "suitRu": "Доказательство доверия",
    "suitEn": "Proof of Trust",
    "pc": "4p"
  },
  "buff_matrix_ssr_4_level2_os": {
    "charRu": "Коко Риттер",
    "charEn": "Cocoritter",
    "suitRu": "Доказательство доверия",
    "suitEn": "Proof of Trust",
    "pc": "4p"
  },
  "buff_matrix_ssr_4_level3_os": {
    "charRu": "Коко Риттер",
    "charEn": "Cocoritter",
    "suitRu": "Доказательство доверия",
    "suitEn": "Proof of Trust",
    "pc": "4p"
  },
  "buff_matrix_ssr_4_level4_os": {
    "charRu": "Коко Риттер",
    "charEn": "Cocoritter",
    "suitRu": "Доказательство доверия",
    "suitEn": "Proof of Trust",
    "pc": "4p"
  },
  "buff_matrix_ssr59_level1": {
    "charRu": "Гнонно",
    "charEn": "Gnonno",
    "suitRu": "Астероид приключений",
    "suitEn": "Adventure Asteroid",
    "pc": "2p"
  },
  "buff_matrix_ssr59": {
    "charRu": "Гнонно",
    "charEn": "Gnonno",
    "suitRu": "Астероид приключений",
    "suitEn": "Adventure Asteroid",
    "pc": "2p"
  },
  "buff_matrix_ssr59_level2": {
    "charRu": "Гнонно",
    "charEn": "Gnonno",
    "suitRu": "Астероид приключений",
    "suitEn": "Adventure Asteroid",
    "pc": "2p"
  },
  "buff_matrix_ssr59_level3": {
    "charRu": "Гнонно",
    "charEn": "Gnonno",
    "suitRu": "Астероид приключений",
    "suitEn": "Adventure Asteroid",
    "pc": "2p"
  },
  "buff_matrix_ssr59_level4": {
    "charRu": "Гнонно",
    "charEn": "Gnonno",
    "suitRu": "Астероид приключений",
    "suitEn": "Adventure Asteroid",
    "pc": "2p"
  },
  "buff_matrix_ssr60_level1": {
    "charRu": "Гнонно",
    "charEn": "Gnonno",
    "suitRu": "Астероид приключений",
    "suitEn": "Adventure Asteroid",
    "pc": "4p"
  },
  "buff_matrix_ssr60": {
    "charRu": "Гнонно",
    "charEn": "Gnonno",
    "suitRu": "Астероид приключений",
    "suitEn": "Adventure Asteroid",
    "pc": "4p"
  },
  "buff_matrix_ssr60_level2": {
    "charRu": "Гнонно",
    "charEn": "Gnonno",
    "suitRu": "Астероид приключений",
    "suitEn": "Adventure Asteroid",
    "pc": "4p"
  },
  "buff_matrix_ssr60_level3": {
    "charRu": "Гнонно",
    "charEn": "Gnonno",
    "suitRu": "Астероид приключений",
    "suitEn": "Adventure Asteroid",
    "pc": "4p"
  },
  "buff_matrix_ssr60_level4": {
    "charRu": "Гнонно",
    "charEn": "Gnonno",
    "suitRu": "Астероид приключений",
    "suitEn": "Adventure Asteroid",
    "pc": "4p"
  },
  "buff_matrix_ssr67_level1": {
    "charRu": "Рубилия",
    "charEn": "Rubilia",
    "suitRu": "Искательница",
    "suitEn": "Seeker",
    "pc": "2p"
  },
  "buff_matrix_ssr67": {
    "charRu": "Рубилия",
    "charEn": "Rubilia",
    "suitRu": "Искательница",
    "suitEn": "Seeker",
    "pc": "2p"
  },
  "buff_matrix_ssr67_level2": {
    "charRu": "Рубилия",
    "charEn": "Rubilia",
    "suitRu": "Искательница",
    "suitEn": "Seeker",
    "pc": "2p"
  },
  "buff_matrix_ssr67_level3": {
    "charRu": "Рубилия",
    "charEn": "Rubilia",
    "suitRu": "Искательница",
    "suitEn": "Seeker",
    "pc": "2p"
  },
  "buff_matrix_ssr67_level4": {
    "charRu": "Рубилия",
    "charEn": "Rubilia",
    "suitRu": "Искательница",
    "suitEn": "Seeker",
    "pc": "2p"
  },
  "buff_matrix_ssr68_level1": {
    "charRu": "Рубилия",
    "charEn": "Rubilia",
    "suitRu": "Искательница",
    "suitEn": "Seeker",
    "pc": "4p"
  },
  "buff_matrix_ssr68": {
    "charRu": "Рубилия",
    "charEn": "Rubilia",
    "suitRu": "Искательница",
    "suitEn": "Seeker",
    "pc": "4p"
  },
  "buff_matrix_ssr68_level2": {
    "charRu": "Рубилия",
    "charEn": "Rubilia",
    "suitRu": "Искательница",
    "suitEn": "Seeker",
    "pc": "4p"
  },
  "buff_matrix_ssr68_level3": {
    "charRu": "Рубилия",
    "charEn": "Rubilia",
    "suitRu": "Искательница",
    "suitEn": "Seeker",
    "pc": "4p"
  },
  "buff_matrix_ssr68_level4": {
    "charRu": "Рубилия",
    "charEn": "Rubilia",
    "suitRu": "Искательница",
    "suitEn": "Seeker",
    "pc": "4p"
  },
  "buff_matrix_ssr65_level1": {
    "charRu": "Лю Хо",
    "charEn": "Liu Huo",
    "suitRu": "Кисть весны и осени",
    "suitEn": "Spring & Autumn Brush",
    "pc": "2p"
  },
  "buff_matrix_ssr65": {
    "charRu": "Лю Хо",
    "charEn": "Liu Huo",
    "suitRu": "Кисть весны и осени",
    "suitEn": "Spring & Autumn Brush",
    "pc": "2p"
  },
  "buff_matrix_ssr65_level2": {
    "charRu": "Лю Хо",
    "charEn": "Liu Huo",
    "suitRu": "Кисть весны и осени",
    "suitEn": "Spring & Autumn Brush",
    "pc": "2p"
  },
  "buff_matrix_ssr65_level3": {
    "charRu": "Лю Хо",
    "charEn": "Liu Huo",
    "suitRu": "Кисть весны и осени",
    "suitEn": "Spring & Autumn Brush",
    "pc": "2p"
  },
  "buff_matrix_ssr65_level4": {
    "charRu": "Лю Хо",
    "charEn": "Liu Huo",
    "suitRu": "Кисть весны и осени",
    "suitEn": "Spring & Autumn Brush",
    "pc": "2p"
  },
  "buff_matrix_ssr66_level1": {
    "charRu": "Лю Хо",
    "charEn": "Liu Huo",
    "suitRu": "Кисть весны и осени",
    "suitEn": "Spring & Autumn Brush",
    "pc": "4p"
  },
  "buff_matrix_ssr66": {
    "charRu": "Лю Хо",
    "charEn": "Liu Huo",
    "suitRu": "Кисть весны и осени",
    "suitEn": "Spring & Autumn Brush",
    "pc": "4p"
  },
  "buff_matrix_ssr66_level2": {
    "charRu": "Лю Хо",
    "charEn": "Liu Huo",
    "suitRu": "Кисть весны и осени",
    "suitEn": "Spring & Autumn Brush",
    "pc": "4p"
  },
  "buff_matrix_ssr66_level3": {
    "charRu": "Лю Хо",
    "charEn": "Liu Huo",
    "suitRu": "Кисть весны и осени",
    "suitEn": "Spring & Autumn Brush",
    "pc": "4p"
  },
  "buff_matrix_ssr66_level4": {
    "charRu": "Лю Хо",
    "charEn": "Liu Huo",
    "suitRu": "Кисть весны и осени",
    "suitEn": "Spring & Autumn Brush",
    "pc": "4p"
  },
  "buff_matrix_ssr63_level1": {
    "charRu": "Юйлань",
    "charEn": "Yu Lan",
    "suitRu": "Искренность",
    "suitEn": "Sincerity",
    "pc": "2p"
  },
  "buff_matrix_ssr63": {
    "charRu": "Юйлань",
    "charEn": "Yu Lan",
    "suitRu": "Искренность",
    "suitEn": "Sincerity",
    "pc": "2p"
  },
  "buff_matrix_ssr63_level2": {
    "charRu": "Юйлань",
    "charEn": "Yu Lan",
    "suitRu": "Искренность",
    "suitEn": "Sincerity",
    "pc": "2p"
  },
  "buff_matrix_ssr63_level3": {
    "charRu": "Юйлань",
    "charEn": "Yu Lan",
    "suitRu": "Искренность",
    "suitEn": "Sincerity",
    "pc": "2p"
  },
  "buff_matrix_ssr63_level4": {
    "charRu": "Юйлань",
    "charEn": "Yu Lan",
    "suitRu": "Искренность",
    "suitEn": "Sincerity",
    "pc": "2p"
  },
  "buff_matrix_ssr64_level1": {
    "charRu": "Юйлань",
    "charEn": "Yu Lan",
    "suitRu": "Искренность",
    "suitEn": "Sincerity",
    "pc": "4p"
  },
  "buff_matrix_ssr64": {
    "charRu": "Юйлань",
    "charEn": "Yu Lan",
    "suitRu": "Искренность",
    "suitEn": "Sincerity",
    "pc": "4p"
  },
  "buff_matrix_ssr64_level2": {
    "charRu": "Юйлань",
    "charEn": "Yu Lan",
    "suitRu": "Искренность",
    "suitEn": "Sincerity",
    "pc": "4p"
  },
  "buff_matrix_ssr64_level3": {
    "charRu": "Юйлань",
    "charEn": "Yu Lan",
    "suitRu": "Искренность",
    "suitEn": "Sincerity",
    "pc": "4p"
  },
  "buff_matrix_ssr64_level4": {
    "charRu": "Юйлань",
    "charEn": "Yu Lan",
    "suitRu": "Искренность",
    "suitEn": "Sincerity",
    "pc": "4p"
  },
  "buff_matrix_ssr69_level1": {
    "charRu": "Мин Цзин",
    "charEn": "Ming Jing",
    "suitRu": "Потерянное сердце",
    "suitEn": "Lost at Heart",
    "pc": "2p"
  },
  "buff_matrix_ssr69": {
    "charRu": "Мин Цзин",
    "charEn": "Ming Jing",
    "suitRu": "Потерянное сердце",
    "suitEn": "Lost at Heart",
    "pc": "2p"
  },
  "buff_matrix_ssr69_level2": {
    "charRu": "Мин Цзин",
    "charEn": "Ming Jing",
    "suitRu": "Потерянное сердце",
    "suitEn": "Lost at Heart",
    "pc": "2p"
  },
  "buff_matrix_ssr69_level3": {
    "charRu": "Мин Цзин",
    "charEn": "Ming Jing",
    "suitRu": "Потерянное сердце",
    "suitEn": "Lost at Heart",
    "pc": "2p"
  },
  "buff_matrix_ssr69_level4": {
    "charRu": "Мин Цзин",
    "charEn": "Ming Jing",
    "suitRu": "Потерянное сердце",
    "suitEn": "Lost at Heart",
    "pc": "2p"
  },
  "buff_matrix_ssr70_level1": {
    "charRu": "Мин Цзин",
    "charEn": "Ming Jing",
    "suitRu": "Потерянное сердце",
    "suitEn": "Lost at Heart",
    "pc": "4p"
  },
  "buff_matrix_ssr70": {
    "charRu": "Мин Цзин",
    "charEn": "Ming Jing",
    "suitRu": "Потерянное сердце",
    "suitEn": "Lost at Heart",
    "pc": "4p"
  },
  "buff_matrix_ssr70_level2": {
    "charRu": "Мин Цзин",
    "charEn": "Ming Jing",
    "suitRu": "Потерянное сердце",
    "suitEn": "Lost at Heart",
    "pc": "4p"
  },
  "buff_matrix_ssr70_level3": {
    "charRu": "Мин Цзин",
    "charEn": "Ming Jing",
    "suitRu": "Потерянное сердце",
    "suitEn": "Lost at Heart",
    "pc": "4p"
  },
  "buff_matrix_ssr70_level4": {
    "charRu": "Мин Цзин",
    "charEn": "Ming Jing",
    "suitRu": "Потерянное сердце",
    "suitEn": "Lost at Heart",
    "pc": "4p"
  },
  "buff_matrix_ssr71_level1": {
    "charRu": "Хуан",
    "charEn": "Huang",
    "suitRu": "Звонкая песнь",
    "suitEn": "Resounding Chant",
    "pc": "2p"
  },
  "buff_matrix_ssr71": {
    "charRu": "Хуан",
    "charEn": "Huang",
    "suitRu": "Звонкая песнь",
    "suitEn": "Resounding Chant",
    "pc": "2p"
  },
  "buff_matrix_ssr71_level2": {
    "charRu": "Хуан",
    "charEn": "Huang",
    "suitRu": "Звонкая песнь",
    "suitEn": "Resounding Chant",
    "pc": "2p"
  },
  "buff_matrix_ssr71_level3": {
    "charRu": "Хуан",
    "charEn": "Huang",
    "suitRu": "Звонкая песнь",
    "suitEn": "Resounding Chant",
    "pc": "2p"
  },
  "buff_matrix_ssr71_level4": {
    "charRu": "Хуан",
    "charEn": "Huang",
    "suitRu": "Звонкая песнь",
    "suitEn": "Resounding Chant",
    "pc": "2p"
  },
  "buff_matrix_ssr72_level1": {
    "charRu": "Хуан",
    "charEn": "Huang",
    "suitRu": "Звонкая песнь",
    "suitEn": "Resounding Chant",
    "pc": "4p"
  },
  "buff_matrix_ssr72": {
    "charRu": "Хуан",
    "charEn": "Huang",
    "suitRu": "Звонкая песнь",
    "suitEn": "Resounding Chant",
    "pc": "4p"
  },
  "buff_matrix_ssr72_level2": {
    "charRu": "Хуан",
    "charEn": "Huang",
    "suitRu": "Звонкая песнь",
    "suitEn": "Resounding Chant",
    "pc": "4p"
  },
  "buff_matrix_ssr72_level3": {
    "charRu": "Хуан",
    "charEn": "Huang",
    "suitRu": "Звонкая песнь",
    "suitEn": "Resounding Chant",
    "pc": "4p"
  },
  "buff_matrix_ssr72_level4": {
    "charRu": "Хуан",
    "charEn": "Huang",
    "suitRu": "Звонкая песнь",
    "suitEn": "Resounding Chant",
    "pc": "4p"
  },
  "buff_matrix_ssr73_level1": {
    "charRu": "Фэй Сэ",
    "charEn": "Fei Se",
    "suitRu": "Грация",
    "suitEn": "Lissom",
    "pc": "2p"
  },
  "buff_matrix_ssr73": {
    "charRu": "Фэй Сэ",
    "charEn": "Fei Se",
    "suitRu": "Грация",
    "suitEn": "Lissom",
    "pc": "2p"
  },
  "buff_matrix_ssr73_level2": {
    "charRu": "Фэй Сэ",
    "charEn": "Fei Se",
    "suitRu": "Грация",
    "suitEn": "Lissom",
    "pc": "2p"
  },
  "buff_matrix_ssr73_level3": {
    "charRu": "Фэй Сэ",
    "charEn": "Fei Se",
    "suitRu": "Грация",
    "suitEn": "Lissom",
    "pc": "2p"
  },
  "buff_matrix_ssr73_level4": {
    "charRu": "Фэй Сэ",
    "charEn": "Fei Se",
    "suitRu": "Грация",
    "suitEn": "Lissom",
    "pc": "2p"
  },
  "buff_matrix_ssr74_level1": {
    "charRu": "Фэй Сэ",
    "charEn": "Fei Se",
    "suitRu": "Грация",
    "suitEn": "Lissom",
    "pc": "4p"
  },
  "buff_matrix_ssr74": {
    "charRu": "Фэй Сэ",
    "charEn": "Fei Se",
    "suitRu": "Грация",
    "suitEn": "Lissom",
    "pc": "4p"
  },
  "buff_matrix_ssr74_level2": {
    "charRu": "Фэй Сэ",
    "charEn": "Fei Se",
    "suitRu": "Грация",
    "suitEn": "Lissom",
    "pc": "4p"
  },
  "buff_matrix_ssr74_level3": {
    "charRu": "Фэй Сэ",
    "charEn": "Fei Se",
    "suitRu": "Грация",
    "suitEn": "Lissom",
    "pc": "4p"
  },
  "buff_matrix_ssr74_level4": {
    "charRu": "Фэй Сэ",
    "charEn": "Fei Se",
    "suitRu": "Грация",
    "suitEn": "Lissom",
    "pc": "4p"
  },
  "buff_matrix_ssr75_level1": {
    "charRu": "Линхань",
    "charEn": "Ling Han",
    "suitRu": "Морозная тень",
    "suitEn": "Frost Shadow",
    "pc": "2p"
  },
  "buff_matrix_ssr75": {
    "charRu": "Линхань",
    "charEn": "Ling Han",
    "suitRu": "Морозная тень",
    "suitEn": "Frost Shadow",
    "pc": "2p"
  },
  "buff_matrix_ssr75_level2": {
    "charRu": "Линхань",
    "charEn": "Ling Han",
    "suitRu": "Морозная тень",
    "suitEn": "Frost Shadow",
    "pc": "2p"
  },
  "buff_matrix_ssr75_level3": {
    "charRu": "Линхань",
    "charEn": "Ling Han",
    "suitRu": "Морозная тень",
    "suitEn": "Frost Shadow",
    "pc": "2p"
  },
  "buff_matrix_ssr75_level4": {
    "charRu": "Линхань",
    "charEn": "Ling Han",
    "suitRu": "Морозная тень",
    "suitEn": "Frost Shadow",
    "pc": "2p"
  },
  "buff_matrix_ssr76_level1": {
    "charRu": "Линхань",
    "charEn": "Ling Han",
    "suitRu": "Морозная тень",
    "suitEn": "Frost Shadow",
    "pc": "4p"
  },
  "buff_matrix_ssr76": {
    "charRu": "Линхань",
    "charEn": "Ling Han",
    "suitRu": "Морозная тень",
    "suitEn": "Frost Shadow",
    "pc": "4p"
  },
  "buff_matrix_ssr76_level2": {
    "charRu": "Линхань",
    "charEn": "Ling Han",
    "suitRu": "Морозная тень",
    "suitEn": "Frost Shadow",
    "pc": "4p"
  },
  "buff_matrix_ssr76_level3": {
    "charRu": "Линхань",
    "charEn": "Ling Han",
    "suitRu": "Морозная тень",
    "suitEn": "Frost Shadow",
    "pc": "4p"
  },
  "buff_matrix_ssr76_level4": {
    "charRu": "Линхань",
    "charEn": "Ling Han",
    "suitRu": "Морозная тень",
    "suitEn": "Frost Shadow",
    "pc": "4p"
  },
  "buff_matrix_ssr77_level1": {
    "charRu": "Нань Инь",
    "charEn": "Nan Yin",
    "suitRu": "Неизменность",
    "suitEn": "Unchanging",
    "pc": "2p"
  },
  "buff_matrix_ssr77": {
    "charRu": "Нань Инь",
    "charEn": "Nan Yin",
    "suitRu": "Неизменность",
    "suitEn": "Unchanging",
    "pc": "2p"
  },
  "buff_matrix_ssr77_level2": {
    "charRu": "Нань Инь",
    "charEn": "Nan Yin",
    "suitRu": "Неизменность",
    "suitEn": "Unchanging",
    "pc": "2p"
  },
  "buff_matrix_ssr77_level3": {
    "charRu": "Нань Инь",
    "charEn": "Nan Yin",
    "suitRu": "Неизменность",
    "suitEn": "Unchanging",
    "pc": "2p"
  },
  "buff_matrix_ssr77_level4": {
    "charRu": "Нань Инь",
    "charEn": "Nan Yin",
    "suitRu": "Неизменность",
    "suitEn": "Unchanging",
    "pc": "2p"
  },
  "buff_matrix_ssr78_level1": {
    "charRu": "Нань Инь",
    "charEn": "Nan Yin",
    "suitRu": "Неизменность",
    "suitEn": "Unchanging",
    "pc": "4p"
  },
  "buff_matrix_ssr78": {
    "charRu": "Нань Инь",
    "charEn": "Nan Yin",
    "suitRu": "Неизменность",
    "suitEn": "Unchanging",
    "pc": "4p"
  },
  "buff_matrix_ssr78_level2": {
    "charRu": "Нань Инь",
    "charEn": "Nan Yin",
    "suitRu": "Неизменность",
    "suitEn": "Unchanging",
    "pc": "4p"
  },
  "buff_matrix_ssr78_level3": {
    "charRu": "Нань Инь",
    "charEn": "Nan Yin",
    "suitRu": "Неизменность",
    "suitEn": "Unchanging",
    "pc": "4p"
  },
  "buff_matrix_ssr78_level4": {
    "charRu": "Нань Инь",
    "charEn": "Nan Yin",
    "suitRu": "Неизменность",
    "suitEn": "Unchanging",
    "pc": "4p"
  },
  "buff_matrix_ssr79_level1": {
    "charRu": "Янь Мяо",
    "charEn": "Yan Miao",
    "suitRu": "Страсть",
    "suitEn": "Passion",
    "pc": "2p"
  },
  "buff_matrix_ssr79": {
    "charRu": "Янь Мяо",
    "charEn": "Yan Miao",
    "suitRu": "Страсть",
    "suitEn": "Passion",
    "pc": "2p"
  },
  "buff_matrix_ssr79_level2": {
    "charRu": "Янь Мяо",
    "charEn": "Yan Miao",
    "suitRu": "Страсть",
    "suitEn": "Passion",
    "pc": "2p"
  },
  "buff_matrix_ssr79_level3": {
    "charRu": "Янь Мяо",
    "charEn": "Yan Miao",
    "suitRu": "Страсть",
    "suitEn": "Passion",
    "pc": "2p"
  },
  "buff_matrix_ssr79_level4": {
    "charRu": "Янь Мяо",
    "charEn": "Yan Miao",
    "suitRu": "Страсть",
    "suitEn": "Passion",
    "pc": "2p"
  },
  "buff_matrix_ssr80_level1": {
    "charRu": "Янь Мяо",
    "charEn": "Yan Miao",
    "suitRu": "Страсть",
    "suitEn": "Passion",
    "pc": "4p"
  },
  "buff_matrix_ssr80": {
    "charRu": "Янь Мяо",
    "charEn": "Yan Miao",
    "suitRu": "Страсть",
    "suitEn": "Passion",
    "pc": "4p"
  },
  "buff_matrix_ssr80_level2": {
    "charRu": "Янь Мяо",
    "charEn": "Yan Miao",
    "suitRu": "Страсть",
    "suitEn": "Passion",
    "pc": "4p"
  },
  "buff_matrix_ssr80_level3": {
    "charRu": "Янь Мяо",
    "charEn": "Yan Miao",
    "suitRu": "Страсть",
    "suitEn": "Passion",
    "pc": "4p"
  },
  "buff_matrix_ssr80_level4": {
    "charRu": "Янь Мяо",
    "charEn": "Yan Miao",
    "suitRu": "Страсть",
    "suitEn": "Passion",
    "pc": "4p"
  },
  "buff_matrix_ssr11_sea_level1": {
    "charRu": "Кинг",
    "charEn": "KING",
    "suitRu": "Адвокат насилия",
    "suitEn": "Advocate of Violence",
    "pc": "2p"
  },
  "buff_matrix_ssr11_sea": {
    "charRu": "Кинг",
    "charEn": "KING",
    "suitRu": "Адвокат насилия",
    "suitEn": "Advocate of Violence",
    "pc": "2p"
  },
  "buff_matrix_ssr11_sea_level2": {
    "charRu": "Кинг",
    "charEn": "KING",
    "suitRu": "Адвокат насилия",
    "suitEn": "Advocate of Violence",
    "pc": "2p"
  },
  "buff_matrix_ssr11_sea_level3": {
    "charRu": "Кинг",
    "charEn": "KING",
    "suitRu": "Адвокат насилия",
    "suitEn": "Advocate of Violence",
    "pc": "2p"
  },
  "buff_matrix_ssr11_sea_level4": {
    "charRu": "Кинг",
    "charEn": "KING",
    "suitRu": "Адвокат насилия",
    "suitEn": "Advocate of Violence",
    "pc": "2p"
  },
  "buff_matrix_ssr_12_level1": {
    "charRu": "Кинг",
    "charEn": "KING",
    "suitRu": "Адвокат насилия",
    "suitEn": "Advocate of Violence",
    "pc": "4p"
  },
  "buff_matrix_ssr_12": {
    "charRu": "Кинг",
    "charEn": "KING",
    "suitRu": "Адвокат насилия",
    "suitEn": "Advocate of Violence",
    "pc": "4p"
  },
  "buff_matrix_ssr_12_level2": {
    "charRu": "Кинг",
    "charEn": "KING",
    "suitRu": "Адвокат насилия",
    "suitEn": "Advocate of Violence",
    "pc": "4p"
  },
  "buff_matrix_ssr_12_level3": {
    "charRu": "Кинг",
    "charEn": "KING",
    "suitRu": "Адвокат насилия",
    "suitEn": "Advocate of Violence",
    "pc": "4p"
  },
  "buff_matrix_ssr_12_level4": {
    "charRu": "Кинг",
    "charEn": "KING",
    "suitRu": "Адвокат насилия",
    "suitEn": "Advocate of Violence",
    "pc": "4p"
  },
  "buff_matrix_ssr81_level1": {
    "charRu": "Бреви",
    "charEn": "Brevey",
    "suitRu": "Взращенный талант",
    "suitEn": "Blossoming Talent",
    "pc": "2p"
  },
  "buff_matrix_ssr81": {
    "charRu": "Бреви",
    "charEn": "Brevey",
    "suitRu": "Взращенный талант",
    "suitEn": "Blossoming Talent",
    "pc": "2p"
  },
  "buff_matrix_ssr81_level2": {
    "charRu": "Бреви",
    "charEn": "Brevey",
    "suitRu": "Взращенный талант",
    "suitEn": "Blossoming Talent",
    "pc": "2p"
  },
  "buff_matrix_ssr81_level3": {
    "charRu": "Бреви",
    "charEn": "Brevey",
    "suitRu": "Взращенный талант",
    "suitEn": "Blossoming Talent",
    "pc": "2p"
  },
  "buff_matrix_ssr81_level4": {
    "charRu": "Бреви",
    "charEn": "Brevey",
    "suitRu": "Взращенный талант",
    "suitEn": "Blossoming Talent",
    "pc": "2p"
  },
  "buff_matrix_ssr82_level1": {
    "charRu": "Бреви",
    "charEn": "Brevey",
    "suitRu": "Взращенный талант",
    "suitEn": "Blossoming Talent",
    "pc": "4p"
  },
  "buff_matrix_ssr82": {
    "charRu": "Бреви",
    "charEn": "Brevey",
    "suitRu": "Взращенный талант",
    "suitEn": "Blossoming Talent",
    "pc": "4p"
  },
  "buff_matrix_ssr82_level2": {
    "charRu": "Бреви",
    "charEn": "Brevey",
    "suitRu": "Взращенный талант",
    "suitEn": "Blossoming Talent",
    "pc": "4p"
  },
  "buff_matrix_ssr82_level3": {
    "charRu": "Бреви",
    "charEn": "Brevey",
    "suitRu": "Взращенный талант",
    "suitEn": "Blossoming Talent",
    "pc": "4p"
  },
  "buff_matrix_ssr82_level4": {
    "charRu": "Бреви",
    "charEn": "Brevey",
    "suitRu": "Взращенный талант",
    "suitEn": "Blossoming Talent",
    "pc": "4p"
  },
  "buff_matrix_ssr83_level1": {
    "charRu": "Плотти",
    "charEn": "Plotti",
    "suitRu": "Парадоксальность",
    "suitEn": "Paradox",
    "pc": "2p"
  },
  "buff_matrix_ssr83": {
    "charRu": "Плотти",
    "charEn": "Plotti",
    "suitRu": "Парадоксальность",
    "suitEn": "Paradox",
    "pc": "2p"
  },
  "buff_matrix_ssr83_level2": {
    "charRu": "Плотти",
    "charEn": "Plotti",
    "suitRu": "Парадоксальность",
    "suitEn": "Paradox",
    "pc": "2p"
  },
  "buff_matrix_ssr83_level3": {
    "charRu": "Плотти",
    "charEn": "Plotti",
    "suitRu": "Парадоксальность",
    "suitEn": "Paradox",
    "pc": "2p"
  },
  "buff_matrix_ssr83_level4": {
    "charRu": "Плотти",
    "charEn": "Plotti",
    "suitRu": "Парадоксальность",
    "suitEn": "Paradox",
    "pc": "2p"
  },
  "buff_matrix_ssr84_level1": {
    "charRu": "Плотти",
    "charEn": "Plotti",
    "suitRu": "Парадоксальность",
    "suitEn": "Paradox",
    "pc": "4p"
  },
  "buff_matrix_ssr84": {
    "charRu": "Плотти",
    "charEn": "Plotti",
    "suitRu": "Парадоксальность",
    "suitEn": "Paradox",
    "pc": "4p"
  },
  "buff_matrix_ssr84_level2": {
    "charRu": "Плотти",
    "charEn": "Plotti",
    "suitRu": "Парадоксальность",
    "suitEn": "Paradox",
    "pc": "4p"
  },
  "buff_matrix_ssr84_level3": {
    "charRu": "Плотти",
    "charEn": "Plotti",
    "suitRu": "Парадоксальность",
    "suitEn": "Paradox",
    "pc": "4p"
  },
  "buff_matrix_ssr84_level4": {
    "charRu": "Плотти",
    "charEn": "Plotti",
    "suitRu": "Парадоксальность",
    "suitEn": "Paradox",
    "pc": "4p"
  },
  "buff_matrix_ssr85_level1": {
    "charRu": "Януо",
    "charEn": "Yanuo",
    "suitRu": "Тысячеликая",
    "suitEn": "A Thousand Faces",
    "pc": "2p"
  },
  "buff_matrix_ssr85": {
    "charRu": "Януо",
    "charEn": "Yanuo",
    "suitRu": "Тысячеликая",
    "suitEn": "A Thousand Faces",
    "pc": "2p"
  },
  "buff_matrix_ssr85_level2": {
    "charRu": "Януо",
    "charEn": "Yanuo",
    "suitRu": "Тысячеликая",
    "suitEn": "A Thousand Faces",
    "pc": "2p"
  },
  "buff_matrix_ssr85_level3": {
    "charRu": "Януо",
    "charEn": "Yanuo",
    "suitRu": "Тысячеликая",
    "suitEn": "A Thousand Faces",
    "pc": "2p"
  },
  "buff_matrix_ssr85_level4": {
    "charRu": "Януо",
    "charEn": "Yanuo",
    "suitRu": "Тысячеликая",
    "suitEn": "A Thousand Faces",
    "pc": "2p"
  },
  "buff_matrix_ssr86_level1": {
    "charRu": "Януо",
    "charEn": "Yanuo",
    "suitRu": "Тысячеликая",
    "suitEn": "A Thousand Faces",
    "pc": "4p"
  },
  "buff_matrix_ssr86": {
    "charRu": "Януо",
    "charEn": "Yanuo",
    "suitRu": "Тысячеликая",
    "suitEn": "A Thousand Faces",
    "pc": "4p"
  },
  "buff_matrix_ssr86_level2": {
    "charRu": "Януо",
    "charEn": "Yanuo",
    "suitRu": "Тысячеликая",
    "suitEn": "A Thousand Faces",
    "pc": "4p"
  },
  "buff_matrix_ssr86_level3": {
    "charRu": "Януо",
    "charEn": "Yanuo",
    "suitRu": "Тысячеликая",
    "suitEn": "A Thousand Faces",
    "pc": "4p"
  },
  "buff_matrix_ssr86_level4": {
    "charRu": "Януо",
    "charEn": "Yanuo",
    "suitRu": "Тысячеликая",
    "suitEn": "A Thousand Faces",
    "pc": "4p"
  },
  "buff_matrix_ssr87_level1": {
    "charRu": "Аска",
    "charEn": "Asuka",
    "suitRu": "Грядущее",
    "suitEn": "Future",
    "pc": "2p"
  },
  "buff_matrix_ssr87": {
    "charRu": "Аска",
    "charEn": "Asuka",
    "suitRu": "Грядущее",
    "suitEn": "Future",
    "pc": "2p"
  },
  "buff_matrix_ssr87_level2": {
    "charRu": "Аска",
    "charEn": "Asuka",
    "suitRu": "Грядущее",
    "suitEn": "Future",
    "pc": "2p"
  },
  "buff_matrix_ssr87_level3": {
    "charRu": "Аска",
    "charEn": "Asuka",
    "suitRu": "Грядущее",
    "suitEn": "Future",
    "pc": "2p"
  },
  "buff_matrix_ssr87_level4": {
    "charRu": "Аска",
    "charEn": "Asuka",
    "suitRu": "Грядущее",
    "suitEn": "Future",
    "pc": "2p"
  },
  "buff_matrix_ssr88_level1": {
    "charRu": "Аска",
    "charEn": "Asuka",
    "suitRu": "Грядущее",
    "suitEn": "Future",
    "pc": "4p"
  },
  "buff_matrix_ssr88": {
    "charRu": "Аска",
    "charEn": "Asuka",
    "suitRu": "Грядущее",
    "suitEn": "Future",
    "pc": "4p"
  },
  "buff_matrix_ssr88_level2": {
    "charRu": "Аска",
    "charEn": "Asuka",
    "suitRu": "Грядущее",
    "suitEn": "Future",
    "pc": "4p"
  },
  "buff_matrix_ssr88_level3": {
    "charRu": "Аска",
    "charEn": "Asuka",
    "suitRu": "Грядущее",
    "suitEn": "Future",
    "pc": "4p"
  },
  "buff_matrix_ssr88_level4": {
    "charRu": "Аска",
    "charEn": "Asuka",
    "suitRu": "Грядущее",
    "suitEn": "Future",
    "pc": "4p"
  },
  "buff_matrix_ssr89_level1": {
    "charRu": "Рэй Аянами",
    "charEn": "Rei",
    "suitRu": "Рефрен Рэй",
    "suitEn": "Rei's Refrain",
    "pc": "2p"
  },
  "buff_matrix_ssr89": {
    "charRu": "Рэй Аянами",
    "charEn": "Rei",
    "suitRu": "Рефрен Рэй",
    "suitEn": "Rei's Refrain",
    "pc": "2p"
  },
  "buff_matrix_ssr89_level2": {
    "charRu": "Рэй Аянами",
    "charEn": "Rei",
    "suitRu": "Рефрен Рэй",
    "suitEn": "Rei's Refrain",
    "pc": "2p"
  },
  "buff_matrix_ssr89_level3": {
    "charRu": "Рэй Аянами",
    "charEn": "Rei",
    "suitRu": "Рефрен Рэй",
    "suitEn": "Rei's Refrain",
    "pc": "2p"
  },
  "buff_matrix_ssr89_level4": {
    "charRu": "Рэй Аянами",
    "charEn": "Rei",
    "suitRu": "Рефрен Рэй",
    "suitEn": "Rei's Refrain",
    "pc": "2p"
  },
  "buff_matrix_ssr90_level1": {
    "charRu": "Рэй Аянами",
    "charEn": "Rei",
    "suitRu": "Рефрен Рэй",
    "suitEn": "Rei's Refrain",
    "pc": "4p"
  },
  "buff_matrix_ssr90": {
    "charRu": "Рэй Аянами",
    "charEn": "Rei",
    "suitRu": "Рефрен Рэй",
    "suitEn": "Rei's Refrain",
    "pc": "4p"
  },
  "buff_matrix_ssr90_level2": {
    "charRu": "Рэй Аянами",
    "charEn": "Rei",
    "suitRu": "Рефрен Рэй",
    "suitEn": "Rei's Refrain",
    "pc": "4p"
  },
  "buff_matrix_ssr90_level3": {
    "charRu": "Рэй Аянами",
    "charEn": "Rei",
    "suitRu": "Рефрен Рэй",
    "suitEn": "Rei's Refrain",
    "pc": "4p"
  },
  "buff_matrix_ssr90_level4": {
    "charRu": "Рэй Аянами",
    "charEn": "Rei",
    "suitRu": "Рефрен Рэй",
    "suitEn": "Rei's Refrain",
    "pc": "4p"
  },
  "buff_matrix_ssr91_level1": {
    "charRu": "Цзи Юй",
    "charEn": "Ji Yu",
    "suitRu": "Проницательность",
    "suitEn": "Profound Insight",
    "pc": "2p"
  },
  "buff_matrix_ssr91": {
    "charRu": "Цзи Юй",
    "charEn": "Ji Yu",
    "suitRu": "Проницательность",
    "suitEn": "Profound Insight",
    "pc": "2p"
  },
  "buff_matrix_ssr91_level2": {
    "charRu": "Цзи Юй",
    "charEn": "Ji Yu",
    "suitRu": "Проницательность",
    "suitEn": "Profound Insight",
    "pc": "2p"
  },
  "buff_matrix_ssr91_level3": {
    "charRu": "Цзи Юй",
    "charEn": "Ji Yu",
    "suitRu": "Проницательность",
    "suitEn": "Profound Insight",
    "pc": "2p"
  },
  "buff_matrix_ssr91_level4": {
    "charRu": "Цзи Юй",
    "charEn": "Ji Yu",
    "suitRu": "Проницательность",
    "suitEn": "Profound Insight",
    "pc": "2p"
  },
  "buff_matrix_ssr92_level1": {
    "charRu": "Цзи Юй",
    "charEn": "Ji Yu",
    "suitRu": "Проницательность",
    "suitEn": "Profound Insight",
    "pc": "4p"
  },
  "buff_matrix_ssr92": {
    "charRu": "Цзи Юй",
    "charEn": "Ji Yu",
    "suitRu": "Проницательность",
    "suitEn": "Profound Insight",
    "pc": "4p"
  },
  "buff_matrix_ssr92_level2": {
    "charRu": "Цзи Юй",
    "charEn": "Ji Yu",
    "suitRu": "Проницательность",
    "suitEn": "Profound Insight",
    "pc": "4p"
  },
  "buff_matrix_ssr92_level3": {
    "charRu": "Цзи Юй",
    "charEn": "Ji Yu",
    "suitRu": "Проницательность",
    "suitEn": "Profound Insight",
    "pc": "4p"
  },
  "buff_matrix_ssr92_level4": {
    "charRu": "Цзи Юй",
    "charEn": "Ji Yu",
    "suitRu": "Проницательность",
    "suitEn": "Profound Insight",
    "pc": "4p"
  },
  "buff_matrix_ssr93_level1": {
    "charRu": "Рослин",
    "charEn": "Roslyn",
    "suitRu": "Неизгладимое воспоминание",
    "suitEn": "Heartetched",
    "pc": "2p"
  },
  "buff_matrix_ssr93": {
    "charRu": "Рослин",
    "charEn": "Roslyn",
    "suitRu": "Неизгладимое воспоминание",
    "suitEn": "Heartetched",
    "pc": "2p"
  },
  "buff_matrix_ssr93_level2": {
    "charRu": "Рослин",
    "charEn": "Roslyn",
    "suitRu": "Неизгладимое воспоминание",
    "suitEn": "Heartetched",
    "pc": "2p"
  },
  "buff_matrix_ssr93_level3": {
    "charRu": "Рослин",
    "charEn": "Roslyn",
    "suitRu": "Неизгладимое воспоминание",
    "suitEn": "Heartetched",
    "pc": "2p"
  },
  "buff_matrix_ssr93_level4": {
    "charRu": "Рослин",
    "charEn": "Roslyn",
    "suitRu": "Неизгладимое воспоминание",
    "suitEn": "Heartetched",
    "pc": "2p"
  },
  "buff_matrix_ssr94_level1": {
    "charRu": "Рослин",
    "charEn": "Roslyn",
    "suitRu": "Неизгладимое воспоминание",
    "suitEn": "Heartetched",
    "pc": "4p"
  },
  "buff_matrix_ssr94": {
    "charRu": "Рослин",
    "charEn": "Roslyn",
    "suitRu": "Неизгладимое воспоминание",
    "suitEn": "Heartetched",
    "pc": "4p"
  },
  "buff_matrix_ssr94_level2": {
    "charRu": "Рослин",
    "charEn": "Roslyn",
    "suitRu": "Неизгладимое воспоминание",
    "suitEn": "Heartetched",
    "pc": "4p"
  },
  "buff_matrix_ssr94_level3": {
    "charRu": "Рослин",
    "charEn": "Roslyn",
    "suitRu": "Неизгладимое воспоминание",
    "suitEn": "Heartetched",
    "pc": "4p"
  },
  "buff_matrix_ssr94_level4": {
    "charRu": "Рослин",
    "charEn": "Roslyn",
    "suitRu": "Неизгладимое воспоминание",
    "suitEn": "Heartetched",
    "pc": "4p"
  },
  "buff_matrix_ssr95_level1": {
    "charRu": "Анка",
    "charEn": "Anka",
    "suitRu": "Среда",
    "suitEn": "Wednesday",
    "pc": "2p"
  },
  "buff_matrix_ssr95": {
    "charRu": "Анка",
    "charEn": "Anka",
    "suitRu": "Среда",
    "suitEn": "Wednesday",
    "pc": "2p"
  },
  "buff_matrix_ssr95_level2": {
    "charRu": "Анка",
    "charEn": "Anka",
    "suitRu": "Среда",
    "suitEn": "Wednesday",
    "pc": "2p"
  },
  "buff_matrix_ssr95_level3": {
    "charRu": "Анка",
    "charEn": "Anka",
    "suitRu": "Среда",
    "suitEn": "Wednesday",
    "pc": "2p"
  },
  "buff_matrix_ssr95_level4": {
    "charRu": "Анка",
    "charEn": "Anka",
    "suitRu": "Среда",
    "suitEn": "Wednesday",
    "pc": "2p"
  },
  "buff_matrix_ssr96_level1": {
    "charRu": "Анка",
    "charEn": "Anka",
    "suitRu": "Среда",
    "suitEn": "Wednesday",
    "pc": "4p"
  },
  "buff_matrix_ssr96": {
    "charRu": "Анка",
    "charEn": "Anka",
    "suitRu": "Среда",
    "suitEn": "Wednesday",
    "pc": "4p"
  },
  "buff_matrix_ssr96_level2": {
    "charRu": "Анка",
    "charEn": "Anka",
    "suitRu": "Среда",
    "suitEn": "Wednesday",
    "pc": "4p"
  },
  "buff_matrix_ssr96_level3": {
    "charRu": "Анка",
    "charEn": "Anka",
    "suitRu": "Среда",
    "suitEn": "Wednesday",
    "pc": "4p"
  },
  "buff_matrix_ssr96_level4": {
    "charRu": "Анка",
    "charEn": "Anka",
    "suitRu": "Среда",
    "suitEn": "Wednesday",
    "pc": "4p"
  },
  "buff_matrix_ssr97_level1": {
    "charRu": "Нола",
    "charEn": "Nola",
    "suitRu": "Сияние ночи",
    "suitEn": "Night's Splendor",
    "pc": "2p"
  },
  "buff_matrix_ssr97": {
    "charRu": "Нола",
    "charEn": "Nola",
    "suitRu": "Сияние ночи",
    "suitEn": "Night's Splendor",
    "pc": "2p"
  },
  "buff_matrix_ssr97_level2": {
    "charRu": "Нола",
    "charEn": "Nola",
    "suitRu": "Сияние ночи",
    "suitEn": "Night's Splendor",
    "pc": "2p"
  },
  "buff_matrix_ssr97_level3": {
    "charRu": "Нола",
    "charEn": "Nola",
    "suitRu": "Сияние ночи",
    "suitEn": "Night's Splendor",
    "pc": "2p"
  },
  "buff_matrix_ssr97_level4": {
    "charRu": "Нола",
    "charEn": "Nola",
    "suitRu": "Сияние ночи",
    "suitEn": "Night's Splendor",
    "pc": "2p"
  },
  "buff_matrix_ssr98_level1": {
    "charRu": "Нола",
    "charEn": "Nola",
    "suitRu": "Сияние ночи",
    "suitEn": "Night's Splendor",
    "pc": "4p"
  },
  "buff_matrix_ssr98": {
    "charRu": "Нола",
    "charEn": "Nola",
    "suitRu": "Сияние ночи",
    "suitEn": "Night's Splendor",
    "pc": "4p"
  },
  "buff_matrix_ssr98_level2": {
    "charRu": "Нола",
    "charEn": "Nola",
    "suitRu": "Сияние ночи",
    "suitEn": "Night's Splendor",
    "pc": "4p"
  },
  "buff_matrix_ssr98_level3": {
    "charRu": "Нола",
    "charEn": "Nola",
    "suitRu": "Сияние ночи",
    "suitEn": "Night's Splendor",
    "pc": "4p"
  },
  "buff_matrix_ssr98_level4": {
    "charRu": "Нола",
    "charEn": "Nola",
    "suitRu": "Сияние ночи",
    "suitEn": "Night's Splendor",
    "pc": "4p"
  },
  "buff_matrix_ssr99_level1": {
    "charRu": "Мерил Железное Сердце",
    "charEn": "Meryl Ironheart",
    "suitRu": "Острие клинка",
    "suitEn": "Blade's Edge",
    "pc": "2p"
  },
  "buff_matrix_ssr99": {
    "charRu": "Мерил Железное Сердце",
    "charEn": "Meryl Ironheart",
    "suitRu": "Острие клинка",
    "suitEn": "Blade's Edge",
    "pc": "2p"
  },
  "buff_matrix_ssr99_level2": {
    "charRu": "Мерил Железное Сердце",
    "charEn": "Meryl Ironheart",
    "suitRu": "Острие клинка",
    "suitEn": "Blade's Edge",
    "pc": "2p"
  },
  "buff_matrix_ssr99_level3": {
    "charRu": "Мерил Железное Сердце",
    "charEn": "Meryl Ironheart",
    "suitRu": "Острие клинка",
    "suitEn": "Blade's Edge",
    "pc": "2p"
  },
  "buff_matrix_ssr99_level4": {
    "charRu": "Мерил Железное Сердце",
    "charEn": "Meryl Ironheart",
    "suitRu": "Острие клинка",
    "suitEn": "Blade's Edge",
    "pc": "2p"
  },
  "buff_matrix_ssr100_level1": {
    "charRu": "Мерил Железное Сердце",
    "charEn": "Meryl Ironheart",
    "suitRu": "Острие клинка",
    "suitEn": "Blade's Edge",
    "pc": "4p"
  },
  "buff_matrix_ssr100": {
    "charRu": "Мерил Железное Сердце",
    "charEn": "Meryl Ironheart",
    "suitRu": "Острие клинка",
    "suitEn": "Blade's Edge",
    "pc": "4p"
  },
  "buff_matrix_ssr100_level2": {
    "charRu": "Мерил Железное Сердце",
    "charEn": "Meryl Ironheart",
    "suitRu": "Острие клинка",
    "suitEn": "Blade's Edge",
    "pc": "4p"
  },
  "buff_matrix_ssr100_level3": {
    "charRu": "Мерил Железное Сердце",
    "charEn": "Meryl Ironheart",
    "suitRu": "Острие клинка",
    "suitEn": "Blade's Edge",
    "pc": "4p"
  },
  "buff_matrix_ssr100_level4": {
    "charRu": "Мерил Железное Сердце",
    "charEn": "Meryl Ironheart",
    "suitRu": "Острие клинка",
    "suitEn": "Blade's Edge",
    "pc": "4p"
  },
  "buff_matrix_ssr9_sea_level1": {
    "charRu": "Кобальт-Би",
    "charEn": "Cobalt-B",
    "suitRu": "Интуитивная тактика",
    "suitEn": "Intuitive Tactic",
    "pc": "2p"
  },
  "buff_matrix_ssr9_sea": {
    "charRu": "Кобальт-Би",
    "charEn": "Cobalt-B",
    "suitRu": "Интуитивная тактика",
    "suitEn": "Intuitive Tactic",
    "pc": "2p"
  },
  "buff_matrix_ssr9_sea_level2": {
    "charRu": "Кобальт-Би",
    "charEn": "Cobalt-B",
    "suitRu": "Интуитивная тактика",
    "suitEn": "Intuitive Tactic",
    "pc": "2p"
  },
  "buff_matrix_ssr9_sea_level3": {
    "charRu": "Кобальт-Би",
    "charEn": "Cobalt-B",
    "suitRu": "Интуитивная тактика",
    "suitEn": "Intuitive Tactic",
    "pc": "2p"
  },
  "buff_matrix_ssr9_sea_level4": {
    "charRu": "Кобальт-Би",
    "charEn": "Cobalt-B",
    "suitRu": "Интуитивная тактика",
    "suitEn": "Intuitive Tactic",
    "pc": "2p"
  },
  "buff_matrix_ssr10_sea_level1": {
    "charRu": "Кобальт-Би",
    "charEn": "Cobalt-B",
    "suitRu": "Интуитивная тактика",
    "suitEn": "Intuitive Tactic",
    "pc": "4p"
  },
  "buff_matrix_ssr10_sea": {
    "charRu": "Кобальт-Би",
    "charEn": "Cobalt-B",
    "suitRu": "Интуитивная тактика",
    "suitEn": "Intuitive Tactic",
    "pc": "4p"
  },
  "buff_matrix_ssr10_sea_level2": {
    "charRu": "Кобальт-Би",
    "charEn": "Cobalt-B",
    "suitRu": "Интуитивная тактика",
    "suitEn": "Intuitive Tactic",
    "pc": "4p"
  },
  "buff_matrix_ssr10_sea_level3": {
    "charRu": "Кобальт-Би",
    "charEn": "Cobalt-B",
    "suitRu": "Интуитивная тактика",
    "suitEn": "Intuitive Tactic",
    "pc": "4p"
  },
  "buff_matrix_ssr10_sea_level4": {
    "charRu": "Кобальт-Би",
    "charEn": "Cobalt-B",
    "suitRu": "Интуитивная тактика",
    "suitEn": "Intuitive Tactic",
    "pc": "4p"
  },
  "buff_matrix_ssr101_level1": {
    "charRu": "Асурада",
    "charEn": "Asurada",
    "suitRu": "Интерпретация",
    "suitEn": "Interpretation",
    "pc": "2p"
  },
  "buff_matrix_ssr101": {
    "charRu": "Асурада",
    "charEn": "Asurada",
    "suitRu": "Интерпретация",
    "suitEn": "Interpretation",
    "pc": "2p"
  },
  "buff_matrix_ssr101_level2": {
    "charRu": "Асурада",
    "charEn": "Asurada",
    "suitRu": "Интерпретация",
    "suitEn": "Interpretation",
    "pc": "2p"
  },
  "buff_matrix_ssr101_level3": {
    "charRu": "Асурада",
    "charEn": "Asurada",
    "suitRu": "Интерпретация",
    "suitEn": "Interpretation",
    "pc": "2p"
  },
  "buff_matrix_ssr101_level4": {
    "charRu": "Асурада",
    "charEn": "Asurada",
    "suitRu": "Интерпретация",
    "suitEn": "Interpretation",
    "pc": "2p"
  },
  "buff_matrix_ssr102_level1": {
    "charRu": "Асурада",
    "charEn": "Asurada",
    "suitRu": "Интерпретация",
    "suitEn": "Interpretation",
    "pc": "4p"
  },
  "buff_matrix_ssr102": {
    "charRu": "Асурада",
    "charEn": "Asurada",
    "suitRu": "Интерпретация",
    "suitEn": "Interpretation",
    "pc": "4p"
  },
  "buff_matrix_ssr102_level2": {
    "charRu": "Асурада",
    "charEn": "Asurada",
    "suitRu": "Интерпретация",
    "suitEn": "Interpretation",
    "pc": "4p"
  },
  "buff_matrix_ssr102_level3": {
    "charRu": "Асурада",
    "charEn": "Asurada",
    "suitRu": "Интерпретация",
    "suitEn": "Interpretation",
    "pc": "4p"
  },
  "buff_matrix_ssr102_level4": {
    "charRu": "Асурада",
    "charEn": "Asurada",
    "suitRu": "Интерпретация",
    "suitEn": "Interpretation",
    "pc": "4p"
  },
  "buff_matrix_ssr103_level1": {
    "charRu": "Серая Лиса",
    "charEn": "Gray Fox",
    "suitRu": "Источник магии",
    "suitEn": "Source of Magic",
    "pc": "2p"
  },
  "buff_matrix_ssr103": {
    "charRu": "Серая Лиса",
    "charEn": "Gray Fox",
    "suitRu": "Источник магии",
    "suitEn": "Source of Magic",
    "pc": "2p"
  },
  "buff_matrix_ssr103_level2": {
    "charRu": "Серая Лиса",
    "charEn": "Gray Fox",
    "suitRu": "Источник магии",
    "suitEn": "Source of Magic",
    "pc": "2p"
  },
  "buff_matrix_ssr103_level3": {
    "charRu": "Серая Лиса",
    "charEn": "Gray Fox",
    "suitRu": "Источник магии",
    "suitEn": "Source of Magic",
    "pc": "2p"
  },
  "buff_matrix_ssr103_level4": {
    "charRu": "Серая Лиса",
    "charEn": "Gray Fox",
    "suitRu": "Источник магии",
    "suitEn": "Source of Magic",
    "pc": "2p"
  },
  "buff_matrix_ssr104_level1": {
    "charRu": "Серая Лиса",
    "charEn": "Gray Fox",
    "suitRu": "Источник магии",
    "suitEn": "Source of Magic",
    "pc": "4p"
  },
  "buff_matrix_ssr104": {
    "charRu": "Серая Лиса",
    "charEn": "Gray Fox",
    "suitRu": "Источник магии",
    "suitEn": "Source of Magic",
    "pc": "4p"
  },
  "buff_matrix_ssr104_level2": {
    "charRu": "Серая Лиса",
    "charEn": "Gray Fox",
    "suitRu": "Источник магии",
    "suitEn": "Source of Magic",
    "pc": "4p"
  },
  "buff_matrix_ssr104_level3": {
    "charRu": "Серая Лиса",
    "charEn": "Gray Fox",
    "suitRu": "Источник магии",
    "suitEn": "Source of Magic",
    "pc": "4p"
  },
  "buff_matrix_ssr104_level4": {
    "charRu": "Серая Лиса",
    "charEn": "Gray Fox",
    "suitRu": "Источник магии",
    "suitEn": "Source of Magic",
    "pc": "4p"
  },
  "buff_matrix_ssr105_level1": {
    "charRu": "Клаудия Око Грозы",
    "charEn": "Claudia Storm Eye",
    "suitRu": "Огненный лотос",
    "suitEn": "Blazing Lotus",
    "pc": "2p"
  },
  "buff_matrix_ssr105": {
    "charRu": "Клаудия Око Грозы",
    "charEn": "Claudia Storm Eye",
    "suitRu": "Огненный лотос",
    "suitEn": "Blazing Lotus",
    "pc": "2p"
  },
  "buff_matrix_ssr105_level2": {
    "charRu": "Клаудия Око Грозы",
    "charEn": "Claudia Storm Eye",
    "suitRu": "Огненный лотос",
    "suitEn": "Blazing Lotus",
    "pc": "2p"
  },
  "buff_matrix_ssr105_level3": {
    "charRu": "Клаудия Око Грозы",
    "charEn": "Claudia Storm Eye",
    "suitRu": "Огненный лотос",
    "suitEn": "Blazing Lotus",
    "pc": "2p"
  },
  "buff_matrix_ssr105_level4": {
    "charRu": "Клаудия Око Грозы",
    "charEn": "Claudia Storm Eye",
    "suitRu": "Огненный лотос",
    "suitEn": "Blazing Lotus",
    "pc": "2p"
  },
  "buff_matrix_ssr106_level1": {
    "charRu": "Клаудия Око Грозы",
    "charEn": "Claudia Storm Eye",
    "suitRu": "Огненный лотос",
    "suitEn": "Blazing Lotus",
    "pc": "4p"
  },
  "buff_matrix_ssr106": {
    "charRu": "Клаудия Око Грозы",
    "charEn": "Claudia Storm Eye",
    "suitRu": "Огненный лотос",
    "suitEn": "Blazing Lotus",
    "pc": "4p"
  },
  "buff_matrix_ssr106_level2": {
    "charRu": "Клаудия Око Грозы",
    "charEn": "Claudia Storm Eye",
    "suitRu": "Огненный лотос",
    "suitEn": "Blazing Lotus",
    "pc": "4p"
  },
  "buff_matrix_ssr106_level3": {
    "charRu": "Клаудия Око Грозы",
    "charEn": "Claudia Storm Eye",
    "suitRu": "Огненный лотос",
    "suitEn": "Blazing Lotus",
    "pc": "4p"
  },
  "buff_matrix_ssr106_level4": {
    "charRu": "Клаудия Око Грозы",
    "charEn": "Claudia Storm Eye",
    "suitRu": "Огненный лотос",
    "suitEn": "Blazing Lotus",
    "pc": "4p"
  },
  "buff_matrix_ssr107_level1": {
    "charRu": "Немезида: Жало Пустоты",
    "charEn": "Nemesis Voidpiercer",
    "suitRu": "Сердце человечества",
    "suitEn": "Heart of Humanity",
    "pc": "2p"
  },
  "buff_matrix_ssr107": {
    "charRu": "Немезида: Жало Пустоты",
    "charEn": "Nemesis Voidpiercer",
    "suitRu": "Сердце человечества",
    "suitEn": "Heart of Humanity",
    "pc": "2p"
  },
  "buff_matrix_ssr107_level2": {
    "charRu": "Немезида: Жало Пустоты",
    "charEn": "Nemesis Voidpiercer",
    "suitRu": "Сердце человечества",
    "suitEn": "Heart of Humanity",
    "pc": "2p"
  },
  "buff_matrix_ssr107_level3": {
    "charRu": "Немезида: Жало Пустоты",
    "charEn": "Nemesis Voidpiercer",
    "suitRu": "Сердце человечества",
    "suitEn": "Heart of Humanity",
    "pc": "2p"
  },
  "buff_matrix_ssr107_level4": {
    "charRu": "Немезида: Жало Пустоты",
    "charEn": "Nemesis Voidpiercer",
    "suitRu": "Сердце человечества",
    "suitEn": "Heart of Humanity",
    "pc": "2p"
  },
  "buff_matrix_ssr108_level1": {
    "charRu": "Немезида: Жало Пустоты",
    "charEn": "Nemesis Voidpiercer",
    "suitRu": "Сердце человечества",
    "suitEn": "Heart of Humanity",
    "pc": "4p"
  },
  "buff_matrix_ssr108": {
    "charRu": "Немезида: Жало Пустоты",
    "charEn": "Nemesis Voidpiercer",
    "suitRu": "Сердце человечества",
    "suitEn": "Heart of Humanity",
    "pc": "4p"
  },
  "buff_matrix_ssr108_level2": {
    "charRu": "Немезида: Жало Пустоты",
    "charEn": "Nemesis Voidpiercer",
    "suitRu": "Сердце человечества",
    "suitEn": "Heart of Humanity",
    "pc": "4p"
  },
  "buff_matrix_ssr108_level3": {
    "charRu": "Немезида: Жало Пустоты",
    "charEn": "Nemesis Voidpiercer",
    "suitRu": "Сердце человечества",
    "suitEn": "Heart of Humanity",
    "pc": "4p"
  },
  "buff_matrix_ssr108_level4": {
    "charRu": "Немезида: Жало Пустоты",
    "charEn": "Nemesis Voidpiercer",
    "suitRu": "Сердце человечества",
    "suitEn": "Heart of Humanity",
    "pc": "4p"
  },
  "buff_matrix_ssr109_level1": {
    "charRu": "Антория",
    "charEn": "Antoria",
    "suitRu": "Часовой",
    "suitEn": "Watchman",
    "pc": "2p"
  },
  "buff_matrix_ssr109": {
    "charRu": "Антория",
    "charEn": "Antoria",
    "suitRu": "Часовой",
    "suitEn": "Watchman",
    "pc": "2p"
  },
  "buff_matrix_ssr109_level2": {
    "charRu": "Антория",
    "charEn": "Antoria",
    "suitRu": "Часовой",
    "suitEn": "Watchman",
    "pc": "2p"
  },
  "buff_matrix_ssr109_level3": {
    "charRu": "Антория",
    "charEn": "Antoria",
    "suitRu": "Часовой",
    "suitEn": "Watchman",
    "pc": "2p"
  },
  "buff_matrix_ssr109_level4": {
    "charRu": "Антория",
    "charEn": "Antoria",
    "suitRu": "Часовой",
    "suitEn": "Watchman",
    "pc": "2p"
  },
  "buff_matrix_ssr110_level1": {
    "charRu": "Антория",
    "charEn": "Antoria",
    "suitRu": "Часовой",
    "suitEn": "Watchman",
    "pc": "4p"
  },
  "buff_matrix_ssr110": {
    "charRu": "Антория",
    "charEn": "Antoria",
    "suitRu": "Часовой",
    "suitEn": "Watchman",
    "pc": "4p"
  },
  "buff_matrix_ssr110_level2": {
    "charRu": "Антория",
    "charEn": "Antoria",
    "suitRu": "Часовой",
    "suitEn": "Watchman",
    "pc": "4p"
  },
  "buff_matrix_ssr110_level3": {
    "charRu": "Антория",
    "charEn": "Antoria",
    "suitRu": "Часовой",
    "suitEn": "Watchman",
    "pc": "4p"
  },
  "buff_matrix_ssr110_level4": {
    "charRu": "Антория",
    "charEn": "Antoria",
    "suitRu": "Часовой",
    "suitEn": "Watchman",
    "pc": "4p"
  },
  "buff_matrix_ssr111_level1": {
    "charRu": "Морковка",
    "charEn": "Carrot",
    "suitRu": "Нежданная гостья",
    "suitEn": "Unexpected Guest",
    "pc": "2p"
  },
  "buff_matrix_ssr111": {
    "charRu": "Морковка",
    "charEn": "Carrot",
    "suitRu": "Нежданная гостья",
    "suitEn": "Unexpected Guest",
    "pc": "2p"
  },
  "buff_matrix_ssr111_level2": {
    "charRu": "Морковка",
    "charEn": "Carrot",
    "suitRu": "Нежданная гостья",
    "suitEn": "Unexpected Guest",
    "pc": "2p"
  },
  "buff_matrix_ssr111_level3": {
    "charRu": "Морковка",
    "charEn": "Carrot",
    "suitRu": "Нежданная гостья",
    "suitEn": "Unexpected Guest",
    "pc": "2p"
  },
  "buff_matrix_ssr111_level4": {
    "charRu": "Морковка",
    "charEn": "Carrot",
    "suitRu": "Нежданная гостья",
    "suitEn": "Unexpected Guest",
    "pc": "2p"
  },
  "buff_matrix_ssr112_level1": {
    "charRu": "Морковка",
    "charEn": "Carrot",
    "suitRu": "Нежданная гостья",
    "suitEn": "Unexpected Guest",
    "pc": "4p"
  },
  "buff_matrix_ssr112": {
    "charRu": "Морковка",
    "charEn": "Carrot",
    "suitRu": "Нежданная гостья",
    "suitEn": "Unexpected Guest",
    "pc": "4p"
  },
  "buff_matrix_ssr112_level2": {
    "charRu": "Морковка",
    "charEn": "Carrot",
    "suitRu": "Нежданная гостья",
    "suitEn": "Unexpected Guest",
    "pc": "4p"
  },
  "buff_matrix_ssr112_level3": {
    "charRu": "Морковка",
    "charEn": "Carrot",
    "suitRu": "Нежданная гостья",
    "suitEn": "Unexpected Guest",
    "pc": "4p"
  },
  "buff_matrix_ssr112_level4": {
    "charRu": "Морковка",
    "charEn": "Carrot",
    "suitRu": "Нежданная гостья",
    "suitEn": "Unexpected Guest",
    "pc": "4p"
  },
  "buff_matrix113_iceatkup_level1": {
    "charRu": "Линсис",
    "charEn": "Lyncis",
    "suitRu": "Новое шоу",
    "suitEn": "New Show",
    "pc": "2p"
  },
  "buff_matrix113_iceatkup": {
    "charRu": "Линсис",
    "charEn": "Lyncis",
    "suitRu": "Новое шоу",
    "suitEn": "New Show",
    "pc": "2p"
  },
  "buff_matrix113_iceatkup_level2": {
    "charRu": "Линсис",
    "charEn": "Lyncis",
    "suitRu": "Новое шоу",
    "suitEn": "New Show",
    "pc": "2p"
  },
  "buff_matrix113_iceatkup_level3": {
    "charRu": "Линсис",
    "charEn": "Lyncis",
    "suitRu": "Новое шоу",
    "suitEn": "New Show",
    "pc": "2p"
  },
  "buff_matrix113_iceatkup_level4": {
    "charRu": "Линсис",
    "charEn": "Lyncis",
    "suitRu": "Новое шоу",
    "suitEn": "New Show",
    "pc": "2p"
  },
  "buff_matrix114_icedmgup_level1": {
    "charRu": "Линсис",
    "charEn": "Lyncis",
    "suitRu": "Новое шоу",
    "suitEn": "New Show",
    "pc": "4p"
  },
  "buff_matrix114_icedmgup": {
    "charRu": "Линсис",
    "charEn": "Lyncis",
    "suitRu": "Новое шоу",
    "suitEn": "New Show",
    "pc": "4p"
  },
  "buff_matrix114_icedmgup_level2": {
    "charRu": "Линсис",
    "charEn": "Lyncis",
    "suitRu": "Новое шоу",
    "suitEn": "New Show",
    "pc": "4p"
  },
  "buff_matrix114_icedmgup_level3": {
    "charRu": "Линсис",
    "charEn": "Lyncis",
    "suitRu": "Новое шоу",
    "suitEn": "New Show",
    "pc": "4p"
  },
  "buff_matrix114_icedmgup_level4": {
    "charRu": "Линсис",
    "charEn": "Lyncis",
    "suitRu": "Новое шоу",
    "suitEn": "New Show",
    "pc": "4p"
  },
  "buff_matrix_ssr115_level1": {
    "charRu": "Астер",
    "charEn": "Aster",
    "suitRu": "Ария туманности",
    "suitEn": "Nebula Aria",
    "pc": "2p"
  },
  "buff_matrix_ssr115": {
    "charRu": "Астер",
    "charEn": "Aster",
    "suitRu": "Ария туманности",
    "suitEn": "Nebula Aria",
    "pc": "2p"
  },
  "buff_matrix_ssr115_level2": {
    "charRu": "Астер",
    "charEn": "Aster",
    "suitRu": "Ария туманности",
    "suitEn": "Nebula Aria",
    "pc": "2p"
  },
  "buff_matrix_ssr115_level3": {
    "charRu": "Астер",
    "charEn": "Aster",
    "suitRu": "Ария туманности",
    "suitEn": "Nebula Aria",
    "pc": "2p"
  },
  "buff_matrix_ssr115_level4": {
    "charRu": "Астер",
    "charEn": "Aster",
    "suitRu": "Ария туманности",
    "suitEn": "Nebula Aria",
    "pc": "2p"
  },
  "buff_matrix_ssr116_level1": {
    "charRu": "Астер",
    "charEn": "Aster",
    "suitRu": "Ария туманности",
    "suitEn": "Nebula Aria",
    "pc": "4p"
  },
  "buff_matrix_ssr116": {
    "charRu": "Астер",
    "charEn": "Aster",
    "suitRu": "Ария туманности",
    "suitEn": "Nebula Aria",
    "pc": "4p"
  },
  "buff_matrix_ssr116_level2": {
    "charRu": "Астер",
    "charEn": "Aster",
    "suitRu": "Ария туманности",
    "suitEn": "Nebula Aria",
    "pc": "4p"
  },
  "buff_matrix_ssr116_level3": {
    "charRu": "Астер",
    "charEn": "Aster",
    "suitRu": "Ария туманности",
    "suitEn": "Nebula Aria",
    "pc": "4p"
  },
  "buff_matrix_ssr116_level4": {
    "charRu": "Астер",
    "charEn": "Aster",
    "suitRu": "Ария туманности",
    "suitEn": "Nebula Aria",
    "pc": "4p"
  },
  "buff_matrix_ssr117_level1": {
    "charRu": "Хиппер",
    "charEn": "Hipper",
    "suitRu": "Звездное будущее",
    "suitEn": "Starlit Future",
    "pc": "2p"
  },
  "buff_matrix_ssr117": {
    "charRu": "Хиппер",
    "charEn": "Hipper",
    "suitRu": "Звездное будущее",
    "suitEn": "Starlit Future",
    "pc": "2p"
  },
  "buff_matrix_ssr117_level2": {
    "charRu": "Хиппер",
    "charEn": "Hipper",
    "suitRu": "Звездное будущее",
    "suitEn": "Starlit Future",
    "pc": "2p"
  },
  "buff_matrix_ssr117_level3": {
    "charRu": "Хиппер",
    "charEn": "Hipper",
    "suitRu": "Звездное будущее",
    "suitEn": "Starlit Future",
    "pc": "2p"
  },
  "buff_matrix_ssr117_level4": {
    "charRu": "Хиппер",
    "charEn": "Hipper",
    "suitRu": "Звездное будущее",
    "suitEn": "Starlit Future",
    "pc": "2p"
  },
  "buff_matrix_ssr118_level1": {
    "charRu": "Хиппер",
    "charEn": "Hipper",
    "suitRu": "Звездное будущее",
    "suitEn": "Starlit Future",
    "pc": "4p"
  },
  "buff_matrix_ssr118": {
    "charRu": "Хиппер",
    "charEn": "Hipper",
    "suitRu": "Звездное будущее",
    "suitEn": "Starlit Future",
    "pc": "4p"
  },
  "buff_matrix_ssr118_level2": {
    "charRu": "Хиппер",
    "charEn": "Hipper",
    "suitRu": "Звездное будущее",
    "suitEn": "Starlit Future",
    "pc": "4p"
  },
  "buff_matrix_ssr118_level3": {
    "charRu": "Хиппер",
    "charEn": "Hipper",
    "suitRu": "Звездное будущее",
    "suitEn": "Starlit Future",
    "pc": "4p"
  },
  "buff_matrix_ssr118_level4": {
    "charRu": "Хиппер",
    "charEn": "Hipper",
    "suitRu": "Звездное будущее",
    "suitEn": "Starlit Future",
    "pc": "4p"
  },
  "buff_matrix119_level1": {
    "charRu": "Лехезис",
    "charEn": "Lechesis",
    "suitRu": "Фуга жизни",
    "suitEn": "Life Fugue",
    "pc": "2p"
  },
  "buff_matrix119": {
    "charRu": "Лехезис",
    "charEn": "Lechesis",
    "suitRu": "Фуга жизни",
    "suitEn": "Life Fugue",
    "pc": "2p"
  },
  "buff_matrix119_level2": {
    "charRu": "Лехезис",
    "charEn": "Lechesis",
    "suitRu": "Фуга жизни",
    "suitEn": "Life Fugue",
    "pc": "2p"
  },
  "buff_matrix119_level3": {
    "charRu": "Лехезис",
    "charEn": "Lechesis",
    "suitRu": "Фуга жизни",
    "suitEn": "Life Fugue",
    "pc": "2p"
  },
  "buff_matrix119_level4": {
    "charRu": "Лехезис",
    "charEn": "Lechesis",
    "suitRu": "Фуга жизни",
    "suitEn": "Life Fugue",
    "pc": "2p"
  },
  "buff_matrix120_level1": {
    "charRu": "Лехезис",
    "charEn": "Lechesis",
    "suitRu": "Фуга жизни",
    "suitEn": "Life Fugue",
    "pc": "4p"
  },
  "buff_matrix120": {
    "charRu": "Лехезис",
    "charEn": "Lechesis",
    "suitRu": "Фуга жизни",
    "suitEn": "Life Fugue",
    "pc": "4p"
  },
  "buff_matrix120_level2": {
    "charRu": "Лехезис",
    "charEn": "Lechesis",
    "suitRu": "Фуга жизни",
    "suitEn": "Life Fugue",
    "pc": "4p"
  },
  "buff_matrix120_level3": {
    "charRu": "Лехезис",
    "charEn": "Lechesis",
    "suitRu": "Фуга жизни",
    "suitEn": "Life Fugue",
    "pc": "4p"
  },
  "buff_matrix120_level4": {
    "charRu": "Лехезис",
    "charEn": "Lechesis",
    "suitRu": "Фуга жизни",
    "suitEn": "Life Fugue",
    "pc": "4p"
  },
  "buff_matrix_ssr_6_level1": {
    "charRu": "Клаудия",
    "charEn": "Claudia",
    "suitRu": "Всесторонний удар",
    "suitEn": "Multi-directional Strike",
    "pc": "2p"
  },
  "buff_matrix_ssr_6": {
    "charRu": "Клаудия",
    "charEn": "Claudia",
    "suitRu": "Всесторонний удар",
    "suitEn": "Multi-directional Strike",
    "pc": "2p"
  },
  "buff_matrix_ssr_6_level2": {
    "charRu": "Клаудия",
    "charEn": "Claudia",
    "suitRu": "Всесторонний удар",
    "suitEn": "Multi-directional Strike",
    "pc": "2p"
  },
  "buff_matrix_ssr_6_level3": {
    "charRu": "Клаудия",
    "charEn": "Claudia",
    "suitRu": "Всесторонний удар",
    "suitEn": "Multi-directional Strike",
    "pc": "2p"
  },
  "buff_matrix_ssr_6_level4": {
    "charRu": "Клаудия",
    "charEn": "Claudia",
    "suitRu": "Всесторонний удар",
    "suitEn": "Multi-directional Strike",
    "pc": "2p"
  },
  "buff_matrix_ssr_5_level1_os": {
    "charRu": "Клаудия",
    "charEn": "Claudia",
    "suitRu": "Всесторонний удар",
    "suitEn": "Multi-directional Strike",
    "pc": "4p"
  },
  "buff_matrix_ssr_5": {
    "charRu": "Клаудия",
    "charEn": "Claudia",
    "suitRu": "Всесторонний удар",
    "suitEn": "Multi-directional Strike",
    "pc": "4p"
  },
  "buff_matrix_ssr_5_level2_os": {
    "charRu": "Клаудия",
    "charEn": "Claudia",
    "suitRu": "Всесторонний удар",
    "suitEn": "Multi-directional Strike",
    "pc": "4p"
  },
  "buff_matrix_ssr_5_level3_os": {
    "charRu": "Клаудия",
    "charEn": "Claudia",
    "suitRu": "Всесторонний удар",
    "suitEn": "Multi-directional Strike",
    "pc": "4p"
  },
  "buff_matrix_ssr_5_level4_os": {
    "charRu": "Клаудия",
    "charEn": "Claudia",
    "suitRu": "Всесторонний удар",
    "suitEn": "Multi-directional Strike",
    "pc": "4p"
  },
  "buff_matrix121_lv1": {
    "charRu": "Элен",
    "charEn": "Helene",
    "suitRu": "Бесконечный шепот",
    "suitEn": "Endless Whispers",
    "pc": "2p"
  },
  "buff_matrix121_lv2": {
    "charRu": "Элен",
    "charEn": "Helene",
    "suitRu": "Бесконечный шепот",
    "suitEn": "Endless Whispers",
    "pc": "2p"
  },
  "buff_matrix121_lv3": {
    "charRu": "Элен",
    "charEn": "Helene",
    "suitRu": "Бесконечный шепот",
    "suitEn": "Endless Whispers",
    "pc": "2p"
  },
  "buff_matrix121_lv4": {
    "charRu": "Элен",
    "charEn": "Helene",
    "suitRu": "Бесконечный шепот",
    "suitEn": "Endless Whispers",
    "pc": "2p"
  },
  "buff_matrix122_lv1": {
    "charRu": "Элен",
    "charEn": "Helene",
    "suitRu": "Бесконечный шепот",
    "suitEn": "Endless Whispers",
    "pc": "4p"
  },
  "buff_matrix122_lv2": {
    "charRu": "Элен",
    "charEn": "Helene",
    "suitRu": "Бесконечный шепот",
    "suitEn": "Endless Whispers",
    "pc": "4p"
  },
  "buff_matrix122_lv3": {
    "charRu": "Элен",
    "charEn": "Helene",
    "suitRu": "Бесконечный шепот",
    "suitEn": "Endless Whispers",
    "pc": "4p"
  },
  "buff_matrix122_lv4": {
    "charRu": "Элен",
    "charEn": "Helene",
    "suitRu": "Бесконечный шепот",
    "suitEn": "Endless Whispers",
    "pc": "4p"
  },
  "buff_matrix123_lv1": {
    "charRu": "Нанто",
    "charEn": "Nanto",
    "suitRu": "Межеход",
    "suitEn": "Edgewalker",
    "pc": "2p"
  },
  "buff_matrix123_lv2": {
    "charRu": "Нанто",
    "charEn": "Nanto",
    "suitRu": "Межеход",
    "suitEn": "Edgewalker",
    "pc": "2p"
  },
  "buff_matrix123_lv3": {
    "charRu": "Нанто",
    "charEn": "Nanto",
    "suitRu": "Межеход",
    "suitEn": "Edgewalker",
    "pc": "2p"
  },
  "buff_matrix123_lv4": {
    "charRu": "Нанто",
    "charEn": "Nanto",
    "suitRu": "Межеход",
    "suitEn": "Edgewalker",
    "pc": "2p"
  },
  "buff_matrix_ssr124_level1": {
    "charRu": "Нанто",
    "charEn": "Nanto",
    "suitRu": "Межеход",
    "suitEn": "Edgewalker",
    "pc": "4p"
  },
  "buff_matrix_ssr124": {
    "charRu": "Нанто",
    "charEn": "Nanto",
    "suitRu": "Межеход",
    "suitEn": "Edgewalker",
    "pc": "4p"
  },
  "buff_matrix_ssr124_level2": {
    "charRu": "Нанто",
    "charEn": "Nanto",
    "suitRu": "Межеход",
    "suitEn": "Edgewalker",
    "pc": "4p"
  },
  "buff_matrix_ssr124_level3": {
    "charRu": "Нанто",
    "charEn": "Nanto",
    "suitRu": "Межеход",
    "suitEn": "Edgewalker",
    "pc": "4p"
  },
  "buff_matrix_ssr124_level4": {
    "charRu": "Нанто",
    "charEn": "Nanto",
    "suitRu": "Межеход",
    "suitEn": "Edgewalker",
    "pc": "4p"
  },
  "buff_matrix125_level1": {
    "charRu": "Veronika",
    "charEn": "Veronika",
    "suitRu": "Преклонение",
    "suitEn": "Kneel Before",
    "pc": "2p"
  },
  "buff_matrix125": {
    "charRu": "Veronika",
    "charEn": "Veronika",
    "suitRu": "Преклонение",
    "suitEn": "Kneel Before",
    "pc": "2p"
  },
  "buff_matrix125_level2": {
    "charRu": "Veronika",
    "charEn": "Veronika",
    "suitRu": "Преклонение",
    "suitEn": "Kneel Before",
    "pc": "2p"
  },
  "buff_matrix125_level3": {
    "charRu": "Veronika",
    "charEn": "Veronika",
    "suitRu": "Преклонение",
    "suitEn": "Kneel Before",
    "pc": "2p"
  },
  "buff_matrix125_level4": {
    "charRu": "Veronika",
    "charEn": "Veronika",
    "suitRu": "Преклонение",
    "suitEn": "Kneel Before",
    "pc": "2p"
  },
  "buff_matrix126_level1": {
    "charRu": "Veronika",
    "charEn": "Veronika",
    "suitRu": "Преклонение",
    "suitEn": "Kneel Before",
    "pc": "4p"
  },
  "buff_matrix126": {
    "charRu": "Veronika",
    "charEn": "Veronika",
    "suitRu": "Преклонение",
    "suitEn": "Kneel Before",
    "pc": "4p"
  },
  "buff_matrix126_level2": {
    "charRu": "Veronika",
    "charEn": "Veronika",
    "suitRu": "Преклонение",
    "suitEn": "Kneel Before",
    "pc": "4p"
  },
  "buff_matrix126_level3": {
    "charRu": "Veronika",
    "charEn": "Veronika",
    "suitRu": "Преклонение",
    "suitEn": "Kneel Before",
    "pc": "4p"
  },
  "buff_matrix126_level4": {
    "charRu": "Veronika",
    "charEn": "Veronika",
    "suitRu": "Преклонение",
    "suitEn": "Kneel Before",
    "pc": "4p"
  },
  "buff_matrix127_lv1": {
    "charRu": "Лана",
    "charEn": "Lana",
    "suitRu": "Бесконечность",
    "suitEn": "Endless",
    "pc": "2p"
  },
  "buff_matrix127_lv2": {
    "charRu": "Лана",
    "charEn": "Lana",
    "suitRu": "Бесконечность",
    "suitEn": "Endless",
    "pc": "2p"
  },
  "buff_matrix127_lv3": {
    "charRu": "Лана",
    "charEn": "Lana",
    "suitRu": "Бесконечность",
    "suitEn": "Endless",
    "pc": "2p"
  },
  "buff_matrix127_lv4": {
    "charRu": "Лана",
    "charEn": "Lana",
    "suitRu": "Бесконечность",
    "suitEn": "Endless",
    "pc": "2p"
  },
  "buff_matrix128_lv1": {
    "charRu": "Лана",
    "charEn": "Lana",
    "suitRu": "Бесконечность",
    "suitEn": "Endless",
    "pc": "4p"
  },
  "buff_matrix128_lv2": {
    "charRu": "Лана",
    "charEn": "Lana",
    "suitRu": "Бесконечность",
    "suitEn": "Endless",
    "pc": "4p"
  },
  "buff_matrix128_lv3": {
    "charRu": "Лана",
    "charEn": "Lana",
    "suitRu": "Бесконечность",
    "suitEn": "Endless",
    "pc": "4p"
  },
  "buff_matrix128_lv4": {
    "charRu": "Лана",
    "charEn": "Lana",
    "suitRu": "Бесконечность",
    "suitEn": "Endless",
    "pc": "4p"
  },
  "buff_matrix129_salidy_lv1": {
    "charRu": "Салиди",
    "charEn": "Salidy",
    "suitRu": "Гибельный восторг",
    "suitEn": "Deadly Rapture",
    "pc": "2p"
  },
  "buff_matrix129_salidy_lv2": {
    "charRu": "Салиди",
    "charEn": "Salidy",
    "suitRu": "Гибельный восторг",
    "suitEn": "Deadly Rapture",
    "pc": "2p"
  },
  "buff_matrix129_salidy_lv3": {
    "charRu": "Салиди",
    "charEn": "Salidy",
    "suitRu": "Гибельный восторг",
    "suitEn": "Deadly Rapture",
    "pc": "2p"
  },
  "buff_matrix129_salidy_lv4": {
    "charRu": "Салиди",
    "charEn": "Salidy",
    "suitRu": "Гибельный восторг",
    "suitEn": "Deadly Rapture",
    "pc": "2p"
  },
  "buff_matrix130_salidy_lv1": {
    "charRu": "Салиди",
    "charEn": "Salidy",
    "suitRu": "Гибельный восторг",
    "suitEn": "Deadly Rapture",
    "pc": "4p"
  },
  "buff_matrix130_salidy_lv2": {
    "charRu": "Салиди",
    "charEn": "Salidy",
    "suitRu": "Гибельный восторг",
    "suitEn": "Deadly Rapture",
    "pc": "4p"
  },
  "buff_matrix130_salidy_lv3": {
    "charRu": "Салиди",
    "charEn": "Salidy",
    "suitRu": "Гибельный восторг",
    "suitEn": "Deadly Rapture",
    "pc": "4p"
  },
  "buff_matrix130_salidy_lv4": {
    "charRu": "Салиди",
    "charEn": "Salidy",
    "suitRu": "Гибельный восторг",
    "suitEn": "Deadly Rapture",
    "pc": "4p"
  },
  "buff_matrix131_lv1": {
    "charRu": "Agleia",
    "charEn": "Agleia",
    "suitRu": "Магия Марвел",
    "suitEn": "Marvel Magic",
    "pc": "2p"
  },
  "buff_matrix131_lv2": {
    "charRu": "Agleia",
    "charEn": "Agleia",
    "suitRu": "Магия Марвел",
    "suitEn": "Marvel Magic",
    "pc": "2p"
  },
  "buff_matrix131_lv3": {
    "charRu": "Agleia",
    "charEn": "Agleia",
    "suitRu": "Магия Марвел",
    "suitEn": "Marvel Magic",
    "pc": "2p"
  },
  "buff_matrix131_lv4": {
    "charRu": "Agleia",
    "charEn": "Agleia",
    "suitRu": "Магия Марвел",
    "suitEn": "Marvel Magic",
    "pc": "2p"
  },
  "buff_matrix_ssr132_level1": {
    "charRu": "Agleia",
    "charEn": "Agleia",
    "suitRu": "Магия Марвел",
    "suitEn": "Marvel Magic",
    "pc": "4p"
  },
  "buff_matrix_ssr132": {
    "charRu": "Agleia",
    "charEn": "Agleia",
    "suitRu": "Магия Марвел",
    "suitEn": "Marvel Magic",
    "pc": "4p"
  },
  "buff_matrix_ssr132_level2": {
    "charRu": "Agleia",
    "charEn": "Agleia",
    "suitRu": "Магия Марвел",
    "suitEn": "Marvel Magic",
    "pc": "4p"
  },
  "buff_matrix_ssr132_level3": {
    "charRu": "Agleia",
    "charEn": "Agleia",
    "suitRu": "Магия Марвел",
    "suitEn": "Marvel Magic",
    "pc": "4p"
  },
  "buff_matrix_ssr132_level4": {
    "charRu": "Agleia",
    "charEn": "Agleia",
    "suitRu": "Магия Марвел",
    "suitEn": "Marvel Magic",
    "pc": "4p"
  },
  "buff_matrix133_berry_level1": {
    "charRu": "Berry",
    "charEn": "Berry",
    "suitRu": "Естественная воля",
    "suitEn": "Natural Will",
    "pc": "2p"
  },
  "buff_matrix133_berry": {
    "charRu": "Berry",
    "charEn": "Berry",
    "suitRu": "Естественная воля",
    "suitEn": "Natural Will",
    "pc": "2p"
  },
  "buff_matrix133_berry_level2": {
    "charRu": "Berry",
    "charEn": "Berry",
    "suitRu": "Естественная воля",
    "suitEn": "Natural Will",
    "pc": "2p"
  },
  "buff_matrix133_berry_level3": {
    "charRu": "Berry",
    "charEn": "Berry",
    "suitRu": "Естественная воля",
    "suitEn": "Natural Will",
    "pc": "2p"
  },
  "buff_matrix133_berry_level4": {
    "charRu": "Berry",
    "charEn": "Berry",
    "suitRu": "Естественная воля",
    "suitEn": "Natural Will",
    "pc": "2p"
  },
  "buff_matrix134_berry_level1": {
    "charRu": "Berry",
    "charEn": "Berry",
    "suitRu": "Естественная воля",
    "suitEn": "Natural Will",
    "pc": "4p"
  },
  "buff_matrix134_berry": {
    "charRu": "Berry",
    "charEn": "Berry",
    "suitRu": "Естественная воля",
    "suitEn": "Natural Will",
    "pc": "4p"
  },
  "buff_matrix134_berry_level2": {
    "charRu": "Berry",
    "charEn": "Berry",
    "suitRu": "Естественная воля",
    "suitEn": "Natural Will",
    "pc": "4p"
  },
  "buff_matrix134_berry_level3": {
    "charRu": "Berry",
    "charEn": "Berry",
    "suitRu": "Естественная воля",
    "suitEn": "Natural Will",
    "pc": "4p"
  },
  "buff_matrix134_berry_level4": {
    "charRu": "Berry",
    "charEn": "Berry",
    "suitRu": "Естественная воля",
    "suitEn": "Natural Will",
    "pc": "4p"
  },
  "buff_matrix135_violin_level1": {
    "charRu": "Harmopheus",
    "charEn": "Harmopheus",
    "suitRu": "Романтическая соната",
    "suitEn": "Romance Sonata",
    "pc": "2p"
  },
  "buff_matrix135_violin": {
    "charRu": "Harmopheus",
    "charEn": "Harmopheus",
    "suitRu": "Романтическая соната",
    "suitEn": "Romance Sonata",
    "pc": "2p"
  },
  "buff_matrix135_violin_level2": {
    "charRu": "Harmopheus",
    "charEn": "Harmopheus",
    "suitRu": "Романтическая соната",
    "suitEn": "Romance Sonata",
    "pc": "2p"
  },
  "buff_matrix135_violin_level3": {
    "charRu": "Harmopheus",
    "charEn": "Harmopheus",
    "suitRu": "Романтическая соната",
    "suitEn": "Romance Sonata",
    "pc": "2p"
  },
  "buff_matrix135_violin_level4": {
    "charRu": "Harmopheus",
    "charEn": "Harmopheus",
    "suitRu": "Романтическая соната",
    "suitEn": "Romance Sonata",
    "pc": "2p"
  },
  "buff_matrix136_violin_lv1": {
    "charRu": "Harmopheus",
    "charEn": "Harmopheus",
    "suitRu": "Романтическая соната",
    "suitEn": "Romance Sonata",
    "pc": "4p"
  },
  "buff_matrix136_violin_lv2": {
    "charRu": "Harmopheus",
    "charEn": "Harmopheus",
    "suitRu": "Романтическая соната",
    "suitEn": "Romance Sonata",
    "pc": "4p"
  },
  "buff_matrix136_violin_lv3": {
    "charRu": "Harmopheus",
    "charEn": "Harmopheus",
    "suitRu": "Романтическая соната",
    "suitEn": "Romance Sonata",
    "pc": "4p"
  },
  "buff_matrix136_violin_lv4": {
    "charRu": "Harmopheus",
    "charEn": "Harmopheus",
    "suitRu": "Романтическая соната",
    "suitEn": "Romance Sonata",
    "pc": "4p"
  },
  "buff_matrix_ssr137_skull_level1": {
    "charRu": "Костяная дробь",
    "charEn": "Bonecrush",
    "suitRu": "Дух Волка",
    "suitEn": "Wolf Spirit",
    "pc": "2p"
  },
  "buff_matrix_ssr137_skull": {
    "charRu": "Костяная дробь",
    "charEn": "Bonecrush",
    "suitRu": "Дух Волка",
    "suitEn": "Wolf Spirit",
    "pc": "2p"
  },
  "buff_matrix_ssr137_skull_level2": {
    "charRu": "Костяная дробь",
    "charEn": "Bonecrush",
    "suitRu": "Дух Волка",
    "suitEn": "Wolf Spirit",
    "pc": "2p"
  },
  "buff_matrix_ssr137_skull_level3": {
    "charRu": "Костяная дробь",
    "charEn": "Bonecrush",
    "suitRu": "Дух Волка",
    "suitEn": "Wolf Spirit",
    "pc": "2p"
  },
  "buff_matrix_ssr137_skull_level4": {
    "charRu": "Костяная дробь",
    "charEn": "Bonecrush",
    "suitRu": "Дух Волка",
    "suitEn": "Wolf Spirit",
    "pc": "2p"
  },
  "buff_matrix_ssr138_skull_level1": {
    "charRu": "Костяная дробь",
    "charEn": "Bonecrush",
    "suitRu": "Дух Волка",
    "suitEn": "Wolf Spirit",
    "pc": "4p"
  },
  "buff_matrix_ssr138_skull": {
    "charRu": "Костяная дробь",
    "charEn": "Bonecrush",
    "suitRu": "Дух Волка",
    "suitEn": "Wolf Spirit",
    "pc": "4p"
  },
  "buff_matrix_ssr138_skull_level2": {
    "charRu": "Костяная дробь",
    "charEn": "Bonecrush",
    "suitRu": "Дух Волка",
    "suitEn": "Wolf Spirit",
    "pc": "4p"
  },
  "buff_matrix_ssr138_skull_level3": {
    "charRu": "Костяная дробь",
    "charEn": "Bonecrush",
    "suitRu": "Дух Волка",
    "suitEn": "Wolf Spirit",
    "pc": "4p"
  },
  "buff_matrix_ssr138_skull_level4": {
    "charRu": "Костяная дробь",
    "charEn": "Bonecrush",
    "suitRu": "Дух Волка",
    "suitEn": "Wolf Spirit",
    "pc": "4p"
  },
  "buff_matrix139_gefion_level1": {
    "charRu": "Гефион",
    "charEn": "Gefion",
    "suitRu": "Обратные координаты",
    "suitEn": "Reverse Coordinates",
    "pc": "2p"
  },
  "buff_matrix139_gefion": {
    "charRu": "Гефион",
    "charEn": "Gefion",
    "suitRu": "Обратные координаты",
    "suitEn": "Reverse Coordinates",
    "pc": "2p"
  },
  "buff_matrix139_gefion_level2": {
    "charRu": "Гефион",
    "charEn": "Gefion",
    "suitRu": "Обратные координаты",
    "suitEn": "Reverse Coordinates",
    "pc": "2p"
  },
  "buff_matrix139_gefion_level3": {
    "charRu": "Гефион",
    "charEn": "Gefion",
    "suitRu": "Обратные координаты",
    "suitEn": "Reverse Coordinates",
    "pc": "2p"
  },
  "buff_matrix139_gefion_level4": {
    "charRu": "Гефион",
    "charEn": "Gefion",
    "suitRu": "Обратные координаты",
    "suitEn": "Reverse Coordinates",
    "pc": "2p"
  },
  "buff_matrix140_gefion_level1": {
    "charRu": "Гефион",
    "charEn": "Gefion",
    "suitRu": "Обратные координаты",
    "suitEn": "Reverse Coordinates",
    "pc": "4p"
  },
  "buff_matrix140_gefion": {
    "charRu": "Гефион",
    "charEn": "Gefion",
    "suitRu": "Обратные координаты",
    "suitEn": "Reverse Coordinates",
    "pc": "4p"
  },
  "buff_matrix140_gefion_level2": {
    "charRu": "Гефион",
    "charEn": "Gefion",
    "suitRu": "Обратные координаты",
    "suitEn": "Reverse Coordinates",
    "pc": "4p"
  },
  "buff_matrix140_gefion_level3": {
    "charRu": "Гефион",
    "charEn": "Gefion",
    "suitRu": "Обратные координаты",
    "suitEn": "Reverse Coordinates",
    "pc": "4p"
  },
  "buff_matrix140_gefion_level4": {
    "charRu": "Гефион",
    "charEn": "Gefion",
    "suitRu": "Обратные координаты",
    "suitEn": "Reverse Coordinates",
    "pc": "4p"
  },
  "buff_matrix_ssr_13_level1": {
    "charRu": "Широ",
    "charEn": "Shiro",
    "suitRu": "Поэма к отбытию",
    "suitEn": "Poem of Departure",
    "pc": "2p"
  },
  "buff_matrix_ssr_13": {
    "charRu": "Широ",
    "charEn": "Shiro",
    "suitRu": "Поэма к отбытию",
    "suitEn": "Poem of Departure",
    "pc": "2p"
  },
  "buff_matrix_ssr_13_level2": {
    "charRu": "Широ",
    "charEn": "Shiro",
    "suitRu": "Поэма к отбытию",
    "suitEn": "Poem of Departure",
    "pc": "2p"
  },
  "buff_matrix_ssr_13_level3": {
    "charRu": "Широ",
    "charEn": "Shiro",
    "suitRu": "Поэма к отбытию",
    "suitEn": "Poem of Departure",
    "pc": "2p"
  },
  "buff_matrix_ssr_13_level4": {
    "charRu": "Широ",
    "charEn": "Shiro",
    "suitRu": "Поэма к отбытию",
    "suitEn": "Poem of Departure",
    "pc": "2p"
  },
  "buff_matrix_ssr_14_level1": {
    "charRu": "Широ",
    "charEn": "Shiro",
    "suitRu": "Поэма к отбытию",
    "suitEn": "Poem of Departure",
    "pc": "4p"
  },
  "buff_matrix_ssr_14": {
    "charRu": "Широ",
    "charEn": "Shiro",
    "suitRu": "Поэма к отбытию",
    "suitEn": "Poem of Departure",
    "pc": "4p"
  },
  "buff_matrix_ssr_14_level2": {
    "charRu": "Широ",
    "charEn": "Shiro",
    "suitRu": "Поэма к отбытию",
    "suitEn": "Poem of Departure",
    "pc": "4p"
  },
  "buff_matrix_ssr_14_level3": {
    "charRu": "Широ",
    "charEn": "Shiro",
    "suitRu": "Поэма к отбытию",
    "suitEn": "Poem of Departure",
    "pc": "4p"
  },
  "buff_matrix_ssr_14_level4": {
    "charRu": "Широ",
    "charEn": "Shiro",
    "suitRu": "Поэма к отбытию",
    "suitEn": "Poem of Departure",
    "pc": "4p"
  },
  "buff_matrix141_zoey_level1": {
    "charRu": "Зои",
    "charEn": "Zoey",
    "suitRu": "Дитя Локхарта",
    "suitEn": "Child of Lockhart",
    "pc": "2p"
  },
  "buff_matrix141_zoey": {
    "charRu": "Зои",
    "charEn": "Zoey",
    "suitRu": "Дитя Локхарта",
    "suitEn": "Child of Lockhart",
    "pc": "2p"
  },
  "buff_matrix141_zoey_level2": {
    "charRu": "Зои",
    "charEn": "Zoey",
    "suitRu": "Дитя Локхарта",
    "suitEn": "Child of Lockhart",
    "pc": "2p"
  },
  "buff_matrix141_zoey_level3": {
    "charRu": "Зои",
    "charEn": "Zoey",
    "suitRu": "Дитя Локхарта",
    "suitEn": "Child of Lockhart",
    "pc": "2p"
  },
  "buff_matrix141_zoey_level4": {
    "charRu": "Зои",
    "charEn": "Zoey",
    "suitRu": "Дитя Локхарта",
    "suitEn": "Child of Lockhart",
    "pc": "2p"
  },
  "buff_matrix142_zoey_level1": {
    "charRu": "Зои",
    "charEn": "Zoey",
    "suitRu": "Дитя Локхарта",
    "suitEn": "Child of Lockhart",
    "pc": "4p"
  },
  "buff_matrix142_zoey": {
    "charRu": "Зои",
    "charEn": "Zoey",
    "suitRu": "Дитя Локхарта",
    "suitEn": "Child of Lockhart",
    "pc": "4p"
  },
  "buff_matrix142_zoey_level2": {
    "charRu": "Зои",
    "charEn": "Zoey",
    "suitRu": "Дитя Локхарта",
    "suitEn": "Child of Lockhart",
    "pc": "4p"
  },
  "buff_matrix142_zoey_level3": {
    "charRu": "Зои",
    "charEn": "Zoey",
    "suitRu": "Дитя Локхарта",
    "suitEn": "Child of Lockhart",
    "pc": "4p"
  },
  "buff_matrix142_zoey_level4": {
    "charRu": "Зои",
    "charEn": "Zoey",
    "suitRu": "Дитя Локхарта",
    "suitEn": "Child of Lockhart",
    "pc": "4p"
  },
  "buff_matrix_ssr_15_level1": {
    "charRu": "Зеро",
    "charEn": "Zero",
    "suitRu": "Невероятная связь",
    "suitEn": "Incredible Connection",
    "pc": "2p"
  },
  "buff_matrix_ssr_15": {
    "charRu": "Зеро",
    "charEn": "Zero",
    "suitRu": "Невероятная связь",
    "suitEn": "Incredible Connection",
    "pc": "2p"
  },
  "buff_matrix_ssr_15_level2": {
    "charRu": "Зеро",
    "charEn": "Zero",
    "suitRu": "Невероятная связь",
    "suitEn": "Incredible Connection",
    "pc": "2p"
  },
  "buff_matrix_ssr_15_level3": {
    "charRu": "Зеро",
    "charEn": "Zero",
    "suitRu": "Невероятная связь",
    "suitEn": "Incredible Connection",
    "pc": "2p"
  },
  "buff_matrix_ssr_15_level4": {
    "charRu": "Зеро",
    "charEn": "Zero",
    "suitRu": "Невероятная связь",
    "suitEn": "Incredible Connection",
    "pc": "2p"
  },
  "buff_matrix_ssr_16_level1": {
    "charRu": "Зеро",
    "charEn": "Zero",
    "suitRu": "Невероятная связь",
    "suitEn": "Incredible Connection",
    "pc": "4p"
  },
  "buff_matrix_ssr_16": {
    "charRu": "Зеро",
    "charEn": "Zero",
    "suitRu": "Невероятная связь",
    "suitEn": "Incredible Connection",
    "pc": "4p"
  },
  "buff_matrix_ssr_16_level2": {
    "charRu": "Зеро",
    "charEn": "Zero",
    "suitRu": "Невероятная связь",
    "suitEn": "Incredible Connection",
    "pc": "4p"
  },
  "buff_matrix_ssr_16_level3": {
    "charRu": "Зеро",
    "charEn": "Zero",
    "suitRu": "Невероятная связь",
    "suitEn": "Incredible Connection",
    "pc": "4p"
  },
  "buff_matrix_ssr_16_level4": {
    "charRu": "Зеро",
    "charEn": "Zero",
    "suitRu": "Невероятная связь",
    "suitEn": "Incredible Connection",
    "pc": "4p"
  },
  "buff_matrix_ssr17_sea_level1": {
    "charRu": "Самир",
    "charEn": "Samir",
    "suitRu": "Рациональное освобождение",
    "suitEn": "Rational Liberation",
    "pc": "2p"
  },
  "buff_matrix_ssr17_sea": {
    "charRu": "Самир",
    "charEn": "Samir",
    "suitRu": "Рациональное освобождение",
    "suitEn": "Rational Liberation",
    "pc": "2p"
  },
  "buff_matrix_ssr17_sea_level2": {
    "charRu": "Самир",
    "charEn": "Samir",
    "suitRu": "Рациональное освобождение",
    "suitEn": "Rational Liberation",
    "pc": "2p"
  },
  "buff_matrix_ssr17_sea_level3": {
    "charRu": "Самир",
    "charEn": "Samir",
    "suitRu": "Рациональное освобождение",
    "suitEn": "Rational Liberation",
    "pc": "2p"
  },
  "buff_matrix_ssr17_sea_level4": {
    "charRu": "Самир",
    "charEn": "Samir",
    "suitRu": "Рациональное освобождение",
    "suitEn": "Rational Liberation",
    "pc": "2p"
  },
  "buff_matrix_sea_ssr18_level1": {
    "charRu": "Самир",
    "charEn": "Samir",
    "suitRu": "Рациональное освобождение",
    "suitEn": "Rational Liberation",
    "pc": "4p"
  },
  "buff_matrix_sea_ssr18": {
    "charRu": "Самир",
    "charEn": "Samir",
    "suitRu": "Рациональное освобождение",
    "suitEn": "Rational Liberation",
    "pc": "4p"
  },
  "buff_matrix_sea_ssr18_level2": {
    "charRu": "Самир",
    "charEn": "Samir",
    "suitRu": "Рациональное освобождение",
    "suitEn": "Rational Liberation",
    "pc": "4p"
  },
  "buff_matrix_sea_ssr18_level3": {
    "charRu": "Самир",
    "charEn": "Samir",
    "suitRu": "Рациональное освобождение",
    "suitEn": "Rational Liberation",
    "pc": "4p"
  },
  "buff_matrix_sea_ssr18_level4": {
    "charRu": "Самир",
    "charEn": "Samir",
    "suitRu": "Рациональное освобождение",
    "suitEn": "Rational Liberation",
    "pc": "4p"
  }
};

export const SIMULACRA_TRAIT_KNOWLEDGE: Record<string, { charRu: string; charEn: string }> = {
  "ageleia": {
    "charRu": "Agleia",
    "charEn": "Agleia"
  },
  "imitation_79": {
    "charRu": "Agleia",
    "charEn": "Agleia"
  },
  "aige": {
    "charRu": "Эхо",
    "charEn": "Echo"
  },
  "imitation_4": {
    "charRu": "Эхо",
    "charEn": "Echo"
  },
  "alyss": {
    "charRu": "Алисс",
    "charEn": "Alyss"
  },
  "imitation_30": {
    "charRu": "Алисс",
    "charEn": "Alyss"
  },
  "anka": {
    "charRu": "Анка",
    "charEn": "Anka"
  },
  "imitation_59": {
    "charRu": "Анка",
    "charEn": "Anka"
  },
  "annabella": {
    "charRu": "Аннабелла",
    "charEn": "Annabella"
  },
  "imitation_26": {
    "charRu": "Аннабелла",
    "charEn": "Annabella"
  },
  "antoria": {
    "charRu": "Антория",
    "charEn": "Antoria"
  },
  "imitation_66": {
    "charRu": "Антория",
    "charEn": "Antoria"
  },
  "asilada": {
    "charRu": "Асурада",
    "charEn": "Asurada"
  },
  "imitation_64": {
    "charRu": "Асурада",
    "charEn": "Asurada"
  },
  "asuka": {
    "charRu": "Аска",
    "charEn": "Asuka"
  },
  "imitation_49": {
    "charRu": "Нань Инь",
    "charEn": "Nan Yin"
  },
  "avatar06": {
    "charRu": "Немезида",
    "charEn": "Nemesis"
  },
  "imitation_17": {
    "charRu": "Немезида",
    "charEn": "Nemesis"
  },
  "avatar12": {
    "charRu": "Фригг",
    "charEn": "Frigg"
  },
  "imitation_28": {
    "charRu": "Фригг",
    "charEn": "Frigg"
  },
  "bai-ling": {
    "charRu": "Бай Лин",
    "charEn": "Bai Ling"
  },
  "imitation_16": {
    "charRu": "Бай Лин",
    "charEn": "Bai Ling"
  },
  "baiyuekui": {
    "charRu": "Бай Юкеи",
    "charEn": "Bai Yuekui"
  },
  "imitation_18": {
    "charRu": "Бай Юкеи",
    "charEn": "Bai Yuekui"
  },
  "berry": {
    "charRu": "Berry",
    "charEn": "Berry"
  },
  "imitation_81": {
    "charRu": "Berry",
    "charEn": "Berry"
  },
  "brevey": {
    "charRu": "Бреви",
    "charEn": "Brevey"
  },
  "imitation_52": {
    "charRu": "Бреви",
    "charEn": "Brevey"
  },
  "carrot": {
    "charRu": "Морковка",
    "charEn": "Carrot"
  },
  "imitation_71": {
    "charRu": "Морковка",
    "charEn": "Carrot"
  },
  "ciper": {
    "charRu": "Хиппер",
    "charEn": "Hipper"
  },
  "imitation_69": {
    "charRu": "Хиппер",
    "charEn": "Hipper"
  },
  "claudia": {
    "charRu": "Клаудия",
    "charEn": "Claudia"
  },
  "imitation_12": {
    "charRu": "Клаудия",
    "charEn": "Claudia"
  },
  "claudia-storm": {
    "charRu": "Клаудия Око Грозы",
    "charEn": "Claudia Storm Eye"
  },
  "imitation_65": {
    "charRu": "Клаудия Око Грозы",
    "charEn": "Claudia Storm Eye"
  },
  "ene": {
    "charRu": "Ина",
    "charEn": "Ene"
  },
  "imitation_2": {
    "charRu": "Ина",
    "charEn": "Ene"
  },
  "feise": {
    "charRu": "Фэй Сэ",
    "charEn": "Fei Se"
  },
  "imitation_51": {
    "charRu": "Фэй Сэ",
    "charEn": "Fei Se"
  },
  "fenrir": {
    "charRu": "Фенрир",
    "charEn": "Fenrir"
  },
  "imitation_32": {
    "charRu": "Фенрир",
    "charEn": "Fenrir"
  },
  "fiona": {
    "charRu": "Фиона",
    "charEn": "Fiona"
  },
  "imitation_36": {
    "charRu": "Фиона",
    "charEn": "Fiona"
  },
  "gefion": {
    "charRu": "Гефион",
    "charEn": "Gefion"
  },
  "imitation_84": {
    "charRu": "Гефион",
    "charEn": "Gefion"
  },
  "gnonno": {
    "charRu": "Гнонно",
    "charEn": "Gnonno"
  },
  "imitation_27": {
    "charRu": "Гнонно",
    "charEn": "Gnonno"
  },
  "greyfox": {
    "charRu": "Грей Фокс",
    "charEn": "Gray Fox"
  },
  "imitation_63": {
    "charRu": "Серая Лиса",
    "charEn": "Gray Fox"
  },
  "gulan": {
    "charRu": "Кобальт-Би",
    "charEn": "Cobalt-B"
  },
  "imitation_10": {
    "charRu": "Кобальт-Би",
    "charEn": "Cobalt-B"
  },
  "hilda": {
    "charRu": "Хильда",
    "charEn": "Hilda"
  },
  "imitation_15": {
    "charRu": "Хильда",
    "charEn": "Hilda"
  },
  "huang": {
    "charRu": "Хуан",
    "charEn": "Huang"
  },
  "imitation_41": {
    "charRu": "Хуан",
    "charEn": "Huang"
  },
  "icarus": {
    "charRu": "Икар",
    "charEn": "Icarus"
  },
  "imitation_35": {
    "charRu": "Икар",
    "charEn": "Icarus"
  },
  "ji-yu": {
    "charRu": "Цзи Юй",
    "charEn": "Ji Yu"
  },
  "imitation_57": {
    "charRu": "Цзи Юй",
    "charEn": "Ji Yu"
  },
  "kekelite": {
    "charRu": "Коко Риттер",
    "charEn": "Cocoritter"
  },
  "imitation_11": {
    "charRu": "Коко Риттер",
    "charEn": "Cocoritter"
  },
  "king": {
    "charRu": "Кинг",
    "charEn": "KING"
  },
  "imitation_9": {
    "charRu": "Кинг",
    "charEn": "KING"
  },
  "lan": {
    "charRu": "Лань",
    "charEn": "Lan"
  },
  "imitation_34": {
    "charRu": "Лань",
    "charEn": "Lan"
  },
  "lana": {
    "charRu": "Лана",
    "charEn": "Lana"
  },
  "imitation_77": {
    "charRu": "Лана",
    "charEn": "Lana"
  },
  "lechesis": {
    "charRu": "Лехезис",
    "charEn": "Lechesis"
  },
  "imitation_70": {
    "charRu": "Лехезис",
    "charEn": "Lechesis"
  },
  "lin": {
    "charRu": "Линь",
    "charEn": "Lin"
  },
  "imitation_23": {
    "charRu": "Линь",
    "charEn": "Lin"
  },
  "ling": {
    "charRu": "Зеро",
    "charEn": "Zero"
  },
  "imitation_1": {
    "charRu": "Зеро",
    "charEn": "Zero"
  },
  "ling-han": {
    "charRu": "Линхань",
    "charEn": "Ling Han"
  },
  "imitation_43": {
    "charRu": "Линхань",
    "charEn": "Ling Han"
  },
  "liu-huo": {
    "charRu": "Лю Хо",
    "charEn": "Liu Huo"
  },
  "imitation_37": {
    "charRu": "Лю Хо",
    "charEn": "Liu Huo"
  },
  "lyncis": {
    "charRu": "Линсис",
    "charEn": "Lyncis"
  },
  "imitation_74": {
    "charRu": "Линсис",
    "charEn": "Lyncis"
  },
  "make": {
    "charRu": "Марк",
    "charEn": "Marc"
  },
  "imitation_20": {
    "charRu": "Марк",
    "charEn": "Marc"
  },
  "meryl": {
    "charRu": "Мерил",
    "charEn": "Meryl"
  },
  "imitation_3": {
    "charRu": "Мерил",
    "charEn": "Meryl"
  },
  "meryl-ironheart": {
    "charRu": "Мерил Железное Сердце",
    "charEn": "Meryl Ironheart"
  },
  "imitation_61": {
    "charRu": "Мерил Железное Сердце",
    "charEn": "Meryl Ironheart"
  },
  "nan-yin": {
    "charRu": "Нань Инь",
    "charEn": "Nan Yin"
  },
  "nanto": {
    "charRu": "Нанто",
    "charEn": "Nanto"
  },
  "imitation_73": {
    "charRu": "Нанто",
    "charEn": "Nanto"
  },
  "nemesis-voidpiercer": {
    "charRu": "Немезида: Жало Пустоты",
    "charEn": "Nemesis Voidpiercer"
  },
  "imitation_67": {
    "charRu": "Немезида: Жало Пустоты",
    "charEn": "Nemesis Voidpiercer"
  },
  "nora": {
    "charRu": "Нола",
    "charEn": "Nola"
  },
  "imitation_62": {
    "charRu": "Нола",
    "charEn": "Nola"
  },
  "pepper": {
    "charRu": "Пеппер",
    "charEn": "Pepper"
  },
  "imitation_14": {
    "charRu": "Пеппер",
    "charEn": "Pepper"
  },
  "plotti": {
    "charRu": "Плотти",
    "charEn": "Plotti"
  },
  "imitation_53": {
    "charRu": "Плотти",
    "charEn": "Plotti"
  },
  "puppeteer": {
    "charRu": "Элен",
    "charEn": "Helene"
  },
  "imitation_75": {
    "charRu": "Элен",
    "charEn": "Helene"
  },
  "rei-ayanami": {
    "charRu": "Рэй Аянами",
    "charEn": "Rei"
  },
  "imitation_50": {
    "charRu": "Мин Цзин",
    "charEn": "Ming Jing"
  },
  "roslyn": {
    "charRu": "Рослин",
    "charEn": "Roslyn"
  },
  "imitation_58": {
    "charRu": "Рослин",
    "charEn": "Roslyn"
  },
  "rubilia": {
    "charRu": "Рубилия",
    "charEn": "Rubilia"
  },
  "imitation_48": {
    "charRu": "Рубилия",
    "charEn": "Rubilia"
  },
  "ruby": {
    "charRu": "Руби",
    "charEn": "Ruby"
  },
  "imitation_21": {
    "charRu": "Руби",
    "charEn": "Ruby"
  },
  "saimier": {
    "charRu": "Самир",
    "charEn": "Samir"
  },
  "imitation_5": {
    "charRu": "Самир",
    "charEn": "Samir"
  },
  "saki-fuwa": {
    "charRu": "Саки Фува",
    "charEn": "Saki Fuwa"
  },
  "imitation_22": {
    "charRu": "Саки Фува",
    "charEn": "Saki Fuwa"
  },
  "salidy": {
    "charRu": "Салиди",
    "charEn": "Salidy"
  },
  "imitation_83": {
    "charRu": "Салиди",
    "charEn": "Salidy"
  },
  "shiro": {
    "charRu": "Широ",
    "charEn": "Shiro"
  },
  "imitation_8": {
    "charRu": "Широ",
    "charEn": "Shiro"
  },
  "sifengyuanyu": {
    "charRu": "Цубаса",
    "charEn": "Tsubasa"
  },
  "imitation_7": {
    "charRu": "Цубаса",
    "charEn": "Tsubasa"
  },
  "skull": {
    "charRu": "Костяная дробь",
    "charEn": "Bonecrush"
  },
  "imitation_82": {
    "charRu": "Костяная дробь",
    "charEn": "Bonecrush"
  },
  "stabdagger": {
    "charRu": "Астер",
    "charEn": "Aster"
  },
  "imitation_72": {
    "charRu": "Астер",
    "charEn": "Aster"
  },
  "tian-lang": {
    "charRu": "Тянь Лан",
    "charEn": "Tian Lang"
  },
  "imitation_29": {
    "charRu": "Тянь Лан",
    "charEn": "Tian Lang"
  },
  "umi": {
    "charRu": "Уми",
    "charEn": "Umi"
  },
  "imitation_31": {
    "charRu": "Уми",
    "charEn": "Umi"
  },
  "veronika": {
    "charRu": "Veronika",
    "charEn": "Veronika"
  },
  "imitation_76": {
    "charRu": "Veronika",
    "charEn": "Veronika"
  },
  "violin": {
    "charRu": "Harmopheus",
    "charEn": "Harmopheus"
  },
  "imitation_80": {
    "charRu": "Harmopheus",
    "charEn": "Harmopheus"
  },
  "wuwan": {
    "charRu": "Кроу",
    "charEn": "Crow"
  },
  "imitation_13": {
    "charRu": "Кроу",
    "charEn": "Crow"
  },
  "xinghuan": {
    "charRu": "Лира",
    "charEn": "Lyra"
  },
  "imitation_24": {
    "charRu": "Лира",
    "charEn": "Lyra"
  },
  "xiuma": {
    "charRu": "Юма",
    "charEn": "Huma"
  },
  "imitation_6": {
    "charRu": "Юма",
    "charEn": "Huma"
  },
  "yanmiao": {
    "charRu": "Янь Мяо",
    "charEn": "Yan Miao"
  },
  "imitation_46": {
    "charRu": "Янь Мяо",
    "charEn": "Yan Miao"
  },
  "yanuo": {
    "charRu": "Януо",
    "charEn": "Yanuo"
  },
  "imitation_54": {
    "charRu": "Януо",
    "charEn": "Yanuo"
  },
  "yulan": {
    "charRu": "Юйлань",
    "charEn": "Yu Lan"
  },
  "imitation_38": {
    "charRu": "Юйлань",
    "charEn": "Yu Lan"
  },
  "zeke": {
    "charRu": "Зик",
    "charEn": "Zeke"
  },
  "zoey": {
    "charRu": "Зои",
    "charEn": "Zoey"
  },
  "imitation_78": {
    "charRu": "Зои",
    "charEn": "Zoey"
  },
  "blevi": {
    "charRu": "Бреви",
    "charEn": "Brevey"
  },
  "tkatana": {
    "charRu": "Асурада",
    "charEn": "Asurada"
  },
  "killknife": {
    "charRu": "Яньмяо",
    "charEn": "Yan Miao"
  },
  "nanyin": {
    "charRu": "Нань Инь",
    "charEn": "Nan Yin"
  }
};

export const RELIC_KNOWLEDGE: Record<string, { nameRu: string; nameEn: string }> = {
  "artifactadvsr": {
    "nameRu": "Промежуточный сердечник",
    "nameEn": "Intermediate Core"
  },
  "artifactadvsrmmo": {
    "nameRu": "Промежуточный сердечник",
    "nameEn": "Intermediate Core"
  },
  "artifactadvssr": {
    "nameRu": "Улучшенный сердечник",
    "nameEn": "Advanced Core"
  },
  "artifactadvssrmmo": {
    "nameRu": "Улучшенный сердечник",
    "nameEn": "Advanced Core"
  },
  "artifactexp01": {
    "nameRu": "Омний типа I",
    "nameEn": "Type-I Omnium"
  },
  "artifactexp01mmo": {
    "nameRu": "Омний типа I",
    "nameEn": "Type-I Omnium"
  },
  "artifactexp02": {
    "nameRu": "Омний типа II",
    "nameEn": "Type-II Omnium"
  },
  "artifactexp02mmo": {
    "nameRu": "Омний типа II",
    "nameEn": "Type-II Omnium"
  },
  "artifactn004": {
    "nameRu": "Частица омния",
    "nameEn": "Omnium Particle"
  },
  "artifactn004mmo": {
    "nameRu": "Частица омния",
    "nameEn": "Omnium Particle"
  },
  "artifactsr001": {
    "nameRu": "Парящая пушка",
    "nameEn": "Hovering Cannon"
  },
  "artifactsr001mmo": {
    "nameRu": "Парящая пушка",
    "nameEn": "Hovering Cannon"
  },
  "artifactsr004": {
    "nameRu": "Реактивный ранец",
    "nameEn": "Jetpack"
  },
  "artifactsr004mmo": {
    "nameRu": "Реактивный ранец",
    "nameEn": "Jetpack"
  },
  "artifactsr005": {
    "nameRu": "Лавовая граната",
    "nameEn": "Lava Bomb"
  },
  "artifactsr005mmo": {
    "nameRu": "Лавовая граната",
    "nameEn": "Lava Bomb"
  },
  "artifactsr006": {
    "nameRu": "Турбоглайдер",
    "nameEn": "Jetboard"
  },
  "artifactsr006mmo": {
    "nameRu": "Турбоглайдер",
    "nameEn": "Jetboard"
  },
  "artifactsr007": {
    "nameRu": "Магнитная буря",
    "nameEn": "Magnetic Storm"
  },
  "artifactsr007mmo": {
    "nameRu": "Магнитная буря",
    "nameEn": "Magnetic Storm"
  },
  "artifactsr009": {
    "nameRu": "Квантовая накидка",
    "nameEn": "Quantum Cloak"
  },
  "artifactsr009mmo": {
    "nameRu": "Квантовая накидка",
    "nameEn": "Quantum Cloak"
  },
  "artifactsr010": {
    "nameRu": "Ракетный залп",
    "nameEn": "Missile Barrage"
  },
  "artifactsr010mmo": {
    "nameRu": "Ракетный залп",
    "nameEn": "Missile Barrage"
  },
  "artifactsr011": {
    "nameRu": "Кибернетическая рука",
    "nameEn": "Cybernetic Arm"
  },
  "artifactsr011mmo": {
    "nameRu": "Кибернетическая рука",
    "nameEn": "Cybernetic Arm"
  },
  "artifactsr012": {
    "nameRu": "Коуант",
    "nameEn": "Couant"
  },
  "artifactsr012mmo": {
    "nameRu": "Коуант",
    "nameEn": "Couant"
  },
  "artifactsr013": {
    "nameRu": "Странный куб",
    "nameEn": "Strange Cube"
  },
  "artifactsr013mmo": {
    "nameRu": "Странный куб",
    "nameEn": "Strange Cube"
  },
  "artifactsr014": {
    "nameRu": "Омниевая кулеврина",
    "nameEn": "Omnium Handcannon"
  },
  "artifactsr014mmo": {
    "nameRu": "Омниевая кулеврина",
    "nameEn": "Omnium Handcannon"
  },
  "artifactsr015": {
    "nameRu": "Магнитный импульс",
    "nameEn": "Magnetic Pulse"
  },
  "artifactsr015mmo": {
    "nameRu": "Магнитный импульс",
    "nameEn": "Magnetic Pulse"
  },
  "artifactsr017": {
    "nameRu": "Консервированный шпинат",
    "nameEn": "Canned Spinach"
  },
  "artifactsr017mmo": {
    "nameRu": "Консервированный шпинат",
    "nameEn": "Canned Spinach"
  },
  "artifactsr018": {
    "nameRu": "Световая бомба",
    "nameEn": "Flashbang"
  },
  "artifactsr018mmo": {
    "nameRu": "Световая бомба",
    "nameEn": "Flashbang"
  },
  "artifactsr019": {
    "nameRu": "Консервированный шпинат",
    "nameEn": "Canned Spinach"
  },
  "artifactsr019mmo": {
    "nameRu": "Консервированный шпинат",
    "nameEn": "Canned Spinach"
  },
  "artifactssr001": {
    "nameRu": "Рука колосса",
    "nameEn": "Colossus Arm"
  },
  "artifactssr001mmo": {
    "nameRu": "Рука колосса",
    "nameEn": "Colossus Arm"
  },
  "artifactssr002": {
    "nameRu": "Омниевый щит",
    "nameEn": "Omnium Shield"
  },
  "artifactssr002mmo": {
    "nameRu": "Омниевый щит",
    "nameEn": "Omnium Shield"
  },
  "artifactssr004": {
    "nameRu": "Броня типа V",
    "nameEn": "Type V Mecha"
  },
  "artifactssr004mmo": {
    "nameRu": "Броня типа V",
    "nameEn": "Type V Mecha"
  },
  "artifactssr005": {
    "nameRu": "Разлом пространства-времени",
    "nameEn": "Spacetime Rift"
  },
  "artifactssr005mmo": {
    "nameRu": "Разлом пространства-времени",
    "nameEn": "Spacetime Rift"
  },
  "artifactssr006": {
    "nameRu": "Заточение",
    "nameEn": "Confinement"
  },
  "artifactssr006mmo": {
    "nameRu": "Заточение",
    "nameEn": "Confinement"
  },
  "artifactssr008": {
    "nameRu": "Дрон",
    "nameEn": "Drone"
  },
  "artifactssr008mmo": {
    "nameRu": "Дрон",
    "nameEn": "Drone"
  },
  "artifactssr010": {
    "nameRu": "Голографический проектор",
    "nameEn": "Hologram Projector"
  },
  "artifactssr011": {
    "nameRu": "Иная судьба",
    "nameEn": "Alternate Destiny"
  },
  "artifactssr011mmo": {
    "nameRu": "Иная судьба",
    "nameEn": "Alternate Destiny"
  },
  "artifactssr012": {
    "nameRu": "Коуант типа II",
    "nameEn": "Type II Couant"
  },
  "artifactssr013": {
    "nameRu": "Парящая доска",
    "nameEn": "Hoverboard"
  },
  "artifactssr013mmo": {
    "nameRu": "Парящая доска",
    "nameEn": "Hoverboard"
  },
  "artifactssr014": {
    "nameRu": "Небесные игральные кости",
    "nameEn": "Heaven's Dice"
  },
  "artifactssr015": {
    "nameRu": "Мини-пеликан",
    "nameEn": "Mini Pelican"
  },
  "artifactssr015mmo": {
    "nameRu": "Мини-пеликан",
    "nameEn": "Mini Pelican"
  },
  "artifactssr016": {
    "nameRu": "Тонизирующий заряд",
    "nameEn": "Overdrive Shot"
  },
  "artifactssr017": {
    "nameRu": "Теневой стервятник",
    "nameEn": "Shadow Vulture"
  },
  "artifactssr017mmo": {
    "nameRu": "Теневой стервятник",
    "nameEn": "Shadow Vulture"
  },
  "artifactssr018": {
    "nameRu": "Морское сердце",
    "nameEn": "Thalassic Heart"
  },
  "artifactssr019": {
    "nameRu": "Скороходы",
    "nameEn": "Speedwalkers"
  },
  "artifactssr019mmo": {
    "nameRu": "Скороходы",
    "nameEn": "Speedwalkers"
  },
  "artifactssr020": {
    "nameRu": "Пузырьковая пушка",
    "nameEn": "Bubble Gun"
  },
  "artifactssr020mmo": {
    "nameRu": "Пузырьковая пушка",
    "nameEn": "Bubble Gun"
  },
  "artifactssr021": {
    "nameRu": "Тройственная маска",
    "nameEn": "Triple Mask"
  },
  "artifactssr021mmo": {
    "nameRu": "Тройственная маска",
    "nameEn": "Triple Mask"
  },
  "artifactssr022": {
    "nameRu": "Летательный аппарат",
    "nameEn": "Flight Apparatus"
  },
  "artifactssr022mmo": {
    "nameRu": "Летательный аппарат",
    "nameEn": "Flight Apparatus"
  },
  "artifactssr023": {
    "nameRu": "Биоэлектрическая винтовка контроля",
    "nameEn": "Bioelectric Control Rifle"
  },
  "artifactssr023mmo": {
    "nameRu": "Биоэлектрическая винтовка контроля",
    "nameEn": "Bioelectric Control Rifle"
  },
  "artifactssr024": {
    "nameRu": "Торгаш с баффами",
    "nameEn": "Buff Dealer"
  },
  "artifactssr025": {
    "nameRu": "Боевое зрение: метка II",
    "nameEn": "Battle Eye: Mark II"
  },
  "artifactssr026": {
    "nameRu": "Блокиратор",
    "nameEn": "Blocker Device"
  },
  "artifactssr026mmo": {
    "nameRu": "Блокиратор",
    "nameEn": "Blocker Device"
  },
  "artifactssr027": {
    "nameRu": "Модулятор нервных импульсов",
    "nameEn": "Neural Pulse Modulator"
  },
  "artifactssr028": {
    "nameRu": "Мастер побега",
    "nameEn": "Escape Master"
  },
  "lockhartartifactenergy": {
    "nameRu": "Импульсный взрыв",
    "nameEn": "Pulse Blast"
  },
  "lockhartartifactrock": {
    "nameRu": "Броня окаменения",
    "nameEn": "Petrification Armor"
  },
  "lockhartartifactwater": {
    "nameRu": "Туманный пузырь",
    "nameEn": "Misty Bubble"
  },
  "lockhartartifactwind": {
    "nameRu": "Царство Ветрового Потока",
    "nameEn": "Windflow Realm"
  }
};

export const CHARACTER_RESONANCE_KNOWLEDGE: Record<string, { ru: string; en: string }> = {
  ace: { ru: 'Клаудия', en: 'Claudia' },
  armphy: { ru: 'Марк', en: 'Marc' },
  asuka: { ru: 'Аска', en: 'Asuka' },
  berry: { ru: 'Ирида', en: 'Irida' },
  blackstar: { ru: 'Фригг', en: 'Frigg' },
  chainsaw: { ru: 'Широ', en: 'Shiro' },
  dfishchess: { ru: 'Уми', en: 'Umi' },
  gunbox: { ru: 'Гноно', en: 'Gnonno' },
  killknife: { ru: 'Яньмяо', en: 'Yan Miao' },
  lana: { ru: 'Яньмяо', en: 'Yan Miao' },
  lechesis: { ru: 'Плотти', en: 'Plotti' },
  nanto: { ru: 'Нань Инь', en: 'Nan Yin' },
  nora: { ru: 'Нола', en: 'Nola' },
  paradox: { ru: 'Асурада', en: 'Asurada' },
  salidy: { ru: 'Лира', en: 'Lyra' },
  skull: { ru: 'Байлин', en: 'Bai Ling' },
  stabdagger: { ru: 'Кроу', en: 'Crow' },
  swordx: { ru: 'Клаудия В', en: 'Claudia Storm Eye' },
  swordphy: { ru: 'Клаудия', en: 'Claudia' },
  yanmiao: { ru: 'Яньмяо', en: 'Yan Miao' },
  claudia: { ru: 'Клаудия', en: 'Claudia' },
  asurada: { ru: 'Асурада', en: 'Asurada' },
  lyncis: { ru: 'Линсис', en: 'Lyncis' }
};

export const ELEMENT_RESONANCE_KNOWLEDGE: Record<string, { ru: string; en: string }> = {
  physic: { ru: 'Физ. резонанс', en: 'Physical Resonance' },
  phy: { ru: 'Физ. резонанс', en: 'Physical Resonance' },
  fire: { ru: 'Огненный резонанс', en: 'Flame Resonance' },
  ice: { ru: 'Ледяной резонанс', en: 'Frost Resonance' },
  thu: { ru: 'Электро-резонанс', en: 'Volt Resonance' },
  thunder: { ru: 'Электро-резонанс', en: 'Volt Resonance' },
  volt: { ru: 'Электро-резонанс', en: 'Volt Resonance' },
  superpower: { ru: 'Аберрационный резонанс', en: 'Altered Resonance' },
  super: { ru: 'Аберрационный резонанс', en: 'Altered Resonance' }
};

export function resolveEnrichedAiGuess(
  cleanValueKey: string,
  candidateLabel?: string,
  candidateLabelRu?: string,
  isRu: boolean = false,
  locale: string = isRu ? 'ru' : 'en'
): EnrichedAiGuess {
  const tr = (name: string) => (isRu || !name ? name : translateUiText(name, locale));
  const base = cleanValueKey.replace(/\.json$/i, '');
  const lower = base.toLowerCase();
  const lowerNoLevel = lower.replace(/_level\d+.*$/i, '');

  // 1. Matrix Check
  if (lower.includes('matrix')) {
    const info = MATRIX_AI_KNOWLEDGE[lower] || MATRIX_AI_KNOWLEDGE[lowerNoLevel];
    if (info) {
      const charName = isRu ? (info.charRu || info.charEn) : tr(info.charEn || info.charRu);
      const suitName = isRu ? (info.suitRu || info.suitEn) : tr(info.suitEn || info.suitRu);
      const label = charName
        ? (isRu ? `Матрицы ${charName} ${info.pc}` : `${charName} ${info.pc}`)
        : `${suitName} ${info.pc}`;
      return {
        label,
        suitName,
        matchedType: 'matrix',
      };
    }
  }

  // 2. Simulacra Trait Check
  if (lower.includes('imitation') || lower.includes('trait') || lower.includes('killknife') || lower.includes('zeke') || lower.includes('blevi') || lower.includes('tkatana')) {
    let charInfo;
    const imitationMatch = lower.match(/imitation_?(\d+)/i);
    if (imitationMatch) {
      charInfo = SIMULACRA_TRAIT_KNOWLEDGE['imitation_' + imitationMatch[1]];
    }
    if (!charInfo) {
      for (const [key, val] of Object.entries(SIMULACRA_TRAIT_KNOWLEDGE)) {
        if (lower.includes(key)) {
          charInfo = val;
          break;
        }
      }
    }
    if (charInfo) {
      const charName = isRu ? (charInfo.charRu || charInfo.charEn) : (charInfo.charEn || charInfo.charRu);
      return {
        label: isRu ? `Черта: ${charName}` : `${tr(charName)} ${translateUiText('Trait', locale)}`,
        matchedType: 'trait',
      };
    }
  }

  // 3. Resonance Check
  if (lower.includes('resonance')) {
    let elemInfo;
    for (const [elemKey, val] of Object.entries(ELEMENT_RESONANCE_KNOWLEDGE)) {
      if (lower.includes(elemKey)) {
        elemInfo = val;
        break;
      }
    }
    let charInfo;
    for (const [charKey, val] of Object.entries(CHARACTER_RESONANCE_KNOWLEDGE)) {
      if (lower.includes(charKey)) {
        charInfo = val;
        break;
      }
    }
    if (elemInfo && charInfo) {
      const elemName = isRu ? elemInfo.ru : tr(elemInfo.en);
      const charName = isRu ? charInfo.ru : tr(charInfo.en);
      return {
        label: `${elemName} (${charName})`,
        matchedType: 'resonance',
      };
    }
  }

  // 4. Relic Check
  if (lower.includes('artifact')) {
    const relicMatch = lower.match(/artifact_?(ssr|sr)?_?(\d+)/i);
    if (relicMatch) {
      const quality = relicMatch[1] || 'ssr';
      const num = relicMatch[2].padStart(3, '0');
      const key = ('artifact' + quality + num).toLowerCase();
      const relic = RELIC_KNOWLEDGE[key];
      if (relic) {
        return {
          label: isRu ? (relic.nameRu || relic.nameEn) : tr(relic.nameEn || relic.nameRu),
          matchedType: 'relic',
        };
      }
    }
  }

  // 5. Fallback to candidate label
  const fallback = isRu
    ? (candidateLabelRu || candidateLabel || base)
    : (candidateLabel || candidateLabelRu || base);

  return {
    label: fallback,
    matchedType: 'generic',
  };
}
