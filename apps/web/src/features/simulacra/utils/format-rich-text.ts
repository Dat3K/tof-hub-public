/**
 * Formats rich text descriptions from game data for display.
 * Reproduces formatRichText from legacy simulacra-core.js.
 */

import type { SimulacraKeywordMatcher } from "./keyword-links";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function decodeHtmlEntities(value: string): string {
  let decoded = value;

  for (let pass = 0; pass < 3; pass += 1) {
    const next = decoded.replace(
      /&#x([0-9a-f]+);|&#(\d+);|&(amp|lt|gt|quot|apos);/gi,
      (match, hex, decimal, named) => {
        if (named) {
          const entities: Record<string, string> = {
            amp: "&",
            apos: "'",
            gt: ">",
            lt: "<",
            quot: '"',
          };
          return entities[String(named).toLowerCase()] || match;
        }

        const codePoint = Number.parseInt(hex || decimal, hex ? 16 : 10);
        const isUnicodeScalar =
          Number.isFinite(codePoint) &&
          codePoint >= 0 &&
          codePoint <= 0x10ffff &&
          (codePoint < 0xd800 || codePoint > 0xdfff);
        return isUnicodeScalar ? String.fromCodePoint(codePoint) : match;
      },
    );

    if (next === decoded) break;
    decoded = next;
  }

  return decoded;
}

export function normalizeSkillFormulaSpacing(text: string): string {
  if (!text) return "";
  return decodeHtmlEntities(text)
    .replace(/(\d+(?:\.\d+)?%?)\s*\+\s*(\d+(?:\.\d+)?)/g, "$1 + $2")
    .replace(/(\b(?:plus|плюс)\b)/gi, "+")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function applyKeywordMatcher(
  html: string,
  keywordMatcher: SimulacraKeywordMatcher | null | undefined,
): string {
  if (!html || !keywordMatcher) return html;

  const tokens = html.split(/(<[^>]+>)/g);
  let inAnchor = false;
  let inKeywordSpan = false;

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.startsWith("<")) {
      if (/^<a\b/i.test(token)) inAnchor = true;
      else if (/^<\/a>/i.test(token)) inAnchor = false;
      else if (/^<span\b[^>]*class="[^"]*sim-keyword-hl/i.test(token)) {
        inKeywordSpan = true;
      } else if (/^<\/span>/i.test(token) && inKeywordSpan) {
        inKeywordSpan = false;
      }
      continue;
    }

    if (inAnchor) continue;
    tokens[index] = token.replace(keywordMatcher.regex, (matched) => {
      const replacement = keywordMatcher.replace(matched);
      if (inKeywordSpan && replacement.startsWith("<span")) return matched;
      return replacement;
    });
  }

  return tokens
    .join("")
    .replace(
      /<span\b[^>]*class="[^"]*sim-keyword-hl[^"]*"[^>]*>(<a class="sim-keyword-link"[^>]*>[\s\S]*?<\/a>)<\/span>/g,
      "$1",
    );
}

export function formatRichText(
  text: string | null | undefined,
  keywordMatcher?: SimulacraKeywordMatcher | null,
): string {
  if (!text) return "";

  const normalized = decodeHtmlEntities(String(text));
  const spaced = normalizeSkillFormulaSpacing(normalized);
  const sanitized = spaced.replace(/\{[0-9]+\}/g, "—");

  let result: string;
  if (sanitized.includes("<shuzhi>") || sanitized.includes("<blue>")) {
    result = sanitized
      .replace(/<shuzhi>([\s\S]*?)(?:<\/>|<\/shuzhi>)/g, (_match, content) => {
        let prefix = "";
        let cleanContent = String(content).trim();
        const plusMatch = cleanContent.match(/^(\+\s*)/);
        if (plusMatch) {
          prefix = "+ ";
          cleanContent = cleanContent.slice(plusMatch[1].length).trim();
        }
        const isNum = /^[\s\d+\-.,/%{}()sсекx×]+$/i.test(cleanContent) && /\d/.test(cleanContent);
        const safe = escapeHtml(cleanContent);
        return isNum
          ? `${prefix}<span class="sim-num-hl">${safe}</span>`
          : `<span class="sim-keyword-hl">${safe}</span>`;
      })
      .replace(/<blue>([\s\S]*?)(?:<\/>|<\/blue>)/g, (_match, content) => {
        return `<span class="sim-keyword-hl">${escapeHtml(content)}</span>`;
      });
  } else {
    const safe = escapeHtml(sanitized);
    result = safe.replace(
      /(\b\d+(?:[.,]\d+)?%?(?:\/\d+(?:[.,]\d+)?%*)*(?:s(?![a-zA-Z])|с(?![а-яА-Я]))?)/gi,
      '<span class="sim-num-hl">$1</span>',
    );
  }

  return applyKeywordMatcher(result, keywordMatcher);
}

