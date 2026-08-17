# syntax=docker/dockerfile:1.7
# Multi-stage build for cube-platform (Next 16 + better-sqlite3)

FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache python3 make g++ libc6-compat
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

FROM node:20-alpine AS runner
WORKDIR /app
RUN apk add --no-cache libc6-compat tini
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    DB_PATH=/data/data.db

RUN addgroup -S app && adduser -S app -G app \
 && mkdir -p /data \
 && chown -R app:app /data

# next standalone output
COPY --from=builder --chown=app:app /app/.next/standalone ./
COPY --from=builder --chown=app:app /app/.next/static ./.next/static
COPY --from=builder --chown=app:app /app/public ./public
# native module + migration assets needed at runtime
COPY --from=builder --chown=app:app /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3
COPY --from=builder --chown=app:app /app/node_modules/bindings ./node_modules/bindings
COPY --from=builder --chown=app:app /app/node_modules/file-uri-to-path ./node_modules/file-uri-to-path
COPY --from=builder --chown=app:app /app/db/migrations ./db/migrations

USER app
EXPOSE 3000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
