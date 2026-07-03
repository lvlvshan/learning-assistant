# 辅助学习系统 — 局域网部署指南

## 环境要求

| 组件 | 要求 |
|------|------|
| Node.js | >= 18（建议 20 LTS） |
| npm | >= 9 |
| 系统 | Windows 10/11 或 Linux |
| 内存 | >= 4GB（含本地 AI 模型建议 >= 16GB） |
| 磁盘 | >= 1GB（含本地 AI 模型建议 >= 20GB） |

---

## 快速部署

### 1. 安装 Node.js

**Windows**: 从 https://nodejs.org 下载 LTS 版本安装。
**Linux**: `curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash - && sudo apt install -y nodejs`

验证安装：
```bash
node --version  # >= 18
npm --version   # >= 9
```

### 2. 部署系统

```bash
cd /path/to/learning-assistant   # 服务器上的项目路径

# 安装依赖
npm install

# 初始化数据库
npx prisma generate
npx prisma db push

# 导入种子数据（首次）
npx tsx prisma/seed.ts

# 构建生产版本
npm run build

# 启动生产服务器
npm run start   # 默认 http://localhost:3001
```

### 3. 设置环境变量

创建 `.env` 文件：

```env
# 数据库（SQLite 默认，无需修改）
DATABASE_URL="file:./dev.db"

# JWT 密钥（生产环境必须修改！）
JWT_SECRET="your-random-64-char-secret-here"

# 端口号（默认 3001）
PORT=3001
```

生成随机 JWT 密钥：
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. Windows 开机自启（批处理脚本）

创建 `start-server.bat`：
```batch
@echo off
cd /d C:\learning-assistant
set PORT=3001
npm run start
```

放入 Windows 开机启动文件夹：`shell:startup`

---

## 配置 AI 服务

系统**不绑定任何 AI 厂商**，管理员通过网页自行配置。

### 方案 A：使用商业 API（推荐快速体验）

1. 登录系统 -> 管理员账号 -> 系统设置
2. 填写：
   - 提供商：OpenAI 兼容接口
   - API 地址：`https://api.openai.com/v1`
   - API Key：你的 key
   - 模型：`gpt-4o` / `deepseek-chat` 等
3. 点击「测试连接」确认可用
4. 启用 AI 服务

### 方案 B：局域网部署 Ollama + 本地模型（免费）

在服务器或同一局域网内的机器上部署：

```bash
# 下载安装 Ollama（Windows/Linux/macOS）
# https://ollama.com/download

# 拉取中文优化模型（推荐）
ollama pull qwen2.5:7b   # 通义千问 7B，学校场景够用
# 或更轻量
ollama pull qwen2.5:3b

# 启动 Ollama（默认端口 11434）
ollama serve
```

然后在系统设置中配置：
- 提供商：Ollama
- API 地址：`http://localhost:11434/v1`（同机）或 `http://192.168.1.100:11434/v1`（局域网其他机器）
- API Key：留空
- 模型：`qwen2.5:7b`

---

## 访问系统

| 角色 | 账号 | 密码 | 说明 |
|------|------|------|------|
| 系统管理员 | admin | 123456 | 首次登录后请修改密码 |
| 教师 | teacher1 | 123456 | 教学管理 |
| 教师 | teacher2 | 123456 | 教学管理 |
| 学生 | student1~6 | 123456 | 学习练习 |

**URL**: `http://服务器IP:3001`

局域网其他设备通过浏览器访问 `http://192.168.x.x:3001` 即可。

---

## 常见问题

### Q: 启动后页面白屏/无法访问？
检查防火墙是否放行端口（默认 3001）：
```bash
# Windows PowerShell (管理员)
New-NetFirewallRule -DisplayName "Learning Assistant" -Direction Inbound -Protocol TCP -LocalPort 3001 -Action Allow
```

### Q: AI 分析提示"AI 服务未配置"？
登录管理员账号 -> 系统设置 -> 配置并启用 AI 服务。

### Q: 学生开始练习提示"暂无已审核的题目"？
老师需要先上传资料 -> AI 提取知识点 -> 生成题目 -> 审核通过，学生才能练习。

### Q: 如何修改默认端口？
创建 `.env` 文件，添加 `PORT=3001`（或其它端口），然后重启服务。

### Q: 如何备份数据？
SQLite 数据库文件位于 `prisma/dev.db`，直接复制该文件即可备份。

---

## 安全建议（上线前必读）

1. **修改默认密码**：登录后立即修改所有默认账号的密码
2. **修改 JWT_SECRET**：生成随机 64 位字符串
3. **局域网部署**：不要暴露到公网，学校内网访问即可
4. **定期备份**：备份 `prisma/dev.db` 文件
