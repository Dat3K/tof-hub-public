import React from 'react';
import type { SkeletonProps, SkeletonVariant } from './types';

function getVariantClasses(variant: SkeletonVariant = 'rectangular'): string {
  switch (variant) {
    case 'text':
      return 'h-4 w-full rounded';
    case 'circular':
      return 'rounded-full aspect-square';
    case 'card':
      return 'w-full aspect-[4/5] rounded-[14px]';
    case 'rectangular':
    default:
      return 'rounded-lg';
  }
}

export const Skeleton: React.FC<SkeletonProps> = ({
  variant = 'rectangular',
  width,
  height,
  aspectRatio,
  className = '',
  style,
  ...rest
}) => {
  const variantClasses = getVariantClasses(variant);

  const inlineStyles: React.CSSProperties = {
    ...style,
    ...(width !== undefined ? { width } : {}),
    ...(height !== undefined ? { height } : {}),
    ...(aspectRatio !== undefined ? { aspectRatio } : {}),
  };

  return (
    <div
      aria-hidden="true"
      className={`skeleton relative overflow-hidden bg-[#151119] border border-white/5 animate-pulse ${variantClasses} ${className}`.trim()}
      style={inlineStyles}
      {...rest}
    >
      <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/[0.04] to-transparent animate-[shimmer_2s_infinite]" />
    </div>
  );
};

Skeleton.displayName = 'Skeleton';
