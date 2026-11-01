import { vi } from 'vitest';

export const push = vi.fn();
export const replace = vi.fn();
export const refresh = vi.fn();
export const back = vi.fn();
export const forward = vi.fn();
export const prefetch = vi.fn();

export function useRouter() {
  return {
    push,
    replace,
    refresh,
    back,
    forward,
    prefetch,
  };
}

export function usePathname() {
  return '/info';
}

export function useSearchParams() {
  return new URLSearchParams();
}

export function useParams() {
  return {};
}

export function useSelectedLayoutSegment() {
  return null;
}

export function useSelectedLayoutSegments() {
  return [];
}

export const notFound = vi.fn();
export const redirect = vi.fn();
