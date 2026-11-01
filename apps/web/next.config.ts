import type { NextConfig } from "next";
import { HTML_LIMITED_BOT_UA_RE } from "next/dist/shared/lib/router/utils/html-bots";

const nextConfig: NextConfig = {
  output: "standalone",
  // Keep Next's default crawler coverage and put Telegram previews in <head> too.
  htmlLimitedBots: new RegExp(`${HTML_LIMITED_BOT_UA_RE.source}|TelegramBot`, "i"),
  // Docker copies public/ explicitly and production mounts mutable game assets.
  // Every server route reads mutable catalogs from public/; keep them in the explicit copy/mount.
  outputFileTracingExcludes: { "/*": ["./public/**/*"] },
  trailingSlash: true,
  webpack(config) {
    // Bundle the maintained editorial source on the server; do not read Markdown per request.
    config.module.rules.push({test: /case-study(?:\.ru)?\.md$/, type: 'asset/source'});
    return config;
  },
  // The Info pages are also opened through the machine's LAN address during
  // development. Next 16 protects dev-only resources (including webpack HMR)
  // from cross-origin requests, so explicitly allow the LAN host used by the
  // local preview. Override this list when the preview is served elsewhere.
  allowedDevOrigins: (process.env.TOF_HUB_DEV_ORIGINS ?? "localhost")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  async headers() {
    // Public game art (Wish banner backgrounds/splashes/titles, Info media, generated textures) changes only with a
    // data release. Without this, Next serves public files with max-age=0 and every banner switch revalidates each
    // image. Same revalidation-aware policy as deploy/nginx (one day, never immutable).
    const art = [{ key: "Cache-Control", value: "public, max-age=86400" }];
    return [
      { source: "/tools/build/mockup/:path*", headers: [{key:"X-Robots-Tag",value:"noindex, nofollow"}] },
      { source: "/datamine/shared/media/:path*", headers: art },
      { source: "/game-assets/:path*", headers: art },
      { source: "/project-story/:path*", headers: art },
    ];
  },
  async rewrites() {
    // In local development the browser must address the API through Next,
    // rather than treating /api as a web-app route (which returns 404).
    const apiOrigin = process.env.TOF_HUB_API_ORIGIN ?? "http://127.0.0.1:3001";
    return [
      {
        source: "/tools/build/mockup/",
        destination: "/tools/build/mockup/index.html",
      },
      {
        source: "/api/v1/:path*",
        destination: `${apiOrigin}/api/v1/:path*`,
      },
    ];
  },
  async redirects() {
    return [
      // 12 Catalogs: /datamine/:catalog/* and /datamine2/:catalog/* -> /info/:catalog/* (301)
      {
        source: "/datamine/simulacra/:path*",
        destination: "/info/simulacra/:path*",
        statusCode: 301,
      },
      {
        source: "/datamine2/simulacra/:path*",
        destination: "/info/simulacra/:path*",
        statusCode: 301,
      },
      {
        source: "/datamine/matrices/:path*",
        destination: "/info/matrices/:path*",
        statusCode: 301,
      },
      {
        source: "/datamine2/matrices/:path*",
        destination: "/info/matrices/:path*",
        statusCode: 301,
      },
      {
        source: "/datamine/relics/:path*",
        destination: "/info/relics/:path*",
        statusCode: 301,
      },
      {
        source: "/datamine2/relics/:path*",
        destination: "/info/relics/:path*",
        statusCode: 301,
      },
      {
        source: "/datamine/pets/:path*",
        destination: "/info/pets/:path*",
        statusCode: 301,
      },
      {
        source: "/datamine2/pets/:path*",
        destination: "/info/pets/:path*",
        statusCode: 301,
      },
      {
        source: "/datamine/cosmetics/:path*",
        destination: "/info/cosmetics/:path*",
        statusCode: 301,
      },
      {
        source: "/datamine2/cosmetics/:path*",
        destination: "/info/cosmetics/:path*",
        statusCode: 301,
      },
      {
        source: "/datamine/arts/:path*",
        destination: "/info/arts/:path*",
        statusCode: 301,
      },
      {
        source: "/datamine2/arts/:path*",
        destination: "/info/arts/:path*",
        statusCode: 301,
      },

      // 10 Editorial Root Pages: /datamine/:page/* and /datamine2/:page/* -> /:page/* (301)
      {
        source: "/datamine/about/:path*",
        destination: "/about/:path*",
        statusCode: 301,
      },
      {
        source: "/datamine2/about/:path*",
        destination: "/about/:path*",
        statusCode: 301,
      },
      {
        source: "/datamine/changelog/:path*",
        destination: "/changelog/:path*",
        statusCode: 301,
      },
      {
        source: "/datamine2/changelog/:path*",
        destination: "/changelog/:path*",
        statusCode: 301,
      },
      {
        source: "/datamine/contribute/:path*",
        destination: "/contribute/:path*",
        statusCode: 301,
      },
      {
        source: "/datamine2/contribute/:path*",
        destination: "/contribute/:path*",
        statusCode: 301,
      },
      {
        source: "/datamine/privacy/:path*",
        destination: "/privacy/:path*",
        statusCode: 301,
      },
      {
        source: "/datamine2/privacy/:path*",
        destination: "/privacy/:path*",
        statusCode: 301,
      },
      {
        source: "/datamine/projects/:path*",
        destination: "/projects/:path*",
        statusCode: 301,
      },
      {
        source: "/datamine2/projects/:path*",
        destination: "/projects/:path*",
        statusCode: 301,
      },

      // Tools · Ranking renamed from /tools/tops/* (301, preserves subpaths and query strings)
      {
        source: "/tools/tops/:path*",
        destination: "/tools/ranking/:path*",
        statusCode: 301,
      },
    ];
  },
};

export default nextConfig;
