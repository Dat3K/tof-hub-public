import type {ReactElement} from 'react';
import {routeCopy} from '@/lib/seo/routes';
import {loadHubSummary} from '@/lib/hub-summary/server';
import {hubText, type HubSummary} from '@/lib/hub-summary';
import {formatHpValue} from '@/features/datamine/oow/oow-domain';
import {localImage, OG_BRAND, OG_FOOTER} from './local-image';

// Link preview cards of the section hubs: name, short copy, live counts and one picture from hub-summary.json
// (the same generated data the hub pages show). English only, like every link preview.

export const HUB_PREVIEW_PATHS = new Set(['/info/', '/datamine/', '/tools/']);

const GOLD = '#f5d97a';
const count = (value: number | undefined) => (value === undefined ? null : value.toLocaleString('en-US'));
const hp = (value: number) => {
  const {value: number, unitLabel} = formatHpValue(value, 'G');
  return `${number} ${unitLabel}`;
};

interface HubPreviewContent {
  name: string;
  facts: {value: string; label: string}[];
  /** Highlighted line under the facts (current season, latest banner). */
  highlight?: {label: string; text: string};
  art?: string;
  /** Wide background behind the art (the Wish banner background). */
  artBackground?: string;
  /** Small portraits along the bottom (Info: latest releases). */
  portraits?: {image: string; name: string}[];
}

const facts = (entries: [number | undefined, string][]) =>
  entries.flatMap(([value, label]) => (count(value) ? [{value: count(value)!, label}] : []));

async function content(pathname: string, summary: HubSummary | null): Promise<HubPreviewContent> {
  if (pathname === '/info/') {
    const info = summary?.info;
    const slots = info?.simulacra.gacha ?? [];
    return {
      name: 'Info',
      facts: facts([
        [info?.counts.simulacra, 'simulacra'], [info?.counts.simulacraMmo, 'MMO simulacra'],
        [info?.counts.matrices, 'matrix sets'], [info?.counts.relics, 'relics'],
        [info?.counts.pets, 'pets'], [info?.counts.cosmetics, 'cosmetics'],
      ]),
      art: await localImage(slots[0]?.portrait, {width:520, height:600}),
      portraits: (await Promise.all(slots.map(async (slot) => ({
        image: await localImage(slot.avatar, {width:128, height:128, fit:'cover'}),
        name: hubText(slot.name, 'en'),
      })))).flatMap((entry) => (entry.image ? [{image: entry.image, name: entry.name}] : [])),
    };
  }
  if (pathname === '/datamine/') {
    const data = summary?.datamine;
    const seasons = data?.oow.gacha.seasons ?? [];
    // The running season by server date, as the Datamine hub highlights it; otherwise the latest.
    const today = new Date().toISOString().slice(0, 10);
    const season = seasons.find((entry) => entry.startDate <= today && today <= entry.endDate) ?? seasons.at(-1);
    return {
      name: 'Datamine',
      facts: facts([
        [data?.counts.oow, 'Origin of War seasons'], [data?.counts.fce, 'bosses'], [data?.counts.bygone, 'Bygone floors'],
        [data?.counts.seq, 'Sequential stages'], [data?.counts.raids, 'team raids'], [data?.counts.items, 'items'],
      ]),
      highlight: season ? {
        label: 'Origin of War',
        text: [`S${season.displayNumber ?? season.season}`, season.boss ? hubText(season.boss.name, 'en') : null,
          season.finalBossHp ? `boss HP ${hp(season.finalBossHp)}` : null].filter(Boolean).join(' · '),
      } : undefined,
      art: await localImage(season?.boss?.image, {width:520, height:600}),
    };
  }
  const banner = summary?.tools.wish;
  return {
    name: 'Tools',
    facts: ['Ranking', 'Build card', 'Gear optimizer', 'Wish Tracker', 'Comp showcase'].map((label) => ({value: '', label})),
    highlight: banner ? {label: 'Latest banner', text: hubText(banner.name, 'en')} : undefined,
    art: await localImage(banner?.image, {width:520, height:630}),
    artBackground: await localImage(banner?.background, {width:520, height:630, fit:'cover'}),
  };
}

