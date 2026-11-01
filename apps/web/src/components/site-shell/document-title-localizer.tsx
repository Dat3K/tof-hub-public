'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { translateUiText } from '@tof-hub/i18n';
import { useI18n } from '@/lib/i18n';

const SEPARATOR = ' | ';

/** Page metadata is static English; translate the short page name in the tab title for the current culture. */
function localizeTitle(title: string, locale: string): string {
  if (locale === 'en') return title;
  const direct = translateUiText(title, locale);
  if (direct !== title) return direct;
  const at = title.lastIndexOf(SEPARATOR);
  if (at < 0) return title;
  const name = title.slice(0, at);
  const translated = translateUiText(name, locale);
  return translated === name ? title : `${translated}${title.slice(at)}`;
}

export function DocumentTitleLocalizer() {
  const { locale } = useI18n();
  const pathname = usePathname();

  useEffect(() => {
    const apply = () => {
      const next = localizeTitle(document.title, locale);
      if (next !== document.title) document.title = next;
    };
    apply();
    // React replaces the <title> element on navigation, so watch the whole head rather than one node.
    const observer = new MutationObserver(apply);
    observer.observe(document.head, { childList: true, characterData: true, subtree: true });
    return () => observer.disconnect();
  }, [locale, pathname]);

  return null;
}
