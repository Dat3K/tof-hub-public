'use client';

import {useEffect, useRef, useState} from 'react';

const RETURN_STORAGE = 'tof-raid-ranking-return-v1';

interface RankingPosition {
  token: string; href: string; player: string; entryId: string;
  visibleCount: number; scrollY: number; scrollX: number; anchorTop: number; tableLeft: number;
  restoration: ScrollRestoration;
}

function position(value: unknown): RankingPosition | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  if (!['token', 'href', 'player', 'entryId'].every(key => typeof item[key] === 'string')) return null;
  if (!['visibleCount', 'scrollY', 'scrollX', 'anchorTop', 'tableLeft'].every(key => typeof item[key] === 'number' && Number.isFinite(item[key]))) return null;
  return value as RankingPosition;
}

function storedPosition() {
  try {return position(JSON.parse(sessionStorage.getItem(RETURN_STORAGE) ?? 'null'));} catch {return null;}
}

function pageHref() { return window.location.pathname + window.location.search + window.location.hash; }

/** The source entry owns its list position; the player entry only points back to it. */
export function openRaidPlayer(player: string, trigger: HTMLButtonElement, visibleCount: number) {
  const url = new URL(window.location.href);
  const origin: RankingPosition = {
    token: crypto.randomUUID(), href: pageHref(), player, entryId: trigger.dataset.raidEntry ?? '', visibleCount,
    scrollY: window.scrollY, scrollX: window.scrollX, anchorTop: trigger.getBoundingClientRect().top,
    tableLeft: trigger.closest('table')?.parentElement?.scrollLeft ?? 0,
    restoration: window.history.scrollRestoration,
  };
  try {sessionStorage.setItem(RETURN_STORAGE, JSON.stringify(origin));} catch { /* History remains available when storage is blocked. */ }
  const state = {...window.history.state};
  delete state.tofRaidPlayerReturn;
  // Only this source entry uses manual restoration; other pages retain their policy.
  window.history.scrollRestoration = 'manual';
  window.history.replaceState({...state, tofRaidRankingPosition: origin}, '', url);
  delete state.tofRaidRankingPosition;
  url.searchParams.set('player', player);
  url.searchParams.set('tab', 'comparison');
  window.history.pushState({...state, tofRaidPlayerReturn: {token: origin.token, href: origin.href}}, '', url);
  window.history.scrollRestoration = origin.restoration;
  window.dispatchEvent(new PopStateEvent('popstate'));
  window.scrollTo({top: 0, left: 0, behavior: 'instant'});
}

export function backToRaidRanking() {
  const origin = window.history.state?.tofRaidPlayerReturn;
  if (typeof origin?.token === 'string' && typeof origin.href === 'string'
    && origin.href.startsWith(window.location.pathname) && window.history.length > 1) {
    window.history.back();
    return;
  }
  const url = new URL(window.location.href);
  url.searchParams.delete('player');
  url.searchParams.set('tab', 'ranking');
  const state = {...window.history.state};
  delete state.tofRaidPlayerReturn;
  delete state.tofRaidRankingPosition;
  window.history.replaceState(state, '', url);
  window.dispatchEvent(new PopStateEvent('popstate'));
  window.scrollTo({top: 0, left: 0, behavior: 'instant'});
}

/** Restore batches before restoring the clicked nickname's viewport position. */
export function useRaidRankingReturn({visibleCount, totalCount, hasMore, loadMore, ready}: {
  visibleCount: number; totalCount: number; hasMore: boolean; loadMore: () => void; ready: boolean;
}) {
  const completed = useRef<string | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const sync = () => {completed.current = null; setRevision(value => value + 1);};
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);
  useEffect(() => {
    const stored = storedPosition();
    const origin = stored?.href === pageHref() ? stored : position(window.history.state?.tofRaidRankingPosition);
    if (!ready || !origin || origin.href !== pageHref() || completed.current === origin.token) return;
    if (hasMore && visibleCount < Math.min(origin.visibleCount, totalCount)) {loadMore(); return;}
    const root = document.querySelector('[data-ranking-ready="true"]');
    const target = [...(root?.querySelectorAll<HTMLButtonElement>('[data-raid-player]') ?? [])]
      .find(button => button.dataset.raidPlayer === origin.player && button.dataset.raidEntry === origin.entryId);
    if (!target && hasMore) {loadMore(); return;}
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        completed.current = origin.token;
        const scrollPanel = target?.closest('table')?.parentElement;
        if (scrollPanel) scrollPanel.scrollLeft = origin.tableLeft;
        target?.focus({preventScroll: true});
        window.scrollTo({left: origin.scrollX, top: target ? target.getBoundingClientRect().top + window.scrollY - origin.anchorTop : origin.scrollY, behavior: 'instant'});
        window.history.scrollRestoration = origin.restoration === 'manual' ? 'manual' : 'auto';
        try {if (storedPosition()?.token === origin.token) sessionStorage.removeItem(RETURN_STORAGE);} catch { /* Optional recovery storage. */ }

      });
    });
    return () => cancelAnimationFrame(frame);
  }, [visibleCount, totalCount, hasMore, loadMore, ready, revision]);
}
