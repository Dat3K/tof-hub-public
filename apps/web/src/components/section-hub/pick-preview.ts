import { useEffect, useState } from 'react';

export interface HubPreviewShape {
  /** Items kept from the start of the list (e.g. newest). */
  head: number;
  /** Random items from between head and tail. */
  middle: number;
  /** Items kept from the end of the list. */
  tail?: number;
}

/**
 * Head and tail of an ordered list plus `middle` items from between them. Without `random` (server render)
 * the middle items are evenly spaced, so the first client render matches; with it they are a random set.
 */
export function pickHubPreview<T>(list: readonly T[], shape: HubPreviewShape, random?: () => number): T[] {
  const tail = shape.tail ?? 0;
  if (list.length <= shape.head + shape.middle + tail) return [...list];
  const between = list.slice(shape.head, list.length - tail);
  let picked: T[];
  if (random) {
    const pool = [...between];
    for (let index = pool.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(random() * (index + 1));
      [pool[index], pool[swap]] = [pool[swap]!, pool[index]!];
    }
    const chosen = new Set(pool.slice(0, shape.middle));
    picked = between.filter((item) => chosen.has(item));
  } else {
    picked = Array.from({ length: shape.middle }, (_, index) => between[Math.floor(((index + 0.5) * between.length) / shape.middle)]!);
  }
  return [...list.slice(0, shape.head), ...picked, ...(tail ? list.slice(-tail) : [])];
}

/** `pickHubPreview` with a deterministic first render and a random middle after hydration. */
export function useHubPreview<T>(list: readonly T[], shape: HubPreviewShape | undefined): T[] {
  const { head = 0, middle = 0, tail = 0 } = shape ?? {};
  const [picked, setPicked] = useState(() => (shape ? pickHubPreview(list, { head, middle, tail }) : [...list]));
  useEffect(() => {
    // Random picks only after hydration, so the server and first client render agree.
    setPicked(shape ? pickHubPreview(list, { head, middle, tail }, Math.random) : [...list]);
  }, [list, shape, head, middle, tail]);
  return picked;
}
