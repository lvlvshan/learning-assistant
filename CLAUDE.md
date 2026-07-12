# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# 辅助学习系统 (Learning Assistant)

学校学生使用的智能学习辅助平台。Next.js 全栈应用，LAN 部署。

## Quick Start

```bash
cd /d/claude/learning-assistant

# 初始化数据库（首次）
npx prisma generate
npx prisma db push
npm run db:seed    # 创建默认账号

# 启动开发服务器（端口 3001）
npm run dev        # http://localhost:3001

# 生产构建
npm run build && npm run start
```

## 默认账号

| 角色 | 用户名 | 密码 | 说明 |
|------|--------|------|------|
| 管理员 | admin | 123456 | 系统管理 |
| 教师 | teacher1 | 123456 | 教学管理 |
| 教师 | teacher2 | 123456 | 教学管理 |
| 学生 | student1~6 | 123456 | 学习练习 |

## 常用命令

```bash
npm run dev              # 开发服务器 (localhost:3001)
npm run build            # 生产构建
npm run start            # 启动生产服务器
npm run lint             # ESLint 检查（eslint.config.mjs）
npm run db:generate      # prisma generate
npm run db:push          # prisma db push
npm run db:seed          # 重置种子数据（tsx prisma/seed.ts）
npm run db:studio        # Prisma Studio GUI

# Prisma
npx prisma validate      # 验证 schema
npx prisma format        # 格式化 schema
```

## 环境变量 (.env)

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `DATABASE_URL` | `file:./dev.db` | SQLite 路径 |
| `JWT_SECRET` | `learning-assistant-dev-secret-change-in-production` | JWT 密钥 |
| `PORT` | `3001` | 服务器端口 |

## 架构

**Next.js 16 (App Router)** — 前端 + API 合一，局域网部署简化。

| 层级 | 技术 |
|------|------|
| 框架 | Next.js 16 + TypeScript |
| 数据库 | SQLite (Prisma ORM) |
| UI | Ant Design v6 + @ant-design/icons |
| 状态管理 | Zustand (persist middleware) + @tanstack/react-query |
| HTTP | Axios |
| 认证 | JWT + bcryptjs |
| AI | 抽象 Provider 层（管理员配置） |
| 测试 | Playwright（dependencies，未配置测试文件） |

## 项目结构

```
src/
├── app/                    # App Router pages + API routes
│   ├── page.tsx            # 根路径 → redirect /login
│   ├── layout.tsx          # 根布局（AntdProvider 包裹）
│   ├── globals.css         # 全局样式
│   ├── login/              # 登录页
│   ├── dashboard/          # 认证后页面（角色路由守卫在 layout.tsx）
│   │   ├── layout.tsx      # 共享侧边栏 + 顶栏 + 角色菜单
│   │   ├── admin/          # 管理员：概览 / 用户 / 班级 / 科目 / 系统设置
│   │   ├── teacher/        # 教师：看板 / 资料 / 知识点(树) / 题库 / 学生 / 班级分析
│   │   └── student/        # 学生：学习 / 练习(会话) / 进度 / 记录
│   └── api/                # API 路由
├── components/
│   └── AntdProvider.tsx    # Ant Design v6 中文配置 + 主题色
├── lib/
│   ├── ai/                 # AI Provider 抽象层
│   │   ├── types.ts        # 接口定义与结果类型
│   │   ├── config.ts       # 配置加载（带缓存）
│   │   ├── provider.ts     # 工厂 + chatWithJSON 辅助
│   │   ├── openai.ts       # OpenAI 兼容实现（Ollama / DeepSeek / 通义千问）
│   │   └── prompts.ts      # 提示词模板 + 中文标签辅助函数
│   ├── auth.ts             # JWT + bcrypt + 请求认证辅助函数
│   ├── api.ts              # Axios 客户端（自动注入 token / 401 自动登出）
│   └── prisma.ts           # Prisma 单例（dev 模式下记录 query）
├── stores/
│   └── userStore.ts        # Zustand + persist（localStorage 持久化）
└── middleware.ts           # 路由守卫（当前仅匹配路径，实际认证在 API 层处理）
```

## API 认证模式

- **中间件** (`src/middleware.ts`): 仅匹配路径 `/api/:path*` 和 `/dashboard/:path*`，不做实际认证
- **API 路由认证**: 每个 API handler 内部调用 `getAuthFromRequest(request)` 提取 JWT，配合角色检查
- **前端守卫**: `src/app/dashboard/layout.tsx` 中检查 token 并调 `/api/auth/me` 验证
- **Axios 拦截器**: 401 响应自动清除 store 并跳转 `/login`

## API 路由

### 认证
| 端点 | 方法 | 说明 | 权限 |
|------|------|------|------|
| `/api/auth/login` | POST | 登录 | 公开 |
| `/api/auth/me` | GET | 当前用户 | 认证 |

### 管理
| 端点 | 方法 | 说明 | 权限 |
|------|------|------|------|
| `/api/users` | GET/POST | 用户列表/创建 | ADMIN |
| `/api/users/[id]` | GET/PUT/DELETE | 用户管理 | ADMIN |
| `/api/classes` | GET/POST | 班级管理 | ADMIN/TEACHER |
| `/api/classes/[id]` | PUT/DELETE | 班级管理 | ADMIN |
| `/api/subjects` | GET/POST/PUT/DELETE | 科目管理 | ADMIN |
| `/api/admin/settings` | GET/PUT | 系统配置(AI) | ADMIN |
| `/api/admin/settings/test` | POST | AI 连接测试 | ADMIN |

