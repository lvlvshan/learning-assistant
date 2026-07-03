@echo off
chcp 65001 >nul
title 辅助学习系统

echo =====================================
echo   辅助学习系统 — 启动脚本
echo =====================================
echo.

REM 设置工作目录
cd /d "%~dp0"

REM 检查 Node.js
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [错误] 未检测到 Node.js，请先安装：https://nodejs.org
    pause
    exit /b 1
)

REM 检查 node_modules
if not exist "node_modules\" (
    echo [信息] 正在安装依赖...
    call npm install
    if %ERRORLEVEL% neq 0 (
        echo [错误] 依赖安装失败
        pause
        exit /b 1
    )
)

REM 检查数据库
if not exist "prisma\dev.db" (
    echo [信息] 正在初始化数据库...
    call npx prisma generate
    call npx prisma db push
    call npx tsx prisma/seed.ts
    echo [信息] 种子数据已导入
)

echo [信息] 启动生产服务器（端口 3001）...
echo.
echo 访问地址: http://localhost:3001
echo 局域网访问: http://%COMPUTERNAME%:3001
echo.
echo 按 Ctrl+C 停止服务器
echo.

call npm run start
pause