export async function hubPreviewCard(pathname: string): Promise<ReactElement> {
  const summary = await loadHubSummary();
  const hub = await content(pathname, summary);
  const [, description] = routeCopy(pathname) ?? ['', ''];
  return (
    <div style={{width:'100%', height:'100%', display:'flex', background:'#0d1017', color:'#f3eee4', fontFamily:'sans-serif',
      backgroundImage:'radial-gradient(circle at 0% 0%, rgba(245,217,122,0.13), rgba(13,16,23,0) 55%)'}}>
      <div style={{display:'flex', width:8, height:'100%', background:GOLD}} />
      <div style={{display:'flex', flexDirection:'column', justifyContent:'space-between', width:hub.art ? 672 : 1192, padding:'48px 52px'}}>
        <div style={{display:'flex', fontSize:22, letterSpacing:'2px', color:GOLD, fontWeight:700}}>{OG_BRAND}</div>
        <div style={{display:'flex', flexDirection:'column'}}>
          <div style={{display:'flex', fontSize:76, fontWeight:700, lineHeight:1.05, letterSpacing:'-1px'}}>{hub.name}</div>
          <div style={{display:'flex', fontSize:26, lineHeight:1.4, color:'#c0c3cc', marginTop:16}}>{description}</div>
          <div style={{display:'flex', flexWrap:'wrap', marginTop:28}}>
            {hub.facts.map((fact) => (
              <div key={fact.label} style={{display:'flex', alignItems:'baseline', margin:'0 10px 10px 0', padding:'8px 14px',
                border:'1px solid rgba(255,255,255,0.14)', borderRadius:8, background:'rgba(255,255,255,0.04)'}}>
                {fact.value ? <span style={{fontSize:26, fontWeight:700, marginRight:8}}>{fact.value}</span> : null}
                <span style={{fontSize:20, color:fact.value ? '#a9adb9' : '#e7e2d6'}}>{fact.label}</span>
              </div>
            ))}
          </div>
          {hub.highlight ? (
            <div style={{display:'flex', alignItems:'baseline', marginTop:8, fontSize:24}}>
              <span style={{color:GOLD, fontWeight:700, marginRight:12}}>{hub.highlight.label}</span>
              <span style={{color:'#f3eee4'}}>{hub.highlight.text}</span>
            </div>
          ) : null}
        </div>
        <div style={{display:'flex', alignItems:'center'}}>
          {hub.portraits?.length ? hub.portraits.map((portrait) => (
            <div key={portrait.name} style={{display:'flex', alignItems:'center', marginRight:22}}>
              <img src={portrait.image} alt="" width={52} height={52} style={{borderRadius:10, border:`2px solid ${GOLD}`}} />
              <span style={{fontSize:20, color:'#d8d4ca', marginLeft:10}}>{portrait.name}</span>
            </div>
          )) : <span style={{fontSize:20, color:'#878b98'}}>{OG_FOOTER}</span>}
        </div>
      </div>
      {hub.art ? (
        <div style={{display:'flex', position:'relative', width:520, height:630, alignItems:'center', justifyContent:'center', overflow:'hidden',
          background:'radial-gradient(circle at 60% 45%, #1d2433, #121620 70%)'}}>
          {hub.artBackground ? <img src={hub.artBackground} alt="" width={520} height={630} style={{position:'absolute', top:0, left:0, opacity:0.85}} /> : null}
          {/* Game art comes only from hub-summary.json and the local public tree. */}
          <img src={hub.art} alt="" width={520} height={hub.artBackground ? 630 : 600} style={{objectFit:'contain', objectPosition:'center bottom'}} />
          <div style={{display:'flex', position:'absolute', top:0, left:0, width:90, height:630,
            backgroundImage:'linear-gradient(90deg, #0d1017, rgba(13,16,23,0))'}} />
        </div>
      ) : null}
    </div>
  );
}
