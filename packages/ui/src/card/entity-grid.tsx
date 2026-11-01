import React from 'react';
import type { EntityGridProps } from './types';
import { LoadingState } from '../primitives/loading-state';
import { EmptyState } from '../primitives/empty-state';

function getColumnClasses(columns: 2 | 3 | 4 | 5 | 6 | 'auto' = 'auto'): string {
  switch (columns) {
    case 2:
      return 'grid-cols-2';
    case 3:
      return 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3';
    case 4:
      return 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4';
    case 5:
      return 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5';
    case 6:
      return 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6';
    case 'auto':
    default:
      return 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6';
  }
}

function getGapClasses(gap: 'sm' | 'md' | 'lg' = 'md'): string {
  switch (gap) {
    case 'sm':
      return 'gap-2 sm:gap-3';
    case 'lg':
      return 'gap-4 sm:gap-6';
    case 'md':
    default:
      return 'gap-3 sm:gap-4.5';
  }
}

export const EntityGrid: React.FC<EntityGridProps> = ({
  children,
  columns = 'auto',
  gap = 'md',
  empty = false,
  emptyTitle,
  emptyDescription,
  emptyAction,
  loading = false,
  skeletonCount = 12,
  className = '',
  ...rest
}) => {
  if (loading) {
    return <LoadingState className={className} />;
  }

  if (empty) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
        className={className}
      />
    );
  }

  return (
    <div
      className={`sim-grid grid ${getColumnClasses(columns)} ${getGapClasses(gap)} ${className}`.trim()}
      {...rest}
    >
      {children}
    </div>
  );
};

EntityGrid.displayName = 'EntityGrid';
