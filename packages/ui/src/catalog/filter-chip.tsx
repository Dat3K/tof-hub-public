'use client';

import React from 'react';
import type { MouseEvent } from 'react';
import type { FilterChipProps, FilterVariant } from './types';

function getVariantClasses(variant: FilterVariant | undefined, active: boolean): {
  buttonClass: string;
  modifierClass: string;
} {
  const norm = variant?.toLowerCase() as FilterVariant | undefined;

  switch (norm) {
    case 'phys':
    case 'physical':
      return {
        modifierClass: 'sim-filter-btn--phys',
        buttonClass: active
          ? 'bg-[rgba(245,158,11,0.22)] border-[#f59e0b] text-[#fde68a] shadow-[0_0_12px_rgba(245,158,11,0.35)] font-bold'
          : '',
      };

    case 'flame':
    case 'fire':
      return {
        modifierClass: 'sim-filter-btn--fire sim-filter-btn--flame',
        buttonClass: active
          ? 'bg-[rgba(239,68,68,0.22)] border-[#ef4444] text-[#fca5a5] shadow-[0_0_12px_rgba(239,68,68,0.35)] font-bold'
          : '',
      };

    case 'frost':
      return {
        modifierClass: 'sim-filter-btn--frost',
        buttonClass: active
          ? 'bg-[rgba(6,182,212,0.22)] border-[#06b6d4] text-[#a5f3fc] shadow-[0_0_12px_rgba(6,182,212,0.35)] font-bold'
          : '',
      };

    case 'volt':
      return {
        modifierClass: 'sim-filter-btn--volt',
        buttonClass: active
          ? 'bg-[rgba(168,85,247,0.22)] border-[#a855f7] text-[#e9d5ff] shadow-[0_0_12px_rgba(168,85,247,0.35)] font-bold'
          : '',
      };

    case 'altered':
      return {
        modifierClass: 'sim-filter-btn--altered',
        buttonClass: active
          ? 'bg-[rgba(16,185,129,0.22)] border-[#10b981] text-[#a7f3d0] shadow-[0_0_12px_rgba(16,185,129,0.35)] font-bold'
          : '',
      };

    case 'dps':
      return {
        modifierClass: 'sim-filter-btn--dps',
        buttonClass: active
          ? 'bg-[rgba(239,68,68,0.22)] border-[#ef4444] text-[#fca5a5] shadow-[0_0_12px_rgba(239,68,68,0.35)] font-bold'
          : '',
      };

    case 'tank':
      return {
        modifierClass: 'sim-filter-btn--tank',
        buttonClass: active
          ? 'bg-[rgba(59,130,246,0.22)] border-[#3b82f6] text-[#93c5fd] shadow-[0_0_12px_rgba(59,130,246,0.35)] font-bold'
          : '',
      };

    case 'benediction':
      return {
        modifierClass: 'sim-filter-btn--benediction',
        buttonClass: active
          ? 'bg-[rgba(16,185,129,0.22)] border-[#10b981] text-[#6ee7b7] shadow-[0_0_12px_rgba(16,185,129,0.35)] font-bold'
          : '',
      };

    case 'attack':
      return {
        modifierClass: 'sim-filter-btn--attack',
        buttonClass: active
          ? 'bg-[rgba(239,68,68,0.22)] border-[#ef4444] text-[#fca5a5] shadow-[0_0_12px_rgba(239,68,68,0.35)] font-bold'
          : '',
      };

    case 'defense':
      return {
        modifierClass: 'sim-filter-btn--defense',
        buttonClass: active
          ? 'bg-[rgba(59,130,246,0.22)] border-[#3b82f6] text-[#93c5fd] shadow-[0_0_12px_rgba(59,130,246,0.35)] font-bold'
          : '',
      };

    case 'assist':
      return {
        modifierClass: 'sim-filter-btn--assist',
        buttonClass: active
          ? 'bg-[rgba(16,185,129,0.22)] border-[#10b981] text-[#6ee7b7] shadow-[0_0_12px_rgba(16,185,129,0.35)] font-bold'
          : '',
      };

    case 'function':
      return {
        modifierClass: 'sim-filter-btn--function',
        buttonClass: active
          ? 'bg-[rgba(245,158,11,0.22)] border-[#f59e0b] text-[#fde047] shadow-[0_0_12px_rgba(245,158,11,0.35)] font-bold'
          : '',
      };

    case 'survive':
      return {
        modifierClass: 'sim-filter-btn--survive',
        buttonClass: active
          ? 'bg-[rgba(236,72,153,0.22)] border-[#ec4899] text-[#f472b6] shadow-[0_0_12px_rgba(236,72,153,0.35)] font-bold'
          : '',
      };

    case 'indigo':
      return {
        modifierClass: 'sim-filter-btn--indigo',
        buttonClass: active
          ? 'bg-[rgba(99,102,241,0.22)] border-[#6366f1] text-[#c7d2fe] shadow-[0_0_12px_rgba(99,102,241,0.35)] font-bold'
          : '',
      };

    case 'yellow':
      return {
        modifierClass: 'sim-filter-btn--yellow',
        buttonClass: active
          ? 'bg-[rgba(250,204,21,0.2)] border-[#facc15] text-[#fde047] shadow-[0_0_12px_rgba(250,204,21,0.35)] font-bold'
          : '',
      };

    case 'ssr':
      return {
        modifierClass: 'sim-filter-btn--ssr',
        buttonClass: active
          ? 'bg-gradient-to-br from-[#f59e0b] to-[#b45309] border-[rgba(254,240,138,0.7)] text-white font-extrabold shadow-[0_2px_10px_rgba(245,158,11,0.55),0_0_14px_rgba(245,158,11,0.35)]'
          : '',
      };

    case 'sr':
      return {
        modifierClass: 'sim-filter-btn--sr',
        buttonClass: active
          ? 'bg-gradient-to-br from-[#a855f7] to-[#6b21a8] border-[rgba(233,213,255,0.7)] text-white font-extrabold shadow-[0_2px_10px_rgba(168,85,247,0.55)]'
          : '',
      };

    case 'r':
      return {
        modifierClass: 'sim-filter-btn--r',
        buttonClass: active
          ? 'bg-gradient-to-br from-[#3b82f6] to-[#1d4ed8] border-[rgba(191,219,254,0.7)] text-white font-extrabold shadow-[0_2px_10px_rgba(59,130,246,0.55)]'
          : '',
      };

    case 'n':
      return {
        modifierClass: 'sim-filter-btn--n',
        buttonClass: active
          ? 'bg-gradient-to-br from-[#10b981] to-[#047857] border-[rgba(167,243,208,0.7)] text-white font-extrabold shadow-[0_2px_10px_rgba(16,185,129,0.55)]'
          : '',
      };

    case 'final':
      return {
        modifierClass: 'sim-filter-btn--final',
        buttonClass: active
          ? 'bg-[rgba(255,255,255,0.14)] border-[#e5e7eb] text-white shadow-[0_0_12px_rgba(255,255,255,0.28)] font-bold'
          : '',
      };

    case 'default':
    case 'all':
    default:
      return {
        modifierClass: '',
        buttonClass: active
          ? 'bg-[rgba(59,130,246,0.22)] border-[#3b82f6] text-[#eff6ff] shadow-[0_0_12px_rgba(59,130,246,0.35)] font-bold'
          : '',
      };
  }
}

