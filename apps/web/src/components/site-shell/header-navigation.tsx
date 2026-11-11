'use client';

import {
  Activity,
  createContext,
  startTransition,
  useContext,
  useOptimistic,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { RouteLoadingForPath } from './route-loading';

const HeaderNavigationContext = createContext<{
  pathname: string;
  navigate: (href: string) => boolean;
} | null>(null);

export function HeaderNavigation({ header, children }: { header: ReactNode; children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [destination, setDestination] = useOptimistic(pathname);
  const pending = destination !== pathname;

  function navigate(href: string) {
    const target = new URL(href, window.location.href).pathname;
    const samePage = target.replace(/\/$/, '') === pathname.replace(/\/$/, '');
    if (samePage && !pending) return false;

    // Keep the destination visible until the router commits its next tree.
    startTransition(() => {
      setDestination(samePage ? pathname : target);
      router.push(href);
    });
    return true;
  }

  return (
    <HeaderNavigationContext.Provider value={{ pathname: destination, navigate }}>
      {header}
      <main id="main-content" className="flex-1">
        <Activity mode={pending ? 'hidden' : 'visible'}>{children}</Activity>
        {pending && <RouteLoadingForPath pathname={destination} />}
      </main>
    </HeaderNavigationContext.Provider>
  );
}

export function useHeaderPathname() {
  const pathname = usePathname();
  return useContext(HeaderNavigationContext)?.pathname ?? pathname;
}

type HeaderLinkProps = ComponentPropsWithoutRef<'a'> & { href: string };

export function HeaderLink({ href, ...props }: HeaderLinkProps) {
  const navigation = useContext(HeaderNavigationContext);
  return (
    <Link
      {...props}
      href={href}
      prefetch={false}
      onNavigate={(event) => {
        if (navigation?.navigate(href)) event.preventDefault();
      }}
    />
  );
}
