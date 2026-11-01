'use client';

import {useEffect, useRef, useState, type MouseEvent, type ReactNode} from 'react';
import {Lightbox} from '@tof-hub/ui';
import type {StoryChapter} from './render-story';
import styles from './story.module.css';

// The author's article is maintained in these two languages only.
const COPY = {
  en: {contents:'Contents', pause:'Pause stickers', play:'Play stickers', source:'Read on GitHub'},
  ru: {contents:'Содержание', pause:'Приостановить стикеры', play:'Включить стикеры', source:'Читать на GitHub'},
} as const;

export function StoryReader({chapters, children, language}: {chapters: StoryChapter[]; children: ReactNode; language:'en'|'ru'}) {
  const copy = COPY[language];
  const root = useRef<HTMLDivElement>(null);
  const mobileContents = useRef<HTMLDetailsElement>(null);
  const translatedAnchor = useRef<string | null>(null);
  const [active, setActive] = useState(chapters[0]?.id ?? '');
  const [activeTopic, setActiveTopic] = useState('');
  const [ready, setReady] = useState(false);
  const [paused, setPaused] = useState(false);
  const [image, setImage] = useState<{src:string; alt:string} | null>(null);

  useEffect(() => {
    root.current?.querySelectorAll<HTMLSourceElement>('[data-story-sticker] source').forEach(source => {
      source.media = paused ? 'all' : 'not all';
    });
  }, [paused, language, children]);

  useEffect(() => {
    const owners = new Map(chapters.flatMap(chapter => [
      [chapter.id, chapter.id], ...chapter.topics.map(topic => [topic.id, chapter.id]),
    ] as [string,string][]));
    const headings = [...owners.keys()].flatMap(id => {
      const heading = document.getElementById(id);
      return heading ? [heading] : [];
    });
    let scrollFrame = 0, firstFrame = 0, secondFrame = 0;
    let restoring = false;
    let lastScrollY = window.scrollY;

    const update = (writeHash: boolean) => {
      if (restoring) return;
      const header = document.querySelector('[data-site-header]');
      const readingLine = (header?.getBoundingClientRect().bottom ?? 0) + Math.min(180, innerHeight * 0.2);
      let current: HTMLElement | undefined;
      for (const heading of headings) {
        if (heading.getBoundingClientRect().top > readingLine) break;
        current = heading;
      }
      const id = current?.id ?? '';
      const owner = owners.get(id) ?? chapters[0]?.id ?? '';
      setActive(owner);
      setActiveTopic(id === owner ? '' : id);
      const hash = id ? `#${id}` : '';
      if (writeHash && location.hash !== hash) {
        // Keep a shareable reading location without a history entry per section.
        history.replaceState(history.state, '', `${location.pathname}${location.search}${hash}`);
      }
    };

    const restore = () => {
      cancelAnimationFrame(scrollFrame);
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
      const hash = translatedAnchor.current ?? location.hash;
      let target: HTMLElement | null = null;
      try { target = document.getElementById(decodeURIComponent(hash.slice(1))); } catch { /* Malformed external hash. */ }
      restoring = true;
      // The header refreshes the server article. Wait for the translated DOM and
      // router restoration; reserved image ratios keep this position stable.
      firstFrame = requestAnimationFrame(() => {
        secondFrame = requestAnimationFrame(() => {
          target?.scrollIntoView({behavior:'instant', block:'start'});
          if (translatedAnchor.current !== null) {
            history.replaceState(history.state, '', `${location.pathname}${location.search}${hash}`);
            translatedAnchor.current = null;
          }
          lastScrollY = window.scrollY;
          restoring = false;
          update(false);
          setReady(true);
        });
      });
    };
    const onLanguageChange = (event: Event) => {
      const next = (event as CustomEvent<string>).detail === 'ru' ? 'ru' : 'en';
      if (next === language) return;
      // The shared provider dispatches this before refreshing server components.
      // Do not interpret translation-induced layout shifts as reader scrolling.
      translatedAnchor.current = location.hash;
      restoring = true;
      cancelAnimationFrame(scrollFrame);
    };
    const onScroll = () => {
      const moved = Math.abs(window.scrollY - lastScrollY) >= 1;
      lastScrollY = window.scrollY;
      if (restoring || !moved) return;
      cancelAnimationFrame(scrollFrame);
      scrollFrame = requestAnimationFrame(() => update(true));
    };
    const onResize = () => update(false);
    window.addEventListener('scroll', onScroll, {passive:true});
    window.addEventListener('resize', onResize);
    window.addEventListener('hashchange', restore);
    window.addEventListener('tof:language-change', onLanguageChange);
    restore();
    return () => {
      cancelAnimationFrame(scrollFrame);
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('hashchange', restore);
      window.removeEventListener('tof:language-change', onLanguageChange);
    };
  }, [chapters, language, children]);

  const navigateChapter = (event: MouseEvent<HTMLAnchorElement>, chapter:string, topic = '') => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    setActive(chapter);
    setActiveTopic(topic);
    if (mobileContents.current) mobileContents.current.open = false;
  };

  const links = <ol className={styles.chapterList}>{chapters.map(chapter => (
    <li key={chapter.id}>
      <a href={`#${chapter.id}`} aria-current={active === chapter.id ? 'location' : undefined} onClick={event => navigateChapter(event, chapter.id)}>
        <span className={styles.chapterNumber} aria-hidden="true">{chapter.number ?? '↳'}</span>
        <span>{chapter.title}</span>
      </a>
      {active === chapter.id && chapter.topics.length > 0 && <ol className={styles.topicList}>
        {chapter.topics.map(topic => <li key={topic.id}>
          <a href={`#${topic.id}`} aria-current={activeTopic === topic.id ? 'location' : undefined} onClick={event => navigateChapter(event, chapter.id, topic.id)}>{topic.title}</a>
        </li>)}
      </ol>}
    </li>
  ))}</ol>;

  const openImage = (event: MouseEvent<HTMLDivElement>) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = (event.target as Element).closest<HTMLAnchorElement>('a[data-story-image]');
    const preview = anchor?.querySelector('img');
    if (!anchor || !preview) return;
    event.preventDefault();
    setImage({src:anchor.href, alt:preview.alt});
  };

  return <div ref={root} className={styles.reader} onClick={openImage} data-story-ready={ready}>
    <aside className={styles.sidebar} lang={language}>
      <nav aria-label={copy.contents}>
        <p className={styles.contentsLabel}>{copy.contents}</p>
        {links}
      </nav>
    </aside>
    <div className={styles.readingColumn}>
      <div className={styles.toolbar} lang={language}>
        <button type="button" disabled={!ready} aria-pressed={paused} onClick={() => setPaused(value => !value)}>{paused ? copy.play : copy.pause}</button>
        <a href={`https://github.com/smilekritik/tof-hub-public/blob/main/docs/case-study${language === 'ru' ? '.ru' : ''}.md`} target="_blank" rel="noopener noreferrer">{copy.source} ↗</a>
      </div>
      <details ref={mobileContents} className={styles.mobileContents} lang={language}>
        <summary>{copy.contents}</summary>
        <nav aria-label={copy.contents}>{links}</nav>
      </details>
      {children}
    </div>
    <Lightbox isOpen={image !== null} onClose={() => setImage(null)} src={image?.src} webpSrc={image?.src} alt={image?.alt} title={image?.alt} locale={language} showPngDownload={false}/>
  </div>;
}
