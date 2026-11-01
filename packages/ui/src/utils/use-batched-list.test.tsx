import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useBatchedList, type UseBatchedListOptions } from './use-batched-list';

const items = Array.from({ length: 65 }, (_, index) => index);
const observers: { callback: IntersectionObserverCallback; observer: IntersectionObserver; options?: IntersectionObserverInit }[] = [];
function List({ values = items, ...options }: UseBatchedListOptions & { values?: readonly number[] }) {
  const { visibleItems, hasMore, loadMore, sentinelRef } = useBatchedList(values, options);
  return <><ul>{visibleItems.map(value => <li key={value}>{value}</li>)}</ul>
    {hasMore && <div ref={sentinelRef}><button onClick={loadMore}>More</button></div>}</>;
}
function intersect(index = observers.length - 1, isIntersecting = true) {
  const { callback, observer } = observers[index]!;
  callback([{ isIntersecting } as IntersectionObserverEntry], observer);
}
beforeEach(() => {
  observers.length = 0;
  vi.stubGlobal('IntersectionObserver', vi.fn(function (callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    const observer = { observe: vi.fn(), disconnect: vi.fn() } as unknown as IntersectionObserver;
    observers.push({ callback, observer, options });
    return observer;
  }));
});
afterEach(() => vi.unstubAllGlobals());

describe('useBatchedList', () => {
  it('appends exactly 20 per approach, ignores repeated callbacks and stops at the remainder', () => {
    render(<List resetKey="upgrades" batchSize={20} rootMargin="400px 0px" />);
    expect(screen.getAllByRole('listitem')).toHaveLength(20);
    expect(observers[0]!.options?.rootMargin).toBe('400px 0px');
    act(() => intersect(0, false));
    expect(screen.getAllByRole('listitem')).toHaveLength(20);
    act(() => { intersect(0); intersect(0); });
    expect(screen.getAllByRole('listitem')).toHaveLength(40);
    act(() => intersect());
    expect(screen.getAllByRole('listitem')).toHaveLength(60);
    act(() => intersect());
    expect(screen.getAllByRole('listitem').map(node => Number(node.textContent))).toEqual(items);
    expect(screen.queryByRole('button')).toBeNull();
    expect(observers).toHaveLength(3);
    expect(observers.every(item => vi.mocked(item.observer.disconnect).mock.calls.length > 0)).toBe(true);
  });

  it('resets tabs, ordered lists and batch size, discarding callbacks from the previous list', () => {
    const { rerender, unmount } = render(<List resetKey="upgrades" batchSize={20} />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getAllByRole('listitem')).toHaveLength(40);
    const oldObserver = observers.length - 1;
    rerender(<List resetKey="all" batchSize={20} />);
    act(() => intersect(oldObserver));
    expect(screen.getAllByRole('listitem')).toHaveLength(20);
    fireEvent.click(screen.getByRole('button'));
    const reversed = [...items].reverse();
    rerender(<List values={reversed} resetKey={reversed} batchSize={20} />);
    expect(screen.getAllByRole('listitem').map(node => Number(node.textContent))).toEqual(reversed.slice(0, 20));
    rerender(<List values={reversed} resetKey={reversed} batchSize={10} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(10);
    const current = observers.length - 1;
    unmount();
    expect(observers[current]!.observer.disconnect).toHaveBeenCalled();
    act(() => intersect(current));
  });

  it('handles empty/short lists and supports manual loading without IntersectionObserver', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const { rerender } = render(<List values={[]} resetKey="empty" batchSize={20} />);
    expect(screen.queryByRole('listitem')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
    rerender(<List values={[1, 2]} resetKey="short" batchSize={20} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.queryByRole('button')).toBeNull();
    rerender(<List resetKey="all" batchSize={20} />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getAllByRole('listitem')).toHaveLength(40);
  });

  it('preserves the Info catalog default batch and approach distance', () => {
    render(<List resetKey="catalog" />);
    expect(screen.getAllByRole('listitem')).toHaveLength(60);
    expect(observers[0]!.options?.rootMargin).toBe('600px 0px');
  });
});
