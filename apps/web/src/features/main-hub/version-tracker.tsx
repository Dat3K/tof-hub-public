'use client';

import { localeText } from '@/lib/i18n/text';
import { localizedUi } from '@tof-hub/i18n';
import { type Locale } from '@tof-hub/i18n';
import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { versionTrackerSchema, type VersionTracker as TrackerData } from '@tof-hub/contracts';
import { LoadingState } from '@tof-hub/ui';
import { ToolInfoModal } from '@/components/tool-rail/tool-info-modal';
import { MAIN_COPY } from './copy';
import styles from './main-hub.module.css';

export function versionAge(changedAt: string | null, now: number) {
  if (!changedAt) return null;
  return Math.max(0, Math.floor((now - Date.parse(changedAt)) / 86_400_000));
}

export function VersionTracker({initial, locale}: {initial: TrackerData | null; locale: Locale}) {
  const copy = localizedUi(MAIN_COPY, locale);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const closeHistory = useCallback(() => setSelectedId(null), []);
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(initial?.mode !== 'live');
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    let running = false;
    const refresh = async () => {
      setNow(Date.now());
      if (running) return;
      running = true;
      try {
        const response = await fetch('/api/v1/version-status/tracker', {signal: AbortSignal.any([controller.signal, AbortSignal.timeout(8000)]), cache: 'no-store'});
        if (!response.ok) throw new Error('Tracker unavailable');
        const parsed = versionTrackerSchema.parse(await response.json());
        if (!controller.signal.aborted) {
          // Generated presentation metadata also supports an API process running the previous schema.
          setData({...parsed, branches: parsed.branches.map((branch) => ({...branch, group: branch.group ?? initial?.branches.find((item) => item.id === branch.id)?.group}))});
          setOffline(false);
        }
      } catch { if (!controller.signal.aborted) setOffline(true); }
      finally { running = false; if (!controller.signal.aborted) setLoading(false); }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 60_000);
    return () => { controller.abort(); clearInterval(timer); };
  }, [initial]);

  const date = (value: string, time = false) => new Intl.DateTimeFormat(locale, {day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC', ...(time ? {hour: '2-digit', minute: '2-digit'} as const : {})}).format(new Date(value));
  const relative = (changedAt: string | null, precision?: 'day' | 'instant') => {
    if (!changedAt || now === null) return '—';
    const minutes = Math.max(0, Math.floor((now - Date.parse(changedAt)) / 60_000));
    if (minutes < 1440 && precision === 'day') return copy.today;
    const unit = minutes >= 1440 ? 'day' : minutes >= 60 ? 'hour' : 'minute';
    const value = unit === 'day' ? Math.floor(minutes / 1440) : unit === 'hour' ? Math.floor(minutes / 60) : minutes;
    return new Intl.RelativeTimeFormat(locale, {numeric: 'always'}).format(-value, unit);
  };
  const selected = data?.branches.find(branch => branch.id === selectedId);
  const observedBranches = data?.branches.filter(branch => branch.version && branch.changedAt) ?? [];

  return <section className={styles.tracker} aria-labelledby="version-tracker-title">
    <div className={styles.trackerHeader}><h2 id="version-tracker-title">{copy.tracker}</h2>{!loading && !offline ? <p className={styles.monitorStatus}>{copy.live}</p> : null}</div>
    {loading ? <LoadingState message={copy.loading} /> : <div className={styles.branches}>
      {observedBranches.length ? (['live', 'other'] as const).map((group) => {
        const branches = observedBranches.filter((branch) => (branch.group ?? 'other') === group);
        if (!branches.length) return null;
        return <div key={group} className={styles.branchGroup} role="group" aria-label={copy.versionGroups[group]} data-version-group={group}>
          <p className={styles.groupTitle}>{copy.versionGroups[group]}</p>
          {branches.map((branch) => {
        const days = now === null ? null : versionAge(branch.changedAt, now);
        const fresh = days === 0 && now !== null && branch.changedAt !== null && Date.parse(branch.changedAt) <= now;
        const age = Math.min(days ?? 0, 30) / 30;
        const last = branch.history.find((event) => event.observedAt === branch.changedAt);
        const stale = now !== null && branch.checkedAt && now - Date.parse(branch.checkedAt) > 20 * 60_000;
        const warning = branch.error ? copy.failed : offline ? copy.archive : stale ? copy.stale : undefined;
        return <div key={branch.id} className={styles.branch}>
          <button type="button" className={styles.branchButton} onClick={() => setSelectedId(branch.id)} aria-haspopup="dialog" data-hint={warning} aria-label={`${branch.label} · ${branch.version ?? copy.unknown} · ${copy.history}${fresh ? ` · ${copy.freshUpdate}` : ''}${warning ? ` · ${warning}` : ''}`}>
            <span className={styles.branchTop}><span>{branch.label}</span><span className={styles.versionValue}><strong>{branch.version ?? '—'}</strong><span aria-hidden="true">›</span></span></span>
            <span className={styles.branchMeta}><span className={styles.branchDate}>{branch.changedAt ? <time dateTime={branch.changedAt}>{date(branch.changedAt)}</time> : copy.unknown}{fresh ? <span className={styles.branchFresh} title={copy.freshUpdate} aria-hidden="true">✦</span> : null}{warning ? <span className={styles.branchWarning} data-hint={warning} aria-hidden="true">⚠︎</span> : null}</span><span>{relative(branch.changedAt, last?.precision)}</span></span>
            <span className={styles.bar} aria-hidden="true"><span style={{'--age-width': `${Math.max(days === null ? 0 : 2, age * 100)}%`, '--age-color': `hsl(${155 - age * 125} 48% 62%)`} as CSSProperties} /></span>
          </button>
          {last?.precision === 'day' ? <span className="sr-only">{copy.dayOnly}</span> : null}
        </div>;
          })}
        </div>;
      }) : <p>{copy.empty}</p>}
    </div>}
    {!loading ? <><div className={styles.scale}><span>0</span><span>15</span><span>30+</span></div>
    <p className={styles.scaleNote}>{copy.scale}</p></> : null}
    <ToolInfoModal isOpen={Boolean(selected)} onClose={closeHistory} eyebrow={copy.history} title={selected ? `${selected.label} · ${selected.version ?? '—'}` : copy.history} intro={copy.observed} closeLabel={localeText(locale)('Close')}>
      {selected ? <div className={styles.history}>
        <dl className={styles.historyMetadata}>
          <div><dt>{localeText(locale)('Client branch', 'Ветка клиента')}</dt><dd><code>{selected.branch}</code></dd></div>
          {selected.launcherVersion ? <div><dt>{localeText(locale)('Launcher', 'Лаунчер')}</dt><dd>{selected.launcherVersion}</dd></div> : null}
          <div><dt>{copy.checked}</dt><dd>{selected.checkedAt ? `${date(selected.checkedAt, true)} UTC` : copy.pending}</dd></div>
        </dl>
        {selected.error ? <p className={styles.sourceStatus}>{copy.failed}</p> : null}
        {selected.history.length ? <ol>{selected.history.map(event => <li key={event.id}><span><strong>{event.version}</strong>{event.resourceBranch ? <small>{event.resourceBranch}</small> : null}{event.launcherVersion ? <small>{localeText(locale)('Launcher', 'Лаунчер')} {event.launcherVersion}</small> : null}</span><span><time dateTime={event.observedAt}>{date(event.observedAt, event.precision === 'instant')}</time><small>{event.precision === 'day' ? copy.dayOnly : 'UTC'}</small></span></li>)}</ol> : <p>{copy.noHistory}</p>}
      </div> : null}
    </ToolInfoModal>
  </section>;
}
