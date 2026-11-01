import type { ReactNode } from 'react';
import { localizeUiCopy, type Locale } from '@tof-hub/i18n';
import { guideRichText } from './guide-rich-data';

const TAGS = /<(b|c|i|m)>(.*?)<\/\1>/g;

/** Inline markup `<b>`, `<c>` (code), `<i>`, `<m>` (highlight) keeps translated sentences whole instead of cutting them at JSX nodes. */
function rich(text: string): ReactNode {
  const nodes: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(TAGS)) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const [, tag, inner] = match;
    const key = nodes.length;
    nodes.push(tag === 'b' ? <strong key={key}>{inner}</strong>
      : tag === 'c' ? <code key={key}>{inner}</code>
      : tag === 'i' ? <em key={key}>{inner}</em>
      : <mark key={key} className="guide-template-highlight">{inner}</mark>);
    last = match.index + match[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return <>{nodes}</>;
}

function richCopy(locale: Locale): Record<string, ReactNode> {
  const entries = guideRichText[locale] ?? {};
  return Object.fromEntries(Object.entries(entries).map(([key, text]) => [
    key,
    text.includes('\n') ? <>{text.split('\n').map((paragraph, index) => <p key={index}>{rich(paragraph)}</p>)}</> : rich(text),
  ]));
}

/** Locale copies for the guide: plain strings go through the UI phrase table, formatted paragraphs come from the rich table. */
export function guideLocaleCopies<T extends object>(en: T): Partial<Record<Locale, T>> {
  const result: Partial<Record<Locale, T>> = {};
  for (const locale of Object.keys(guideRichText) as Locale[]) {
    result[locale] = { ...localizeUiCopy(en, locale), ...richCopy(locale) } as T;
  }
  return result;
}
