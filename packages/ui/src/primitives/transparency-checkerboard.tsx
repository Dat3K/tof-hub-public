import React from 'react';

const checkerboardStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  zIndex: 0,
  pointerEvents: 'none',
  backgroundColor: '#0b0f17',
  backgroundImage:
    'linear-gradient(45deg, #181c26 25%, transparent 25%), linear-gradient(-45deg, #181c26 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #181c26 75%), linear-gradient(-45deg, transparent 75%, #181c26 75%)',
  backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0',
  backgroundSize: '16px 16px',
  opacity: 0.6,
};

export interface TransparencyCheckerboardProps {
  className?: string;
}

/** Shared stage for PNG/WebP previews that preserve alpha transparency. */
export function TransparencyCheckerboard({ className = '' }: TransparencyCheckerboardProps) {
  return <div aria-hidden="true" className={className} style={checkerboardStyle} />;
}