/**
 * Formats the matrix-specific markup emitted by the legacy exporter.
 * Matrix values are kept as slash-separated tiers so the selected star is
 * blue while the other tiers remain visible but subdued.
 */
export function formatMatrixEffectHtml(
  text: string | null | undefined,
  starIdx: number | null = 3,
  keywordMatcher?: SimulacraKeywordMatcher | null,
): string {
  if (!text) return "—";

  const source = decodeHtmlEntities(String(text))
    .replace(/\{[0-9]+\}%?/g, "—")
    .replace(/\{[^{}]*\}/g, "—")
    .trim();
  if (!source) return "—";

  const renderRange = (range: string) => {
    const parts = range.split("/").map((part) => part.trim());
    const rendered = parts
      .map((part, index) => {
        const isActive =
          starIdx === null ||
          index === starIdx ||
          (starIdx >= parts.length && index === parts.length - 1);
        const className = isActive
          ? "sim-num-hl sim-matrix-num sim-matrix-num--lit"
          : "sim-num-hl sim-matrix-num sim-matrix-num--dim";
        return `<span class="${className}">${escapeHtml(part)}</span>`;
      })
      .join('<span class="sim-matrix-num--dim sim-matrix-num--slash">/</span>');
    const safeRange = escapeHtml(parts.join("/"));
    return `<span class="sim-matrix-tier-range" data-range="${safeRange}" title="${safeRange}">${rendered}</span>`;
  };

  if (!source.includes('class="mx-num"') && !source.includes('class="mx-kw"')) {
    let plain = /<[a-z][\s\S]*>/i.test(source) ? source : escapeHtml(source);
    plain = plain.replace(/(\d+(?:\.\d+)?%?(?:\/\d+(?:\.\d+)?%?)+)/g, renderRange);
    if (!/<[a-z]/i.test(source)) {
      plain = plain.replace(
        /(?<![a-zA-Z0-9_\-/])(\d+(?:\.\d+)?%?)(?![a-zA-Z0-9_\-/])/g,
        '<span class="sim-num-hl sim-matrix-num sim-matrix-num--lit">$1</span>',
      );
    }
    return applyKeywordMatcher(plain, keywordMatcher);
  }

  const normalized = source.replace(
    /(?:<span class="mx-num">([^<]+)<\/span>\s*\/\s*)+<span class="mx-num">([^<]+)<\/span>/g,
    (fullMatch) => {
      const nums = Array.from(fullMatch.matchAll(/<span class="mx-num">([^<]+)<\/span>/g)).map(
        (match) => match[1],
      );
      return `<span class="mx-num" data-combined="true">${nums.join("/")}</span>`;
    },
  );

  let output = normalized.replace(
    /<span class="mx-num"(?:[^>]*)>([\s\S]*?)<\/span>/g,
    (_match, content: string) => {
      const parts = content.split("/").map((part) => part.trim());
      if (parts.length === 1) {
        return `<span class="sim-num-hl sim-matrix-num sim-matrix-num--lit">${escapeHtml(parts[0])}</span>`;
      }

      const range = parts.join("/");
      const rendered = parts
        .map((part, index) => {
          const isActive =
            starIdx === null ||
            index === starIdx ||
            (starIdx >= parts.length && index === parts.length - 1);
          const className = isActive
            ? "sim-num-hl sim-matrix-num sim-matrix-num--lit"
            : "sim-num-hl sim-matrix-num sim-matrix-num--dim";
          return `<span class="${className}">${escapeHtml(part)}</span>`;
        })
        .join('<span class="sim-matrix-num--dim sim-matrix-num--slash">/</span>');

      return `<span class="sim-matrix-tier-range" data-range="${escapeHtml(range)}" title="${escapeHtml(range)}">${rendered}</span>`;
    },
  );

  output = output.replace(
    /<span class="mx-kw">([\s\S]*?)<\/span>/g,
    (_match, content: string) =>
      `<span class="sim-keyword-hl sim-matrix-keyword">${escapeHtml(content)}</span>`,
  );

  return applyKeywordMatcher(output, keywordMatcher);
}
