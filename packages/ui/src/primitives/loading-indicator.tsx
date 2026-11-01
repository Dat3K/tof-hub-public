import React from 'react';

/** Decorative animation shared by page loading, regions and busy controls. */
export function LoadingIndicator({ size = 64 }: { size?: number }) {
  return <span className="tof-loading__animation" aria-hidden="true"
    style={{ '--loading-size': `${size}px` } as React.CSSProperties}>
    <span className="tof-loading__outer" />
    <span className="tof-loading__inner" />
    <span className="tof-loading__dot" />
  </span>;
}
