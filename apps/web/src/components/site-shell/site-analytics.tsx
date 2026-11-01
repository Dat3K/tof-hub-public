'use client';

import Script from 'next/script';
import {useEffect, useState} from 'react';
import {analyticsPageview, type SiteAnalyticsConfig} from '@/lib/site-analytics';

declare global {
  interface Window {tofHubAnalytics?: (type:string, payload:Record<string,unknown>) => ReturnType<typeof analyticsPageview>}
}

export function SiteAnalytics({config}: {config:SiteAnalyticsConfig}) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if ((navigator as Navigator & {globalPrivacyControl?:boolean}).globalPrivacyControl) return;
    window.tofHubAnalytics = (type, payload) => analyticsPageview(type, payload, window.location.origin);
    setReady(true);
    return () => {delete window.tofHubAnalytics;};
  }, []);
  if (!ready) return null;
  return <Script id="tof-site-analytics" src={config.scriptUrl} strategy="afterInteractive"
    data-website-id={config.websiteId} data-domains={config.domains}
    data-before-send="tofHubAnalytics" data-exclude-search="true" data-exclude-hash="true"
    data-do-not-track="true"/>;
}
