'use client';

import {useLayoutEffect, useRef} from 'react';
import {useSiteHeaderInset} from '@/components/site-shell/use-site-header-inset';

/** Keep the actual header inside its horizontal scroll panel and bounded by its table. */
export function useTableHeader(enabled = true) {
  const tableRef = useRef<HTMLTableElement>(null);
  const headerRef = useRef<HTMLTableSectionElement>(null);
  const inset = useSiteHeaderInset(enabled);
  useLayoutEffect(() => {
    const table = tableRef.current, header = headerRef.current;
    if (!enabled || !table || !header) return;
    let offset = 0, frame = 0;
    const update = () => {
      frame = 0;
      const rect = header.getBoundingClientRect();
      const originalTop = rect.top - offset;
      offset = Math.max(0, Math.min(inset - originalTop, table.getBoundingClientRect().bottom - originalTop - rect.height));
      header.style.setProperty('--table-header-offset', `${offset}px`);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    const observer = new ResizeObserver(schedule);
    observer.observe(table);
    observer.observe(header);
    window.addEventListener('scroll', schedule, {capture: true, passive: true});
    window.addEventListener('resize', schedule);
    update();
    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', schedule, true);
      window.removeEventListener('resize', schedule);
      cancelAnimationFrame(frame);
      header.style.removeProperty('--table-header-offset');
    };
  }, [enabled, inset]);
  return {tableRef, headerRef};
}
