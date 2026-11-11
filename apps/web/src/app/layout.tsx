import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import {
  SiteBackground,
  SiteHeader,
  SiteFooter,
  ScrollToTop,
} from '@/components/site-shell';
import { resolveServerLocale } from '@/lib/i18n/server';
import { I18nProvider } from '@/lib/i18n/provider';
import { buildMetadata, getSiteOrigin } from '@/lib/seo';
import {DocumentTitleLocalizer} from '@/components/site-shell/document-title-localizer';
import {SiteNotifications} from '@/components/site-shell/site-notifications';
import {SiteHints} from '@/components/site-shell/site-hints';
import {BrowserErrorReporter} from '@/components/site-shell/browser-error-reporter';
import {HeaderNavigation} from '@/components/site-shell/header-navigation';
import {SiteAnalytics} from '@/components/site-shell/site-analytics';
import {siteAnalyticsConfig} from '@/lib/site-analytics';
import {FeedbackPrompt} from '@/features/feedback/feedback-prompt';

export const metadata: Metadata = buildMetadata({
  title: 'Tower of Fantasy Hub',
  description: 'Tower of Fantasy research database, encyclopedia, and tools platform.',
  path: '/',
  ogTitle: 'Tower of Fantasy Hub',
  ogDescription: 'Tower of Fantasy research database, encyclopedia, and tools platform.',
});

export default async function RootLayout({ children }: { children: ReactNode }) {
  const { locale, source } = await resolveServerLocale();
  const analytics = siteAnalyticsConfig(process.env);

  return (
    <html lang={locale} suppressHydrationWarning>
      <body
        className="flex min-h-screen flex-col bg-tof-canvas text-text-body antialiased"
        suppressHydrationWarning
      >
        <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify({
          '@context':'https://schema.org', '@type':'WebSite', '@id':`${getSiteOrigin()}/#website`,
          url:`${getSiteOrigin()}/`, name:'ToF Hub', alternateName:'Tower of Fantasy Hub',
          description:'Tower of Fantasy game data and tools.', inLanguage:['en','ru'],
        }).replace(/</g,'\\u003c')}}/>
        <I18nProvider initialLocale={locale} initialSource={source}>
          <SiteNotifications>
          <BrowserErrorReporter />
          <DocumentTitleLocalizer />
          <SiteBackground />
          <HeaderNavigation header={<SiteHeader />}>
            {children}
          </HeaderNavigation>
          <SiteFooter />
          <ScrollToTop />
          <SiteHints />
          {(process.env.FEEDBACK_PROMPT_ENABLED ?? 'true') === 'true' && <FeedbackPrompt />}
          </SiteNotifications>
        </I18nProvider>
        {analytics && <SiteAnalytics config={analytics}/>}
      </body>
    </html>
  );
}
