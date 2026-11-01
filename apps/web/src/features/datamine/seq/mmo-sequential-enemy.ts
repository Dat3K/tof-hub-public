import type {HandbookBiochemicalData, HandbookBiochemicalMedia} from '../contracts/handbook';

export type SequentialPod = HandbookBiochemicalData['seasons'][number]['levels'][number];
export type SequentialEnemy = SequentialPod['waves'][number]['enemies'][number] & {wave: number; sourceSlot: string};

export const sequentialLineup = (pod: SequentialPod): SequentialEnemy[] => pod.waves.flatMap(wave =>
  wave.enemies.map((enemy, index) => ({...enemy, wave: wave.index, sourceSlot: `${wave.index}:${index}`}))
    .filter(enemy => enemy.count == null || enemy.count > 0));

export function sequentialEnemyMedia(pod: SequentialPod, enemy: SequentialEnemy, media?: HandbookBiochemicalMedia | null) {
  const entry = media?.pods[pod.id]?.enemies[enemy.sourceSlot];
  return entry && JSON.stringify(entry.name) === JSON.stringify(enemy.name) ? entry : undefined;
}

export function sequentialEnemyPortrait(pod: SequentialPod, enemy: SequentialEnemy, media?: HandbookBiochemicalMedia | null) {
  const full = sequentialEnemyMedia(pod, enemy, media);
  if (full) return full.portrait;
  if (media?.pods[pod.id]) return null;
  for (const [icon, label] of [[pod.bossIcon, pod.bossName], [pod.slotIcon, pod.featuredName]] as const) {
    if (icon && (['en', 'ru'] as const).some(locale => label?.[locale] && label[locale] === enemy.name?.[locale])) return icon;
  }
  return null;
}

export const sequentialEnemyKind = (enemy: SequentialEnemy) => enemy.type?.endsWith('_BOSS') ? 'boss' : enemy.type?.endsWith('_ELITE') ? 'elite' : 'normal';

export function knownEnemyValue(value: number | null | undefined): value is number {
  return value != null && Number.isFinite(value);
}
