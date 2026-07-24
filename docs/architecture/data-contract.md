# 数据架构与接口说明

更新时间：2026-06-21

本文档从“数据流转”与“接口架构”视角整理当前项目的正式文档入口、技术架构、数据对象、集合与云函数 action 规则。工程实现事实仍以 `apps/wechat-cloudbase/docs/database.md` 为准。

## 1. 架构模式与数据流转

当前链路为：
`页面层` -> `frontend/services/*` -> `frontend/services/cloud.ts` -> `improv-api` -> `CloudBase 集合`

- **云能力**：腾讯云 CloudBase
- **统一云函数**：`improv-api`
- **页面层**：负责交互、表单状态和跳转。
- **服务层**：负责 action 调用和响应归一化。
- **状态层 (`store/index.ts`)**：负责轻量状态和订阅；当前开发阶段不启用本地持久化，仅保留当前会话内存态。
- **前端调用**：`wx.cloud.callFunction`，请求字段：`action`、`requestId`、`payload`；返回字段：`code`、`message`、`data`、`requestId`。

### 1.1 前端消费策略

- 接口成功返回空数组时，页面应进入空态，不回退旧本地数据。
- 读取失败时页面进入错误态，不降级为空数据；写入失败时保留表单草稿，不生成未入库的历史记录。

## 2. 集合总览

所有业务集合统一使用 `improv_` 前缀：

| 集合 | 用途 |
| --- | --- |
| `improv_materials` | 即兴素材库，包含游戏、角色、才艺、格式、主理、技巧、复盘、路径。 |
| `improv_user_material_states` | 用户对素材的收藏、练过、最近使用状态。 |
| `improv_profiles` | 当前用户个人资料。 |
| `improv_inspirations` | 灵感记录。 |
| `improv_rehearsals` | 排练记录。 |
| `improv_practice_records` | 单次素材练习复盘。 |
| `improv_method_cards` | 个人沉淀方法卡。 |
| `improv_feedback` | 用户主动提交的产品反馈。 |

## 3. 核心数据对象

### 3.1 Material
`Material` 是 App 内“素材”的上位对象。
字段包括：`id`, `title`, `desc`, `type` (游戏/角色/才艺/格式/主理/技巧/复盘/路径), `tags`, `abilities`, `scenes`, `meta`, `steps`, `tips`, `variant`, `issue`, `relatedMaterialId`, `referenceOnly`, `stripeTone`, `sortOrder`, `saved`, `played`, `playedCount`, `lastPlayedAt`, `lastRehearsalAt`。

### 3.2 Inspiration
灵感记录字段：`id`, `title`, `desc`, `type`, `meta`, `linkedMaterialId`, `linkedMaterialTitle`, `linkedRehearsalId`, `linkedRehearsalTitle`, `attachments`, `createdAt`, `updatedAt`。`attachments` 用于快速记录的未归档照片、视频和录音，结构与 `PracticeRecord.attachments` 一致；未归档文字或附件统一通过 `meta` 标记为 `未归档` / `待整理`。附件上传后若灵感入库失败，前端保留文本草稿并删除本次上传的附件，不写入历史 Store。

### 3.3 Rehearsal
排练记录字段：`id`, `title`, `desc`, `teamName`, `duration`, `goals` (数组), `source`, `status`, `plan` (包含 materialId, status, keep, try), `reviewKeep`, `reviewTry`, `reviewReminder`, `createdAt`, `updatedAt`。
说明：当前个人版中的排练是个人多素材 session，`teamName` 只作为历史记录字段，不代表团队空间、成员权限或多人共同编辑。排练复盘直接附着在 `rehearsal`，不额外创建 `practiceRecord`。历史排练只读。

### 3.4 PracticeRecord
单次素材练习复盘字段：`id`, `materialId`, `materialTitle`, `rehearsalId`, `rehearsalTitle`, `title`, `desc`, `score`, `note`, `attachments`, `comparisonNotes`, `reminder`, `duration`, `meta`, `createdAt`, `updatedAt`。

`score` 为 `1-10` 分；`note` 承接“本次复盘”；`attachments` 为数组，单项固定为 `{ id, type, fileID, thumbFileID?, duration?, size?, markers?, createdAt }`，`type` 取值为 `image / video / audio`，其中 `markers` 只用于视频/图片附件的轻量关键时刻备注，单项为 `{ id, time, kind, note, createdAt }`，`kind` 取值为 `good / issue / reminder / neutral`。音频附件首版只支持录制、上传、保存和回看，不支持 markers。`comparisonNotes` 保存同一素材两条含视频记录的对比复盘，包括被对比记录 ID 和“变化 / 仍需改进 / 下次重点”。当前产品尚未上线使用，不保留旧 `effect/keep/try` 单素材练习记录字段。

### 3.5 MethodCard
方法卡字段：`id`, `title`, `desc`, `type`, `sourceType`, `tags`, `meta`, `createdAt`, `updatedAt`。

### 3.6 Feedback
反馈字段：`id`, `category`, `content`, `contact`, `sourcePage`, `appVersion`, `status`, `ownerOpenId`, `createdAt`, `updatedAt`, `deletedAt`。首版只支持创建，由开发者在 CloudBase 控制台处理。

