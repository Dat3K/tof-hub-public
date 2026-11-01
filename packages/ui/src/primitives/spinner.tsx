import React from 'react';
import type { SpinnerProps } from './types';
import { LoadingIndicator } from './loading-indicator';

/** Compatibility wrapper for compact busy controls; uses the same page animation. */
export const Spinner: React.FC<SpinnerProps> = ({ size = 'md', variant: _variant, className = '', 'aria-label': label = 'Loading', ...rest }) => (
  <span role="status" aria-label={label} className={`inline-flex shrink-0 ${className}`} {...rest}>
    <LoadingIndicator size={{ sm: 16, md: 20, lg: 32, xl: 48 }[size]} />
  </span>
);
Spinner.displayName = 'Spinner';
