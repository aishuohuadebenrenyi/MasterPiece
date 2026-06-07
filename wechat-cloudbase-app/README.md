# 即兴工具箱微信小程序

本目录是 `ImprovTool_2` 的微信小程序工程，采用微信小程序原生前端 + 腾讯云 CloudBase 后端。

## 1. 文档入口

正式产品文档统一维护在 [../docs/README.md](../docs/README.md)。

工程内文档：

- [database.md](database.md)：CloudBase 集合、action、初始化和权限说明。
- 本 README：工程打开方式、配置、脚本和开发约定。

若工程文档与历史过程文档冲突，以 `docs/` 和本目录工程文档为准。

## 2. 目录

```text
frontend/                  # 小程序前端根目录
backend/cloudfunctions/    # CloudBase 云函数根目录
tools/                     # 本地检查脚本
```

关键入口：

- `frontend/app.json`：页面、TabBar、Skyline、Glass-Easel 配置。
- `frontend/app.ts`：小程序入口和云开发初始化。
- `frontend/services/cloud.ts`：统一 CloudBase 调用封装。
- `frontend/store/index.ts`：轻量状态层。
- `backend/cloudfunctions/improv-api/index.js`：统一云函数 action 入口。

## 3. 打开方式

用微信开发者工具打开 `wechat-cloudbase-app/`。

工程配置：

- `miniprogramRoot`: `frontend/`
- `cloudfunctionRoot`: `backend/cloudfunctions/`
- `useCompilerPlugins`: `["typescript"]`
- `libVersion`: `3.16.1`

## 4. 本地配置

- 仓库中的 `project.config.json` 使用占位符 `appid`，请在本地替换为自己的微信小程序 AppID。
- 仓库中的 `frontend/config/env.js` 使用占位符 `envId`，请在本地替换为自己的 CloudBase 环境 ID。
- `project.private.config.json` 属于本地开发配置，不应提交到远程仓库。

## 5. 开发脚本

在 `wechat-cloudbase-app/` 下执行：

```bash
npm run syntax-check
npm run typecheck
```

脚本说明：

- `syntax-check`：运行 `node tools/syntax-check.js`。
- `typecheck`：运行 `tsc --noEmit --pretty false`。

## 6. 隔离约定

- 不修改同级旧项目代码。
- 不调用旧项目云函数。
- 不读写旧项目数据库集合。
- 本项目云函数统一使用 `improv-api`。
- 本项目数据库集合统一使用 `improv_` 前缀。
- 本项目云存储路径统一使用 `improv/` 前缀。

## 7. 前端源码约定

- 有 `.ts` 的页面、组件以 `.ts` 为唯一源码入口，不再保留同名空 `.js` 脚手架。
- 纯 JavaScript 页面和工具模块继续使用 `.js`。
- 页面不得直接散落调用 `wx.cloud.callFunction`，应统一经过 `frontend/services/cloud.ts` 或服务层模块。
- 页面负责展示和交互，业务请求放到 `frontend/services/`。
- 状态优先使用 `frontend/store/index.ts`，逐步减少旧 `services/local-state.js` 的双轨维护。

## 8. 数据与接口

- 统一云函数：`improv-api`
- 统一调用封装：`frontend/services/cloud.ts`
- 数据集合：全部使用 `improv_` 前缀
- 详细说明：见 [database.md](database.md)