## 4. 按用户链路的数据归属

1. **找素材**：操作 `improv_materials`, `improv_user_material_states`。
2. **记录单次素材练习复盘**：操作 `improv_practice_records`，可手动触发 `improv_method_cards`。
3. **快速记录未归档内容**：操作 `improv_inspirations`，可保存文字、照片、视频和录音附件，并可手动触发 `improv_method_cards`。
4. **开启并进行排练**：操作 `improv_rehearsals`, `improv_materials`, `improv_user_material_states`。
5. **结束排练并复盘**：操作 `improv_rehearsals`，可手动触发 `improv_method_cards`。
6. **回看个人资产**：查询方法卡、灵感、个人多素材 session 记录和单素材练习记录。
7. **提交产品反馈**：设置页通过 `feedback.create` 写入 `improv_feedback`；失败时保留表单内容。

## 5. 云函数 action (`improv-api`)

| action | 说明 |
| --- | --- |
| `auth.apple` | iOS 个人版 Apple 登录换取 CloudBase sessionToken；iOS owner 使用 `ios:<userId>` 命名空间，与微信 `OPENID` 隔离。 |
| `material.list` | 返回合法素材列表，合并当前用户收藏/练过状态。支持 query, type, ability, scene, status, limit, offset，并返回不受筛选影响的 categoryCounts、不受分页影响的 types / abilities / scenes / statuses 动态分面数量，以及 500 条扫描容量门禁状态。 |
| `material.get` | 按素材 `id` 返回单条公共系统素材或当前用户自定义素材，合并当前用户收藏/练过状态；素材详情页和分享冷启动使用该 action，不依赖列表默认分页。 |
| `material.create/update/delete` | 管理自定义素材。 |
| `material.updateState` | 更新 `saved` / `played` / `lastRehearsalAt`。 |
| `profile.get/update` | 获取/更新当前用户资料。 |
| `today.summary` | 返回记录页今日聚合数据。 |
| `inspiration.*` | 灵感记录 CRUD。 |
| `methodCard.*` | 方法卡 CRUD。 |
| `rehearsal.*` | 排练记录 CRUD，含 `updateMaterialStatus`。 |
| `practiceRecord.*` | 单次素材练习复盘 CRUD。 |
| `practice.complete/rehearsal.complete` | 事务化保存练习或排练完成链路。 |
| `feedback.create` | 校验类型、正文和选填联系方式后创建用户反馈。 |
| `account.delete` | 删除当前用户私有业务数据、反馈、素材状态、头像和业务附件；写入账号级 `revokedBefore` 使删除前全部 iOS session 失效，部分文件失败时返回可重试状态和逐项结果。 |
| `security.checkText/security.checkMedia` | iOS / 多端写入前内容安全检查包装；文本走 `msgSecCheck`，图片走 `imgSecCheck`，视频和音频返回需人工或后续专用策略追踪。 |
| `media.prepareUpload` | iOS 媒体上传准备入口；配置上传网关后返回 `uploadUrl`、`method`、`headers`、`fileID` 和过期时间，未配置时返回 `uploadSupported: false`。 |
| `media.resolve` | 校验当前账号对附件的所有权；CloudBase fileID 返回临时 URL，外部 `improv/ios/<owner>/...` 对象返回绑定 `GET + fileID + owner + expires` 的签名 URL。 |

iOS 外部媒体网关的 PUT、GET、DELETE 使用同一 HMAC 口径，签名输入必须包含 HTTP method、fileID、owner 和 expires，避免上传签名被重放为读取或删除请求。账号删除会收集头像以及灵感/练习附件的 `fileID`、`thumbFileID`，分别清理 CloudBase 与外部对象存储；软删除记录保留到重试成功，不能把部分失败呈现为删除成功。

`practiceRecord.list` 支持按 `materialId`、评分区间、附件类型和分页查询；素材详情页按 `materialId` 拉取练习记录摘要，全局查询由练习记录页承接，单素材的关键时刻、视频对比和对比复盘由素材记录页承接。

## 6. 权限与隔离规则

- 私有数据必须由云函数通过 `cloud.getWXContext()` 写入 `ownerOpenId`。前端不传、不信任 `ownerOpenId`。
- iOS 原生端不使用微信 `OPENID`，由 `auth.apple` 校验 Apple identity token 签名后换取 sessionToken，并映射为 `ownerOpenId = "ios:<userId>"`。
- 用户私有集合查询必须带 `ownerOpenId` 和 `deletedAt: null` (软删除机制)。
- **隔离原则**：不读写旧项目集合，新集合统一 `improv_` 前缀，云函数走 `improv-api`。

## 7. 初始化与 Mock 数据导入

- 核心代码目录 `apps/wechat-cloudbase/` 中不保留业务 mock 数据。
- `data/cloudbase-imports/` 存放可手动导入 CloudBase 的演示数据：
  - `improv_materials.sample.json`
  - `improv_user_material_states.sample.json`
  - `improv_inspirations.sample.json`
  - `improv_rehearsals.sample.json`
  - `improv_method_cards.sample.json`
  - `improv_practice_records.sample.json`
- 公开素材样例只有 8 条，不代表生产内容库；私有集合样例导入前需手动将 `ownerOpenId` 替换为测试用户值。
