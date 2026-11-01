FROM node:24.15.0-alpine AS base
RUN apk add --no-cache bash unzip git libc6-compat openssl && npm install -g pnpm@12.5.1
WORKDIR /workspace
ENTRYPOINT []
CMD ["node", "scripts/setup.mjs"]

FROM base AS runner
COPY . .
RUN pnpm install --frozen-lockfile --no-runtime
RUN pnpm --filter '@tof-hub/contracts...' --filter '@tof-hub/game-assets...' --filter '@tof-hub/game-domain...' build
CMD ["pnpm", "--filter", "@tof-hub/tof-exporter", "run", "pipeline", "--raw", "/raw", "--out", "/output"]