/**
 * FilterChip — Reusable catalog filter button (.sim-filter-btn).
 * Adheres strictly to:
 * - 26px height and 5px border radius geometry
 * - Signature glowing neon active styling
 * - No-Glare Icon Rule: flat, crisp icons with grayscale/opacity switch on active state
 */
export function FilterChip({
  value,
  label,
  active = false,
  variant = 'default',
  icon,
  iconAlt = '',
  onClick,
  role = 'button',
  'aria-selected': ariaSelected,
  'aria-checked': ariaChecked,
  'aria-controls': ariaControls,
  disabled = false,
  title,
  className = '',
  children,
  dataVal,
}: FilterChipProps) {
  const { buttonClass, modifierClass } = getVariantClasses(variant, active);
  const resolvedValue = value ?? (typeof children === 'string' ? children : '');

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;
    onClick?.(resolvedValue, event);
  };

  const defaultAriaChecked = role === 'radio' ? active : ariaChecked;
  const defaultAriaSelected = role === 'tab' ? active : ariaSelected;
  const defaultAriaPressed = role === 'button' ? active : undefined;

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      onClick?.(resolvedValue, event as unknown as MouseEvent<HTMLButtonElement>);
    }
  };

  const tabIndex = role === 'tab' || role === 'radio' ? (active ? 0 : -1) : undefined;

  return (
    <button
      type="button"
      tabIndex={tabIndex}
      className={[
        'sim-filter-btn',
        modifierClass,
        active ? 'active is-active' : '',
        'h-[26px] px-2 rounded-[5px] text-[12px] font-semibold leading-[1.25] shrink-0 whitespace-nowrap',
        'inline-flex items-center justify-center gap-1.5 cursor-pointer select-none [[data-text-selectable]_&]:select-text transition-all duration-150',
        'border font-sans',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6] focus-visible:ring-offset-1 focus-visible:ring-offset-[#0b0d13]',
        active
          ? buttonClass
          : 'bg-[rgba(255,255,255,0.05)] border-[rgba(255,255,255,0.08)] text-[#9ca3af] hover:bg-[rgba(255,255,255,0.08)] hover:text-[#f3f4f6] hover:border-[rgba(255,255,255,0.16)]',
        disabled ? 'opacity-40 cursor-not-allowed pointer-events-none' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      role={role}
      aria-selected={defaultAriaSelected}
      aria-checked={defaultAriaChecked}
      aria-pressed={defaultAriaPressed}
      aria-controls={ariaControls}
      disabled={disabled}
      title={title}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      data-val={dataVal ?? value}
    >
      {icon && typeof icon === 'string' ? (
        <img
          src={icon}
          alt={iconAlt}
          className={[
            'sim-filter-icon',
            'w-[15px] h-[15px] object-contain shrink-0 align-middle transition-all duration-200',
            active ? 'grayscale-0 opacity-100 scale-[1.04]' : 'grayscale opacity-50',
          ].join(' ')}
          loading="eager"
          decoding="async"
        />
      ) : icon ? (
        <span
          className={[
            'sim-filter-icon',
            'inline-flex items-center justify-center w-[15px] h-[15px] shrink-0 transition-all duration-200',
            active ? 'opacity-100 scale-[1.04]' : 'opacity-50',
          ].join(' ')}
        >
          {icon}
        </span>
      ) : null}
      <span>{label ?? children ?? value}</span>
    </button>
  );
}
