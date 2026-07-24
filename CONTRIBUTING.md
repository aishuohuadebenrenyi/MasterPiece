# 贡献指南

## 开始之前

1. 阅读根 [`README.md`](README.md)、[`AGENTS.md`](AGENTS.md) 和对应应用 README。
2. 从示例文件创建本地配置，不要修改占位配置后提交真实环境值。
3. 一个提交只处理一个清晰目的，不混入缓存、截图产物或个人配置。

## 验证

微信与 CloudBase：

```bash
cd apps/wechat-cloudbase
npm run syntax-check
npm run typecheck
npm run contract-check
cd backend/cloudfunctions/improv-api
npm test
```

iOS：

```bash
cd apps/ios-personal
swift test
swift run ImprovToolCoreValidation
```

提交前回到仓库根目录运行：

```bash
node tools/check-repository-safety.js
node tools/check-markdown-links.js
git diff --check
```

产品、架构、数据或公开契约发生变化时，同步更新对应文档和 `docs/changelog.md`。
