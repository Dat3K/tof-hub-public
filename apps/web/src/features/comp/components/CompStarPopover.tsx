'use client';

import { translateUiText, type Locale } from '@tof-hub/i18n';
import React, { useEffect, useRef, useState } from 'react';
import { CompPopover } from './CompPopover';
import { getCompStrings } from '../copy';
import { formatStars, parseSlotNumber } from '../format';
import styles from '../comp.module.css';

interface CompStarPopoverProps {
  type: 'weapon' | 'matrix';
  currentStars: number | string;
  currentCount?: 2 | 4;
  /** Second chip state: when defined, both chips are edited (2+2). */
  secondStars?: number | string;
  chipNames?: [string, string];
  /** Matrix 2+2 mode active. */
  isSplit?: boolean;
  /** Chip this popover edits in single-chip mode. */
  chipIndex?: 0 | 1;
  anchorRect: DOMRect;
  locale: Locale;
  server?: 'standard' | 'mmo';
  onSelectStars: (stars: number | string, chipIdx: 0 | 1) => void;
  onSelectCount?: (count: 2 | 4) => void;
  onSelectSplit?: () => void;
  onPickChip?: (chipIdx: 0 | 1) => void;
  onRemoveSecondary?: () => void;
  onClose: () => void;
}

function CustomStarInput({
  value,
  max,
  label,
  onCommit,
}: {
  value: number | string;
  max: number;
  label: string;
  onCommit: (value: number | string) => void;
}) {
  const isFocusedRef = useRef(false);
  const [text, setText] = useState(String(value ?? ''));

  useEffect(() => {
    if (!isFocusedRef.current) {
      setText(String(value ?? ''));
    }
  }, [value]);

  const commitValue = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) {
      onCommit(max);
      setText(String(max));
      return;
    }
    if (/^\d+$/.test(trimmed)) {
      const parsed = parseInt(trimmed, 10);
      onCommit(parsed);
      setText(String(parsed));
    } else {
      onCommit(trimmed);
      setText(trimmed);
    }
  };

  return (
    <div className={styles.popInputWrap}>
      <label className={styles.popLabel}>{label}</label>
      <input
        type="text"
        className={styles.popNumInput}
        value={text}
        onFocus={() => {
          isFocusedRef.current = true;
        }}
        onChange={(e) => {
          const val = e.target.value;
          setText(val);
          const trimmed = val.trim();
          if (trimmed) {
            if (/^\d+$/.test(trimmed)) {
              onCommit(parseInt(trimmed, 10));
            } else {
              onCommit(trimmed);
            }
          }
        }}
        onBlur={(e) => {
          isFocusedRef.current = false;
          commitValue(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            commitValue((e.target as HTMLInputElement).value);
            (e.target as HTMLInputElement).blur();
          }
        }}
        aria-label={label}
        maxLength={16}
      />
    </div>
  );
}

