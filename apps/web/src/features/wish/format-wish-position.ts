/** Negative positions mean the imported history has no verified counter anchor. */
export function formatWishPosition(position: number): string {
  return position < 0 ? '?' : String(position);
}
