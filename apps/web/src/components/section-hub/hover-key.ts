import { useState, type FocusEvent } from 'react';

/**
 * The item under the pointer or keyboard focus inside a list (a roster tile, a season tile). A featured hub card
 * shows that item's art while it is hovered and falls back to its own choice when the pointer or focus leaves.
 */
export function useHubHover<K>() {
  const [hovered, setHovered] = useState<K | null>(null);
  return {
    hovered,
    reset: () => setHovered(null),
    /** Handlers for one item. */
    item: (key: K) => ({ onPointerEnter: () => setHovered(key), onFocus: () => setHovered(key) }),
    /** Handlers for the list: leaving it with the pointer or the focus clears the hover. */
    list: {
      onPointerLeave: () => setHovered(null),
      onBlur: (event: FocusEvent<HTMLElement>) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setHovered(null);
      },
    },
  };
}
