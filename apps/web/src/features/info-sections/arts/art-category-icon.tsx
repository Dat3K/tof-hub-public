'use client';

import React from 'react';

export type ArtCategoryIconName =
  | 'loading'
  | 'character-bg'
  | 'characters'
  | 'gashapon'
  | 'events'
  | 'others';

interface ArtCategoryIconProps {
  name: ArtCategoryIconName;
}

/** Legacy Arts category icons, kept as inline SVG so FilterChip can tint them by state. */
export const ArtCategoryIcon: React.FC<ArtCategoryIconProps> = ({ name }) => {
  const common = {
    className: 'h-4 w-4',
    viewBox: '0 0 24 24',
    width: 16,
    height: 16,
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };

  switch (name) {
    case 'loading':
      return <svg {...common}><rect width="20" height="14" x="2" y="3" rx="2" /><line x1="8" x2="16" y1="21" y2="21" /><line x1="12" x2="12" y1="17" y2="21" /></svg>;
    case 'character-bg':
      return <svg {...common}><rect width="18" height="18" x="3" y="3" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" /></svg>;
    case 'characters':
      return <svg {...common}><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>;
    case 'gashapon':
      return <svg {...common}><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" /></svg>;
    case 'events':
      return <svg {...common}><rect width="18" height="18" x="3" y="4" rx="2" ry="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" /></svg>;
    case 'others':
      return <svg {...common}><circle cx="12" cy="12" r="10" /><polygon points="12 8 8 12 12 16 16 12 12 8" /></svg>;
    default:
      return null;
  }
};
