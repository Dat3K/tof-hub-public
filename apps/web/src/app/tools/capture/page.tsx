import {buildMetadata} from '@/lib/seo';
import {CaptureDownload} from '@/features/capture/capture-download';
export const metadata=buildMetadata({title:'Data import',description:'Import Build, Wish and player JSON into your own ToF Hub installation.',path:'/tools/capture/'});
export default function Page(){return <CaptureDownload/>;}
