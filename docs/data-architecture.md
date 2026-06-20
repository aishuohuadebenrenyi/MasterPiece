# 数据架构与接口说明

更新时间：2026-06-19

本文档从“数据流转”与“接口架构”视角整理当前项目的正式文档入口、技术架构、数据对象、集合与云函数 action 规则。工程实现事实仍以 `wechat-cloudbase-app/database.md` 为准。

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

## 3. 核心数据对象

### 3.1 Material
`Material` 是 App 内“素材”的上位对象。
字段包括：`id`, `title`, `desc`, `type` (游戏/角色/才艺/格式/主理/技巧/复盘/路径), `tags`, `abilities`, `scenes`, `meta`, `steps`, `tips`, `variant`, `issue`, `relatedMaterialId`, `referenceOnly`, `stripeTone`, `sortOrder`, `saved`, `played`, `playedCount`, `lastPlayedAt`, `lastRehearsalAt`。

### 3.2 Inspiration
灵感记录字段：`id`, `title`, `desc`, `type`, `meta`, `linkedMaterialId`, `linkedMaterialTitle`, `linkedRehearsalId`, `linkedRehearsalTitle`, `createdAt`, `updatedAt`。

### 3.3 Rehearsal
排练记录字段：`id`, `title`, `desc`, `teamName`, `duration`, `goals` (数组), `source`, `status`, `plan` (包含 materialId, status, keep, try), `reviewKeep`, `reviewTry`, `reviewReminder`, `createdAt`, `updatedAt`。
说明：排练复盘直接附着在 `rehearsal`，不额外创建 `practiceRecord`。历史排练只读。

### 3.4 PracticeRecord
单次素材练习复盘字段：`id`, `materialId`, `title`, `desc`, `rehearsalId`, `effect`, `keep`, `try`, `reminder`, `duration`, `meta`, `createdAt`, `updatedAt`。

### 3.5 MethodCard
方法卡字段：`id`, `title`, `desc`, `type`, `sourceType`, `tags`, `meta`, `createdAt`, `updatedAt`。

## 4. 按用户链路的数据归属

1. **找素材**：操作 `improv_materials`, `improv_user_material_states`。
2. **记录单次素材练习复盘**：操作 `improv_practice_records`，可手动触发 `improv_method_cards`。
3. **快速记录灵感**：操作 `improv_inspirations`，可手动触发 `improv_method_cards`。
4. **开启并进行排练**：操作 `improv_rehearsals`, `improv_materials`, `improv_user_material_states`。
5. **结束排练并复盘**：操作 `improv_rehearsals`，可手动触发 `improv_method_cards`。
6. **回看个人与团队资产**：查询方法卡、灵感、排练记录、练习记录。

## 5. 云函数 action (`improv-api`)

| action | 说明 |
| --- | --- |
| `material.list` | 返回素材列表，合并当前用户收藏/练过状态。支持 query, type, ability, scene, status, limit 过滤。 |
| `material.create/update/delete` | 管理自定义素材。 |
| `material.updateState` | 更新 `saved` / `played` / `lastRehearsalAt`。 |
| `profile.get/update` | 获取/更新当前用户资料。 |
| `today.summary` | 返回记录页今日聚合数据。 |
| `inspiration.*` | 灵感记录 CRUD。 |
| `methodCard.*` | 方法卡 CRUD。 |
| `rehearsal.*` | 排练记录 CRUD，含 `updateMaterialStatus`。 |
| `practiceRecord.*` | 单次素材练习复盘 CRUD。 |

## 6. 权限与隔离规则

- 私有数据必须由云函数通过 `cloud.getWXContext()` 写入 `ownerOpenId`。前端不传、不信任 `ownerOpenId`。
- 用户私有集合查询必须带 `ownerOpenId` 和 `deletedAt: null` (软删除机制)。
- **隔离原则**：不读写旧项目集合，新集合统一 `improv_` 前缀，云函数走 `improv-api`。

## 7. 初始化与 Mock 数据导入

- 核心代码目录 `wechat-cloudbase-app/` 中不保留业务 mock 数据。
- `mock_data/` 存放可手动导入 CloudBase 的演示数据：
  - `improv_materials.json`
  - `improv_user_material_states.sample.json`
  - `improv_inspirations.sample.json`
  - `improv_rehearsals.sample.json`
  - `improv_method_cards.sample.json`
  - `improv_practice_records.sample.json`
- 私有集合使用 `sample` 后缀，导入前需手动将 `ownerOpenId` 替换为真实用户值。