export const CompStarPopover: React.FC<CompStarPopoverProps> = ({
  type,
  currentStars,
  currentCount = 4,
  secondStars,
  chipNames,
  isSplit = false,
  chipIndex = 0,
  anchorRect,
  locale,
  server = 'standard',
  onSelectStars,
  onSelectCount,
  onSelectSplit,
  onPickChip,
  onRemoveSecondary,
  onClose,
}) => {
  const strings = getCompStrings(locale);
  const isMmoWeapon = type === 'weapon' && server === 'mmo';
  const popoverWidth = isMmoWeapon
    ? (typeof window === 'undefined' ? 440 : Math.min(440, Math.max(0, window.innerWidth - 20)))
    : 380;
  const maxStars = type === 'weapon' ? (server === 'mmo' ? 15 : 6) : 3;
  const hasTwoChips = secondStars !== undefined;

  const renderChipSection = (
    chipIdx: 0 | 1,
    label: string,
    pickLabel: string,
    stars: number | string
  ) => {
    const num = parseSlotNumber(stars);
    const canDecrease = num === null || num > 0;
    const canIncrease = num === null || num < maxStars;

    return (
      <div className={styles.popSection}>
        <div className={styles.popHeaderRow}>
          <span className={styles.popLabel}>
            {label}
          </span>
          {onPickChip && (
            <button type="button" className={styles.popChipPick} onClick={() => onPickChip(chipIdx)}>
              {pickLabel}
            </button>
          )}
        </div>
        <div className={`${styles.popRow} ${isMmoWeapon ? styles.popRowMmo : ''}`}>
          <button
            type="button"
            className={styles.popStepper}
            disabled={!canDecrease}
            aria-label={strings.decreaseTitle}
            onClick={() => onSelectStars(num !== null ? Math.max(0, num - 1) : 0, chipIdx)}
          >
            &minus;
          </button>
          {Array.from({ length: maxStars + 1 }, (_, i) => i).map((st) => {
            const isActive = num !== null ? num === st : String(st) === String(stars).trim();
            return (
              <button
                key={st}
                type="button"
                className={`${styles.popBtn} ${styles.popBtnStar} ${isActive ? styles.popBtnStarActive : ''}`}
                onClick={() => onSelectStars(st, chipIdx)}
              >
                ★{st}
              </button>
            );
          })}
          <button
            type="button"
            className={styles.popStepper}
            disabled={!canIncrease}
            aria-label={strings.increaseTitle}
            onClick={() => onSelectStars(num !== null ? Math.min(maxStars, num + 1) : maxStars, chipIdx)}
          >
            +
          </button>
        </div>
        <CustomStarInput
          value={stars}
          max={maxStars}
          label={strings.customStarsLabel}
          onCommit={(v) => onSelectStars(v, chipIdx)}
        />
      </div>
    );
  };

  const isMatrix = type === 'matrix';
  const title = isMatrix
    ? isSplit
      ? translateUiText('2+2 Overlapping Matrix Sets', locale)
      : strings.matrixChipset
    : strings.starsWeapon;
  const subtitle = hasTwoChips
    ? `${formatStars(currentStars, maxStars)} / ${formatStars(secondStars, maxStars)}`
    : isMatrix
      ? `${isSplit ? 2 : currentCount}pc • ${formatStars(currentStars, 3)}`
      : formatStars(currentStars, maxStars);

  const singleNum = parseSlotNumber(currentStars);
  const singleCanDecrease = singleNum === null || singleNum > 0;
  const singleCanIncrease = singleNum === null || singleNum < maxStars;

  return (
    <CompPopover anchorRect={anchorRect} width={popoverWidth} className={isMmoWeapon ? styles.popMmo : ''} onClose={onClose}
      ariaLabel={isMatrix ? strings.matrixSelectorAria : strings.starSelectorAria} title={title} subtitle={subtitle}>

      {isMatrix && onSelectCount && onSelectSplit && (
        <div className={styles.popSection}>
          <span className={styles.popLabel}>
            {isSplit ? strings.configurationLabel : strings.setPiecesLabel}
          </span>
          <div className={`${styles.popRow} ${isMmoWeapon ? styles.popRowMmo : ''}`}>
            <button
              type="button"
              className={`${styles.popBtn} ${styles.popBtnMatrix} ${!isSplit && currentCount === 4 ? styles.popBtnMatrixActive : ''}`}
              onClick={() => onSelectCount(4)}
            >
              {strings.count4Label}
            </button>
            <button
              type="button"
              className={`${styles.popBtn} ${styles.popBtnMatrix} ${!isSplit && currentCount === 2 ? styles.popBtnMatrixActive : ''}`}
              onClick={() => onSelectCount(2)}
            >
              {strings.count2Label}
            </button>
            <button
              type="button"
              className={`${styles.popBtn} ${styles.popBtnMatrix} ${isSplit ? styles.popBtnMatrixActive : ''}`}
              onClick={onSelectSplit}
            >
              {strings.splitLabel}
            </button>
          </div>
        </div>
      )}

      {hasTwoChips && chipNames ? (
        <>
          {renderChipSection(
            0,
            isMatrix ? `Chip 1 (Back): ${chipNames[0]}` : `Weapon 1 (Back): ${chipNames[0]}`,
            isMatrix ? strings.changeChip1 : strings.changeWeapon1,
            currentStars
          )}
          {renderChipSection(
            1,
            isMatrix ? `Chip 2 (Front): ${chipNames[1]}` : `Weapon 2 (Front): ${chipNames[1]}`,
            isMatrix ? strings.changeChip2 : strings.changeWeapon2,
            secondStars
          )}
          {!isMatrix && onRemoveSecondary && (
            <div className={styles.popSection}>
              <button type="button" className={`${styles.popBtn} ${styles.popRemove}`} onClick={onRemoveSecondary}>
                {strings.removeSecondary}
              </button>
            </div>
          )}
        </>
      ) : (
        <div className={styles.popSection}>
          <div className={isMmoWeapon ? styles.popMmoAdvancementHeader : undefined}>
            <span className={styles.popLabel}>{strings.advancementLevel}</span>
            {isMmoWeapon && (
              <div className={styles.popMmoStepControls}>
                <button
                  type="button"
                  className={styles.popStepper}
                  disabled={!singleCanDecrease}
                  aria-label={strings.decreaseTitle}
                  onClick={() => onSelectStars(singleNum !== null ? Math.max(0, singleNum - 1) : 0, chipIndex)}
                >
                  &minus;
                </button>
                <button
                  type="button"
                  className={styles.popStepper}
                  disabled={!singleCanIncrease}
                  aria-label={strings.increaseTitle}
                  onClick={() => onSelectStars(singleNum !== null ? Math.min(maxStars, singleNum + 1) : maxStars, chipIndex)}
                >
                  +
                </button>
              </div>
            )}
          </div>
          <div className={isMmoWeapon ? styles.popMmoStarGrid : styles.popRow}>
            {!isMmoWeapon && (
              <button
                type="button"
                className={styles.popStepper}
                disabled={!singleCanDecrease}
                aria-label={strings.decreaseTitle}
                onClick={() => onSelectStars(singleNum !== null ? Math.max(0, singleNum - 1) : 0, chipIndex)}
              >
                &minus;
              </button>
            )}
            {Array.from({ length: maxStars + 1 }, (_, i) => i).map((st) => {
              const isActive = singleNum !== null ? singleNum === st : String(st) === String(currentStars).trim();
              return (
                <button
                  key={st}
                  type="button"
                  className={`${styles.popBtn} ${styles.popBtnStar} ${isActive ? styles.popBtnStarActive : ''}`}
                  onClick={() => onSelectStars(st, chipIndex)}
                >
                  ★{st}
                </button>
              );
            })}
            {!isMmoWeapon && (
              <button
                type="button"
                className={styles.popStepper}
                disabled={!singleCanIncrease}
                aria-label={strings.increaseTitle}
                onClick={() => onSelectStars(singleNum !== null ? Math.min(maxStars, singleNum + 1) : maxStars, chipIndex)}
              >
                +
              </button>
            )}
          </div>
          <CustomStarInput
            value={currentStars}
            max={maxStars}
            label={strings.customStarsLabel}
            onCommit={(v) => onSelectStars(v, chipIndex)}
          />
        </div>
      )}
    </CompPopover>
  );
};
