import React from 'react';
import type { EmptyStateProps } from './types';

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'No items found',
  description = 'Try adjusting your search query or active filter selections.',
  icon,
  action,
  className = '',
  ...rest
}) => {
  const defaultIcon = (
    <svg
      className="w-12 h-12 text-[#9ca3af]/40 mx-auto"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
      />
    </svg>
  );

  return (
    <div
      role="status"
      className={`empty-state flex flex-col items-center justify-center text-center p-8 sm:p-12 rounded-xl bg-[#100d14]/60 border border-white/5 backdrop-blur-sm max-w-lg mx-auto my-6 ${className}`.trim()}
      {...rest}
    >
      <div className="mb-4">{icon || defaultIcon}</div>
      {title && (
        <h3 className="text-lg font-semibold text-[#f3f4f6] mb-1.5">{title}</h3>
      )}
      {description && (
        <p className="text-sm text-[#9ca3af] max-w-sm mb-6 leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
};

EmptyState.displayName = 'EmptyState';
