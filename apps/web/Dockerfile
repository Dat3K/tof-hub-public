# syntax=docker/dockerfile:1

FROM node:24-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app
RUN npm install --global pnpm@12.5.1

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml turbo.json pnpm-lock.yaml ./
COPY packages ./packages
COPY apps/web/package.json ./apps/web/package.json
COPY apps/api/package.json ./apps/api/package.json
COPY tools/patch-exporter/package.json ./tools/patch-exporter/package.json
RUN pnpm install --frozen-lockfile --no-runtime

FROM base AS builder
WORKDIR /app
COPY --from=deps /app ./
COPY . .
ARG NEXT_PUBLIC_SITE_URL=http://localhost:8080
ARG NEXT_PUBLIC_CAPTURE_APP_URL=
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_CAPTURE_APP_URL=$NEXT_PUBLIC_CAPTURE_APP_URL
ENV TOF_HUB_API_ORIGIN=http://api:3001
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
# Build workspace dependencies first: their public entry points reference dist/,
# which is deliberately excluded from the host build context.
RUN pnpm --filter 'web...' build

FROM node:24-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 -G nodejs nextjs

RUN mkdir -p /app/apps/web/.next/cache && \
    chown -R nextjs:nodejs /app

COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/ || exit 1

CMD ["node", "apps/web/server.js"]

# Server releases mount public/ from /sites/tof/public rather than duplicating
# several gigabytes of media in every image and rollback version.
FROM runtime AS server

# Preserve the existing self-contained local-test image.
FROM runtime AS runner
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public
