# ============================================================
# Dockerfile — learning-assistant (linux/amd64)
# Next.js 16 + Prisma + SQLite + Python3 (PPTX 提取)
# ============================================================

# ─── 阶段1: 构建 ──────────────────────────────────────────────
FROM node:20-slim AS builder
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    libsqlite3-dev \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Prisma：生成客户端
RUN npx prisma generate

# 预编译种子脚本（不 external，确保 bcryptjs 等依赖全部打包进 seed.js）
RUN npx --yes esbuild prisma/seed.ts --bundle --platform=node --outfile=prisma/seed.js

# Next.js 构建（standalone 模式）
RUN npm run build

# ─── 阶段2: 运行 ──────────────────────────────────────────────
FROM node:20-slim AS runner
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    curl \
    libsqlite3-0 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001
ENV HOSTNAME="0.0.0.0"
ENV DATABASE_URL="file:/app/prisma/dev.db"

RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --gid nodejs nextjs

# ─── Next.js standalone 产物 ────────────────────────────
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/scripts ./scripts

# ─── Prisma 运行时依赖（含 schema + seed） ──────────────
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/prisma/schema.prisma ./prisma/schema.prisma
COPY --from=builder /app/prisma/seed.js ./prisma/seed.js

# ─── 重新生成 Linux 平台 Prisma 客户端（覆盖 Windows 二进制文件） ──
RUN DATABASE_URL="file:/app/prisma/dev.db" node node_modules/prisma/build/index.js generate

# ─── 入口脚本：启动时创建数据库 + 种子数据 ──────────────
COPY Dockerfile-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

RUN mkdir -p /home/nextjs/.npm /app/public/uploads && \
    chown -R nextjs:nodejs /app /home/nextjs

USER nextjs

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD curl -f http://localhost:3001/login || exit 1

ENTRYPOINT ["/docker-entrypoint.sh"]
