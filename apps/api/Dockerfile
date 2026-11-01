# syntax=docker/dockerfile:1

FROM node:24-alpine AS base
RUN apk add --no-cache libc6-compat openssl
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
ENV NODE_ENV=production
RUN node scripts/generators/build-version-tracker.cjs && \
    pnpm --filter @tof-hub/config build && \
    pnpm exec tsc -p packages/game-domain/tsconfig.json --module CommonJS --moduleResolution node --ignoreDeprecations 6.0 && \
    node -e 'const fs=require("fs"); const pkg=JSON.parse(fs.readFileSync("./packages/game-domain/package.json","utf8")); pkg.main="./dist/index.js"; fs.writeFileSync("./packages/game-domain/package.json", JSON.stringify(pkg,null,2));' && \
    pnpm exec tsc -p packages/contracts/tsconfig.json --module CommonJS --moduleResolution node --ignoreDeprecations 6.0 && \
    node -e 'const fs=require("fs"); const pkg=JSON.parse(fs.readFileSync("./packages/contracts/package.json","utf8")); pkg.main="./dist/index.js"; fs.writeFileSync("./packages/contracts/package.json", JSON.stringify(pkg,null,2));' && \
    pnpm --filter api build

# A portable production-only dependency tree for the server API. Keep Prisma's
# generated client alongside its matching installed @prisma/client package.
FROM builder AS pruned
RUN pnpm --filter @tof-hub/config build && \
    node -e 'const fs=require("fs"); for(const dir of ["apps/api","packages/contracts","packages/game-domain","packages/config"]){const file=dir+"/package.json";const pkg=JSON.parse(fs.readFileSync(file,"utf8"));pkg.files=["dist"];fs.writeFileSync(file,JSON.stringify(pkg));}' && \
    pnpm --filter api deploy --prod --ignore-scripts /out && \
    node -e 'const fs=require("fs"),path=require("path");const locate=root=>path.resolve(path.dirname(require.resolve("@prisma/client/package.json",{paths:[root]})),"../..");fs.cpSync(path.join(locate("/app/apps/api"),".prisma"),path.join(locate("/out"),".prisma"),{recursive:true});' && \
    cd /out && node -e 'require("@prisma/client");require("@tof-hub/contracts");require("@tof-hub/game-domain");'

FROM node:24-alpine AS server
RUN apk add --no-cache libc6-compat openssl && \
    addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 -G nodejs -h /home/nestjs -D nestjs && \
    mkdir -p /app/.data && chown 1001:1001 /app/.data
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001
COPY --from=pruned --chown=nestjs:nodejs /out ./
USER nestjs
EXPOSE 3001
HEALTHCHECK --interval=10s --timeout=5s --start-period=31m --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3001/api/v1/health || exit 1
CMD ["node", "dist/main.js"]

# Keep the build-time migration engine, so deploy never downloads a binary.
FROM builder AS migration-engines
RUN node -e 'const fs=require("fs"),path=require("path");const cli=path.dirname(require.resolve("prisma/package.json",{paths:["/app/apps/api"]}));const root=path.dirname(require.resolve("@prisma/engines/package.json",{paths:[cli]}));const names=fs.readdirSync(root).filter(name=>name.startsWith("schema-engine-")&&fs.statSync(path.join(root,name)).isFile());if(names.length!==1)throw new Error("Expected one native Prisma schema engine");fs.mkdirSync("/migration-engines");fs.copyFileSync(path.join(root,names[0]),"/migration-engines/schema-engine");fs.chmodSync("/migration-engines/schema-engine",0o755);'

# Production migrations reuse the API's matching Prisma CLI dependency graph.
# Their only extra files are the schema, migrations and configuration.
FROM server AS migration
USER root
RUN node -e 'const fs=require("fs"),path=require("path");const client=path.dirname(require.resolve("@prisma/client/package.json"));const prisma=path.dirname(require.resolve("prisma/package.json",{paths:[client]}));if(!fs.existsSync("/app/node_modules/prisma"))fs.symlinkSync(prisma,"/app/node_modules/prisma");fs.mkdirSync("/app/apps/api",{recursive:true});fs.symlinkSync("/app/node_modules","/app/apps/api/node_modules");'
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/prisma.config.ts ./apps/api/prisma.config.ts
COPY --from=migration-engines --chown=nestjs:nodejs /migration-engines ./prisma-engines
ENV PRISMA_SCHEMA_ENGINE_BINARY=/app/prisma-engines/schema-engine
WORKDIR /app/apps/api
USER nestjs
HEALTHCHECK NONE
CMD ["node", "node_modules/prisma/build/index.js", "migrate", "deploy"]

# The existing image remains the maintenance/migration image and local default.
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 -G nodejs -h /home/nestjs -D nestjs && \
    mkdir -p /home/nestjs /app/.data && \
    chown -R nestjs:nodejs /home/nestjs /app/.data

COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/packages ./packages
COPY --from=builder --chown=nestjs:nodejs /app/apps/api ./apps/api
COPY --from=builder --chown=nestjs:nodejs /app/apps/web/public/game-data ./apps/web/public/game-data
COPY --from=builder --chown=nestjs:nodejs /app/package.json /app/pnpm-workspace.yaml /app/turbo.json /app/pnpm-lock.yaml ./

RUN ln -s /app/apps/api/dist /app/dist

USER nestjs

EXPOSE 3001

# A changed scoring revision can require the full startup rescore (transaction limit: 30 minutes).
HEALTHCHECK --interval=10s --timeout=5s --start-period=31m --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3001/api/v1/health || exit 1

CMD ["node", "apps/api/dist/main.js"]
