import React from "react";

export interface GameTextLink {
  label: string;
  href: string;
}
export interface GameRichTextOptions {
  links?: readonly GameTextLink[];
  /** Selected rank in slash-separated values; omitted means the final rank. */
  rank?: number;
  /** Names kept as plain text, so digits inside them ("Calamity No. 5") are not highlighted as values. */
  plainTerms?: readonly string[];
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
function decodeEntities(value: string): string {
  const named: Record<string, string> = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: " ",
  };
  return value.replace(
    /&#x([0-9a-f]+);|&#(\d+);|&(amp|lt|gt|quot|apos|nbsp);/gi,
    (match, hex, dec, key) => {
      if (key) return named[String(key).toLowerCase()];
      const point = parseInt(hex || dec, hex ? 16 : 10);
      return point > 0 && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff)
        ? String.fromCodePoint(point)
        : match;
    },
  );
}
function safeHref(href: string): boolean {
  return /^(?:https?:\/\/|\/(?!\/)|#)/i.test(href) && !/[\u0000-\u0020\\]/.test(href);
}
function numberMarkup(text: string, rank?: number): string {
  // A season token ("S1 Expansion Effect") is highlighted whole, not only its digit.
  const pattern = /(?:\bS(?=\d))?\d+(?:[.,]\d+)?%?(?:\s*\/\s*\d+(?:[.,]\d+)?%?)*/g;
  let output = "",
    offset = 0;
  for (const match of text.matchAll(pattern)) {
    output += escapeHtml(text.slice(offset, match.index));
    const values = match[0].split(/\s*\/\s*/);
    const selected =
      rank === undefined ? values.length - 1 : Math.max(0, Math.min(values.length - 1, rank));
    output += values
      .map(
        (entry, index) =>
          `<span class="${index === selected ? "sim-num-hl" : "game-range-dim"}">${escapeHtml(entry)}</span>`,
      )
      .join('<span class="game-range-dim">/</span>');
    offset = match.index! + match[0].length;
  }
  return output + escapeHtml(text.slice(offset));
}
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function valueMarkup(text: string, options: GameRichTextOptions): string {
  const terms = (options.plainTerms || []).filter(Boolean).slice().sort((a, b) => b.length - a.length);
  if (!terms.length) return numberMarkup(text, options.rank);
  const pattern = new RegExp(terms.map(escapeRegExp).join("|"), "gi");
  let output = "",
    offset = 0;
  for (const match of text.matchAll(pattern)) {
    output += numberMarkup(text.slice(offset, match.index), options.rank) + escapeHtml(match[0]);
    offset = match.index! + match[0].length;
  }
  return output + numberMarkup(text.slice(offset), options.rank);
}
function plainMarkup(text: string, options: GameRichTextOptions): string {
  const links = (options.links || [])
    .filter((link) => link.label && safeHref(link.href))
    .slice()
    .sort((a, b) => b.label.length - a.label.length);
  if (!links.length) return valueMarkup(text, options);
  const pattern = new RegExp(
    links.map((link) => link.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"),
    "gi",
  );
  let output = "",
    offset = 0;
  for (const match of text.matchAll(pattern)) {
    output += valueMarkup(text.slice(offset, match.index), options);
    const link = links.find((entry) => entry.label.toLowerCase() === match[0].toLowerCase())!;
    output += `<a href="${escapeHtml(link.href)}" class="sim-keyword-link">${escapeHtml(match[0])}</a>`;
    offset = match.index! + match[0].length;
  }
  return output + valueMarkup(text.slice(offset), options);
}

/** `<LblRed14>` is presentation-only (rendered as plain text); a copy whose closing `</>` is missing would show the tag literally. */
const dropUnclosedPlain = (chunk: string) => chunk.replace(/<LblRed14>/gi, "");

/** Allowlisted game markup; unknown HTML is displayed as text, never executed. */
export function formatGameRichText(
  text: string | null | undefined,
  options: GameRichTextOptions = {},
): string {
  if (!text) return "";
  const normalized = decodeEntities(String(text)).replace(/\{\d+\}/g, "—");
  // Some localized item texts translate the tag names themselves. Only the observed
  // color/number aliases are allowed; arbitrary HTML stays escaped.
  const tags =
    /<(shuzhi2?|шучжи|шужи|blue|purple|orange|green|red|wenzi|LblRed14|biaoti|biru|oranye|azul|laranja|vermelho|verde|สีส้ม|สีน้ำเงิน|แว่นตาสีน้ำเงิน|ชุดเสริมสีน้ำเงิน|сини[ме]|син(?:ей|яя)|оранжев(?:ые|ая)|красн(?:ый|ых|ая)|зелен(?:ые|ый|ой|ая|ым))>([\s\S]*?)(?:<\/>|<\/\1>)|<a\s+href\s*=\s*["']([^"']*)["']\s*>([\s\S]*?)<\/a>|<br\s*\/?>/gi;
  let result = "",
    offset = 0;
  for (const match of normalized.matchAll(tags)) {
    result += plainMarkup(dropUnclosedPlain(normalized.slice(offset, match.index)), options);
    if (match[1]) {
      const content = match[2];
      result +=
        /^biaoti$/i.test(match[1])
          ? `<strong>${plainMarkup(content, options)}</strong>`
          : /^LblRed14$/i.test(match[1]) || (/\d/.test(content) && /^[\s\d+\-.,/%()sсекx×]+$/i.test(content))
          ? plainMarkup(content, options)
          : `<span class="sim-keyword-hl">${plainMarkup(content, options)}</span>`;
    } else if (match[3]) {
      result += safeHref(match[3])
        ? `<a href="${escapeHtml(match[3])}">${escapeHtml(match[4])}</a>`
        : escapeHtml(match[4]);
    } else result += "<br />";
    offset = match.index! + match[0].length;
  }
  return result + plainMarkup(dropUnclosedPlain(normalized.slice(offset)), options);
}

export function GameRichText({
  text,
  className = "",
  links,
  rank,
  plainTerms,
  density = 'default',
}: GameRichTextOptions & { text?: string | null; className?: string; density?: 'default' | 'compact' }) {
  if (!text) return null;
  return (
    <div
      className={`game-rich-text ${density==='compact'?'game-rich-text--compact ':''}${className}`}
      dangerouslySetInnerHTML={{ __html: formatGameRichText(text, { links, rank, plainTerms }) }}
    />
  );
}
