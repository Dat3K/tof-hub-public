import {ImageResponse} from 'next/og';
import {getLinkPreview} from '@/lib/seo/server';
import {HUB_PREVIEW_PATHS, hubPreviewCard} from './hub-card';
import {localImage, OG_BRAND, OG_FOOTER} from './local-image';

export const runtime = 'nodejs';

const AREA_LABELS: Record<string, string> = {info:'Info', datamine:'Datamine', tools:'Tools'};

/** Label above the title: the entity section, else the site area of the path (Info / Datamine / Tools). */
function areaLabel(path: string, section: string): string | null {
  if (section && section !== 'Tower of Fantasy') return section;
  return AREA_LABELS[path.split('/')[1] ?? ''] ?? null;
}

export async function GET(request: Request) {
  const href = new URL(request.url).searchParams.get('path') || '/';
  if (!href.startsWith('/') || href.startsWith('//') || href.length > 65536) return new Response('Invalid preview path', {status:400});
  const preview = await getLinkPreview(href);
  const headers = {'Cache-Control':preview.noindex?'public, max-age=60, s-maxage=60':'public, max-age=3600, s-maxage=3600','X-Robots-Tag':'noindex'};
  // Section hubs get their own card with live counts and art (hub-card.tsx).
  if (HUB_PREVIEW_PATHS.has(preview.path)) return new ImageResponse(await hubPreviewCard(preview.path), {width:1200, height:630, headers});
  const art = await localImage(preview.image);
  const label = areaLabel(preview.path, preview.section);
  return new ImageResponse(
    <div style={{width:'100%',height:'100%',display:'flex',background:'#0d1017',color:'#f3eee4',fontFamily:'sans-serif',
      backgroundImage:'radial-gradient(circle at 0% 0%, rgba(245,217,122,0.09), rgba(13,16,23,0) 50%)'}}>
      <div style={{display:'flex',width:6,height:'100%',background:'#f5d97a'}}/>
      <div style={{display:'flex',flexDirection:'column',justifyContent:'space-between',width:art?714:1194,padding:'52px 56px'}}>
        <div style={{display:'flex',alignItems:'baseline',fontSize:24}}>
          <span style={{color:'#f5d97a',fontWeight:700,letterSpacing:'2px',fontSize:22}}>{OG_BRAND}</span>
          {label ? <span style={{color:'#b9a77d',marginLeft:14}}>{label}</span> : null}
        </div>
        <div style={{display:'flex',flexDirection:'column'}}>
          <div style={{display:'flex',fontSize:preview.title.length>55?48:64,fontWeight:700,lineHeight:1.1,letterSpacing:'-1px'}}>{preview.title.slice(0,110)}</div>
          <div style={{display:'flex',fontSize:27,lineHeight:1.45,color:'#c0c3cc',marginTop:26}}>{preview.description.slice(0,180)}</div>
        </div>
        <div style={{display:'flex',fontSize:22,color:'#878b98'}}>{OG_FOOTER}</div>
      </div>
      {art ? <div style={{display:'flex',width:480,height:630,alignItems:'center',justifyContent:'center',background:'#151a24'}}>
        {/* Game art is loaded only from the generated manifest and local public tree. */}
        <img src={art} alt="" width={480} height={590} style={{objectFit:'contain'}}/>
      </div> : null}
    </div>,
    {width:1200,height:630,headers},
  );
}
