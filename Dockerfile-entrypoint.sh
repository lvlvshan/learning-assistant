#!/bin/sh
set -e

echo "Initializing database..."

# 确保数据库文件存在且有正确权限
touch /app/prisma/dev.db
chown nextjs:nodejs /app/prisma/dev.db 2>/dev/null || true

echo "Database ready. Starting Next.js..."
exec node server.js
