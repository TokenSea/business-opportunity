# 商机云台

一个面向中小团队的轻量级商机管理系统，用于集中管理商机、客户合同、付款记录、供应商及相关附件。项目采用 Next.js 全栈架构，前后端代码统一维护，可直接连接 MySQL 运行，无需依赖 Docker。

## 核心功能

- **商机管理**：记录客户、需求与现状、商机来源、付款条件、状态、进展、备注和附件
- **合同与付款**：分别管理客户和供应商侧的合同、付款记录及关联文件
- **供应商管理**：维护供应商名称、登录账号、加密密码和备注
- **自动关联**：创建商机或供应商时，自动生成对应的合同和付款记录
- **附件管理**：支持上传、预览、下载及替换业务附件，单个文件最大 20 MB
- **账号与权限**：支持管理员和普通用户，使用 JWT 与 HttpOnly Cookie 维护登录会话
- **安全与审计**：登录密码采用 Argon2 哈希，供应商密码采用 AES-256-GCM 加密，并记录关键操作日志

## 技术栈

| 分类 | 技术 |
| --- | --- |
| Web 框架 | Next.js 15（App Router） |
| 开发语言 | TypeScript 5 |
| UI | React 19、Ant Design 5、Lucide React |
| 数据请求 | TanStack React Query 5 |
| API | Next.js Route Handlers |
| 数据校验 | Zod 4 |
| ORM | Prisma 6 |
| 数据库 | MySQL 8 |
| 身份认证 | JOSE（JWT）+ HttpOnly Cookie |
| 密码安全 | Argon2、AES-256-GCM |

## 项目结构

```text
.
├── prisma/
│   ├── migrations/       # 数据库迁移
│   ├── schema.prisma     # Prisma 数据模型
│   └── seed.ts           # 初始管理员账号
├── src/
│   ├── app/
│   │   ├── api/          # 服务端 API
│   │   ├── login/        # 登录页面
│   │   ├── register/     # 注册页面
│   │   └── page.tsx      # 系统主页
│   ├── components/       # 业务组件
│   ├── lib/              # 认证、数据库、文件及加密模块
│   └── types/            # TypeScript 类型定义
├── storage/              # 本地文件存储目录
├── .env.example          # 环境变量示例
└── next.config.ts        # Next.js 配置
```

## 环境要求

- Node.js 20 或更高版本
- npm 10 或兼容版本
- MySQL 8.x

## 快速开始

### 1. 安装依赖

```powershell
npm install
```

### 2. 创建数据库

登录 MySQL 后执行：

```sql
CREATE DATABASE business_opportunity
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
```

### 3. 配置环境变量

复制示例配置：

```powershell
Copy-Item .env.example .env
```

编辑 `.env`：

```dotenv
DATABASE_URL="mysql://root:password@127.0.0.1:3306/business_opportunity"
AUTH_SECRET="replace-with-at-least-32-random-characters"
SUPPLIER_PASSWORD_KEY="replace-with-64-hex-characters"
UPLOAD_DIR="./storage/uploads"
SEED_ADMIN_USERNAME="admin"
SEED_ADMIN_PASSWORD="replace-with-a-strong-password"
```

在 PowerShell 中生成所需密钥：

```powershell
# 生成 64 位十六进制密钥，用于 SUPPLIER_PASSWORD_KEY
[Convert]::ToHexString([byte[]](1..32 | ForEach-Object { Get-Random -Maximum 256 }))

# 生成随机认证密钥，用于 AUTH_SECRET
[Convert]::ToBase64String([byte[]](1..48 | ForEach-Object { Get-Random -Maximum 256 }))
```

> 请勿将 `.env` 提交到版本控制，也不要在生产环境中使用示例密码。

### 4. 初始化数据库

```powershell
npm run prisma:generate
npm run prisma:deploy
npm run db:seed
```

`db:seed` 会根据 `SEED_ADMIN_USERNAME` 和 `SEED_ADMIN_PASSWORD` 创建或更新管理员账号。

### 5. 启动开发服务器

```powershell
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000)，使用上一步配置的管理员账号登录。

## 常用命令

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 创建生产构建 |
| `npm run start` | 启动生产服务器 |
| `npm run typecheck` | 执行 TypeScript 类型检查 |
| `npm run prisma:generate` | 生成 Prisma Client |
| `npm run prisma:migrate -- --name <名称>` | 在开发环境创建并应用数据库迁移 |
| `npm run prisma:deploy` | 在生产环境应用已有迁移 |
| `npm run prisma:studio` | 打开 Prisma Studio |
| `npm run db:seed` | 创建或更新初始管理员 |

## 生产部署

1. 配置生产环境变量，并确保 MySQL 和上传目录可访问。
2. 应用数据库迁移并生成 Prisma Client。
3. 构建并启动服务。

```powershell
npm ci
npm run prisma:generate
npm run prisma:deploy
npm run build
npm run start
```

默认服务地址为 `http://localhost:3000`。如需修改端口，可在启动时设置 `PORT` 环境变量。

## 数据与文件

- 数据库连接由 `DATABASE_URL` 配置。
- 上传目录由 `UPLOAD_DIR` 配置，默认为 `./storage/uploads`。
- 生产环境应定期备份 MySQL 数据库和上传目录。
- 多实例部署时，本地目录无法天然共享，建议将文件存储迁移到对象存储或共享文件系统。

## 安全建议

- 使用足够长且随机的 `AUTH_SECRET` 和 `SUPPLIER_PASSWORD_KEY`。
- 首次部署时立即更换默认管理员密码。
- 仅通过 HTTPS 对外提供服务，以保护登录 Cookie 和业务数据。
- 严格限制 `.env`、数据库和上传目录的访问权限。
- 定期检查依赖更新，并审阅系统操作日志。

## License

当前项目尚未声明开源许可证。如需公开分发或商业授权，请先补充相应的 License 文件。
