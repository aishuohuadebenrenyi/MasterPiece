# 数据与接口文档

更新时间：2026-06-08

本文档说明即兴工具箱的数据对象、CloudBase 集合、云函数 action、权限和隔离规则。工程事实源为 [wechat-cloudbase-app/database.md](../wechat-cloudbase-app/database.md)，本文档用于产品和架构层面的集中说明。

## 1. 后端模式

- 云能力：腾讯云 CloudBase
- 统一云函数：`improv-api`
- 前端调用：`wx.cloud.callFunction`
- 前端封装：`frontend/services/cloud.ts`
- 请求字段：`action`、`requestId`、`payload`
- 返回字段：`code`、`message`、`data`、`requestId`

当前前端消费策略：

- 当前功能开发阶段不启用 `store` 本地持久化缓存，只保留当前会话内存态。
- 接口成功返回空数组时，页面应进入空态，不回退旧本地数据。
- 接口失败时，页面进入错误态；若当前会话内存在 `pending` 记录，可继续显示这些记录。

## 2. 集合

所有业务集合统一使用 `improv_` 前缀：

| 集合 | 用途 |
| --- | --- |
| `improv_games` | 即兴游戏库。 |
| `improv_user_game_states` | 用户对游戏的收藏、玩过、最近排练状态。 |
| `improv_profiles` | 当前用户个人资料。 |
| `improv_inspirations` | 灵感记录。 |
| `improv_rehearsals` | 排练记录。 |
| `improv_game_records` | 单次游戏实践反馈。 |
| `improv_method_cards` | 个人沉淀方法卡。 |

## 3. 核心数据对象

### 3.1 Game

游戏条目字段包括：

- `id`
- `title`
- `desc`
- `tags`
- `meta`
- `steps`
- `tips`
- `variant`
- `issue`
- `relatedGameId`
- `stripeTone`
- `sortOrder`
- `saved`
- `played`
- `playedCount`
- `lastPlayedAt`
- `lastRehearsalAt`

### 3.2 Inspiration

灵感记录字段包括：

- `id`
- `title`
- `desc`
- `type`
- `meta`
- `linkedGameId`
- `linkedGameTitle`
- `linkedRehearsalId`
- `linkedRehearsalTitle`
- `createdAt`
- `updatedAt`

### 3.3 Rehearsal

排练记录字段包括：

- `id`
- `title`
- `desc`
- `teamName`
- `duration`
- `goals`
- `source`
- `status`
- `plan`
- `reviewKeep`
- `reviewTry`
- `reviewReminder`
- `createdAt`
- `updatedAt`

说明：

- `goals` 为字符串数组，支持固定目标和用户自定义目标混合写入。
- 排练复盘字段直接附着在 `rehearsal` 记录本身，不额外创建 `gameRecord`。
- 历史排练只读回看，不支持事后追加编辑；后续归档统一通过“我的 -> 待整理”完成。

`plan` 中每个游戏包含：

- `gameId`
- `status`
- `keep`
- `try`

### 3.4 GameRecord

单次游戏实践反馈字段包括：

- `id`
- `gameId`
- `title`
- `desc`
- `rehearsalId`
- `effect`
- `keep`
- `try`
- `reminder`
- `duration`
- `meta`
- `createdAt`
- `updatedAt`

说明：

- `title` 为本次记录对应的游戏名。
- `desc` 为 Keep / Try / reminder 的拼接摘要，用于列表回看。
- `rehearsalId` 仅在“加入当前排练”或“从反馈新建排练”时写入；历史排练保持只读，不支持回写编辑。

### 3.5 MethodCard

方法卡字段包括：

- `id`
- `title`
- `desc`
- `type`
- `sourceType`
- `tags`
- `meta`
- `createdAt`
- `updatedAt`

### 3.6 Profile

个人资料字段包括：

- `id`
- `displayName`
- `avatarUrl`
- `troupeName`
- `createdAt`
- `updatedAt`

## 4. 云函数 action

当前 `improv-api` 支持：

| action | 说明 |
| --- | --- |
| `game.seed` | 已停用代码内 seed，调用时会提示改为手动导入 `mock_data/improv_games.json`。 |
| `game.list` | 返回游戏列表，并合并当前用户收藏/玩过状态。 |
| `game.create` | 创建自定义游戏。 |
| `game.update` | 更新当前用户创建的自定义游戏。 |
| `game.delete` | 软删除当前用户创建的自定义游戏。 |
| `game.updateState` | 统一更新 `saved` / `played` / `lastRehearsalAt`。 |
| `profile.get` | 返回当前用户个人资料；如果未创建资料，返回空。 |
| `profile.update` | 更新当前用户的名字、头像和 `troupeName`。 |
| `today.summary` | 返回记录页今日聚合：`inspirations`、`rehearsals`、`recommendGameId`。 |
| `inspiration.list` | 返回当前用户灵感记录。 |
| `inspiration.create` | 创建灵感记录。 |
| `methodCard.list` | 返回当前用户方法卡。 |
| `methodCard.create` | 创建方法卡。 |
| `rehearsal.list` | 返回当前用户排练记录。 |
| `rehearsal.create` | 创建排练记录；`goals` 支持自定义字符串。 |
| `rehearsal.update` | 更新排练记录，也承载排练暂停、完成和复盘字段回写。 |
| `rehearsal.updateGameStatus` | 更新排练计划中单个游戏的状态、Keep、Try。 |
| `gameRecord.list` | 返回当前用户单次游戏实践反馈。 |
| `gameRecord.create` | 创建单次游戏实践反馈；不用于保存排练复盘。 |

兼容别名：

- `seed.games` -> `game.seed`
- `game.updateSaved` -> `game.updateState`
- `game.updatePlayed` -> `game.updateState`

## 5. 权限规则

- MVP 阶段所有业务读写建议走 `improv-api` 云函数。
- 私有数据必须由云函数通过 `cloud.getWXContext()` 写入 `ownerOpenId`。
- 前端不传、不信任 `ownerOpenId`。
- 用户私有集合查询必须带 `ownerOpenId` 和 `deletedAt: null`。
- 删除优先使用软删除，保留 `deletedAt` 字段。

## 6. 隔离规则

当前项目可复用同一个 CloudBase 环境，但必须与旧项目隔离：

- 不复用旧项目业务云函数。
- 不读写旧项目集合。
- 新集合统一使用 `improv_` 前缀。
- 新云存储路径统一使用 `improv/` 前缀。
- 新业务统一走 `improv-api` action。

## 7. 初始化流程

1. 在 CloudBase 控制台创建或重建 `improv_` 集合。
2. 上传并部署云函数 `improv-api`。
3. 从仓库根目录 `mock_data/` 手动导入对应 JSON：
   - `mock_data/improv_games.json`
   - `mock_data/improv_user_game_states.sample.json`
   - `mock_data/improv_inspirations.sample.json`
   - `mock_data/improv_rehearsals.sample.json`
   - `mock_data/improv_method_cards.sample.json`
   - `mock_data/improv_game_records.sample.json`
4. 对私有集合导入前，先将 `ownerOpenId` 替换为真实用户值。
5. 在微信开发者工具中打开 `wechat-cloudbase-app/` 并验证 `game.list`、`inspiration.list`、`rehearsal.list`。

补充验证约定：

- 如果数据库未导入，`mine`、`record`、`team-records` 应显示空态或 0。
- 如果此前运行过旧版本，验证前需要先清除微信开发者工具 Storage / 清缓存 / 编译缓存，避免旧开发缓存干扰结果。
