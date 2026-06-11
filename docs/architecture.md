# 技术架构文档

更新时间：2026-06-11

## 1. 文档目的

本文档沉淀当前 `ImprovTool_2 / wechat-cloudbase-app` 的实际技术架构，作为后续产品设计、交互整改、技术选型与实现约束的统一依据。

本文档基于当前仓库中的真实配置与代码结构整理。

## 2. 产品形态

- 产品名称：即兴工具箱微信小程序
- 运行形态：微信小程序原生应用
- 前端形态：多页面小程序，自定义 TabBar
- 后端形态：腾讯云 CloudBase 聚合云函数
- 当前工程：`wechat-cloudbase-app/`

## 3. 总体技术栈

### 3.1 前端

- 前端框架：微信小程序原生页面/组件体系
- 渲染引擎：Skyline
- 组件框架：Glass-Easel
- 语言：TypeScript + JavaScript 混合
- 模板：WXML
- 样式：WXSS
- UI 体系：自定义页面样式 + 自定义组件，不依赖外部大 UI 框架

### 3.2 后端与数据

- 云能力：腾讯云 CloudBase
- 云函数入口：`improv-api`
- 前后端通信方式：`wx.cloud.callFunction`
- 本地持久化：业务数据当前开发阶段暂不启用；仅允许纯 UI 偏好通过本地 Storage 持久化

### 3.3 工程工具

- 工程类型：微信小程序工程
- 开发工具：微信开发者工具
- 类型检查：TypeScript
- 小程序类型声明：`miniprogram-api-typings`
- 本地脚本：`npm run syntax-check`、`npm run typecheck`

## 4. 关键配置

`wechat-cloudbase-app/frontend/app.json`：

- `style: "v2"`
- `renderer: "skyline"`
- `componentFramework: "glass-easel"`
- `lazyCodeLoading: "requiredComponents"`
- 自定义 `tabBar`

`wechat-cloudbase-app/project.config.json`：

- `miniprogramRoot: "frontend/"`
- `cloudfunctionRoot: "backend/cloudfunctions/"`
- `useCompilerPlugins: ["typescript"]`
- `libVersion: "3.16.1"`

## 5. 前端分层

当前前端采用“小程序原生页面 + 自定义组件 + 服务层 + 轻量状态层”的分层结构。

| 层级 | 位置 | 职责 |
| --- | --- | --- |
| 应用入口层 | `frontend/app.ts`、`frontend/app.json` | 全局配置、云环境初始化、页面注册、渲染配置。 |
| 页面层 | `frontend/pages/*` | 页面状态、数据拼装、交互流程、页面跳转。 |
| 组件层 | `frontend/components/*`、`frontend/custom-tab-bar/*` | 卡片、弹层、浮层、底部导航等复用 UI。 |
| 服务层 | `frontend/services/*` | CloudBase 调用、业务接口封装、错误归一化、空态与错误态处理。 |
| 状态层 | `frontend/store/index.ts` | 轻量状态层、订阅通知；业务数据以内存态为主，纯 UI 偏好允许本地持久化。 |
| 类型层 | `frontend/types/domain.ts` | 领域模型和云函数返回类型。 |

## 6. UI 组件策略

当前项目没有引入 TDesign、NutUI 等大型小程序 UI 框架作为主 UI 体系，而是采用高度定制的页面和组件：

- `components/bottom-sheet`：底部半弹窗，统一承载遮罩、`root-portal`、尺寸规格、内容滚动和可选底部操作区。
- `components/form-card`：表单与概览卡片容器，统一负责卡片白底、标题、副标题、右上角动作及圆角。
- `components/form-field`：表单字段包裹容器，统一管理 Label、描述与输入框间距。配合全局去边框奶系输入框 `.app-input`/`.app-textarea` 实现和谐呼吸感的表单设计。
- `components/game-card`：游戏卡片展示和事件透传。
- `components/floating-card`：悬浮详情卡片。
- `components/search-bar`：发现、记录、排练记录等页共享的搜索壳层。
- `components/empty-state-panel`：标准空态说明 + 动作按钮面板。
- `components/filter-section`：筛选 chips、目标选择、来源选择等分组块的统一壳层。
- `components/selection-card`：选择列表、今日记录列表、弹层候选卡片的统一卡片结构。
- `components/record-card`、`components/record-detail-panel`、`components/asset-detail-panel`：历史记录和我的页资产列表/详情收口组件。
- `components/voice-field`、`components/game-form`：统一游戏录入与编辑表单，复用语音按钮布局和字段分组；`voice-field` 只负责字段级“输入框 + 语音按钮”结构，不吞并记录页、灵感页等页面级语音速记流程。
- `components/subpage-header`：子页面返回头部壳层，统一返回按钮、kicker 和标题层级。
- `custom-tab-bar`：自定义主导航。

