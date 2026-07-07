# ============================================================
# Dockerfile — learning-assistant (linux/amd64)
# Next.js 16 + Prisma + SQLite + Python3 (PPTX 提取)
# 两个阶段均使用 Debian（node:20-slim），避免 musl/OpenSSL 兼容问题
# ============================================================

# ─── 阶段1: 构建 ──────────────────────────────────────────────
FROM node:20-slim AS builder
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Prisma 生成（生成 glibc 版引擎，匹配 Debian runner）
RUN npx prisma generate

# 编译 seed.ts → seed.js
RUN npx --yes esbuild prisma/seed.ts --bundle --platform=node \
  --external:@prisma/client --external:bcryptjs --outfile=prisma/seed.js

RUN npm run build

# ─── 阶段2: 运行 ──────────────────────────────────────────────
FROM node:20-slim AS runner
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    curl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001
ENV HOSTNAME="0.0.0.0"
ENV DATABASE_URL="file:/app/prisma/dev.db"

RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --gid nodejs nextjs

# ─── Prisma 相关文件 ────────────────────────────────────
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma/client ./node_modules/.prisma/client
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client

# ─── Next.js standalone 产物 ────────────────────────────
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/scripts ./scripts

RUN mkdir -p /app/public/uploads && \
    chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD curl -f http://localhost:3001/login || exit 1

CMD ["sh", "-c", "\
  node ./prisma/seed.js 2>/dev/null; \
  exec node server.js \
"]
