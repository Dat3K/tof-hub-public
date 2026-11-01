import {generatePageMetadata} from '@/lib/seo/server';
import { MainHubView } from '@/features/main-hub';
import { loadServerGameData } from '@/lib/game-data-server';
import { versionTrackerSchema } from '@tof-hub/contracts';
import type { MainHubArt } from '@/features/main-hub/main-hub-view';

export async function generateMetadata() { return generatePageMetadata('/'); }

export default async function HomePage() {
  const [art, tracker] = await Promise.all([
    loadServerGameData<MainHubArt | null>('', 'main-hub', {throwOnNotFound: false}),
    loadServerGameData<unknown>('', 'version-tracker', {throwOnNotFound: false}),
  ]);
  const parsed = versionTrackerSchema.safeParse(tracker);
  return <MainHubView art={art} tracker={parsed.success ? parsed.data : null} />;
}
