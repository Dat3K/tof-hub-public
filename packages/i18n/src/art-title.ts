import { translateUiText } from './ui-text';

const numbered = (token: string) => token.replace(/#\d+$/, '#{0}').replace(/^Version \d[\w.]*$/, 'Version {0}');

/** Localizes the site-authored parts of an artwork title while preserving game character names and numbering. */
export function localizeArtTitle(title: string, locale: string): string {
  const translate = (token: string) => {
    const text = token.trim();
    const template = numbered(text);
    const translated = translateUiText(template, locale);
    if (translated === template) return token;
    const value = /#(\d+)$/.exec(text)?.[1] ?? /^Version (\d[\w.]*)$/.exec(text)?.[1] ?? '';
    return translated.replace('{0}', value);
  };
  return title.split(' — ').map(part => {
    const paren = /^(.*?)\s*\((.+)\)$/.exec(part.trim());
    return paren ? `${translate(paren[1])} (${translate(paren[2])})` : translate(part);
  }).join(' — ');
}
