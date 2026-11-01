'use client';

import { createLocaleCopies } from '@tof-hub/i18n';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useI18n } from '@/lib/i18n';
import { LANGUAGES, LANGUAGE_MENU_LOCALES, getLanguageMenuLocale, localizedUi, translateUiText, type Locale } from '@tof-hub/i18n';
import { LanguageFlag } from './language-flag';
import { SiteVersionStatus } from './site-version-status';
import { SectionSwitcher } from './section-switcher';
import styles from './site-header.module.css';
import { INFO_NAV_ITEMS, DATAMINE_NAV_ITEMS, TOOLS_NAV_ITEMS, MAIN_NAV_ITEMS, type NavItem } from './site-navigation';

export type SiteSection = 'info' | 'datamine' | 'tools' | 'main' | string;

export type { NavItem } from './site-navigation';

export interface SiteHeaderProps {
  section?: SiteSection;
  currentRoute?: string;
  brandTitle?: string;
  brandHref?: string;
  navItems?: NavItem[];
  version?: string;
  exportDate?: string;
  sourceBranch?: string;
  liveGlobalVersion?: string;
  updateAvailable?: boolean;
  className?: string;
}

const ROUTE_ALIASES: Record<string, string> = {
  outfits: 'cosmetics',
  'outfits/': 'cosmetics',
  tops: 'ranking',
  'tops/': 'ranking',
};

const INFO_BRANDS: Record<string, { en: string; ru: string }> = {
  hub: { en: 'Info', ru: 'База знаний' },
  simulacra: { en: 'Simulacra & Weapons', ru: 'Симулякры и оружие' },
  matrices: { en: 'Matrices Database', ru: 'База данных матриц' },
  relics: { en: 'Relics Database', ru: 'База данных реликвий' },
  pets: { en: 'Smart Servants', ru: 'Смарт-слуги' },
  food: { en: 'Food Recipes', ru: 'Рецепты еды' },
  cosmetics: { en: 'Cosmetics Gallery', ru: 'Галерея косметики' },
  outfits: { en: 'Outfits Gallery', ru: 'Галерея костюмов' },
  arts: { en: 'Artworks Gallery', ru: 'Арт-галерея' },
};

const DATAMINE_BRANDS: Record<string, { en: string; ru: string }> = {
  hub: { en: 'Datamine Archive', ru: 'Архив Datamine' },
  oow: { en: 'Origin of War', ru: 'Истоки войны' },
  fce: { en: 'Boss Mechanics', ru: 'Механики боссов' },
  bygone: { en: 'Bygone Phantasm', ru: 'Былой фантазм' },
  seq: { en: 'Sequential Analysis', ru: 'Анализ Sequential' },
  raids: { en: 'Raids', ru: 'Рейды' },
  multype: { en: 'Multype Datamine', ru: 'Датамайн Multype' },
  items: { en: 'Item Datamine', ru: 'Датамайн предметов' },
  about: { en: 'About the data', ru: 'О данных сайта' },
  changelog: { en: 'Changelog', ru: 'История изменений' },
  contribute: { en: 'Contribute', ru: 'Помочь проекту' },
  privacy: { en: 'Privacy Policy', ru: 'Конфиденциальность' },
  projects: { en: 'ToF Resources & Projects', ru: 'Ресурсы и проекты ToF' },
};

const TOOLS_BRANDS: Record<string, { en: string; ru: string }> = {
  hub: { en: 'Tools', ru: 'Инструменты' },
  ranking: { en: 'Ranking', ru: 'Рейтинг' },
  build: { en: 'Build card', ru: 'Карточка билда' },
  optimizer: { en: 'Gear optimizer', ru: 'Оптимайзер гира' },
  wish: { en: 'Special Orders Wish Tracker', ru: 'История круток и симулятор' },
  comp: { en: 'Squad & Raid Comp', ru: 'Конструктор отрядов' },
};



const MAIN_BRAND = createLocaleCopies({ en: 'ToF Hub', ru: 'База данных и знаний ToF' });



