# ImprovTool_2 协作入口

开始开发、规划、审查或文档整理前，先确认本文件、根 [`README.md`](README.md) 和对应产品入口。

## 1. 必读顺序

1. `README.md`：仓库分区、状态标签、运行入口和提交边界。
2. `docs/README.md`：正式产品、架构、数据和发布文档索引。
3. 当前应用 README：
   - 微信与 CloudBase：`apps/wechat-cloudbase/README.md`
   - iOS/iPadOS：`apps/ios-personal/README.md`
4. 数据或 action 任务：`apps/wechat-cloudbase/docs/database.md`
5. 发布任务：`docs/operations/` 与 `releases/ios-personal/`

本机若存在 `project_memory/`，可用于补充长期记忆和任务状态；它是 `LOCAL-ONLY`，不得成为新克隆、构建或正式事实源的依赖。

## 2. 事实源边界

- `docs/`：正式产品、体验、架构、数据、路线与发布规则。
- `apps/wechat-cloudbase/`：微信客户端和共享 CloudBase 后端运行事实。
- `apps/wechat-cloudbase/docs/database.md`：集合、字段和 action 工程事实源。
- `apps/ios-personal/`：iOS/iPadOS 客户端运行事实。
- `prototypes/`：静态交互参考，不连接生产后端。
- `incubator/`：未来计划，不代表当前范围或承诺。
- `releases/`：发布文本和人工门禁，不存放密钥或签名二进制。
- `archive/`：归档清单；归档内容不影响当前实现。
- `.trae/`：本地历史过程归档，不移动、不删除、不改写。

## 3. 开发前核对

微信/CloudBase 任务至少核对：

- `apps/wechat-cloudbase/frontend/app.json`
- `apps/wechat-cloudbase/frontend/services/`
- `apps/wechat-cloudbase/frontend/store/index.ts`
- `apps/wechat-cloudbase/frontend/types/domain.ts`
- `apps/wechat-cloudbase/backend/cloudfunctions/improv-api/index.js`
- `apps/wechat-cloudbase/docs/database.md`

iOS 任务至少核对：

- `apps/ios-personal/README.md`
- `apps/ios-personal/Sources/ImprovToolCore/`
- `apps/ios-personal/Sources/ImprovToolApp/`
- `docs/architecture/ios.md`

共享 action、字段、认证或媒体契约变化必须同时核对两个客户端。

## 4. 架构默认值

- 微信：原生小程序、Skyline、Glass-Easel。
- iOS/iPadOS：SwiftUI Universal App，最低 iOS/iPadOS 17。
- 后端：CloudBase 聚合云函数 `improv-api`。
- 集合与存储：`improv_`、`improv/` 前缀。
- 业务事实来自云端；本地持久化只承载纯 UI 偏好。
- 不为局部需求迁移到 Taro、React、Vue、大型 UI 框架或第二套后端。

## 5. 变更要求

- 只修改任务直接需要的文件，不清理无关代码。
- 产品范围变化更新 `docs/product/`。
- 平台实现变化更新 `docs/architecture/`。
- 数据变化先更新 `apps/wechat-cloudbase/docs/database.md`，再同步 `docs/architecture/data-contract.md`。
- 发布流程变化更新 `docs/operations/` 或 `releases/`。
- 较大事实变化记录到 `docs/changelog.md`。
- `GENERATED`、`LOCAL-ONLY`、密钥、证书、真实 AppID/envId 和个人开发工具状态不得提交。

## 6. 验证

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

涉及 Xcode 工程、SwiftUI 页面或发布门禁时，再执行相应 Simulator、Release 或 UI 测试。提交前运行 `git status --short`，只暂存本次任务相关文件。
