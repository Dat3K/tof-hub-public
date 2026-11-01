import { Marked, type Tokens } from 'marked';
import GithubSlugger from 'github-slugger';

export interface StoryAsset {
  src: string;
  width: number;
  height: number;
  poster?: string;
  dimmed?: boolean;
}

export interface StoryChapter {
  id: string;
  title: string;
  number: string | null;
  topics: {id:string; title:string}[];
}

// Curated milestones, rather than every heading in this long article.
const chapterTopics = new Set([
  'my-own-spreadsheet', 'a-website-for-the-datamine', 'the-patch-problem',
  'following-one-enemy-through-the-files', 'using-the-data-to-make-combat-easier-to-read', 'more-than-a-year-in',
  'simulacra', 'cosmetics', 'handbook', 'multiplicative-buffs',
  'two-element-weapons-pick-their-best-numbers-separately', 'how-much-is-a-stat-worth', 'checking-combat-strength-against-the-server',
  'the-build-card', 'the-optimizer', 'the-pull-tracker', 'raid-leaderboards',
  'keep-extraction-outside-the-request-path', 'load-the-data-a-page-actually-needs', 'compute-ranking-scores-on-writes', 'serialize-heavy-imports-across-api-processes',
  'from-a-web-interface-to-a-windows-application', 'what-the-captures-showed-about-game-lag',
  'silent-changes-to-the-rules', 'competition-on-the-developers-calendar', 'fionas-synthesis-banner-the-final-straw',
  'returning-to-the-unfinished-website', 'what-i-learned-by-building-it',
]);

const repositoryDocs = 'https://github.com/smilekritik/tof-hub-public/blob/main/docs/';
const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Only repository-owned editorial Markdown enters this renderer, never imports or user input. */
function articleBody(markdown: string) {
  return markdown.slice(markdown.indexOf('</div>') + '</div>'.length)
    .replace(/<a id="[^"]+"><\/a>\s*\n/g, '')
    .replace(/\n## (?:Contents|Содержание)\n[\s\S]*?(?=\n## (?:Part|Часть) 1\.)/, '\n');
}

export function renderStory(markdown: string, assets: Record<string, StoryAsset>, canonicalMarkdown?: string) {
  const slugger = new GithubSlugger();
  const chapters: StoryChapter[] = [];
  const title = /^# (.+)$/m.exec(markdown)?.[1] ?? 'My journey in Tower of Fantasy';
  const subtitle = /^\*\*([^\n]+)\*\*$/m.exec(markdown)?.[1] ?? '';
  // The website supplies the header and chapter navigation. The article remains canonical in docs.
  const body = articleBody(markdown);
  const canonicalSlugger = new GithubSlugger();
  const canonicalIds = canonicalMarkdown
    ? [...articleBody(canonicalMarkdown).matchAll(/^#{2,4} (.+)$/gm)].map(match => canonicalSlugger.slug(match[1]))
    : null;
  let headingIndex = 0;
  const parser = new Marked({gfm: true, async: false});
  parser.use({renderer: {
    heading({tokens, depth, text}: Tokens.Heading) {
      const id = canonicalIds?.[headingIndex] ?? slugger.slug(text);
      headingIndex++;
      if (depth === 2) {
        const part = /^(?:Part|Часть) (\d+)\. (.+)$/.exec(text);
        chapters.push({id, title: part?.[2] ?? text, number: part?.[1] ?? null, topics:[]});
      } else if (chapters.length && (chapterTopics.has(id) || /119\.99/.test(text))) {
        chapters.at(-1)!.topics.push({id, title:text});
      }
      return `<h${depth} id="${escape(id)}">${this.parser.parseInline(tokens)}</h${depth}>\n`;
    },
    blockquote({tokens}: Tokens.Blockquote) {
      const content = this.parser.parse(tokens);
      const callout = /^<p>\[!(NOTE|TIP|IMPORTANT)\]\s*/.exec(content);
      return callout
        ? `<aside class="story-note">${content.replace(callout[0], '<p>')}</aside>\n`
        : `<blockquote>${content}</blockquote>\n`;
    },
  }});

  let html = parser.parse(body) as string;
  if (canonicalIds && headingIndex !== canonicalIds.length) throw new Error('Story translations must retain the same heading structure');
  if (/<\s*(?:script|iframe|object|embed|form)\b|\bon\w+\s*=|(?:href|src)\s*=\s*["']\s*(?:javascript|data):/i.test(html)) {
    throw new Error('Unsupported active HTML in the project story');
  }

  const resolve = (href: string) => {
    const asset = assets[href];
    if (asset) return asset.src;
    if (/^(?:screenshots|stickers)\//.test(href)) throw new Error(`Missing story asset: ${href}`);
    if (/^(?:#|\/|https?:\/\/|mailto:)/i.test(href)) return href;
    return new URL(href, repositoryDocs).href;
  };
  html = html.replace(/<a\b([^>]*?)href="([^"]+)"([^>]*)>/g, (_, before: string, href: string, after: string) => {
    const image = Boolean(assets[href] && href.startsWith('screenshots/'));
    const resolved = resolve(href.replace(/&amp;/g, '&'));
    const external = /^https?:\/\//.test(resolved);
    return `<a${before}href="${escape(resolved)}"${after}${image ? ' data-story-image' : ''}${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>`;
  });
  html = html.replace(/<img\b[^>]*\bsrc="([^"]+)"[^>]*>/g, (tag: string, source: string) => {
    const asset = assets[source];
    if (!asset) throw new Error(`Undeclared story image: ${source}`);
    if (source.startsWith('stickers/')) {
      if (!asset.poster) throw new Error(`Missing story sticker poster: ${source}`);
      return `<picture data-story-sticker><source media="not all" srcset="${escape(asset.poster)}"><img src="${escape(asset.src)}" width="48" height="48" alt="" loading="lazy" decoding="async"></picture>`;
    }
    const alt = /\balt="([^"]*)"/.exec(tag)?.[1] ?? '';
    return `<img src="${escape(asset.src)}" width="${asset.width}" height="${asset.height}" style="width:min(100%,${asset.width}px);aspect-ratio:${asset.width}/${asset.height}" alt="${alt}" loading="lazy" decoding="async"${asset.dimmed ? ' data-story-bright-image' : ''}>`;
  });
  html = html.replace(/<p align="center">\s*(<a[\s\S]*?<\/a>)\s*<br>\s*<sub><i>([\s\S]*?)<\/i><\/sub>\s*<\/p>/g,
    '<figure>$1<figcaption>$2</figcaption></figure>');
  html = html.replace(/<table>/g, '<div class="story-table" role="region" aria-label="Scrollable data table" tabindex="0"><table>')
    .replace(/<\/table>/g, '</table></div>');
  return {title, subtitle, chapters, html};
}
