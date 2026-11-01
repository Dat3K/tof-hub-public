'use client';

import React from 'react';
import styles from '@/components/pill-switcher/pill-switcher.module.css';
import tones from './datamine-tabs.module.css';

export interface DatamineTabItem<T extends string = string> {
  id: T;
  label: React.ReactNode;
}

export interface DatamineTabsProps<T extends string = string> {
  activeTab: T;
  onChange: (tabId: T) => void;
  tabs: DatamineTabItem<T>[];
  ariaLabel?: string;
  className?: string;
  tone?: 'gold' | 'neutral';
}

export function DatamineTabs<T extends string = string>({
  activeTab,
  onChange,
  tabs,
  ariaLabel = 'Navigation Tabs',
  className = '',
  tone = 'gold',
}: DatamineTabsProps<T>) {
  return (
    <nav className={`${styles.mainTabs} ${className}`.trim()} aria-label={ariaLabel}>
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            type="button"
            className={tone === 'neutral'
              ? `${tones.tab} ${isActive ? tones.active : ''}`
              : `${styles.tabBtn} ${isActive ? styles.tabActive : ''}`}
            aria-pressed={isActive}
            onClick={() => onChange(tab.id)}
          >
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
