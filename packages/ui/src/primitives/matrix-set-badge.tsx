import React from 'react';

/** Shared matrix set count, preserving the Simulacra reference presentation. */
export function MatrixSetBadge({children,className='',...props}:React.HTMLAttributes<HTMLSpanElement>) {
  return <span {...props} className={`tof-matrix-set-badge ${className}`.trim()}>{children}</span>;
}
