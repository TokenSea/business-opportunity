# 商机云台

商机云台是一个面向中小团队的轻量级业务管理系统，用于统一管理商机、供应商，以及它们下面的合同、付款记录和附件。项目采用 Next.js 全栈架构，前后端代码统一维护，使用 MySQL 持久化业务数据，并将上传文件保存到服务器磁盘。

## 核心功能

- **商机管理**：管理客户、需求与现状、商机来源、付款条件、状态、进展和备注；点击表格行可打开详情并直接编辑
- **供应商管理**：管理供应商名称、银行卡账号、官网账号、官网密码、官网地址和备注；官网密码加密保存，仅管理员可按需查看
- **合同与付款**：合同和付款作为商机或供应商下面的独立记录管理，不会在新建商机或供应商时自动生成
- **附件管理**：在商机、合同和付款记录中管理附件，支持上传、预览、下载和删除；单个文件最大 20 MB
- **账号与权限**：管理员统一创建、筛选、启停和安全删除账号，并可分配角色或重置密码；所有用户都可以修改自己的登录密码，普通用户仅可查看业务数据和附件
- **安全与审计**：登录密码使用 Argon2 哈希，供应商官网密码使用 AES-256-GCM 加密，并记录关键操作日志

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
│   │   ├── register/     # 已关闭的公开注册入口（跳转登录页）
│   │   └── page.tsx      # 系统主页
│   ├── components/       # 业务组件
│   ├── lib/              # 认证、数据库、文件及加密模块
│   └── types/            # TypeScript 类型定义
├── storage/              # 本地开发时的默认附件目录
├── .env.example          # 环境变量示例
└── next.config.ts        # Next.js 配置
```

## 环境要求

- Node.js 20 或更高版本
- npm 10 或兼容版本
- MySQL 8.x

## 本地开发

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
AUTH_COOKIE_SECURE="false"
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

> 不要将 `.env` 提交到版本控制，也不要在生产环境使用示例密码。

### 4. 初始化数据库和管理员

```powershell
npm run prisma:generate
npm run prisma:deploy
npm run db:seed
```

`npm run db:seed` 会根据 `SEED_ADMIN_USERNAME` 和 `SEED_ADMIN_PASSWORD` 创建或更新管理员。没有配置这两个变量时，代码默认使用 `admin` / `admin123`，该默认密码仅用于本地开发，禁止用于生产环境。

### 5. 启动开发服务器

```powershell
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000)，使用上一步创建的管理员账号登录。

系统不开放自助注册。管理员登录后可在左侧“账号管理”中创建普通用户或其他管理员账号。删除账号后，该账号会从登录体系和账号列表中移除，但其关联的业务及审计记录仍会保留。普通用户只拥有业务数据和附件的查看、预览及下载权限。

## 环境变量

| 变量 | 是否必需 | 说明 |
| --- | --- | --- |
| `DATABASE_URL` | 是 | Prisma 使用的 MySQL 连接地址 |
| `AUTH_SECRET` | 生产环境必需 | JWT 签名密钥，建议使用至少 32 字节的随机值；更换后现有登录会话会失效 |
| `AUTH_COOKIE_SECURE` | 可选 | HTTPS 部署设为 `true`；仅使用 HTTP 时设为 `false`。生产环境未配置时默认启用安全 Cookie |
| `SUPPLIER_PASSWORD_KEY` | 生产环境必需 | 64 位十六进制字符串，用于加密供应商官网密码 |
| `UPLOAD_DIR` | 建议显式配置 | 附件持久化目录，默认是项目下的 `storage/uploads` |
| `SEED_ADMIN_USERNAME` | 否 | 执行初始化脚本时创建或更新的管理员账号 |
| `SEED_ADMIN_PASSWORD` | 否 | 执行初始化脚本时写入的管理员密码 |

> `SUPPLIER_PASSWORD_KEY` 上线后必须妥善备份且不能随意更换，否则已保存的供应商官网密码将无法解密。

## 生产部署（Ubuntu 22.04/24.04）

推荐使用 **Node.js 20 + MySQL 8 + PM2 + Nginx + HTTPS**。以下命令默认由具备 `sudo` 权限的普通部署用户执行。

### 1. 准备服务器

建议服务器至少具有 2 核 CPU、2 GB 内存和 40 GB 磁盘。安装基础软件：

```bash
sudo apt update
sudo apt install -y nginx mysql-server git curl
```

另外安装 Node.js 20 LTS，完成后检查版本：

```bash
node -v
npm -v
```

### 2. 上传代码

通过 Git 部署时：

```bash
sudo mkdir -p /opt/business-opportunity
sudo chown -R ubuntu:ubuntu /opt/business-opportunity
git clone <仓库地址> /opt/business-opportunity
cd /opt/business-opportunity
```

请根据服务器实际登录用户替换示例中的 `ubuntu:ubuntu`。也可以通过 SFTP 上传项目，但不要上传 `node_modules`、`.next`、本地 `.env` 和本地附件目录。

### 3. 创建数据库和专用账号

```bash
sudo mysql
```

在 MySQL 中执行：

```sql
CREATE DATABASE business_opportunity
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER 'bo_app'@'127.0.0.1'
  IDENTIFIED BY '替换为高强度数据库密码';

GRANT ALL PRIVILEGES ON business_opportunity.*
  TO 'bo_app'@'127.0.0.1';

FLUSH PRIVILEGES;
EXIT;
```

