'use client';

import React, { useEffect, useRef, useState } from 'react';
import { HeaderLink } from './header-navigation';
import styles from './site-header.module.css';

export interface SectionSwitcherItem {
  id: string;
  href: string;
  label: string;
}

export interface SectionSwitcherProps {
  /** Text of the header brand (the current section). */
  title: string;
  /** The main hub and the section hubs, in menu order. */
  items: readonly SectionSwitcherItem[];
  /** Id of the section the page belongs to. */
  currentId: string;
  menuLabel: string;
}

/**
 * Header brand that opens a menu of the main hub and the section hubs. It reuses the language menu
 * styles; the menu opens under the brand, slightly to its left so the item text lines up with it.
 */
export function SectionSwitcher({ title, items, currentId, menuLabel }: SectionSwitcherProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuItems = () => Array.from(rootRef.current?.querySelectorAll<HTMLAnchorElement>('[role="menuitem"]') ?? []);

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const openAndFocus = () => {
    setOpen(true);
    requestAnimationFrame(() => {
      const links = menuItems();
      (links.find((link) => link.getAttribute('aria-current')) ?? links[0])?.focus();
    });
  };

  const onMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const links = menuItems();
    const index = links.indexOf(document.activeElement as HTMLAnchorElement);
    const focus = (next: number) => {
      event.preventDefault();
      links[(next + links.length) % links.length]?.focus();
    };
    if (event.key === 'ArrowDown') focus(index + 1);
    else if (event.key === 'ArrowUp') focus(index - 1);
    else if (event.key === 'Home') focus(0);
    else if (event.key === 'End') focus(links.length - 1);
    else if (event.key === 'Tab') setOpen(false);
  };

  return (
    <div className={styles.sectionSwitcher} ref={rootRef} data-section-switcher>
      <button
        ref={triggerRef}
        type="button"
        className={`${styles.brand} ${styles.brandButton} info-header__brand datamine-header__brand`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="site-section-menu"
        onClick={() => (open ? setOpen(false) : openAndFocus())}
        onKeyDown={(event) => {
          if (!open && event.key === 'ArrowDown') {
            event.preventDefault();
            openAndFocus();
          }
        }}
      >
        <span className={styles.brandText}>{title}</span>
        <svg
          className={`${styles.langChevron} ${open ? styles.langChevronOpen : ''}`}
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
        id="site-section-menu"
        className={`${styles.langDropdown} ${styles.sectionMenu} ${open ? styles.langDropdownOpen : ''}`}
        role="menu"
        aria-label={menuLabel}
        onKeyDown={onMenuKeyDown}
      >
        {items.map((item) => {
          const current = item.id === currentId;
          return (
            <HeaderLink
              key={item.id}
              href={item.href}
              role="menuitem"
              tabIndex={open ? 0 : -1}
              className={`${styles.langOption} ${current ? styles.langOptionActive : ''}`}
              aria-current={current ? 'page' : undefined}
              data-section-link={item.id}
              onClick={() => setOpen(false)}
            >
              <span className={styles.langOptionName}>{item.label}</span>
            </HeaderLink>
          );
        })}
      </div>
    </div>
  );
}
