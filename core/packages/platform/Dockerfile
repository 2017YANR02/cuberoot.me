# syntax=docker/dockerfile:1.7
# Build context is core/; compose selects packages/platform/Dockerfile.

FROM node:24-bookworm-slim AS deps
WORKDIR /workspace
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@11.1.2 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches ./patches
COPY packages/platform/package.json ./packages/platform/package.json
COPY packages/shared/package.json ./packages/shared/package.json
RUN pnpm install --filter @cuberoot/platform... --frozen-lockfile

FROM node:24-bookworm-slim AS builder
WORKDIR /workspace
RUN corepack enable && corepack prepare pnpm@11.1.2 --activate
COPY --from=deps /workspace /workspace
COPY packages/platform ./packages/platform
COPY packages/shared ./packages/shared
ARG NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3100
ENV NEXT_TELEMETRY_DISABLED=1 \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    ADMIN_PASSWORD=container-build-only \
    SESSION_SECRET=container-build-only-session-secret
RUN pnpm --filter @cuberoot/shared build \
 && pnpm --filter @cuberoot/platform db:migrate \
 && pnpm --filter @cuberoot/platform db:seed \
 && pnpm --filter @cuberoot/platform build
RUN STANDALONE=packages/platform/.next/standalone \
 && ENTRY_DIR="$(dirname "$(find "$STANDALONE" -name server.js -not -path '*/node_modules/*' | head -1)")" \
 && test -f "$ENTRY_DIR/server.js" \
 && mkdir -p "$ENTRY_DIR/.next" "$ENTRY_DIR/public" /runtime \
 && cp -r packages/platform/.next/static "$ENTRY_DIR/.next/static" \
 && cp -r packages/platform/public/. "$ENTRY_DIR/public/" \
 && cp -r "$STANDALONE/." /runtime/ \
 && cp packages/platform/data.db /runtime/seed-data.db \
 && cp -r packages/platform/db/migrations /runtime/db-migrations \
 && cp packages/platform/ops/migrate.cjs /runtime/migrate.cjs \
 && cp packages/platform/ops/container-start.sh /runtime/container-start.sh \
 && chmod +x /runtime/container-start.sh

FROM node:24-bookworm-slim AS runner
WORKDIR /app
RUN apt-get update \
 && apt-get install -y --no-install-recommends tini \
 && rm -rf /var/lib/apt/lists/* \
 && groupadd --system app \
 && useradd --system --gid app --home-dir /app app \
 && mkdir -p /data \
 && chown -R app:app /app /data
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    DB_PATH=/data/data.db
COPY --from=builder --chown=app:app /runtime ./
USER app
EXPOSE 3000
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["/app/container-start.sh"]
