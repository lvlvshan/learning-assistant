# ============================================================
# Dockerfile — learning-assistant (linux/amd64)
# Next.js 16 + Prisma + SQLite + Python3 (PPTX 提取)
# ============================================================

# ─── 阶段1: 安装依赖 ──────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --only=production

# ─── 阶段2: 构建 ──────────────────────────────────────────────
FROM node:20-alpine AS builder
RUN apk add --no-cache python3
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .

# Prisma 客户端生成
RUN npx prisma generate

# 编译 seed.ts → seed.js（生产环境无 tsx 也能运行）
RUN npx --yes esbuild prisma/seed.ts --bundle --platform=node \
  --external:@prisma/client --external:bcryptjs --outfile=prisma/seed.js

# Next.js 构建（自动启用 standalone 输出）
RUN npm run build

# ─── 阶段3: 运行 ──────────────────────────────────────────────
FROM node:20-alpine AS runner
RUN apk add --no-cache python3 curl

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001
ENV HOSTNAME="0.0.0.0"

# 创建非 root 用户
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# 复制运行时所需的 Prisma 相关文件
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/scripts ./scripts

# 复制 Next.js standalone 构建产物
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# 确保上传目录存在
RUN mkdir -p /app/public/uploads && chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD curl -f http://localhost:3001/login || exit 1

# 启动：初始化数据库 → 填充种子数据（幂等） → 启动服务
CMD ["sh", "-c", "\
  node ./prisma/seed.js 2>/dev/null; \
  exec node server.js \
"]
