#!/bin/sh
set -e

echo "Initializing database..."

# 数据库已在构建阶段创建并复制到镜像中，确保文件权限正确
touch /app/prisma/dev.db
chown nextjs:nodejs /app/prisma/dev.db

echo "Database ready. Starting Next.js..."
exec node server.js
