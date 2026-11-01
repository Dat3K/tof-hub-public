import { vi, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});

// Polyfill DOM APIs if running under jsdom
if (typeof window !== 'undefined') {
  if (!window.matchMedia) {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  }

  if (!window.scrollTo) {
    window.scrollTo = vi.fn();
  }

  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = vi.fn().mockImplementation(function () { return {
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    }; });
  }

  if (!globalThis.IntersectionObserver) {
    globalThis.IntersectionObserver = vi.fn().mockImplementation(function () { return {
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
      takeRecords: vi.fn().mockReturnValue([]),
    }; });
  }
}

// Global Next.js navigation mock
vi.mock('next/navigation', () => {
  const push = vi.fn();
  const replace = vi.fn();
  const refresh = vi.fn();
  const back = vi.fn();
  const forward = vi.fn();
  const prefetch = vi.fn();

  return {
    useRouter: () => ({
      push,
      replace,
      refresh,
      back,
      forward,
      prefetch,
    }),
    usePathname: () => '/info',
    useSearchParams: () => new URLSearchParams(),
    notFound: vi.fn(),
    redirect: vi.fn(),
  };
});

// Global Next.js headers mock
vi.mock('next/headers', () => {
  return {
    cookies: vi.fn(async () => ({
      get: (name: string) => {
        if (typeof document !== 'undefined') {
          const matches = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
          if (matches) return { name, value: decodeURIComponent(matches[1]) };
        }
        return undefined;
      },
      getAll: () => [],
      has: () => false,
    })),
    headers: vi.fn(async () => new Headers()),
  };
});