全局 `frontend/app.wxss` 只承载页面骨架、卡片、按钮、筛选 chips、表单输入和 fixed action bar 等跨页面语义基线；具体页面的局部组合结构不应继续堆进全局样式。像语音速记弹层中的内联保存操作组这类非 fixed 场景，应由页面局部样式控制，不与 `form-actions` / `fixed-actions` 共用同一套固定底栏语义。

后续优先强化现有组件和交互基础设施，不建议为了局部问题整体迁移到 Taro、React、Vue 或大型 UI 框架。

前端配色以 `frontend/styles/theme.wxss` 的 `--improv-*` 变量作为主题 token 契约，页面和组件不再直接维护散落色值。当前默认主题延续橙色主品牌、蓝色辅助色、浅色卡片和柔和阴影体系；`theme.wxss` 内提供了 `.theme-vivid` 高对比度沉浸主题覆盖块，用户可在“我的页”一键切换。主题模式属于纯 UI 偏好：当前通过 `store/index.ts` 统一管理，并使用本地 Storage 持久化到当前设备；不新增 CloudBase 字段，不参与业务事实同步。所有页面根节点、TabBar 以及弹层组件均需绑定 `themeClass`，依赖 CSS 变量继承机制实现全局主题一致。自定义组件存在样式隔离边界，凡是在组件 WXSS 中使用主题变量的组件，必须显式 `@import` 主题文件；凡是组件内部需要复用全局按钮、输入框或页面传入 `customClass` 的场景，必须显式打开全局类共享。受 Skyline / Glass-Easel 兼容性影响，底部导航、发现页空态卡片、游戏卡片、弹层和浮层等关键视觉属性必须保留直接色值兜底，再使用 `var(--improv-*, fallback)` 覆盖；运行关键样式不应只引用复合渐变 token。

半弹窗组件当前通过 `sheetClass` 区分 `compact-sheet`、`task-sheet`、`full-sheet` 等用途规格。轻量选择使用较低高度，任务型弹层保持标题区稳定；底部操作区通过 `showActions` 可选启用，添加游戏这类原型化快速表单不启用独立底栏，主按钮放在内容流末尾。超过单一任务或长表单的场景进入子页面。

全局轻提示由 `frontend/utils/page.js` 的 `toast(title)` 统一触发，并在 `app.wxss` 中定义样式。默认提示为柔和白色半透明胶囊，`待同步` 文案进入暖色样式。页面通过 `root-portal` 渲染提示；`wx.showToast` 只作为拿不到当前页面实例时的兜底。

### 6.1 页面栈约定
- 保持扁平，尽量使用 Tab 切换或 BottomSheet。
- TabBar 包含：发现（发现游戏）、记录（排练与打卡）、我的（沉淀与归档）。
- 半弹窗用于：语音速记、添加游戏、排练快捷操作。

### 6.2 生命周期与任务互斥机制 (Task Mutex)
为了保持用户认知清晰和底层状态机简单，全局在同一时间只能存在一个“活跃”的任务；这里的活跃既包括进行中，也包括暂停中、等待恢复的任务。
- **活跃上下文 (Active Context)** = `currentRehearsal` (排练) **OR** `currentGame` (单游戏)。
- **互斥拦截**：
  - 如果存在进行中或暂停中的排练，不允许开启新的单游戏。
  - 如果存在进行中或暂停中的单游戏，不允许开启排练。
  - 互斥规则必须由 `store/index.ts` 统一校验，不能只依赖页面局部拦截。
