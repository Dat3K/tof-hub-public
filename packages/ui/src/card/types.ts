import type { ReactNode, MouseEvent, HTMLAttributes } from 'react';
import type { RarityVariant, ElementVariant, PropertyVariant, RoleVariant } from '../primitives/types';

export interface EntityCardProps {
  presentation?: 'catalog' | 'picker' | 'picker-compact';
  id?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  description?: ReactNode;
  image?: string;
  imageAlt?: string;
  aspectRatio?: 'portrait' | 'square' | 'video' | 'banner' | string;
  artPosition?: string;
  artZoom?: number | string;
  showTransparencyCheckerboard?: boolean;
  rarity?: RarityVariant;
  element?: ElementVariant;
  property?: PropertyVariant;
  role?: RoleVariant;
  badges?: ReactNode[];
  raritySlot?: ReactNode;
  cornerSlot?: ReactNode;
  artBottomLeftSlot?: ReactNode;
  footerSlot?: ReactNode;
  href?: string;
  onClick?: (e: MouseEvent<HTMLElement>) => void;
  selected?: boolean;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  children?: ReactNode;
  dataId?: string;
  dataName?: string;
}

export interface EntityGridProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
  columns?: 2 | 3 | 4 | 5 | 6 | 'auto';
  gap?: 'sm' | 'md' | 'lg';
  empty?: boolean;
  emptyTitle?: ReactNode;
  emptyDescription?: ReactNode;
  emptyAction?: ReactNode;
  loading?: boolean;
  skeletonCount?: number;
}

export type CardVariant = 'default' | 'panel' | 'raised' | 'frosted' | 'outline';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  interactive?: boolean;
  selected?: boolean;
  children?: ReactNode;
  as?: 'div' | 'article' | 'section';
}

export interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export interface CardTitleProps extends HTMLAttributes<HTMLHeadingElement> {
  children: ReactNode;
}

export interface CardDescriptionProps extends HTMLAttributes<HTMLParagraphElement> {
  children: ReactNode;
}

export interface CardContentProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export interface CardFooterProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}
