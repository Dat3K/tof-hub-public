import type { Locale } from '../../../constants';

// MMO handbook, progression and mechanics labels.
// Columns: English source, German, Spanish, French, Indonesian, Japanese, Korean, Portuguese (Brazil), Thai, Simplified Chinese.
const rows = [
  ['{0}+ augmentations', '{0}+ augmentations', '{0}+ augmentations', '{0}+ améliorations', '{0}+ augmentations', '{0}+ augmentations', '{0}+ augmentations', '{0}+ augmentations', '{0}+ augmentations', '{0}+ augmentations'],
  ['{0}–{1} augmentations', '{0}–{1} augmentations', '{0}–{1} augmentations', '{0}–{1} améliorations', '{0}–{1} augmentations', '{0}–{1} augmentations', '{0}–{1} augmentations', '{0}–{1} augmentations', '{0}–{1} augmentations', '{0}–{1} augmentations'],
  ['Augmentations', 'Augmentations', 'Augmentations', 'Améliorations', 'Augmentations', 'Augmentations', 'Augmentations', 'Augmentations', 'Augmentations', 'Augmentations'],
  ['Biochemical Collapse', 'Biochemical Collapse', 'Biochemical Collapse', 'Biochemical Collapse', 'Kolaps Biokimia', '生化学的崩壊', '생화학적 붕괴', 'Biochemical Collapse', 'การล่มสลายทางชีวเคมี', 'Biochemical Collapse'],
  ['Culture Pod', 'Culture Pod', 'Cápsula cultural', 'Capsule de culture', 'Pod Budaya', '培養ポッド', '배양 포드', 'Culture Pod', 'แคปซูลเพาะเลี้ยง', 'Culture Pod'],
  ['DATAMINE · SEQUENTIAL MMO', 'DATAMINE · SEQUENTIAL MMO', 'DATAMINE · SEQUENTIAL MMO', 'DATAMINE · SEQUENTIAL MMO', 'DATAMINE · SEQUENTIAL MMO', 'DATAMINE · SEQUENTIAL MMO', 'DATAMINE · SEQUENTIAL MMO', 'DATAMINE · SEQUENTIAL MMO', 'ดาต้าไมน์ · ซีเควนเชียล MMO', 'DATAMINE · SEQUENTIAL MMO'],
  ['Epic', 'Epic', 'Epic', 'Epic', 'Epic', 'Epic', 'Epic', 'Epic', 'มหากาพย์', 'Epic'],
  ['Ignore & shred', 'Ignore & shred', 'Ignore & shred', 'Ignore & shred', 'Abaikan dan kurangi resistansi', 'Ignore & shred', 'Ignore & shred', 'Ignore & shred', 'เจาะและลดค่าต้านทาน', 'Ignore & shred'],
  ['Legendary', 'Legendary', 'Legendary', 'Legendary', 'Legendary', 'Legendary', 'Legendary', 'Legendary', 'ระดับตำนาน', 'Legendary'],
  ['Neuron Chains', 'Neuron Chains', 'Neuron Chains', 'Neuron Chains', 'Neuron Chains', 'Neuron Chains', 'Neuron Chains', 'Neuron Chains', 'โซ่ประสาท', 'Neuron Chains'],
  ['Preset', 'Preset', 'Preset', 'Preset', 'Prasetel', 'Preset', 'Preset', 'Preset', 'Preset', 'Preset'],
  ['RES × (1 − ignore) × (1 − shred)', 'RES × (1 − ignore) × (1 − shred)', 'RES × (1 − ignore) × (1 − shred)', 'RES × (1 − ignore) × (1 − shred)', 'RES × (1 − pengabaian) × (1 − pengurangan)', 'RES × (1 − ignore) × (1 − shred)', 'RES × (1 − ignore) × (1 − shred)', 'RES × (1 − ignore) × (1 − shred)', 'RES × (1 − เจาะต้านทาน) × (1 − ลดต้านทาน)', 'RES × (1 − ignore) × (1 − shred)'],
  ['Space Support · Sequential', 'Space Support · Sequential', 'Space Support · Sequential', 'Space Support · Sequential', 'Space Support · Sequential', 'Space Support · Sequential', 'Space Support · Sequential', 'Space Support · Sequential', 'สนับสนุนอวกาศ · ต่อสู้ต่อเนื่อง', 'Space Support · Sequential'],
  ['Supercomputer · Lv. {0}', 'Supercomputer · Lv. {0}', 'Supercomputer · Lv. {0}', 'Supercomputer · Lv. {0}', 'ซูเปอร์คอมพิวเตอร์ · Lv. {0}', 'Supercomputer · Lv. {0}', 'Supercomputer · Lv. {0}', 'Supercomputer · Lv. {0}', 'Supercomputer · Lv. {0}', 'Supercomputer · Lv. {0}'],
] as const;

const columns = ['de', 'es', 'fr', 'id', 'ja', 'ko', 'pt', 'th', 'zh-CN'] as const;
export const siteUiHandbookTranslations: Partial<Record<Locale, Readonly<Record<string, string>>>> = Object.fromEntries(
  columns.map((locale, index) => [locale, Object.fromEntries(rows.flatMap(row => row[index + 1] === row[0] ? [] : [[row[0], row[index + 1]]]))]),
);