- **生命周期流转**：
  - 游戏生命周期：开始(生成 GameSession) -> 暂停/继续 -> 结束并复盘(清空 session，跳反馈页)。
  - 结束复盘时，通过下拉框支持**事后关联**到历史排练。

## 7. 状态管理

当前使用自定义轻量 store：

- 内存态 `state`
- `subscribe()` 订阅更新
- `setState()` 局部更新
- 当前开发阶段业务数据只保留内存态，不启用本地业务缓存
- 纯 UI 偏好允许通过 `wx.setStorageSync()` 持久化，例如 `themeMode` 和忽略中的待整理标记

状态内容包括：

- 视图模式
- 游戏列表
- 收藏与玩过状态
- 今日灵感与今日排练
- 方法卡
- 当前排练
- 暂停中的排练
- 语音草稿

旧 `services/local-state.js` 已删除。当前阶段状态来源收敛为云端成功结果和 `store/index.ts` 当前会话内存态，不启用本地持久化缓存。

### 7.1 当前阶段状态策略

- 当前功能开发和页面交互开发阶段，`store` 对业务数据只承担当前会话内存态，不作为本地持久化缓存层。
- 例外只限纯 UI 偏好、且不参与业务事实判断的本地状态。例如“我的 -> 待整理”中的 `已不再整理` 忽略标记，以及全局 `themeMode` 主题模式，可用本地 Storage 记住用户选择；它们不会回写云端，也不参与正式业务数据同步。
- 页面展示数据优先级为：
  - 云端成功结果
  - 当前会话内存态中的 pending 数据
  - 空态 / 错误态
- 文档中的“本地兜底”统一指当前会话内存态，不等同于持久化历史缓存。
- 明确区分两种情况：
  - 云端请求成功但返回空数组：页面应进入空态，不回退历史本地数据
  - 云端请求失败：页面可展示错误态，并在必要时保留当前会话内 pending 数据
- 旧版本开发缓存不再作为事实源。如果页面仍显示历史数据，应先清理微信开发者工具 Storage / 清缓存 / 编译缓存。

## 8. 后端架构

当前后端采用 CloudBase 云函数模式，不是独立 HTTP 服务。

- 统一云函数：`improv-api`
- 前端统一封装：`frontend/services/cloud.ts`
- 请求结构：`action`、`requestId`、`payload`
- 返回结构：`code`、`message`、`data`、`requestId`
- 私有数据由云函数通过 `cloud.getWXContext()` 获取 `OPENID` 并写入 `ownerOpenId`

详细集合和 action 见 [data-api.md](data-api.md) 与 [wechat-cloudbase-app/database.md](../wechat-cloudbase-app/database.md)。

## 9. 数据隔离约定

项目与同级旧项目隔离：

- 不修改同级旧项目代码。
- 不调用旧项目云函数。
- 不读写旧项目数据库集合。
- 本项目云函数统一使用 `improv-api`。
- 本项目数据库集合统一使用 `improv_` 前缀。
- 本项目云存储路径统一使用 `improv/` 前缀。

## 10. Skyline 兼容风险

虽然项目已配置 Skyline，但部分页面可能因样式或能力不兼容而回退到 WebView。

高风险点包括：

- 某些渐变能力。
- 某些 CSS Grid 写法。
- 某些 scroll-snap 相关能力。
- 偏 Web 的样式语法。
- fixed 操作栏、scroll-view、安全区和弹层组合。

后续应优先清理导致回退的页面样式与交互写法。

## 11. 后续架构建议

建议继续保持：

- 微信原生小程序。
- Skyline。
- CloudBase。
- 轻量 store。
- 自定义组件化 UI。

优先优化：

- 统一弹层模态容器方案。
- 统一底部 fixed 操作栏和内容 spacer 策略。
- 继续将页面临时态沉淀到 `store/index.ts` 或页面局部状态，避免重新引入并行本地状态源。
- 补齐 loading、empty、error 三态。
- 为保存失败增加本地 pending 状态。
