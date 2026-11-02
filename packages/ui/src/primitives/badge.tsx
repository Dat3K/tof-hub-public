import React from 'react';
import type { BadgeProps, BadgeVariant, BadgeSize } from './types';

function getVariantClasses(variant: BadgeVariant = 'default'): { classes: string; dotColor: string } {
  switch (variant) {
    // Rarities
    case 'ssr':
      return {
        classes: 'bg-[rgba(245,217,122,0.18)] text-[#fde68a] border-[#f5d97a]/50 shadow-[0_0_0.5rem_rgba(245,217,122,0.2)]',
        dotColor: 'bg-[#f5d97a]',
      };
    case 'sr':
      return {
        classes: 'bg-[rgba(168,85,247,0.18)] text-[#e9d5ff] border-[#a855f7]/50 shadow-[0_0_0.5rem_rgba(168,85,247,0.2)]',
        dotColor: 'bg-[#a855f7]',
      };
    case 'r':
      return {
        classes: 'bg-[rgba(59,130,246,0.18)] text-[#bfdbfe] border-[#3b82f6]/50 shadow-[0_0_0.5rem_rgba(59,130,246,0.2)]',
        dotColor: 'bg-[#3b82f6]',
      };
    case 'n':
      return {
        classes: 'bg-[rgba(16,185,129,0.18)] text-[#a7f3d0] border-[#10b981]/50 shadow-[0_0_0.5rem_rgba(16,185,129,0.2)]',
        dotColor: 'bg-[#10b981]',
      };

    // Elements
    case 'phys':
      return {
        classes: 'bg-[rgba(245,158,11,0.18)] text-[#fde68a] border-[#f59e0b]/50 shadow-[0_0_0.5rem_rgba(245,158,11,0.2)]',
        dotColor: 'bg-[#f59e0b]',
      };
    case 'flame':
      return {
        classes: 'bg-[rgba(239,68,68,0.18)] text-[#fca5a5] border-[#ef4444]/50 shadow-[0_0_0.5rem_rgba(239,68,68,0.2)]',
        dotColor: 'bg-[#ef4444]',
      };
    case 'frost':
      return {
        classes: 'bg-[rgba(6,182,212,0.18)] text-[#a5f3fc] border-[#06b6d4]/50 shadow-[0_0_0.5rem_rgba(6,182,212,0.2)]',
        dotColor: 'bg-[#06b6d4]',
      };
    case 'volt':
      return {
        classes: 'bg-[rgba(168,85,247,0.18)] text-[#e9d5ff] border-[#a855f7]/50 shadow-[0_0_0.5rem_rgba(168,85,247,0.2)]',
        dotColor: 'bg-[#a855f7]',
      };
    case 'altered':
      return {
        classes: 'bg-[rgba(16,185,129,0.18)] text-[#a7f3d0] border-[#10b981]/50 shadow-[0_0_0.5rem_rgba(16,185,129,0.2)]',
        dotColor: 'bg-[#10b981]',
      };

    // Roles & Properties
    case 'dps':
    case 'attack':
      return {
        classes: 'bg-[rgba(239,68,68,0.15)] text-[#fca5a5] border-[#ef4444]/40',
        dotColor: 'bg-[#ef4444]',
      };
    case 'tank':
    case 'defense':
      return {
        classes: 'bg-[rgba(245,158,11,0.15)] text-[#fde68a] border-[#f59e0b]/40',
        dotColor: 'bg-[#f59e0b]',
      };
    case 'benediction':
    case 'assist':
      return {
        classes: 'bg-[rgba(16,185,129,0.15)] text-[#a7f3d0] border-[#10b981]/40',
        dotColor: 'bg-[#10b981]',
      };
    case 'function':
      return {
        classes: 'bg-[rgba(59,130,246,0.15)] text-[#bfdbfe] border-[#3b82f6]/40',
        dotColor: 'bg-[#3b82f6]',
      };
    case 'survive':
      return {
        classes: 'bg-[rgba(6,182,212,0.15)] text-[#a5f3fc] border-[#06b6d4]/40',
        dotColor: 'bg-[#06b6d4]',
      };

    // Semantics
    case 'primary':
      return {
        classes: 'bg-[#2ba6df]/15 text-[#7dd3fc] border-[#2ba6df]/40 shadow-[0_0_0.5rem_rgba(43,166,223,0.2)]',
        dotColor: 'bg-[#2ba6df]',
      };
    case 'success':
      return {
        classes: 'bg-[#10b981]/15 text-[#6ee7b7] border-[#10b981]/40',
        dotColor: 'bg-[#10b981]',
      };
    case 'warning':
      return {
        classes: 'bg-[#f59e0b]/15 text-[#fde68a] border-[#f59e0b]/40',
        dotColor: 'bg-[#f59e0b]',
      };
    case 'danger':
      return {
        classes: 'bg-[#ef4444]/15 text-[#fca5a5] border-[#ef4444]/40',
        dotColor: 'bg-[#ef4444]',
      };
    case 'info':
      return {
        classes: 'bg-[#0284c7]/15 text-[#38bdf8] border-[#0284c7]/40',
        dotColor: 'bg-[#0284c7]',
      };
    case 'default':
    default:
      return {
        classes: 'bg-white/5 text-[#d7d0dd] border-white/10',
        dotColor: 'bg-white/60',
      };
  }
}

function getSizeClasses(size: BadgeSize = 'md'): string {
  switch (size) {
    case 'sm':
      return 'text-[0.65rem] px-1.5 py-0.5 gap-1 font-bold';
    case 'lg':
      return 'text-sm px-2.5 py-1 gap-1.5 font-semibold';
    case 'md':
    default:
      return 'text-xs px-2 py-0.5 gap-1.5 font-semibold';
  }
}

function getRoundedClasses(rounded: 'default' | 'full' | 'sm' = 'default'): string {
  switch (rounded) {
    case 'full':
      return 'rounded-full';
    case 'sm':
      return 'rounded';
    case 'default':
    default:
      return 'rounded-md';
  }
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'default',
  size = 'md',
  icon,
  dot = false,
  rounded = 'default',
  children,
  className = '',
  ...rest
}) => {
  const { classes: variantClasses, dotColor } = getVariantClasses(variant);
  const sizeClasses = getSizeClasses(size);
  const roundedClasses = getRoundedClasses(rounded);

  return (
    <span
      className={`sim-badge inline-flex items-center justify-center border leading-none whitespace-nowrap tracking-wide select-none backdrop-blur-sm ${sizeClasses} ${variantClasses} ${roundedClasses} ${className}`.trim()}
      data-variant={variant}
      {...rest}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} aria-hidden="true" />}
      {icon && <span className="inline-flex shrink-0 items-center justify-center" aria-hidden="true">{icon}</span>}
      {children}
    </span>
  );
};

Badge.displayName = 'Badge';
