# Small standalone service — see README.md before deploying this.
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 whatsapp \
  && adduser --system --uid 1001 whatsapp

COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist

# Session credentials live here (see src/baileys.ts's AUTH_DIR) — a
# named volume in docker-compose.yml so re-pairing isn't needed on
# every restart. Owned by the non-root user this container runs as.
RUN mkdir -p /app/auth_info && chown -R whatsapp:whatsapp /app
USER whatsapp

EXPOSE 3100
ENV PORT=3100

# 127.0.0.1, not localhost: inside a container localhost can resolve to ::1
# first. Express here listens on every interface so it happened to pass, but
# the app image's identical check didn't (see /Dockerfile) — kept consistent.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:3100/health || exit 1

CMD ["node", "dist/server.js"]
