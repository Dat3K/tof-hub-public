import React from 'react';
import type { ButtonProps, IconButtonProps, ButtonVariant, ButtonSize } from './types';
import { Spinner } from './spinner';

function getVariantClasses(variant: ButtonVariant = 'secondary'): string {
  switch (variant) {
    case 'primary':
      return 'bg-[#2ba6df] hover:bg-[#38bdf8] text-white border border-[#2ba6df]/70 shadow-[0_0_0.75rem_rgba(43,166,223,0.35)] active:translate-y-[1px]';
    case 'gold':
    case 'accent':
      return 'bg-[rgba(245,217,122,0.18)] hover:bg-[rgba(245,217,122,0.28)] border border-[#f5d97a] text-[#fde68a] shadow-[0_0_0.75rem_rgba(245,217,122,0.25)] active:translate-y-[1px]';
    case 'danger':
      return 'bg-[rgba(239,68,68,0.2)] hover:bg-[rgba(239,68,68,0.32)] border border-[#ef4444] text-[#fca5a5] shadow-[0_0_0.75rem_rgba(239,68,68,0.25)] active:translate-y-[1px]';
    case 'ghost':
      return 'bg-transparent hover:bg-white/10 text-[#d7d0dd] hover:text-white border-transparent';
    case 'outline':
      return 'bg-transparent hover:bg-white/5 border border-white/20 hover:border-white/40 text-[#f3f4f6]';
    case 'secondary':
    default:
      return 'bg-[rgba(255,255,255,0.06)] hover:bg-[rgba(255,255,255,0.12)] border border-white/10 text-[#f3f4f6] active:translate-y-[1px]';
  }
}

function getSizeClasses(size: ButtonSize = 'md'): string {
  switch (size) {
    case 'sm':
      return 'h-7 px-2.5 text-xs gap-1.5 rounded-md';
    case 'lg':
      return 'h-11 px-6 text-base gap-2.5 rounded-lg';
    case 'md':
    default:
      return 'h-9 px-4 text-sm gap-2 rounded-md';
  }
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'secondary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      children,
      className = '',
      disabled,
      href,
      target,
      rel,
      type = 'button',
      ...rest
    },
    ref
  ) => {
    const baseClasses =
      'inline-flex items-center justify-center font-medium transition-all duration-150 select-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2ba6df] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0d13] disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed';
    const variantClasses = getVariantClasses(variant);
    const sizeClasses = getSizeClasses(size);
    const combinedClasses = `${baseClasses} ${variantClasses} ${sizeClasses} ${className}`.trim();

    if (href && !disabled && !isLoading) {
      return (
        <a
          href={href}
          target={target}
          rel={rel}
          className={combinedClasses}
          {...(rest as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
        >
          {leftIcon && <span className="inline-flex shrink-0 items-center">{leftIcon}</span>}
          {children}
          {rightIcon && <span className="inline-flex shrink-0 items-center">{rightIcon}</span>}
        </a>
      );
    }

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        className={combinedClasses}
        {...rest}
      >
        {isLoading ? (
          <Spinner size={size === 'lg' ? 'md' : 'sm'} variant={variant === 'primary' ? 'white' : 'primary'} />
        ) : (
          leftIcon && <span className="inline-flex shrink-0 items-center">{leftIcon}</span>
        )}
        {children}
        {!isLoading && rightIcon && (
          <span className="inline-flex shrink-0 items-center">{rightIcon}</span>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      size = 'md',
      className = '',
      children,
      'aria-label': ariaLabel,
      ...rest
    },
    ref
  ) => {
    const sizeMap: Record<ButtonSize, string> = {
      sm: 'w-7 h-7 p-0',
      md: 'w-9 h-9 p-0',
      lg: 'w-11 h-11 p-0',
    };

    return (
      <Button
        ref={ref}
        size={size}
        aria-label={ariaLabel}
        className={`${sizeMap[size]} ${className}`.trim()}
        {...rest}
      >
        {children}
      </Button>
    );
  }
);

IconButton.displayName = 'IconButton';
