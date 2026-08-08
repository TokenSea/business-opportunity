# 北京 Kubernetes / Tekton 部署

本目录只包含北京环境配置。`develop` 分支 Push 会触发
`business-opportunity-pipeline`，构建镜像并更新 `tokensea` 命名空间中的
`business-opportunity` Deployment。

## 资源边界

- 应用和 MySQL：`tokensea` 命名空间
- Tekton、Trigger、EventListener：`default` 命名空间
- 镜像仓库：`tokensea.tencentcloudcr.com/tokensea/business-opportunity`
- 不包含 Tag Trigger、香港镜像仓库或 `kubeconfig-hk-secret`

## 首次部署前置资源

以下 Secret 不提交到 Git：

- `tokensea/business-opportunity-mysql`
- `tokensea/business-opportunity-app`
- `tokensea/business-opportunity-registry`
- `default/github-ssh-secret-business-opportunity`
- `default/business-opportunity-webhook-secret`

集群还需要已有的公共 Tekton 资源：

- Task：`git-clone`、`kubectl-verify`
- Secret：`image-secret`、`kubeconfig-secret`
- ServiceAccount：`github-bot`、`tekton-triggers-github-sa`
- PVC：`tekton-shared-workspace`

## 自动更新流程

1. GitHub Webhook 接收 `develop` Push。
2. Tekton 使用只读 Deploy Key 克隆仓库。
3. Kaniko 构建并推送以 Git Commit SHA 标记的镜像。
4. Pipeline 同时更新迁移 initContainer 和应用容器镜像。
5. Deployment 扩容到 1，initContainer 执行 `prisma migrate deploy`。
6. Tekton 等待 Deployment rollout 完成。
