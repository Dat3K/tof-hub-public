import CompPage from '@/features/comp/comp-page';
import {generatePageMetadata, type SeoPageProps} from '@/lib/seo/server';
export async function generateMetadata(props: SeoPageProps) { return generatePageMetadata('/tools/comp/', props); }
export default CompPage;
