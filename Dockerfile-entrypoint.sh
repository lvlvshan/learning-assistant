#!/bin/sh
set -e

echo "Initializing database..."

# 运行数据库迁移（构建阶段已生成 Prisma 客户端）
# 直接调用 node 避免 npx 依赖 .bin 可执行文件
node /app/node_modules/prisma/build/main.js db push --skip-generate

echo "Seeding database..."
if [ -f /app/prisma/seed.js ]; then
  node /app/prisma/seed.js
else
  echo "No seed.js found, skipping seed"
fi

echo "Database ready. Starting Next.js..."
exec node server.js
