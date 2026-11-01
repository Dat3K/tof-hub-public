import { translateUiText } from './ui-text';

const NUMBER = /\d[\d,]*(?:\.\d+)?/g;
const STAT_BUFF = /^(.+?) ([+-]\d[\d,.]*%) \+ (\d[\d,.]*) for (\d[\d,.]*)s$/;

/** Localizes generated food effect wording while preserving the source values and units. */
export function localizeEffectLine(line: string, locale: string): string {
  if (locale === 'en') return line;
  const buff = STAT_BUFF.exec(line);
  if (buff) {
    const template = translateUiText('{0} +{1}% + {2} for {3}s', locale);
    if (template !== '{0} +{1}% + {2} for {3}s') {
      const values = [translateUiText(buff[1], locale), buff[2].replace(/^\+/, '').replace('%', ''), buff[3], buff[4]];
      return template.replace(/\{(\d)\}/g, (_, i) => values[Number(i)]);
    }
  }
  const numbers = line.match(NUMBER) ?? [];
  let index = 0;
  const template = line.replace(NUMBER, () => `{${index++}}`);
  const translated = translateUiText(template, locale);
  if (translated === template) return line;
  return translated.replace(/\{(\d)\}/g, (_, i) => numbers[Number(i)] ?? '');
}

export const localizeEffectLines = (lines: readonly string[], locale: string): string[] => lines.map(line => localizeEffectLine(line, locale));
