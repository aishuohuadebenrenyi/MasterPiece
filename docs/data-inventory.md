# 数据总览与用户链路

更新时间：2026-06-07

本文档从“用户链路”视角整理当前项目的正式文档入口、技术架构、数据链路、入库范围和 mock 数据迁移方案。工程实现事实仍以 `wechat-cloudbase-app/database.md` 为准。

## 1. 正式文档入口

- `product.md`：产品定位、用户、核心问题、核心对象、MVP。
- `information-architecture.md`：三 Tab、十页面、关键链路、页面职责。
- `architecture.md`：前端分层、状态层、服务层、云函数分层。
- `data-api.md`：集合、数据对象、action、权限规则。
- `wechat-cloudbase-app/database.md`：CloudBase 集合、字段和初始化的实现事实源。

## 2. 当前架构

当前链路为：

页面层 -> `frontend/services/*` -> `frontend/services/cloud.ts` -> `improv-api` -> CloudBase 集合

其中：

- 页面层负责交互、表单状态和跳转。
- 服务层负责 action 调用和响应归一化。
- `store/index.ts` 负责轻量状态和订阅；当前开发阶段不启用本地持久化。
- `improv-api` 负责统一 action 分发和私有数据隔离。

## 3. 按用户链路分类的数据

### 3.1 找游戏

- 页面：`discover`、`game-detail`
- 用户动作：搜索、筛选、抽卡、查看详情、收藏、标记玩过、添加自定义游戏、开始游戏
- 入库数据：
  - `improv_games`
  - `improv_user_game_states`
- 服务与 action：
  - `listGames()` -> `game.list`
  - `createGame()` -> `game.create`
  - `updateGameState()` -> `game.updateState`

### 3.2 记录单次游戏反馈

- 页面：`game-feedback`
- 用户动作：结束单次游戏后填写效果、Keep、Try、下次提醒，可新建排练；保存后可手动选择沉淀为方法卡
- 入库数据：
  - `improv_game_records`
  - `improv_method_cards` (手动触发)
  - `improv_rehearsals`
- 服务与 action：
  - `createGameRecord()` -> `gameRecord.create`
  - `createMethodCard()` -> `methodCard.create`
  - `createRehearsal()` -> `rehearsal.create`

### 3.3 快速记录灵感

- 页面：`record`、`inspiration-edit`
- 用户动作：语音速记、保存灵感、补充标签、关联游戏或排练；保存后可手动选择沉淀方法卡
- 入库数据：
  - `improv_inspirations`
  - `improv_method_cards` (手动触发)
- 服务与 action：
  - `fetchTodaySummary()` -> `today.summary`
  - `createInspiration()` -> `inspiration.create`
  - `listInspirations()` -> `inspiration.list`
  - `createMethodCard()` -> `methodCard.create`

### 3.4 开启并进行排练

- 页面：`record`、`rehearsal-record`
- 用户动作：开启排练、添加游戏、切换状态、记录 Keep / Try、暂停和继续
- 入库数据：
  - `improv_rehearsals`
  - `improv_games`
  - `improv_user_game_states`
- 服务与 action：
  - `createRehearsal()` -> `rehearsal.create`
  - `updateRehearsal()` -> `rehearsal.update`
  - `updateGameStatus()` -> `rehearsal.updateGameStatus`
  - `listGames()` -> `game.list`
  - `updateGameState()` -> `game.updateState`

### 3.5 结束排练并复盘

- 页面：`rehearsal-review`
- 用户动作：结束排练、保存整体复盘；保存后可手动选择沉淀方法卡
- 入库数据：
  - `improv_rehearsals`
  - `improv_method_cards` (手动触发)
  - `improv_game_records`
- 服务与 action：
  - `updateRehearsal()` -> `rehearsal.update`
  - `createMethodCard()` -> `methodCard.create`
  - `createGameRecord()` -> `gameRecord.create`

### 3.6 回看个人与团队资产

- 页面：`mine`、`team-records`、`game-records`
- 用户动作：查看方法卡、灵感、排练记录、游戏记录和详情
- 入库数据：
  - `improv_method_cards`
  - `improv_inspirations`
  - `improv_rehearsals`
  - `improv_game_records`
- 服务与 action：
  - `listMethodCards()` -> `methodCard.list`
  - `listInspirations()` -> `inspiration.list`
  - `listRehearsals()` -> `rehearsal.list`
  - `listGameRecords()` -> `gameRecord.list`

## 4. 哪些数据必须入库

- 必须入库：
  - 游戏库
  - 用户游戏状态
  - 灵感记录
  - 排练记录
  - 游戏实践反馈
  - 方法卡
- 只保留本地：
  - `viewMode`
  - `voiceDraft`
  - `pausedRehearsal`
  - `currentRehearsal`
  - 弹层开关、当前索引、输入中表单值等纯 UI 状态

## 5. 本地状态与数据库映射

- `savedGameIds` / `playedGameIds`
  - 对应 `improv_user_game_states` 的派生缓存。
- `todayInspirations`
  - 对应 `today.summary` 聚合返回或 `improv_inspirations` 查询结果。
- `todayRehearsals` / `rehearsalHistory`
  - 对应 `improv_rehearsals`，页面层可做时间或状态筛选。
- `methodCards`
  - 对应 `improv_method_cards`。

## 6. mock 数据迁移方案

当前 mock 主要来自：

- `frontend/services/mock-data.ts`
- `frontend/services/mock-data.js`
- `store/index.ts` 默认状态
- 若干页面和服务里的回退示例数据
- `improv-api/index.js` 内置 `SEED_GAMES`

迁移后规则：

- 项目核心代码目录 `wechat-cloudbase-app/` 中不保留业务 mock 数据。
- 所有可导入数据放在仓库根目录 `mock_data/`。
- 前端接口失败时只返回空数组、已有本地真实状态或错误态，不再回退业务示例。
- 云函数不再通过代码内 seed 数组初始化游戏库。

## 6.1 当前开发阶段的状态策略

- 当前功能开发和页面交互开发阶段，暂不启用 `store` 本地持久化缓存。
- 页面只使用：
  - 当前会话内存态
  - 云端真实数据
  - 空态 / 错误态
- 页面渲染约定：
  - 云端请求成功但返回空数组：直接显示空态
  - 云端请求失败：显示错误态；如当前会话存在 `pending` 数据，可继续展示这些数据
  - 不再把旧本地持久化缓存当作事实源
- 如果之前运行过旧版本，需要先在微信开发者工具中清除 Storage / 清缓存 / 编译缓存，再验证空态。

## 7. mock_data 文件规划

- `mock_data/improv_games.json`
- `mock_data/improv_user_game_states.sample.json`
- `mock_data/improv_inspirations.sample.json`
- `mock_data/improv_rehearsals.sample.json`
- `mock_data/improv_method_cards.sample.json`
- `mock_data/improv_game_records.sample.json`

说明：

- 公共集合可直接导入。
- 私有集合使用 `sample` 后缀，导入前需要手动替换 `ownerOpenId`。
- `mock_data/` 只存放导入数据，不参与前端构建和云函数部署。
