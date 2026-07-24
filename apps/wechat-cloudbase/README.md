# 即兴工具箱微信小程序

原生微信小程序前端与共享 CloudBase 部署单元。前端使用 Skyline、Glass-Easel 和 TypeScript；后端保持单个聚合云函数 `improv-api`。

## 本地配置

公开仓库只提交配置示例。首次使用：

```bash
cd apps/wechat-cloudbase
cp project.config.example.json project.config.json
```

在本地 `project.config.json` 中填写自己的微信 AppID。该文件与开发者工具生成的 `project.private.config.json` 均被 Git 忽略。

`frontend/config/env.js` 中的 envId 必须保持为空占位。部署者可在自己的未提交工作区中设置开发/生产 CloudBase 环境，但提交前必须恢复空值。AppSecret、SecretId、SecretKey 和生产地址不得写入前端或仓库。

## 打开与目录

使用微信开发者工具打开本目录：

```text
frontend/                  小程序前端根目录
backend/cloudfunctions/    CloudBase 云函数根目录
docs/database.md           集合、字段与 action 工程事实
tools/                     本地契约与语法检查
```

关键配置：

- `miniprogramRoot`: `frontend/`
- `cloudfunctionRoot`: `backend/cloudfunctions/`
- `useCompilerPlugins`: `["typescript"]`

## 验证

```bash
npm ci
npm run syntax-check
npm run typecheck
npm run contract-check
cd backend/cloudfunctions/improv-api
npm test
```

页面不得直接散落调用 `wx.cloud.callFunction`，统一经过 `frontend/services/cloud.ts` 或对应业务服务。集合使用 `improv_` 前缀，云存储路径使用 `improv/` 前缀。

正式产品和跨端架构文档见 [`../../docs/README.md`](../../docs/README.md)。
