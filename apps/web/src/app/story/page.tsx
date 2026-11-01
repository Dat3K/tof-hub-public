import {EditorialHeader} from '@tof-hub/ui';
import {cache} from 'react';
import {buildMetadata} from '@/lib/seo';
import {resolveServerLocale} from '@/lib/i18n/server';
import {renderStory} from '@/features/project-story/render-story';
import {StoryReader} from '@/features/project-story/story-reader';
import media from '@/features/project-story/media.generated';
import markdown from '../../../../../docs/case-study.md';
import russian from '../../../../../docs/case-study.ru.md';
import styles from '@/features/project-story/story.module.css';

const stories = {en:renderStory(markdown, media), ru:renderStory(russian, media, markdown)};
const articleLanguage = cache(async (): Promise<'en'|'ru'> => {
  const {locale} = await resolveServerLocale();
  return locale === 'ru' ? 'ru' : 'en';
});

export async function generateMetadata() {
  const language = await articleLanguage();
  const metadata = buildMetadata({
    title:language === 'ru' ? 'История проекта' : 'Project story',
    description:language === 'ru' ? 'Мой путь в Tower of Fantasy: от игрока первого дня до исследований, таблиц и ToF Hub.' : 'My journey in Tower of Fantasy: from a day-one player to research, spreadsheets and ToF Hub.',
    path:'/story/',
  });
  return metadata;
}

export default async function StoryPage() {
  const language = await articleLanguage();
  const story = stories[language];
  return <article className={`editorial-page editorial-layout ${styles.page}`}>
    <div id="contents" className={styles.header} lang={language}>
      <EditorialHeader title={story.title} description={story.subtitle}/>
      <p className={styles.byline}>smilekritik</p>
    </div>
    <StoryReader chapters={story.chapters} language={language}>
      <div className={styles.prose} lang={language} dangerouslySetInnerHTML={{__html:story.html}}/>
    </StoryReader>
  </article>;
}
