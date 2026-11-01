/**
 * Zero-dependency word diffing implementation (bundled, no CDN dependency).
 *
 * Implements token-level LCS (Longest Common Subsequence) diffing between old and new text,
 * unit-merging for numeric balance shifts (e.g. "9%" -> "12%"), and HTML rendering
 * with <ins class="diff-ins"> and <del class="diff-del">.
 */

export interface DiffPart {
  value: string;
  added?: boolean;
  removed?: boolean;
}

function escapeHtml(unsafe: string): string {
  if (!unsafe) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Tokenize string into words, whitespace runs, and punctuation.
 */
function tokenizeWords(text: string): string[] {
  if (!text) return [];
  // Tokenizes by sequences of non-whitespace/non-punctuation, whitespace runs, or single punctuation
  const tokens = text.match(/([^\s\p{P}]+|\s+|[\p{P}])/gu);
  return tokens || [];
}

/**
 * Computes word-level diff between two strings.
 */
export function diffWords(oldStr: string, newStr: string): DiffPart[] {
  const normOld = String(oldStr ?? '').replace(/&#0*39;|&apos;/g, "'");
  const normNew = String(newStr ?? '').replace(/&#0*39;|&apos;/g, "'");

  if (normOld === normNew) {
    return [{ value: normNew }];
  }

  const oldTokens = tokenizeWords(normOld);
  const newTokens = tokenizeWords(normNew);
  const m = oldTokens.length;
  const n = newTokens.length;

  if (m === 0 && n === 0) {
    return [];
  }
  if (m === 0) {
    return [{ value: normNew, added: true }];
  }
  if (n === 0) {
    return [{ value: normOld, removed: true }];
  }

  // Dynamic programming LCS table
  // Since individual game descriptions are typically a few dozen words, DP is fast and exact
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      if (oldTokens[i] === newTokens[j]) {
        dp[i + 1][j + 1] = dp[i][j] + 1;
      } else {
        dp[i + 1][j + 1] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  // Backtrack to assemble the diff
  let i = m;
  let j = n;
  const rawDiff: DiffPart[] = [];
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldTokens[i - 1] === newTokens[j - 1]) {
      rawDiff.unshift({ value: oldTokens[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      rawDiff.unshift({ value: newTokens[j - 1], added: true });
      j--;
    } else {
      rawDiff.unshift({ value: oldTokens[i - 1], removed: true });
      i--;
    }
  }

  // 1. Merge consecutive tokens with the same added/removed flag
  const merged: DiffPart[] = [];
  for (const part of rawDiff) {
    const last = merged[merged.length - 1];
    if (
      last &&
      Boolean(last.added) === Boolean(part.added) &&
      Boolean(last.removed) === Boolean(part.removed)
    ) {
      last.value += part.value;
    } else {
      merged.push({ ...part });
    }
  }

  // 2. Legacy parity: Merge adjacent removed/added numbers with trailing unit (%, s, сек, sec)
  for (let k = 0; k < merged.length - 1; k++) {
    const curr = merged[k];
    const next = merged[k + 1];
    if (
      curr.removed &&
      next.added &&
      k + 2 < merged.length &&
      !merged[k + 2].added &&
      !merged[k + 2].removed
    ) {
      const next2 = merged[k + 2];
      const unitMatch = next2.value.match(/^(\s*%|\s*s\b|\s*сек|\s*sec)/i);
      if (unitMatch) {
        const unit = unitMatch[1].trim();
        curr.value += unit;
        next.value += unit;
        next2.value = next2.value.slice(unitMatch[0].length);
      }
    }
  }

  return merged;
}

/**
 * Highlights numeric values in unchanged description text.
 */
function highlightNumbers(text: string): string {
  const safe = escapeHtml(text);
  return safe.replace(
    /(\b\d+(?:[.,]\d+)?%?(?:\/\d+(?:[.,]\d+)?%*)*(?:s(?![a-zA-Z])|с(?![а-яА-Я]))?)/gi,
    '<span class="sim-num-hl">$1</span>'
  );
}

/**
 * Formats old and new values into an HTML diff string matching legacy index.html.
 */
export function formatDiffHtml(
  oldVal: string | number | undefined | null,
  newVal: string | number | undefined | null
): string {
  const oldText = oldVal != null ? String(oldVal) : '';
  const newText = newVal != null ? String(newVal) : '';

  if (!oldText && !newText) return '';
  if (!oldText) {
    return highlightNumbers(newText).replace(/\n/g, '<br/>');
  }
  if (!newText) {
    return `<del class="diff-del">${highlightNumbers(oldText)}</del>`.replace(/\n/g, '<br/>');
  }
  if (oldText === newText) {
    return highlightNumbers(newText).replace(/\n/g, '<br/>');
  }

  const parts = diffWords(oldText, newText);

  const resultHtml = parts
    .map((part) => {
      if (part.added) {
        return `<ins class="diff-ins">${escapeHtml(part.value)}</ins>`;
      }
      if (part.removed) {
        return `<del class="diff-del">${escapeHtml(part.value)}</del>`;
      }
      return highlightNumbers(part.value);
    })
    .join('');

  return resultHtml.replace(/\n/g, '<br/>');
}
