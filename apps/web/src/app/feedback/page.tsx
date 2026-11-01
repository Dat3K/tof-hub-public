import { resolveServerLocale } from '@/lib/i18n/server';
import { generatePageMetadata } from '@/lib/seo/server';
import { FeedbackView } from '@/features/feedback/feedback-view';
import { feedbackPage } from '@/features/feedback/feedback-progress';

export async function generateMetadata() { return generatePageMetadata('/feedback/'); }

export default async function FeedbackPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ locale }, query] = await Promise.all([resolveServerLocale(), searchParams]);
  const source = query.from === 'footer' || query.from === 'prompt' ? query.from : 'direct';
  const page = typeof query.page === 'string' ? feedbackPage(query.page) : null;
  return <FeedbackView initialLocale={locale} source={source} initialPage={page} />;
}
