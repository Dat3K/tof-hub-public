'use client';

import { type Locale } from '@tof-hub/i18n';
import React, { useEffect, useRef, useState } from 'react';
import { CompPopover } from './CompPopover';
import { getCompStrings } from '../copy';
import { parseSlotNumber } from '../format';
import styles from '../comp.module.css';

interface CompRankPopoverProps {
  currentRank: number | string;
  anchorRect: DOMRect;
  locale: Locale;
  onSelectRank: (rank: number | string) => void;
  onClose: () => void;
}

const RANK_ACTIVE_CLASS = [
  '',
  '',
  '',
  styles.popBtnR3Active,
  styles.popBtnR4Active,
  styles.popBtnR5Active,
];

export const CompRankPopover: React.FC<CompRankPopoverProps> = ({
  currentRank,
  anchorRect,
  locale,
  onSelectRank,
  onClose,
}) => {
  const strings = getCompStrings(locale);
  const isFocusedRef = useRef(false);
  const [text, setText] = useState(String(currentRank ?? '5'));

  useEffect(() => {
    if (!isFocusedRef.current) {
      setText(String(currentRank ?? '5'));
    }
  }, [currentRank]);


  const num = parseSlotNumber(currentRank);
  const canDecrease = num === null || num > 0;
  const canIncrease = num === null || num < 5;

  const commitRank = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) {
      onSelectRank(5);
      setText('5');
      return;
    }
    if (/^\d+$/.test(trimmed)) {
      const parsed = parseInt(trimmed, 10);
      onSelectRank(parsed);
      setText(String(parsed));
    } else {
      onSelectRank(trimmed);
      setText(trimmed);
    }
  };

  const ranks = [0, 1, 2, 3, 4, 5];
  const rankSub =
    num !== null ? `${strings.rankLabel} ${num}` : String(currentRank);

  return (
    <CompPopover anchorRect={anchorRect} width={310} ariaLabel={strings.rankSelectorAria} onClose={onClose}
      title={strings.relicAdvancement} subtitle={rankSub}>

      <div className={styles.popSection}>
        <span className={styles.popLabel}>{strings.rankRange}</span>
        <div className={styles.popRow}>
          <button
            type="button"
            className={styles.popStepper}
            disabled={!canDecrease}
            aria-label={strings.decreaseTitle}
            onClick={() => onSelectRank(num !== null ? Math.max(0, num - 1) : 0)}
          >
            &minus;
          </button>
          {ranks.map((rk) => {
            const isActive =
              num !== null
                ? rk === num
                : String(rk) === String(currentRank).trim() ||
                  `R${rk}`.toLowerCase() === String(currentRank).trim().toLowerCase();
            return (
              <button
                key={rk}
                type="button"
                className={`${styles.popBtn} ${isActive ? `${styles.popBtnActive} ${RANK_ACTIVE_CLASS[rk] ?? ''}` : ''}`}
                onClick={() => onSelectRank(rk)}
              >
                R{rk}
              </button>
            );
          })}
          <button
            type="button"
            className={styles.popStepper}
            disabled={!canIncrease}
            aria-label={strings.increaseTitle}
            onClick={() => onSelectRank(num !== null ? Math.min(5, num + 1) : 5)}
          >
            +
          </button>
        </div>
        <div className={styles.popInputWrap}>
          <label className={styles.popLabel}>{strings.customRankLabel}</label>
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
                  onSelectRank(parseInt(trimmed, 10));
                } else {
                  onSelectRank(trimmed);
                }
              }
            }}
            onBlur={(e) => {
              isFocusedRef.current = false;
              commitRank(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                commitRank((e.target as HTMLInputElement).value);
                (e.target as HTMLInputElement).blur();
              }
            }}
            aria-label={strings.customRankLabel}
            maxLength={16}
          />
        </div>
      </div>
    </CompPopover>
  );
};
