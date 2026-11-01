import fs from 'node:fs';
import path from 'node:path';
import {describe, expect, it} from 'vitest';
import {renderStory, type StoryAsset} from './render-story';

const article = fs.existsSync('docs/case-study.md') ? 'docs/case-study.md' : '../../docs/case-study.md';
const markdown = fs.readFileSync(path.resolve(article), 'utf8');
const russian = fs.readFileSync(path.resolve(article.replace('.md', '.ru.md')), 'utf8');
const references = [...new Set([...markdown.matchAll(/src="((?:screenshots|stickers)\/[^"]+)"/g)].map(match => match[1]))];
const assets: Record<string, StoryAsset> = Object.fromEntries(references.map(reference => [reference, {
  src:`/project-story/${reference}`, width:800, height:600,
  ...(reference.endsWith('.gif') ? {poster:`/project-story/${reference}.poster.webp`} : {}),
}]));

describe('project story publication', () => {
  it('keeps the full article navigable, including nested anchors and the final credits', () => {
    const story = renderStory(markdown, assets);
    const page = new DOMParser().parseFromString(story.html, 'text/html');
    expect(story.chapters).toHaveLength(10);
    expect(story.chapters.at(-1)?.id).toBe('credits');
    expect(page.querySelector('h1')).toBeNull();
    expect(page.body.textContent).toContain("If I haven't mentioned you by name, I'm sorry.");
    for (const anchor of page.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')) {
      const id = anchor.getAttribute('href')!.slice(1);
      if (id !== 'contents') expect(page.getElementById(id), id).not.toBeNull();
    }
    expect(page.body.textContent).not.toContain('[!NOTE]');
    expect(page.querySelectorAll('[data-story-sticker]')).toHaveLength([...markdown.matchAll(/src="stickers\//g)].length);
  });

  it('resolves repository references, image previews and reduced-motion posters without relative broken URLs', () => {
    const page = new DOMParser().parseFromString(renderStory(markdown, assets).html, 'text/html');
    for (const anchor of page.querySelectorAll<HTMLAnchorElement>('a[href]')) {
      expect(anchor.getAttribute('href')).toMatch(/^(?:https?:\/\/|\/|#|mailto:)/);
    }
    expect(page.querySelector('a[href*="/blob/main/packages/game-domain"]')).not.toBeNull();
    const screenshot = page.querySelector('[data-story-image] img');
    expect(screenshot?.getAttribute('width')).toBe('800');
    expect(screenshot?.closest('figure')?.querySelector('figcaption')?.textContent).toBeTruthy();
    expect(page.querySelector('[data-story-sticker] source')?.getAttribute('media')).toBe('not all');
  });

  it('fails publication for missing images or active HTML rather than showing a partly broken story', () => {
    expect(() => renderStory(markdown, {})).toThrow('Missing story asset');
    expect(() => renderStory(markdown + '\n<script>alert(1)</script>', assets)).toThrow('Unsupported active HTML');
  });

  it('keeps both complete editions on the same chapter anchors and the same media', () => {
    const englishStory = renderStory(markdown, assets);
    const russianStory = renderStory(russian, assets, markdown);
    expect(russianStory.chapters.map(chapter => chapter.id)).toEqual(englishStory.chapters.map(chapter => chapter.id));
    expect(russianStory.chapters.map(chapter => chapter.topics.map(topic => topic.id))).toEqual(englishStory.chapters.map(chapter => chapter.topics.map(topic => topic.id)));
    expect(englishStory.chapters[0].topics.some(topic => topic.title.includes('119.99'))).toBe(true);
    const parse = (html: string) => new DOMParser().parseFromString(html, 'text/html');
    const en = parse(englishStory.html), ru = parse(russianStory.html);
    const references = (document: Document) => new Set([...document.querySelectorAll('a[href^="https:"]')].map(anchor => anchor.getAttribute('href')));
    expect(references(ru)).toEqual(references(en));
    expect([...ru.querySelectorAll('h2,h3,h4')].map(heading => heading.id)).toEqual([...en.querySelectorAll('h2,h3,h4')].map(heading => heading.id));
    expect([...ru.querySelectorAll('img')].map(image => image.getAttribute('src'))).toEqual([...en.querySelectorAll('img')].map(image => image.getAttribute('src')));
    expect(ru.body.textContent).toContain('Если кого-то не упомянул лично - извините.');
    expect(ru.querySelectorAll('[id]').length).toBe(new Set([...ru.querySelectorAll('[id]')].map(element => element.id)).size);
    for (const anchor of ru.querySelectorAll('a[href^="#"]')) {
      const id = anchor.getAttribute('href')!.slice(1);
      if (id !== 'contents') expect(ru.getElementById(id), id).not.toBeNull();
    }
  });
});
