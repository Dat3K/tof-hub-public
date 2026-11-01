'use client';

import React from 'react';
import type { EntityCardProps } from './types';
import type { RarityVariant, ElementVariant, PropertyVariant } from '../primitives/types';
import { Badge } from '../primitives/badge';
import { LoadingState } from '../primitives/loading-state';
import { TransparencyCheckerboard } from '../primitives/transparency-checkerboard';

function getRarityClasses(rarity?: RarityVariant): {
  cardClass: string;
  badgeVariant: RarityVariant;
  glowColor: string;
} {
  const norm = rarity?.toLowerCase() as RarityVariant | undefined;
  switch (norm) {
    case 'ssr':
      return {
        cardClass:
          'border-[rgba(245,217,122,0.35)] hover:border-[#f5d97a] hover:shadow-[0_10px_24px_rgba(0,0,0,0.55),0_0_20px_rgba(230,162,60,0.35)]',
        badgeVariant: 'ssr',
        glowColor: 'rgba(230, 162, 60, 0.35)',
      };
    case 'sr':
      return {
        cardClass:
          'border-[rgba(168,85,247,0.35)] hover:border-[#c084fc] hover:shadow-[0_10px_24px_rgba(0,0,0,0.55),0_0_20px_rgba(168,85,247,0.35)]',
        badgeVariant: 'sr',
        glowColor: 'rgba(168, 85, 247, 0.35)',
      };
    case 'r':
      return {
        cardClass:
          'border-[rgba(59,130,246,0.35)] hover:border-[#3b82f6] hover:shadow-[0_10px_24px_rgba(0,0,0,0.55),0_0_20px_rgba(59,130,246,0.35)]',
        badgeVariant: 'r',
        glowColor: 'rgba(59, 130, 246, 0.35)',
      };
    case 'n':
      return {
        cardClass:
          'border-[rgba(16,185,129,0.35)] hover:border-[#10b981] hover:shadow-[0_10px_24px_rgba(0,0,0,0.55),0_0_20px_rgba(16,185,129,0.35)]',
        badgeVariant: 'n',
        glowColor: 'rgba(16, 185, 129, 0.35)',
      };
    default:
      return {
        cardClass:
          'border-[rgba(255,255,255,0.08)] hover:border-[rgba(120,160,255,0.3)] hover:shadow-[0_14px_32px_rgba(0,0,0,0.5)]',
        badgeVariant: 'ssr',
        glowColor: 'rgba(43, 166, 223, 0.25)',
      };
  }
}

function getAspectRatioStyle(aspectRatio?: string): string {
  switch (aspectRatio) {
    case 'square':
      return 'aspect-square';
    case 'video':
      return 'aspect-video';
    case 'banner':
      return 'aspect-[2/1]';
    case 'portrait':
    default:
      return 'aspect-[1/1.25]';
  }
}

