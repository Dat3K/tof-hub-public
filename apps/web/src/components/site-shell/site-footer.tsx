'use client';

import { localizedUi } from '@tof-hub/i18n';
import { createLocaleCopies, type Locale } from '@tof-hub/i18n';
import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useI18n } from '@/lib/i18n';
import { GITHUB_REPO_URL } from '@/lib/project-links';
import styles from './site-footer.module.css';

export interface FooterLinkItem {
  key: string;
  href: string;
  external?: boolean;
  infoOnly?: boolean;
}

export const FOOTER_LINKS: FooterLinkItem[] = [
  { key: 'about', href: '/about/' },
  { key: 'story', href: '/story/' },
  { key: 'projects', href: '/projects/' },
  { key: 'contribute', href: '/contribute/' },
  { key: 'feedback', href: '/feedback/?from=footer' },
  { key: 'changelog', href: '/changelog/' },
  { key: 'simulacraChangelog', href: '/info/simulacra/changelog/', infoOnly: true },
  { key: 'privacy', href: '/privacy/' },
  { key: 'github', href: GITHUB_REPO_URL, external: true },
];

export const FOOTER_TRANSLATIONS = createLocaleCopies({
  en: {
    about: 'About the data',
    story: 'Project story',
    projects: 'ToF resources',
    contribute: 'Contribute',
    feedback: 'Give feedback',
    privacy: 'Privacy',
    simulacraChangelog: 'Simulacra changelog',
    changelog: 'Changelog',
    github: 'GitHub',
    navAria: 'Site information',
    githubAria: 'GitHub (opens in a new tab)',
  },
  ru: {
    about: 'О данных сайта',
    story: 'История проекта',
    projects: 'Ресурсы ToF',
    contribute: 'Помочь проекту',
    feedback: 'Оценить сайт',
    privacy: 'Конфиденциальность',
    simulacraChangelog: 'Ченджлог симулякров',
    changelog: 'История изменений',
    github: 'GitHub',
    navAria: 'Информация о сайте',
    githubAria: 'GitHub (откроется в новой вкладке)',
  },
} as const);

export interface SiteFooterProps {
  section?: string;
  isInfoPage?: boolean;
  lang?: Locale;
  className?: string;
}

export function SiteFooter({
  section,
  isInfoPage: isInfoProp,
  lang: langProp,
  className,
}: SiteFooterProps) {
  const pathname = usePathname();

  const isInfo = useMemo(() => {
    if (typeof isInfoProp === 'boolean') {
      return isInfoProp;
    }
    if (section === 'info') {
      return true;
    }
    if (pathname) {
      return pathname.startsWith('/info/') || pathname === '/info';
    }
    return false;
  }, [isInfoProp, section, pathname]);

  const resolvedSection = useMemo(() => {
    if (section) return section;
    if (isInfo) return 'info';
    if (!pathname || pathname === '/') return 'main';
    if (/^\/about(\/|$)/.test(pathname)) return 'main';
    if (pathname.startsWith('/datamine')) return 'datamine';
    if (pathname.startsWith('/tools')) return 'tools';
    if (/^\/(about|changelog|contribute|privacy|projects)(\/|$)/.test(pathname)) {
      return 'datamine';
    }
    return 'main';
  }, [section, isInfo, pathname]);

  const { locale: i18nLocale } = useI18n();
  const currentLang = langProp ?? i18nLocale;
  const [currentYear, setCurrentYear] = useState<number>(2026);

  useEffect(() => {
    setCurrentYear(new Date().getFullYear());
  }, []);

  // Expose global window API for backwards compatibility / legacy tests
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as unknown as { DatamineFooter?: unknown }).DatamineFooter = {
        renderAll: () => {},
        getLinks: () => FOOTER_LINKS,
        getTranslations: () => FOOTER_TRANSLATIONS,
      };
    }
  }, []);

  const t = localizedUi(FOOTER_TRANSLATIONS, currentLang) || FOOTER_TRANSLATIONS.en;

  const visibleLinks = useMemo(() => {
    return FOOTER_LINKS.filter((link) => {
      if (link.infoOnly && !isInfo) {
        return false;
      }
      return true;
    });
  }, [isInfo]);

  // Canvas pages reserve the viewport for their card and bottom actions.
  if (/^\/tools\/build(\/(mmo|profiles))*\/?$|^\/datamine\/fce\/?$/.test(pathname ?? '')) return null;

  return (
    <footer
      className={`${styles.footer} datamine-footer ${className || ''}`}
      data-datamine-footer
      data-footer
      data-footer-ready="true"
      data-section={resolvedSection}
    >
      <div className={`${styles.inner} datamine-footer__inner`}>
        <span className={`${styles.copyright} datamine-footer__copyright`}>
          © <span data-footer-year>{currentYear}</span> smilekritik
        </span>

        <nav
          className={`${styles.nav} datamine-footer__nav`}
          aria-label={t.navAria}
        >
          {visibleLinks.map((link) => {
            const label = t[link.key as keyof typeof t] || link.key;

            if (link.external) {
              return (
                <a
                  key={link.key}
                  href={link.href}
                  className={`${styles.link} ${styles.github} datamine-footer__link`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={t.githubAria}
                  title={label}
                >
                  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
                    <path
                      fill="currentColor"
                      d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"
                    />
                  </svg>
                </a>
              );
            }

            return (
              <Link
                key={link.key}
                prefetch={false}
                href={link.href}
                className={`${styles.link} datamine-footer__link`}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </footer>
  );
}
