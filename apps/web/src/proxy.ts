import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const CATALOGS = new Set(['simulacra', 'matrices', 'relics', 'pets', 'cosmetics', 'arts']);
const EDITORIAL_PAGES = new Set(['about', 'changelog', 'contribute', 'privacy', 'projects']);

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Match /datamine/<section> or /datamine2/<section>
  const match = pathname.match(/^\/(datamine|datamine2)\/([a-zA-Z0-9_-]+)(\/.*)?$/);
  if (match) {
    const [, , section, rest] = match;
    let subpath = rest || '/';

    // Normalize subpath to end with trailing slash unless it has a file extension
    const hasExtension = /\.[a-z0-9]+$/i.test(subpath);
    if (!hasExtension && !subpath.endsWith('/')) {
      subpath = `${subpath}/`;
    }

    if (CATALOGS.has(section)) {
      const destination = `/info/${section}${subpath === '/' ? '/' : subpath}`;
      const url = new URL(destination + search, request.url);
      return NextResponse.redirect(url, 301);
    }

    if (EDITORIAL_PAGES.has(section)) {
      const destination = `/${section}${subpath === '/' ? '/' : subpath}`;
      const url = new URL(destination + search, request.url);
      return NextResponse.redirect(url, 301);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/datamine/:path*',
    '/datamine2/:path*',
  ],
};
