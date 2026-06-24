# ──────────────────────────────────────────────────────────────
# Stage 1: deps – install node_modules with Bun (fast, resilient)
# ──────────────────────────────────────────────────────────────
FROM oven/bun:1 AS deps
WORKDIR /app

COPY package.json bun.lockb* package-lock.json* ./
# Bun resolves from package.json; far faster + more network-tolerant than npm.
RUN bun install

# ──────────────────────────────────────────────────────────────
# Stage 2: builder – compile Next.js app with Bun
# ──────────────────────────────────────────────────────────────
FROM oven/bun:1 AS builder
WORKDIR /app

# Build-time public env vars (baked into the bundle)
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_WS_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_WS_URL=${NEXT_PUBLIC_WS_URL}
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN bun run build

# ──────────────────────────────────────────────────────────────
# Stage 3: runner – minimal production image (Node runtime)
# Next.js standalone output ships a plain `server.js` run by Node.
# ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "server.js"]
