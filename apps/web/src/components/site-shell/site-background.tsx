import React from 'react';

export interface SiteBackgroundProps {
  className?: string;
}

export function SiteBackground({ className }: SiteBackgroundProps) {
  return (
    <div
      className={`noise-bg ${className || ''}`}
      aria-hidden="true"
    />
  );
}
