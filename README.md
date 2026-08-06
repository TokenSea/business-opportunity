# 商机管理系统

基于 Next.js、TypeScript、Ant Design、Prisma 和 MySQL 的商机管理系统。当前包含账号登录、商机、合同、付款、供应商和文件上传功能，不依赖 Docker。

## 已实现功能

- 管理员、普通用户账号密码登录，使用 HttpOnly Cookie 保存会话
- 商机字段：客户、需求与现状、商机来源、付款条件、状态、进展、备注、附件
- 供应商字段：名称、账号、密码、备注
- 新建商机时，自动生成对应的客户合同和付款记录
- 新建供应商时，自动生成对应的供应商合同和付款记录
- 合同、付款均保持名称、类型、记录三列，可直接上传或更换文件
- 供应商密码使用 AES-256-GCM 加密保存，登录密码使用 Argon2 哈希保存
- 操作审计日志和上传文件鉴权下载

## 环境要求

- Node.js 20 或更高版本
- MySQL 8.x

## 首次启动

1. 在 MySQL 中创建数据库：

```sql
CREATE DATABASE business_opportunity
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
```

2. 复制环境变量文件：

```powershell
Copy-Item .env.example .env
```

3. 修改 `.env` 中的 MySQL 用户名和密码，并生成密钥。可在 PowerShell 中生成：

```powershell
[Convert]::ToHexString([byte[]](1..32 | ForEach-Object { Get-Random -Maximum 256 }))
[Convert]::ToBase64String([byte[]](1..48 | ForEach-Object { Get-Random -Maximum 256 }))
```

第一行结果填入 `SUPPLIER_PASSWORD_KEY`，第二行结果填入 `AUTH_SECRET`。同时请修改默认管理员密码 `SEED_ADMIN_PASSWORD`。

4. 初始化数据库并创建管理员：

```powershell
npm.cmd run prisma:generate
npm.cmd run prisma:migrate -- --name init
npm.cmd run db:seed
```

5. 启动开发环境：

```powershell
npm.cmd run dev
```

打开 [http://localhost:3000](http://localhost:3000)，使用 `.env` 中的 `SEED_ADMIN_USERNAME` 和 `SEED_ADMIN_PASSWORD` 登录。

## 常用命令

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd run prisma:studio
```

默认上传目录由 `.env` 的 `UPLOAD_DIR` 指定，单个文件最大 20 MB。
