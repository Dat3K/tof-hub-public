import React, { type ReactNode } from 'react';

const ACCENT_CLASS = 'fce-card__text-accent';
const ACCENT_SPAN = /<span\s+class=(?:"|')fce-card__text-accent(?:"|')\s*>([\s\S]*?)<\/span>/gi;
const NAMED_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" } as const;

function decodeHtmlEntities(value: string): string {
  return value.replace(/&#x([0-9a-f]+);|&#(\d+);|&(amp|lt|gt|quot|apos);/gi, (_match, hex, decimal, named) => {
    if (named) {
      const entity = named.toLowerCase() as keyof typeof NAMED_ENTITIES;
      return NAMED_ENTITIES[entity];
    }

    const codePoint = Number.parseInt(hex || decimal, hex ? 16 : 10);
    const isUnicodeScalar =
      Number.isFinite(codePoint) &&
      codePoint >= 0 &&
      codePoint <= 0x10ffff &&
      (codePoint < 0xd800 || codePoint > 0xdfff);
    return isUnicodeScalar ? String.fromCodePoint(codePoint) : _match;
  });
}

/**
 * Renders FCE mechanic content without interpreting arbitrary dataset HTML.
 * The legacy accent span is deliberately the only supported markup.
 */
export function renderFceMechanicText(value: string | undefined): ReactNode[] {
  const source = decodeHtmlEntities(value || '');
  const parts: ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;

  ACCENT_SPAN.lastIndex = 0;

  while ((match = ACCENT_SPAN.exec(source)) !== null) {
    if (match.index > cursor) {
      parts.push(source.slice(cursor, match.index));
    }
    parts.push(
      React.createElement(
        'span',
        { className: ACCENT_CLASS, key: `accent-${match.index}` },
        match[1]
      )
    );
    cursor = match.index + match[0].length;
  }

  if (cursor < source.length || parts.length === 0) {
    parts.push(source.slice(cursor));
  }

  return parts;
}
