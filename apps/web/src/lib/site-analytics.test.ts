import {describe,it,expect} from 'vitest';
import {analyticsPageview,siteAnalyticsConfig} from './site-analytics';

describe('site analytics privacy',()=>{
  const origin='https://tof.smilekritik.beer';
  it('collects paths and referring domains without tool state or character identity',()=>{
    const result=analyticsPageview('event',{url:'/tools/build/1300500001/dps-flame/?token=secret#private',
      referrer:'https://example.com/private?q=secret',website:'public-id',hostname:'tof.smilekritik.beer',
      language:'ru',screen:'1920x1080',title:'Character nickname',uid:'1300500001',data:{capture:'private'}},origin);
    expect(result).toMatchObject({url:'/tools/build/profile/',referrer:'https://example.com',title:'/tools/build/profile/'});
    expect(JSON.stringify(result)).not.toMatch(/secret|nickname|1300500001|capture|private/);
  });
  it('keeps route changes while excluding custom events and identification',()=>{
    expect(analyticsPageview('event',{url:'/tools/ranking/?q=name#item'},origin)).toMatchObject({url:'/tools/ranking/'});
    expect(analyticsPageview('event',{url:'/',name:'capture',data:{}},origin)).toBe(false);
    expect(analyticsPageview('identify',{url:'/'},origin)).toBe(false);
  });
  it('only enables valid production configuration',()=>{
    const env={NODE_ENV:'production',UMAMI_WEBSITE_ID:'49a7da1e-e01b-4367-bef0-1fff0641414e',UMAMI_SCRIPT_URL:'https://analytics.smilekritik.beer/script.js',SITE_URL:origin};
    expect(siteAnalyticsConfig(env)?.domains).toBe('tof.smilekritik.beer');
    expect(siteAnalyticsConfig({...env,NODE_ENV:'development'})).toBeNull();
    expect(siteAnalyticsConfig({...env,UMAMI_SCRIPT_URL:'javascript:alert(1)'})).toBeNull();
  });
});