### 资料与知识点
| 端点 | 方法 | 说明 | 权限 |
|------|------|------|------|
| `/api/materials` | GET/POST | 资料列表/创建 | TEACHER+ |
| `/api/materials/[id]` | GET/PUT/DELETE | 资料管理 | TEACHER+ |
| `/api/materials/[id]/analyze` | POST | AI 提取知识点 | TEACHER+ |
| `/api/materials/upload` | POST | 文件上传 | TEACHER+ |
| `/api/knowledge-points` | GET/POST/PUT/DELETE | 知识点 CRUD（树形） | TEACHER+ |

### 练习
| 端点 | 方法 | 说明 | 权限 |
|------|------|------|------|
| `/api/practice/start` | POST | 开始练习(随机选题) | STUDENT |
| `/api/practice/sessions` | GET | 练习记录列表 | 认证 |
| `/api/practice/[id]/questions` | GET | 获取题目 | STUDENT |
| `/api/practice/[id]/submit` | POST | 提交答案(自动/AI判卷) | STUDENT |
| `/api/practice/[id]/regenerate` | POST | AI 针对薄弱点重新出题 | STUDENT |
| `/api/practice/[id]/finish` | POST | 完成练习+AI综合分析 | STUDENT |

### 题目
| 端点 | 方法 | 说明 | 权限 |
|------|------|------|------|
| `/api/questions` | GET/POST | 题目列表/创建 | TEACHER+ |
| `/api/questions/[id]` | PUT/DELETE | 题目编辑/删除 | TEACHER+ |
| `/api/questions/generate` | POST | AI 批量生成题目 | TEACHER+ |

### 看板
| 端点 | 方法 | 说明 | 权限 |
|------|------|------|------|
| `/api/dashboard/teacher` | GET | 教学总看板(汇总/趋势/分析) | TEACHER+ |
| `/api/dashboard/student` | GET | 学生个人看板 | 认证 |
| `/api/students/[id]/stats` | GET | 学生详细统计 | TEACHER+ |

## 数据模型（13 个表）

### 身份与组织
- **User** — id/username/password/name/role(STUDENT|TEACHER|ADMIN)/classId
- **Class** — id/name/grade → students(User[]), teachers(User[])
- **Subject** — id/name/description/icon

### 学习资料
- **LearningMaterial** — title/type(TEXT|PDF|IMAGE|VIDEO)/content/fileUrl → Subject, Author
- **MaterialChunk** — content/chunkIndex → Material
- **KnowledgePoint** — 树形: parentId(自引用)/subjectId/difficultyLevel(BASIC|INTERMEDIATE|ADVANCED)/orderIndex

### 练习与评估
- **Question** — type(MULTIPLE_CHOICE|TF|FILL_BLANK|SHORT_ANSWER)/difficulty/bloomLevel/aiGenerated/reviewedByTeacher → KnowledgePoint
- **ExerciseSession** — status(IN_PROGRESS|COMPLETED)/totalQuestions/correctCount/score/weaknessData(JSON) → Student, Subject
- **ExerciseAnswer** — studentAnswer/isCorrect/score/aiFeedback(JSON) → Session, Question

### 掌握度追踪
- **StudentWeakness** — masteryLevel(0-100)/bloomBreakdown(JSON) → Student, KnowledgePoint
- **MasteryRecord** — previousLevel/newLevel/delta → Student, KnowledgePoint, Session

### 系统
- **SystemConfig** — key/value(JSON)/description
- **AIGenerationLog** — type/provider/model/promptHash/tokens/durationMs

## AI 提供商抽象层

管理员在 `/dashboard/admin/settings` 页面配置，支持三种模式：

| 模式 | 说明 |
|------|------|
| `openai-compatible` | 通用 OpenAI 兼容接口（Ollama / DeepSeek / 通义千问 / vLLM） |
| `ollama` | 本地部署免费方案（复用 OpenAI 兼容实现） |
| `custom` | 自定义（同样复用 OpenAI 兼容请求格式） |

配置保存在 `SystemConfig` 表 `key="ai-config"`。未配置时返回错误提示。

## AI 判卷规则

| 题型 | 判卷方式 |
|------|----------|
| MULTIPLE_CHOICE (选择题) | 直接比对 `correctAnswer` — 无需 AI |
| TF (判断题) | 直接比对 `correctAnswer` — 无需 AI |
| FILL_BLANK (填空题) | 先精确比对，不一致则走 AI 评估（有容错） |
| SHORT_ANSWER (简答题) | AI 评估（失败时给 50 分作为容错） |

## 重要开发注意事项

1. **Next.js 16 `params` 为 `Promise` 类型** — 必须 `await context.params`
2. **SQLite 不支持 enum** — role/status/type/difficulty 等用字符串存储
3. **Ant Design v6 + React 19** — 确保导入路径正确
4. **Zustand v5 persist** — token 恢复是异步的，dashboard layout 中通过 `subscribe` 监听恢复完成
5. **文件上传** — 支持 PPTX/TXT 上传到 `public/` 目录，AI 分析时通过 Python 脚本 (`scripts/extract_pptx.py`) 或 `readFileSync` 提取文本
6. **知识点树** — 自引用 parentId 实现树形结构，API 通过 `tree=true` 参数返回组装好的树
7. **级联删除** — 删除知识点时递归删除所有子节点及其关联的题目/答题/薄弱点/掌握度记录
8. **AI 容错** — 所有 AI 调用均有 try/catch 兜底，失败时返回降级数据而非让请求崩溃
9. **端口** — 默认 3001（通过 `PORT` 环境变量设置，`.env` 文件中配置）
10. **无测试文件** — Playwright 在 devDependencies 中但未配置测试或编写测试用例
11. 每一次修改后推送到github
