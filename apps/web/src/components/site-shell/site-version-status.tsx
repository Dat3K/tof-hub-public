'use client';

import { localized } from '@tof-hub/i18n';
import { type Locale } from '@tof-hub/i18n';
import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n';
import {
  useVersionStatus,
  type SiteVersionStatusData,
  type VersionStatusState,
  VERSION_STATUS_STRINGS,
} from '@/lib/version-status';
import styles from './site-header.module.css';

export interface SiteVersionStatusProps {
  className?: string;
  initialData?: Partial<SiteVersionStatusData>;
  version?: string;
  exportDate?: string;
  sourceBranch?: string;
  liveGlobalVersion?: string;
  updateAvailable?: boolean;
  state?: VersionStatusState;
  popoverId?: string;
}

export function SiteVersionStatus({
  className,
  initialData,
  version: versionProp,
  exportDate: exportDateProp,
  sourceBranch: sourceBranchProp,
  liveGlobalVersion: liveGlobalVersionProp,
  updateAvailable: updateAvailableProp,
  state: stateProp,
  popoverId = 'site-header-popover',
}: SiteVersionStatusProps) {
  const { locale: i18nLocale } = useI18n();
  const lang: Locale = i18nLocale;
  const strings = localized(VERSION_STATUS_STRINGS, lang);

  const { status, isLoading } = useVersionStatus(initialData);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  // Resolved state
  const effectiveState: VersionStatusState =
    stateProp || (isLoading ? 'loading' : status.state);

  const effectiveVersion: string | null =
    versionProp !== undefined ? versionProp : status.datasetVersion;

  const effectiveExportDate: string =
    exportDateProp !== undefined
      ? exportDateProp
      : localized(status.formattedExportDate, lang) || '—';

  const effectiveSourceBranch: string =
    sourceBranchProp !== undefined
      ? sourceBranchProp
      : localized(status.sourceBranch, lang) || '—';

  const effectiveGlobalVersion: string | null =
    liveGlobalVersionProp !== undefined
      ? liveGlobalVersionProp
      : status.globalVersion;

  const effectiveUpdateAvailable: boolean =
    updateAvailableProp !== undefined
      ? updateAvailableProp
      : status.updateAvailable;

  // Click outside and Escape key handling
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (exportRef.current && !exportRef.current.contains(target)) {
        setIsExportOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && isExportOpen) {
        setIsExportOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isExportOpen]);

  // Determine badge text
  let badgeText: string;
  if (effectiveState === 'loading') {
    badgeText = strings.loading;
  } else if (effectiveState === 'unavailable' || !effectiveVersion) {
    badgeText = strings.versionUnavailable;
  } else {
    badgeText = effectiveVersion;
  }

  // Determine aria-label
  const ariaTooltip = [
    effectiveExportDate !== '—'
      ? `${strings.updated}: ${effectiveExportDate}`
      : '',
    effectiveSourceBranch !== '—' ? effectiveSourceBranch : '',
    effectiveGlobalVersion ? `${strings.global}: ${effectiveGlobalVersion}` : '',
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div
      className={`${styles.exportInfo} info-header__export-info datamine-header__export-info ${
        isExportOpen ? 'is-open' : ''
      } ${className || ''}`}
      ref={exportRef}
      tabIndex={0}
      role="button"
      aria-haspopup="dialog"
      aria-expanded={isExportOpen}
      aria-controls={popoverId}
      aria-label={ariaTooltip || badgeText}
      data-datamine-export-info
      data-version-status-state={effectiveState}
      onPointerEnter={(event) => {
        if (event.pointerType !== 'touch') setIsExportOpen(true);
      }}
      onPointerLeave={(event) => {
        if (event.pointerType !== 'touch') setIsExportOpen(false);
      }}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('a')) return;
        setIsExportOpen((prev) => !prev);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          if ((e.target as HTMLElement).closest('a, button')) return;
          e.preventDefault();
          setIsExportOpen((prev) => !prev);
        }
      }}
    >
      <span
        className={`${styles.versionBadge} info-header__version-badge datamine-header__version-badge`}
        data-datamine-field="version"
      >
        {badgeText}
      </span>
      <span
        className={`${styles.exportClientName} info-header__export-client-name datamine-header__export-client-name`}
      >
        {strings.snapshot}
      </span>

      {/* Detailed Provenance & Update Tooltip Dialog */}
      <div
        className={`${styles.exportTooltip} ${
          isExportOpen ? styles.exportTooltipOpen : ''
        } info-header__export-tooltip datamine-header__export-tooltip`}
        id={popoverId}
        role="region"
        aria-label={strings.tooltipTitle}
      >
        <span
          className={`${styles.exportTooltipTitle} datamine-header__export-tooltip-title`}
        >
          {strings.tooltipTitle}
        </span>

        {effectiveExportDate !== '—' && (
          <div
            className={`${styles.exportTooltipRow} datamine-header__export-tooltip-row`}
          >
            <span
              className={`${styles.exportTooltipKey} datamine-header__export-tooltip-key`}
            >
              {strings.updated}
            </span>
            <span
              className={`${styles.exportTooltipValue} datamine-header__export-tooltip-value`}
            >
              {effectiveExportDate}
            </span>
          </div>
        )}

        {effectiveSourceBranch !== '—' && (
          <div
            className={`${styles.exportTooltipRow} datamine-header__export-tooltip-row`}
          >
            <span
              className={`${styles.exportTooltipKey} datamine-header__export-tooltip-key`}
            >
              {strings.sources}
            </span>
            <span
              className={`${styles.exportTooltipValue} datamine-header__export-tooltip-value`}
            >
              {effectiveSourceBranch}
            </span>
          </div>
        )}

        {effectiveGlobalVersion && (
          <div
            className={`${styles.exportTooltipRow} datamine-header__export-tooltip-row`}
          >
            <span
              className={`${styles.exportTooltipKey} datamine-header__export-tooltip-key`}
            >
              {strings.global}
            </span>
            <span
              className={`${styles.exportTooltipValue} datamine-header__export-tooltip-value`}
            >
              {effectiveGlobalVersion}
            </span>
          </div>
        )}

        {effectiveUpdateAvailable && effectiveGlobalVersion && (
          <div
            className={`${styles.exportUpdateSection} datamine-header__export-update-section`}
          >
            <span
              className={`${styles.exportUpdateTitle} datamine-header__export-update-title`}
            >
              {strings.updateAvailable}
            </span>
            <p
              className={`${styles.exportUpdateText} datamine-header__export-update-text`}
            >
              {strings.updateNotice(effectiveGlobalVersion)}
            </p>
            <p
              className={`${styles.exportUpdateSubtext} datamine-header__export-update-subtext`}
            >
              {strings.updateHelpText}
            </p>
            <Link
              className={`${styles.exportHelpLink} datamine-header__export-help-link`}
              href={strings.howToHelpHref}
            >
              {strings.howToHelp}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
