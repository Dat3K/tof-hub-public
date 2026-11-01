'use client';

import { useEffect } from 'react';
import { pageTitle } from '@/lib/seo';

/** Tab title follows the selection: the open entity's name, otherwise the section name. */
export function useInfoDocumentTitle(section: string, entityName?: string | null): void {
  useEffect(() => {
    document.title = pageTitle(entityName || section);
  }, [entityName, section]);
}
