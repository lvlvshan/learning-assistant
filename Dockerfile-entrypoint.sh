#!/bin/sh
set -e

echo "Initializing database..."

# 确保 prisma 目录存在且可写
mkdir -p /app/prisma

# 使用本地 Prisma CLI 创建表结构（使用正确的 Linux 查询引擎）
cd /app
DATABASE_URL="file:/app/prisma/dev.db" node node_modules/prisma/build/index.js db push --schema=./prisma/schema.prisma

# 填充种子数据
DATABASE_URL="file:/app/prisma/dev.db" node prisma/seed.js

echo "Database ready. Starting Next.js..."
exec node server.js
