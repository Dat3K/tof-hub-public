import React from 'react';
import type {
  CardProps,
  CardHeaderProps,
  CardTitleProps,
  CardDescriptionProps,
  CardContentProps,
  CardFooterProps,
  CardVariant,
} from './types';

function getVariantClasses(variant: CardVariant = 'default'): string {
  switch (variant) {
    case 'panel':
      return 'bg-[#100d14] border border-white/10';
    case 'raised':
      return 'bg-[#151119] border border-white/10 shadow-[0_0.75rem_1.75rem_rgba(0,0,0,0.5)]';
    case 'frosted':
      return 'bg-[var(--surface-panel)]/85 border border-white/10 backdrop-blur-md shadow-lg';
    case 'outline':
      return 'bg-transparent border border-white/15';
    case 'default':
    default:
      return 'bg-[#100d14] border border-white/10';
  }
}

export const Card: React.FC<CardProps> & {
  Header: typeof CardHeader;
  Title: typeof CardTitle;
  Description: typeof CardDescription;
  Content: typeof CardContent;
  Footer: typeof CardFooter;
} = ({
  variant = 'default',
  interactive = false,
  selected = false,
  children,
  className = '',
  as: Component = 'div',
  ...rest
}) => {
  const variantClasses = getVariantClasses(variant);
  const interactiveClasses = interactive
    ? 'cursor-pointer hover:border-white/20 hover:-translate-y-0.5 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2ba6df]'
    : '';
  const selectedClasses = selected
    ? 'ring-2 ring-[#2ba6df] border-[#2ba6df] shadow-[0_0_1rem_rgba(43,166,223,0.3)]'
    : '';

  return (
    <Component
      className={`card relative rounded-xl overflow-hidden flex flex-col text-[#d7d0dd] ${variantClasses} ${interactiveClasses} ${selectedClasses} ${className}`.trim()}
      {...rest}
    >
      {children}
    </Component>
  );
};

export const CardHeader: React.FC<CardHeaderProps> = ({
  children,
  className = '',
  ...rest
}) => (
  <div className={`p-4 sm:p-5 border-b border-white/5 ${className}`.trim()} {...rest}>
    {children}
  </div>
);

export const CardTitle: React.FC<CardTitleProps> = ({
  children,
  className = '',
  ...rest
}) => (
  <h3 className={`text-base sm:text-lg font-bold text-white tracking-wide ${className}`.trim()} {...rest}>
    {children}
  </h3>
);

export const CardDescription: React.FC<CardDescriptionProps> = ({
  children,
  className = '',
  ...rest
}) => (
  <p className={`text-xs sm:text-sm text-[#9ca3af] mt-1 leading-relaxed ${className}`.trim()} {...rest}>
    {children}
  </p>
);

export const CardContent: React.FC<CardContentProps> = ({
  children,
  className = '',
  ...rest
}) => (
  <div className={`p-4 sm:p-5 flex-1 ${className}`.trim()} {...rest}>
    {children}
  </div>
);

export const CardFooter: React.FC<CardFooterProps> = ({
  children,
  className = '',
  ...rest
}) => (
  <div className={`p-4 sm:p-5 pt-0 border-t border-white/5 flex items-center justify-between gap-3 ${className}`.trim()} {...rest}>
    {children}
  </div>
);

Card.Header = CardHeader;
Card.Title = CardTitle;
Card.Description = CardDescription;
Card.Content = CardContent;
Card.Footer = CardFooter;
Card.displayName = 'Card';

export const Panel = Card;
