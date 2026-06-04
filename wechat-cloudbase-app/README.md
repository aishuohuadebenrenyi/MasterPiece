# 即兴工具箱微信小程序

本目录是 `ImprovTool_2` 的全新微信小程序工程，采用微信小程序原生前端 + 腾讯云 CloudBase 后端。

## 目录

```text
frontend/                  # 小程序前端根目录
backend/cloudfunctions/    # CloudBase 云函数根目录
```

## 隔离约定

- 不修改同级 `ImprovTool` 项目代码。
- 不调用 `ImprovTool` 现有云函数。
- 不读写 `ImprovTool` 现有数据库集合。
- 本项目云函数统一使用 `improv-api`。
- 本项目数据库集合统一使用 `improv_` 前缀。
- 本项目云存储路径统一使用 `improv/` 前缀。

## 打开方式

用微信开发者工具打开 `wechat-cloudbase-app/`。

## 本地配置说明

- 仓库中的 `project.config.json` 已改为占位符 `appid`，请在本地替换为你自己的微信小程序 `AppID`。
- 仓库中的 `frontend/config/env.js` 已改为占位符 `envId`，请在本地替换为你自己的 CloudBase 环境 ID。
- `project.private.config.json` 属于本地开发配置，不应提交到远程仓库。

## 前端源码入口

- `project.config.json` 已启用 `useCompilerPlugins: ["typescript"]`。
- 有 `.ts` 的页面、组件以 `.ts` 为唯一源码入口，不再保留同名空 `.js` 脚手架，避免开发者工具调试和人工排查时读到过期实现。
- 纯 JavaScript 页面和工具模块仍继续使用 `.js`。