export function SiteHeader({
  section: sectionProp,
  currentRoute: currentRouteProp,
  brandTitle,
  brandHref,
  navItems,
  version,
  exportDate,
  sourceBranch,
  liveGlobalVersion,
  updateAvailable,
  className,
}: SiteHeaderProps) {
  const pathname = usePathname();

  const section = useMemo(() => {
    if (sectionProp) return sectionProp;
    if (!pathname || pathname === '/') return 'main';
    if (/^\/about(\/|$)/.test(pathname)) return 'main';
    if (pathname.startsWith('/datamine')) return 'datamine';
    if (pathname.startsWith('/tools')) return 'tools';
    if (pathname.startsWith('/info')) return 'info';
    if (/^\/(about|changelog|contribute|privacy|projects)(\/|$)/.test(pathname)) {
      return 'main';
    }
    return 'main';
  }, [sectionProp, pathname]);

  const currentRoute = useMemo(() => {
    if (currentRouteProp !== undefined) return currentRouteProp;
    if (!pathname || pathname === '/') return '';
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length > 1) return segments[1];
    if (segments.length === 1 && !['info', 'datamine', 'tools'].includes(segments[0])) {
      return segments[0];
    }
    return '';
  }, [currentRouteProp, pathname]);

  const { locale: i18nLocale, setLocale, t } = useI18n();
  const selectedLang = i18nLocale || 'en';
  const menuLocale = getLanguageMenuLocale(selectedLang);
  const [isLangOpen, setIsLangOpen] = useState(false);
  const [hasOverflowLeft, setHasOverflowLeft] = useState(false);
  const [hasOverflowRight, setHasOverflowRight] = useState(false);

  const navWrapRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const langRef = useRef<HTMLDivElement>(null);
  const langTriggerRef = useRef<HTMLButtonElement>(null);
  const animFrameRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    if (!isLangOpen) return;
    const options = langRef.current;
    const active = options?.querySelector<HTMLButtonElement>('[aria-current="true"]')
      ?? options?.querySelector<HTMLButtonElement>('[role="menuitem"]');
    active?.focus();
  }, [isLangOpen]);

  // Normalize route and aliases
  const rawRoute = (currentRoute || '').toLowerCase().replace(/^\/|\/$/g, '');
  const activeRoute = ROUTE_ALIASES[rawRoute] || rawRoute;

  // Resolve active brand title and href
  const resolvedBrandHref =
    brandHref ||
    (section === 'info'
      ? '/info'
      : section === 'datamine'
        ? '/datamine'
        : section === 'tools'
          ? '/tools'
          : '/');

  let resolvedBrandTitle = brandTitle;
  if (!resolvedBrandTitle) {
    if (section === 'info') {
      const entry = INFO_BRANDS[activeRoute] || INFO_BRANDS.hub;
      resolvedBrandTitle = localizedUi(entry, selectedLang);
    } else if (section === 'datamine') {
      const entry = DATAMINE_BRANDS[activeRoute] || DATAMINE_BRANDS.hub;
      resolvedBrandTitle = localizedUi(entry, selectedLang);
    } else if (section === 'tools') {
      const entry = TOOLS_BRANDS[activeRoute] || TOOLS_BRANDS.hub;
      resolvedBrandTitle = localizedUi(entry, selectedLang);

    } else {
      resolvedBrandTitle = localizedUi(MAIN_BRAND, selectedLang);
    }
  }

  resolvedBrandTitle = translateUiText(resolvedBrandTitle, selectedLang);

  // Resolve navigation items
  const resolvedNavItems =
    navItems ||
    (section === 'info'
      ? INFO_NAV_ITEMS
      : section === 'datamine'
        ? DATAMINE_NAV_ITEMS
        : section === 'tools'
          ? TOOLS_NAV_ITEMS
          : MAIN_NAV_ITEMS);

  // Check overflow state for fades and arrows
  const updateOverflow = useCallback(() => {
    const nav = navRef.current;
    if (!nav) return;
    const scrollLeft = nav.scrollLeft;
    const maxScroll = nav.scrollWidth - nav.clientWidth;
    setHasOverflowLeft(scrollLeft > 4);
    setHasOverflowRight(maxScroll - scrollLeft > 4);
  }, []);

  // Smooth scroll helper for overflow arrows
  const smoothScrollNav = useCallback(
    (delta: number, duration = 320) => {
      const nav = navRef.current;
      if (!nav) return;

      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }

      const startLeft = nav.scrollLeft;
      const maxScroll = nav.scrollWidth - nav.clientWidth;
      const targetLeft = Math.max(0, Math.min(maxScroll, startLeft + delta));
      const distance = targetLeft - startLeft;
      if (Math.abs(distance) < 1) return;

      const startTime = performance.now();
      const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

      function step(currentTime: number) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        if (nav) {
          nav.scrollLeft = startLeft + distance * easeOutCubic(progress);
        }

        if (progress < 1) {
          animFrameRef.current = requestAnimationFrame(step);
        } else {
          animFrameRef.current = null;
          updateOverflow();
        }
      }

      animFrameRef.current = requestAnimationFrame(step);
    },
    [updateOverflow]
  );

  // Initialize scroll listeners, touch interruption, and ResizeObserver
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    nav.addEventListener('scroll', updateOverflow, { passive: true });

    const cancelScrollAnim = () => {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    };

    nav.addEventListener('touchstart', cancelScrollAnim, { passive: true });
    nav.addEventListener('wheel', cancelScrollAnim, { passive: true });

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(updateOverflow);
      ro.observe(nav);
    } else {
      window.addEventListener('resize', updateOverflow, { passive: true });
    }

    // Auto-center active route on mount / route change
    requestAnimationFrame(() => {
      const activeLink = nav.querySelector(`.${styles.navLinkActive}`);
      if (activeLink && nav.clientWidth > 0 && nav.scrollWidth > nav.clientWidth) {
        const navRect = nav.getBoundingClientRect();
        const linkRect = activeLink.getBoundingClientRect();
        if (linkRect.left < navRect.left || linkRect.right > navRect.right) {
          activeLink.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'instant' });
        }
      }
      updateOverflow();
    });

    return () => {
      nav.removeEventListener('scroll', updateOverflow);
      nav.removeEventListener('touchstart', cancelScrollAnim);
      nav.removeEventListener('wheel', cancelScrollAnim);
      if (ro) {
        ro.disconnect();
      } else {
        window.removeEventListener('resize', updateOverflow);
      }
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [activeRoute, updateOverflow]);

  // Click outside and Escape keyboard handling for language dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (langRef.current && !langRef.current.contains(target)) {
        setIsLangOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        if (isLangOpen) {
          setIsLangOpen(false);
          langTriggerRef.current?.focus();
        }
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isLangOpen]);

  const handleLangSelect = (code: Locale) => {
    setLocale(code);
    setIsLangOpen(false);
    langTriggerRef.current?.focus();
  };

  const handleDropdownKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const options = langRef.current?.querySelectorAll<HTMLButtonElement>(
        '[role="menuitem"]'
      );
      if (!options || options.length === 0) return;
      const focusedIndex = Array.from(options).indexOf(
        document.activeElement as HTMLButtonElement
      );
      if (event.key === 'ArrowDown') {
        const nextIndex = focusedIndex === -1 ? 0 : (focusedIndex + 1) % options.length;
        options[nextIndex]?.focus();
      } else {
        const prevIndex =
          focusedIndex <= 0 ? options.length - 1 : focusedIndex - 1;
        options[prevIndex]?.focus();
      }
    } else if (event.key === 'Home') {
      event.preventDefault();
      const first = langRef.current?.querySelector<HTMLButtonElement>(
        '[role="menuitem"]'
      );
      first?.focus();
    } else if (event.key === 'End') {
      event.preventDefault();
      const options = langRef.current?.querySelectorAll<HTMLButtonElement>(
        '[role="menuitem"]'
      );
      if (options && options.length > 0) {
        options[options.length - 1]?.focus();
      }
    } else if (event.key === 'Tab') {
      setIsLangOpen(false);
    }
  };

  const navWrapClasses = [
    styles.navWrap,
    'info-header__nav-wrap',
    'datamine-header__nav-wrap',
    hasOverflowLeft ? styles.hasOverflowLeft : '',
    hasOverflowRight ? styles.hasOverflowRight : '',
  ]
    .filter(Boolean)
    .join(' ');

  const headerClasses = [
    styles.siteHeader,
    'info-header',
    'datamine-header',
    className || '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <>
      <header
        className={headerClasses}
        role="banner"
        data-site-header
        data-info-header
        data-datamine-header
        data-section={section}
        data-current={activeRoute}
      >
        <div className={`${styles.inner} info-header__inner datamine-header__inner`}>
          {/* Brand Logo / Section Title */}
          {section === 'main' || section === 'info' || section === 'datamine' || section === 'tools' ? (
            <SectionSwitcher
              title={resolvedBrandTitle}
              currentId={section}
              menuLabel={translateUiText(selectedLang === 'ru' ? 'Разделы сайта' : 'Site sections', selectedLang)}
              items={[
                { id: 'main', href: '/', label: translateUiText(selectedLang === 'ru' ? 'Главная' : 'Main hub', selectedLang) },
                ...MAIN_NAV_ITEMS.map((item) => ({ id: item.id, href: item.href, label: localizedUi(item.label, selectedLang) })),
              ]}
            />
          ) : (
            <Link
              prefetch={false}
              className={`${styles.brand} info-header__brand datamine-header__brand`}
              href={resolvedBrandHref}
            >
              {resolvedBrandTitle}
            </Link>
          )}

          {/* Navigation Track with Overflow Indicators */}
          <div className={navWrapClasses} ref={navWrapRef}>
            <button
              type="button"
              className={`${styles.navArrow} ${styles.navArrowLeft} info-header__nav-arrow info-header__nav-arrow--left`}
              aria-label={translateUiText("Scroll left", selectedLang)}
              tabIndex={-1}
              onClick={(e) => {
                e.preventDefault();
                smoothScrollNav(-150);
              }}
            >
              <svg
                viewBox="0 0 24 24"
                width="12"
                height="12"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>

            <nav
              className={`${styles.nav} info-header__nav datamine-header__nav`}
              ref={navRef}
              aria-label={
                section === 'datamine'
                  ? (translateUiText(selectedLang === 'ru' ? 'Разделы Datamine' : 'Datamine sections', selectedLang))
                  : section === 'info'
                    ? (translateUiText(selectedLang === 'ru' ? 'Разделы каталога' : 'Catalog sections', selectedLang))
                    : (translateUiText(selectedLang === 'ru' ? 'Разделы каталога' : 'Catalog sections', selectedLang))
              }
            >
              {resolvedNavItems.map((item) => {
                const isActive =
                  item.id === activeRoute ||
                  (pathname
                    ? item.href !== '/' &&
                      (pathname === item.href || pathname.startsWith(item.href + '/'))
                    : false);
                const linkClasses = [
                  styles.navLink,
                  'info-header__link',
                  'datamine-header__link',
                  isActive ? `${styles.navLinkActive} is-active` : '',
                ]
                  .filter(Boolean)
                  .join(' ');

                return (
                  <Link
                    key={item.id}
                    prefetch={false}
                    href={item.href}
                    className={linkClasses}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    {localizedUi(item.label, selectedLang)}
                  </Link>
                );
              })}
            </nav>

            <button
              type="button"
              className={`${styles.navArrow} ${styles.navArrowRight} info-header__nav-arrow info-header__nav-arrow--right`}
              aria-label={translateUiText("Scroll right", selectedLang)}
              tabIndex={-1}
              onClick={(e) => {
                e.preventDefault();
                smoothScrollNav(150);
              }}
            >
              <svg
                viewBox="0 0 24 24"
                width="12"
                height="12"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>

          {/* Right Utility Cluster */}
          <div className={`${styles.rightArea} info-header__right-area datamine-header__right-area`}>
            {/* Language Switcher */}
            <div
              className={`${styles.language} info-header__language datamine-header__language ${
                isLangOpen ? `${styles.languageOpen} is-open` : ''
              }`}
              ref={langRef}
              data-info-language-selector
            >
              <button
                ref={langTriggerRef}
                type="button"
                className={`${styles.langTrigger} ${
                  isLangOpen ? styles.langTriggerOpen : ''
                } info-header__lang-trigger datamine-header__lang-trigger`}
                data-info-lang-trigger
                aria-haspopup="true"
                aria-expanded={isLangOpen}
                aria-controls="info-header-lang-menu"
                aria-label={
                  t('shell.language.ariaWithCurrent', { lang: LANGUAGES[menuLocale].label })
                }
                onClick={() => setIsLangOpen((prev) => !prev)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (!isLangOpen) {
                      setIsLangOpen(true);
                    } else {
                      langRef.current?.querySelector<HTMLButtonElement>('[aria-current="true"]')?.focus();
                    }
                  }
                }}
              >
                <LanguageFlag locale={menuLocale} className={`${styles.flag} info-header__flag`} />
                <span className={`${styles.langCurrentCode} info-header__lang-current-code`}>
                  {LANGUAGES[menuLocale].short}
                </span>
                <svg
                  className={`${styles.langChevron} ${
                    isLangOpen ? styles.langChevronOpen : ''
                  } info-header__lang-chevron`}
                  viewBox="0 0 10 6"
                  width="8"
                  height="5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M1 1l4 4 4-4" />
                </svg>
              </button>

              <div
                id="info-header-lang-menu"
                className={`${styles.langDropdown} ${
                  isLangOpen ? styles.langDropdownOpen : ''
                } info-header__lang-dropdown datamine-header__lang-dropdown`}
                role="menu"
                aria-label={t('shell.language.aria')}
                onKeyDown={handleDropdownKeyDown}
              >
                {LANGUAGE_MENU_LOCALES.map((code) => (
                  <button
                    key={code}
                    type="button"
                    className={`${styles.langOption} ${menuLocale === code ? `${styles.langOptionActive} is-active` : ''} info-header__lang-option datamine-header__lang-option`}
                    data-info-lang={code}
                    data-datamine-language={code}
                    role="menuitem"
                    aria-current={menuLocale === code ? 'true' : undefined}
                    lang={code}
                    onClick={() => handleLangSelect(code)}
                  >
                    <LanguageFlag locale={code} className={`${styles.flag} info-header__flag`} />
                    <span className={`${styles.langOptionName} info-header__lang-option-name`}>{LANGUAGES[code].label}</span>
                    {menuLocale === code ? <span className={styles.langCheck} aria-hidden="true">✓</span> : null}
                  </button>
                ))}
              </div>
            </div>

            {/* Real Dataset Snapshot & Version Status Widget */}
            <SiteVersionStatus
              version={version}
              exportDate={exportDate}
              sourceBranch={sourceBranch}
              liveGlobalVersion={liveGlobalVersion}
              updateAvailable={updateAvailable}
            />
          </div>
        </div>
      </header>
    </>
  );
}

// Lightweight wrappers over SiteHeader for backwards compatibility / semantic convenience
export function InfoHeader(props: Omit<SiteHeaderProps, 'section'>) {
  return <SiteHeader section="info" {...props} />;
}

export function DatamineHeader(props: Omit<SiteHeaderProps, 'section'>) {
  return <SiteHeader section="datamine" {...props} />;
}

export function ToolsHeader(props: Omit<SiteHeaderProps, 'section'>) {
  return <SiteHeader section="tools" {...props} />;
}
