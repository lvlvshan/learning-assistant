# ============================================================
# Dockerfile — learning-assistant (linux/amd64)
# Next.js 16 + Prisma + SQLite + Python3 (PPTX 提取)
# ============================================================

# ─── 阶段1: 构建 ──────────────────────────────────────────────
FROM node:20-alpine AS builder
RUN apk add --no-cache python3
WORKDIR /app

# 依赖安装（利用缓存）
COPY package.json package-lock.json ./
RUN npm ci

# 源码
COPY . .

# 生成 Prisma 客户端（针对 linux/amd64）
RUN npx prisma generate

# 编译 seed.ts → seed.js（生产环境无需 tsx）
RUN npx --yes esbuild prisma/seed.ts --bundle --platform=node \
  --external:@prisma/client --external:bcryptjs --outfile=prisma/seed.js

# Next.js 构建（standalone 模式）
RUN npm run build

# ─── 阶段2: 运行 ──────────────────────────────────────────────
FROM node:20-alpine AS runner
RUN apk add --no-cache python3 curl

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001
ENV HOSTNAME="0.0.0.0"
# 使用绝对路径，避免 CWD 问题
ENV DATABASE_URL="file:/app/prisma/dev.db"

# 创建非 root 用户
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# ─── 复制 Prisma 相关 ──────────────────────────────────
COPY --from=builder /app/prisma ./prisma
# Prisma 客户端引擎（linux 二进制，关键！）
COPY --from=builder /app/node_modules/.prisma/client ./node_modules/.prisma/client
# @prisma/client 运行时
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client

# ─── 复制 Next.js standalone 产物 ──────────────────────
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/scripts ./scripts

# 确保必要目录存在且可写
RUN mkdir -p /app/public/uploads && \
    chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD curl -f http://localhost:3001/login || exit 1

# 启动：初始化数据库(幂等) → 启动服务
CMD ["sh", "-c", "\
  node ./prisma/seed.js 2>/dev/null; \
  exec node server.js \
"]