不要让应用使用 MySQL 的 `root` 账号，也不要将 MySQL 的 3306 端口直接开放到公网。数据库密码如果包含 `@`、`#`、`/`、`:` 等字符，写入 `DATABASE_URL` 前需要进行 URL 编码。

### 4. 创建持久化附件目录

```bash
sudo mkdir -p /var/lib/business-opportunity/uploads
sudo chown -R ubuntu:ubuntu /var/lib/business-opportunity
sudo chmod 750 /var/lib/business-opportunity/uploads
```

同样需要将 `ubuntu:ubuntu` 替换为运行应用的实际系统用户。生产环境应使用项目目录之外的持久化路径，避免更新或重新发布代码时误删附件。

### 5. 配置生产环境变量

```bash
cd /opt/business-opportunity
nano .env
```

示例：

```dotenv
DATABASE_URL="mysql://bo_app:数据库密码@127.0.0.1:3306/business_opportunity"
AUTH_SECRET="随机认证密钥"
SUPPLIER_PASSWORD_KEY="64位十六进制密钥"
UPLOAD_DIR="/var/lib/business-opportunity/uploads"
SEED_ADMIN_USERNAME="admin"
SEED_ADMIN_PASSWORD="首次部署使用的高强度管理员密码"
```

在 Linux 中生成密钥：

```bash
# AUTH_SECRET
openssl rand -base64 48

# SUPPLIER_PASSWORD_KEY
openssl rand -hex 32
```

限制配置文件权限：

```bash
chmod 600 .env
```

### 6. 安装依赖、迁移数据库并构建

```bash
npm ci
npm run prisma:generate
npm run prisma:deploy
npm run db:seed
npm run build
```

`npm run db:seed` 只需要在首次部署或明确需要重置该管理员密码时执行。脚本使用 upsert，会把同名管理员的密码更新为 `.env` 中的 `SEED_ADMIN_PASSWORD`。

生产环境只能使用 `npm run prisma:deploy` 应用仓库中已有的迁移，不要使用面向开发环境的 `npm run prisma:migrate`。

### 7. 使用 PM2 启动服务

```bash
sudo npm install -g pm2
pm2 start npm --name business-opportunity -- start -- -H 127.0.0.1 -p 3000
pm2 save
pm2 startup
```

`pm2 startup` 会输出一条带 `sudo` 的命令，继续执行它即可配置服务器重启后自动启动应用。

检查服务：

```bash
pm2 status
pm2 logs business-opportunity
curl http://127.0.0.1:3000
```

### 8. 配置 Nginx 反向代理

新建 `/etc/nginx/sites-available/business-opportunity`：

```nginx
server {
    listen 80;
    server_name example.com;

    client_max_body_size 25M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300;
    }
}
```

将 `example.com` 替换为已经解析到服务器公网 IP 的域名，然后启用配置：

```bash
sudo ln -s /etc/nginx/sites-available/business-opportunity /etc/nginx/sites-enabled/business-opportunity
sudo nginx -t
sudo systemctl reload nginx
```

如果启用了防火墙，只需要放行 SSH、HTTP 和 HTTPS，不要对公网放行应用的 3000 端口或 MySQL 的 3306 端口。

### 9. 配置 HTTPS

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d example.com
```

生产环境必须通过 HTTPS 访问。应用在生产模式下会为登录 Cookie 设置 `Secure` 属性，直接使用 HTTP 可能导致登录状态无法正常保存。

### 10. 验证部署

部署完成后至少验证以下内容：

1. 使用 `.env` 中配置的管理员账号登录。
2. 新建一条商机和供应商记录。
3. 新建合同、付款记录并上传附件。
4. 重启应用后确认数据和附件仍然存在。
5. 使用管理员账号确认供应商官网密码可以按需查看，普通用户不能查看。
6. 在“账号管理”中新建普通用户，确认其无法新增、修改、删除业务数据或上传附件。

## 生产环境更新

发布新版本时执行：

```bash
cd /opt/business-opportunity
git pull
npm ci
npm run prisma:generate
npm run prisma:deploy
npm run build
pm2 restart business-opportunity --update-env
```

更新前建议先备份数据库和附件。除非需要重置初始化管理员密码，否则不要在日常更新中执行 `npm run db:seed`。

## 数据备份

需要同时备份以下内容：

1. MySQL 数据库 `business_opportunity`
2. `UPLOAD_DIR` 指向的完整附件目录
3. 生产环境 `.env` 中的密钥，尤其是 `SUPPLIER_PASSWORD_KEY`

数据库和附件必须作为同一套业务数据进行备份。建议每天自动备份并定期进行恢复演练，仅有备份文件但没有验证恢复流程并不可靠。

多实例部署时，本地磁盘目录无法天然共享，需要将附件迁移到对象存储或共享文件系统；当前版本更适合单实例部署。

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

## 安全建议

- 使用随机且足够长的 `AUTH_SECRET`、`SUPPLIER_PASSWORD_KEY` 和数据库密码
- 只通过 HTTPS 对外提供服务
- 限制 `.env`、附件目录和数据库的系统权限
- 不向公网开放 3000 和 3306 端口
- 定期备份数据库、附件和生产密钥
- 定期检查依赖更新并审阅系统操作日志

## License

当前项目尚未声明开源许可证。如需公开分发或商业授权，请先补充相应的 License 文件。
