import type { Locale } from '../../../constants';

/** Boss stat plate on the FCE and Raids cards (Phase / HP / Resists / Crit RES) and its Hide / Show button; hand-maintained. */
export const bossPlateTranslations: Partial<Record<Locale, Readonly<Record<string, string>>>> = {
  de: { "Phase": "Phase", "Hide stats": "Werte ausblenden", "Show stats": "Werte anzeigen", "Crit RES": "Krit-RES", "Crit resistance (FinalCritDef)": "Krit-Resistenz (FinalCritDef)", "Boss resistances": "Boss-Resistenzen" },
  es: { "Phase": "Fase", "Hide stats": "Ocultar stats", "Show stats": "Mostrar stats", "Crit RES": "RES crít.", "Crit resistance (FinalCritDef)": "Resistencia a críticos (FinalCritDef)", "Boss resistances": "Resistencias del jefe" },
  fr: { "Phase": "Phase", "Hide stats": "Masquer les stats", "Show stats": "Afficher les stats", "Crit RES": "RÉS crit.", "Crit resistance (FinalCritDef)": "Résistance aux critiques (FinalCritDef)", "Boss resistances": "Résistances du boss" },
  id: { "Phase": "Fase", "Hide stats": "Sembunyikan statistik", "Show stats": "Tampilkan statistik", "Crit RES": "RES Krit", "Crit resistance (FinalCritDef)": "Resistansi kritikal (FinalCritDef)", "Boss resistances": "Resistansi bos" },
  ja: { "Phase": "フェーズ", "Hide stats": "ステータスを隠す", "Show stats": "ステータスを表示", "Crit RES": "会心耐性", "Crit resistance (FinalCritDef)": "会心耐性（FinalCritDef）", "Boss resistances": "ボスの耐性" },
  ko: { "Phase": "페이즈", "Hide stats": "스탯 숨기기", "Show stats": "스탯 표시", "Crit RES": "치명 저항", "Crit resistance (FinalCritDef)": "치명타 저항 (FinalCritDef)", "Boss resistances": "보스 저항" },
  pt: { "Phase": "Fase", "Hide stats": "Ocultar status", "Show stats": "Mostrar status", "Crit RES": "RES crít.", "Crit resistance (FinalCritDef)": "Resistência a críticos (FinalCritDef)", "Boss resistances": "Resistências do chefe" },
  th: { "Phase": "เฟส", "Hide stats": "ซ่อนสถานะ", "Show stats": "แสดงสถานะ", "Crit RES": "ต้านคริ", "Crit resistance (FinalCritDef)": "ความต้านทานคริติคอล (FinalCritDef)", "Boss resistances": "ค่าต้านทานของบอส" },
  'zh-CN': { "Phase": "阶段", "Hide stats": "隐藏属性", "Show stats": "显示属性", "Crit RES": "暴击抗性", "Crit resistance (FinalCritDef)": "暴击抗性（FinalCritDef）", "Boss resistances": "首领抗性" },
};