export const EntityCard: React.FC<EntityCardProps> & {
  Art: typeof EntityCardArt;
  Badges: typeof EntityCardBadges;
  RarityBadge: typeof EntityCardRarityBadge;
  CornerBadge: typeof EntityCardCornerBadge;
  Info: typeof EntityCardInfo;
  Title: typeof EntityCardTitle;
  Subtitle: typeof EntityCardSubtitle;
  Description: typeof EntityCardDescription;
  Footer: typeof EntityCardFooter;
} = ({
  id,
  presentation='catalog',
  title,
  subtitle,
  description,
  image,
  imageAlt,
  aspectRatio = 'portrait',
  artPosition = 'center 18%',
  artZoom = 1.42,
  showTransparencyCheckerboard = true,
  rarity,
  element,
  property,
  role,
  badges = [],
  raritySlot,
  cornerSlot,
  artBottomLeftSlot,
  footerSlot,
  href,
  onClick,
  selected = false,
  disabled = false,
  loading = false,
  className = '',
  children,
  dataId,
  dataName,
}) => {
  if (loading) {
    return <LoadingState className={className} />;
  }

  const { cardClass, badgeVariant } = getRarityClasses(rarity);

  const isInteractive = Boolean(href || onClick);

  const baseClasses =
    'sim-grid-card group relative flex flex-col bg-[rgba(16,13,22,0.92)] rounded-[14px] overflow-hidden transition-all duration-200 backdrop-blur-[8px] text-inherit no-underline select-none outline-none';

  const interactiveClasses = isInteractive && !disabled
    ? 'cursor-pointer hover:-translate-y-1 focus-visible:ring-2 focus-visible:ring-[#2ba6df]'
    : '';

  const selectedClasses = selected
    ? 'ring-2 ring-[#2ba6df] border-[#2ba6df] shadow-[0_0_18px_rgba(43,166,223,0.4)]'
    : '';

  const disabledClasses = disabled
    ? 'opacity-50 grayscale pointer-events-none cursor-not-allowed'
    : '';

  const isPicker=presentation==='picker'||presentation==='picker-compact';
  const combinedClasses = isPicker?`tool-picker-card ${presentation==='picker-compact'?'tool-picker-card--compact':''} group ${interactiveClasses} ${selectedClasses} ${disabledClasses} ${className}`.trim():`${baseClasses} ${cardClass} ${interactiveClasses} ${selectedClasses} ${disabledClasses} ${className}`.trim();

  // If children provided, render declarative composition container
  const pickerContent=<>
    <div className="tool-picker-card-badges">{badges}{raritySlot|| (rarity&&<Badge variant={badgeVariant} size="sm">{rarity.toUpperCase()}</Badge>)}</div>
    <div className="tool-picker-card-art">{image&&<img src={image} alt={imageAlt||(typeof title==='string'?title:'Entity preview')} loading="lazy" decoding="async" style={{objectPosition:artPosition,transform:`scale(${artZoom})`}}/>}</div>
    <div className="tool-picker-card-info"><h3 title={typeof title==='string'?title:undefined}>{title}</h3>{subtitle&&<div className="tool-picker-card-subtitle">{subtitle}</div>}{description&&<p>{description}</p>}{footerSlot}</div>
  </>;
  const content = children || (isPicker?pickerContent:'' ) || (
    <>
      {/* Art Box */}
      <div className={`sim-grid-card__art-box relative w-full ${getAspectRatioStyle(aspectRatio)} bg-[#0d111a] overflow-hidden`}>
        {showTransparencyCheckerboard && <TransparencyCheckerboard />}
        {image && (
          <img
            src={image}
            alt={imageAlt || (typeof title === 'string' ? title : 'Entity preview')}
            loading="lazy"
            decoding="async"
            className="sim-grid-card__art w-full h-full object-cover transition-transform duration-300"
            style={{
              objectPosition: artPosition,
              transform: `scale(${artZoom})`,
            }}
          />
        )}

        {/* Art gradient overlay */}
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none bg-gradient-to-t from-[#0a0e18]/90 via-[#0a0e18]/20 to-transparent"
        />

        {/* Top-Left Badges Overlay */}
        {(badges.length > 0 || element || property || role) && (
          <div className="sim-grid-card__badges-overlay absolute top-2 left-2 z-10 flex flex-row items-center gap-1.5 max-w-[calc(100%-60px)]">
            {element && <Badge variant={element} size="sm">{element}</Badge>}
            {property && <Badge variant={property} size="sm">{property}</Badge>}
            {role && <Badge variant={role} size="sm">{role}</Badge>}
            {badges.map((b, i) => (
              <React.Fragment key={i}>{b}</React.Fragment>
            ))}
          </div>
        )}

        {/* Top-Right Rarity Overlay */}
        {(rarity || raritySlot) && (
          <div className="sim-grid-card__rarity-overlay absolute top-2 right-2 z-10 flex items-center gap-1">
            {raritySlot || (rarity && (
              <Badge variant={badgeVariant} size="sm" className="font-extrabold uppercase tracking-wider">
                {rarity.toUpperCase()}
              </Badge>
            ))}
          </div>
        )}

        {/* Bottom-Right Corner Slot (e.g. Weapon Badge or Star Rank) */}
        {cornerSlot && (
          <div className="sim-grid-card__weapon-badge absolute bottom-2 right-2 z-10">
            {cornerSlot}
          </div>
        )}

        {/* Bottom-Left Art Slot (e.g. a passive stat badge) */}
        {artBottomLeftSlot && (
          <div className="sim-grid-card__art-bottom-left absolute bottom-2 left-2 z-10">
            {artBottomLeftSlot}
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="sim-grid-card__info p-2.5 bg-[#121622]/90 border-t border-white/5 flex flex-col gap-0.5 flex-1 min-w-0">
        <h3 className="sim-grid-card__name font-bold text-white text-[0.9375rem] leading-snug truncate">
          {title}
        </h3>

        {subtitle && (
          <div className="sim-grid-card__weapon text-xs text-[#2ba6df] font-medium leading-tight truncate group-hover:text-white transition-colors">
            {subtitle}
          </div>
        )}

        {description && (
          <div className="text-xs text-[#9ca3af] line-clamp-2 mt-1 leading-normal">
            {description}
          </div>
        )}

        {footerSlot && <div className="mt-auto pt-1">{footerSlot}</div>}
      </div>
    </>
  );

  const commonProps = {
    id,
    'data-id': dataId,
    'data-name': dataName,
    'data-rarity': rarity,
    'data-element': element,
    className: combinedClasses,
  };

  if (href && !disabled) {
    return (
      <a href={href} onClick={onClick} {...commonProps}>
        {content}
      </a>
    );
  }

  if (onClick && !disabled) {
    return (
      <button type="button" onClick={onClick} {...commonProps}>
        {content}
      </button>
    );
  }

  return <div {...commonProps}>{content}</div>;
};

// Compound Subcomponents
export const EntityCardArt: React.FC<{
  src: string;
  alt?: string;
  aspectRatio?: string;
  artPosition?: string;
  artZoom?: number | string;
  className?: string;
}> = ({
  src,
  alt = 'Entity art',
  aspectRatio = 'portrait',
  artPosition = 'center 18%',
  artZoom = 1.42,
  className = '',
}) => (
  <div className={`sim-grid-card__art-box relative w-full ${getAspectRatioStyle(aspectRatio)} bg-[#0d111a] overflow-hidden ${className}`.trim()}>
    <TransparencyCheckerboard />
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      className="sim-grid-card__art w-full h-full object-cover transition-transform duration-300"
      style={{
        objectPosition: artPosition,
        transform: `scale(${artZoom})`,
      }}
    />
    <div
      aria-hidden="true"
      className="absolute inset-0 pointer-events-none bg-gradient-to-t from-[#0a0e18]/90 via-[#0a0e18]/20 to-transparent"
    />
  </div>
);

export const EntityCardBadges: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => (
  <div className={`sim-grid-card__badges-overlay absolute top-2 left-2 z-10 flex flex-row items-center gap-1.5 max-w-[calc(100%-60px)] ${className}`.trim()}>
    {children}
  </div>
);

export const EntityCardRarityBadge: React.FC<{ rarity: RarityVariant; className?: string }> = ({
  rarity,
  className = '',
}) => (
  <div className={`sim-grid-card__rarity-overlay absolute top-2 right-2 z-10 flex items-center gap-1 ${className}`.trim()}>
    <Badge variant={rarity} size="sm" className="font-extrabold uppercase tracking-wider">
      {rarity.toUpperCase()}
    </Badge>
  </div>
);

export const EntityCardCornerBadge: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => (
  <div className={`sim-grid-card__weapon-badge absolute bottom-2 right-2 z-10 ${className}`.trim()}>
    {children}
  </div>
);

export const EntityCardInfo: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => (
  <div className={`sim-grid-card__info p-2.5 bg-[#121622]/90 border-t border-white/5 flex flex-col gap-0.5 flex-1 min-w-0 ${className}`.trim()}>
    {children}
  </div>
);

export const EntityCardTitle: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => (
  <h3 className={`sim-grid-card__name font-bold text-white text-[0.9375rem] leading-snug truncate ${className}`.trim()}>
    {children}
  </h3>
);

export const EntityCardSubtitle: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => (
  <div className={`sim-grid-card__weapon text-xs text-[#2ba6df] font-medium leading-tight truncate ${className}`.trim()}>
    {children}
  </div>
);

export const EntityCardDescription: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => (
  <div className={`text-xs text-[#9ca3af] line-clamp-2 mt-1 leading-normal ${className}`.trim()}>
    {children}
  </div>
);

export const EntityCardFooter: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => (
  <div className={`mt-auto pt-1 ${className}`.trim()}>{children}</div>
);

EntityCard.Art = EntityCardArt;
EntityCard.Badges = EntityCardBadges;
EntityCard.RarityBadge = EntityCardRarityBadge;
EntityCard.CornerBadge = EntityCardCornerBadge;
EntityCard.Info = EntityCardInfo;
EntityCard.Title = EntityCardTitle;
EntityCard.Subtitle = EntityCardSubtitle;
EntityCard.Description = EntityCardDescription;
EntityCard.Footer = EntityCardFooter;
EntityCard.displayName = 'EntityCard';
