# CloudBase 数据库与接口说明

更新时间：2026-06-06

本小程序使用 `improv_` 前缀集合。当前版本采用重建策略，不兼容旧数据。

## 1. 集合

- `improv_games`：即兴游戏库。
- `improv_user_game_states`：用户对游戏的收藏、玩过、最近排练状态。
- `improv_profiles`：用户个人资料。
- `improv_inspirations`：灵感记录。
- `improv_rehearsals`：排练记录。
- `improv_game_records`：单次游戏实践反馈。
- `improv_method_cards`：个人沉淀方法卡。

## 2. improv_games

固定字段：

- `id`
- `title`
- `desc`
- `tags`
- `meta`
- `fit`
- `lead`
- `steps`
- `tips`
- `variant`
- `issue`
- `relatedGameId`
- `stripeTone`
- `sortOrder`
- `ownerOpenId`
- `createdAt`
- `updatedAt`
- `deletedAt`

前端合并用户状态后还会得到：

- `saved`
- `played`
- `playedCount`
- `lastPlayedAt`
- `lastRehearsalAt`

## 3. improv_user_game_states

固定字段：

- `ownerOpenId`
- `gameId`
- `saved`
- `playedCount`
- `lastPlayedAt`
- `lastRehearsalAt`
- `createdAt`
- `updatedAt`

## 4. 用户私有集合

以下集合统一写入：

- `ownerOpenId`
- `createdAt`
- `updatedAt`
- `deletedAt`

私有集合：

- `improv_profiles`
- `improv_inspirations`
- `improv_rehearsals`
- `improv_game_records`
- `improv_method_cards`

### improv_profiles

固定字段：

- `id`
- `displayName`
- `avatarUrl`
- `ownerOpenId`
- `createdAt`
- `updatedAt`
- `deletedAt`

## 5. 云函数 action

统一云函数：`improv-api`

| action | 说明 |
| --- | --- |
| `game.seed` | 已停用代码内 seed，调用时会提示改为手动导入仓库根目录 `mock_data/improv_games.json`。 |
| `game.list` | 返回游戏列表，并合并当前用户收藏/玩过状态。 |
| `game.create` | 创建自定义游戏。 |
| `game.update` | 更新当前用户创建的自定义游戏。 |
| `game.delete` | 软删除当前用户创建的自定义游戏。 |
| `game.updateState` | 统一更新 `saved` / `played` / `lastRehearsalAt`。 |
| `profile.get` | 返回当前用户个人资料；没有资料时返回空。 |
| `profile.update` | 更新当前用户的名字和头像。 |
| `today.summary` | 返回记录页今日统计和推荐游戏。 |
| `inspiration.list` | 返回当前用户灵感记录。 |
| `inspiration.create` | 创建灵感记录。 |
| `methodCard.list` | 返回当前用户方法卡。 |
| `methodCard.create` | 创建方法卡。 |
| `rehearsal.list` | 返回当前用户排练记录。 |
| `rehearsal.create` | 创建排练记录。 |
| `rehearsal.update` | 更新排练记录。 |
| `rehearsal.updateGameStatus` | 更新排练计划中单个游戏的状态、Keep、Try。 |
| `gameRecord.list` | 返回当前用户单次游戏实践反馈。 |
| `gameRecord.create` | 创建单次游戏实践反馈。 |

兼容别名：

- `seed.games` 仍会命中 `game.seed`，但同样只返回手动导入提示。
- `game.updateSaved` 会转到 `game.updateState`。
- `game.updatePlayed` 会转到 `game.updateState`。

## 6. 请求与返回结构

前端通过 `wx.cloud.callFunction` 调用：

```js
wx.cloud.callFunction({
  name: 'improv-api',
  data: {
    action: 'game.list',
    requestId: `improv_${Date.now()}`,
    payload: {}
  }
})
```

云函数返回：

```json
{
  "code": 0,
  "message": "ok",
  "data": {},
  "requestId": "improv_..."
}
```

## 7. 初始化

1. 在 CloudBase 控制台删除旧 `improv_` 集合或确认可以重建。
2. 创建上方集合。
3. 上传并部署云函数 `improv-api`。
4. 从仓库根目录 `mock_data/` 手动导入集合数据：

- `mock_data/improv_games.json`
- `mock_data/improv_user_game_states.sample.json`
- `mock_data/improv_inspirations.sample.json`
- `mock_data/improv_rehearsals.sample.json`
- `mock_data/improv_method_cards.sample.json`
- `mock_data/improv_game_records.sample.json`

5. 导入私有集合前，先把 `ownerOpenId` 替换为真实值：

- `improv_user_game_states`
- `improv_inspirations`
- `improv_rehearsals`
- `improv_game_records`
- `improv_method_cards`

6. 导入完成后，在小程序中验证：

- `game.list`
- `inspiration.list`
- `rehearsal.list`
- `methodCard.list`

当前开发阶段补充说明：

- 前端暂不启用 `store` 本地持久化缓存，只保留当前会话内存态。
- 云端接口成功返回空数组时，前端应按空态处理，不回退旧本地缓存数据。
- 云端接口失败时，前端才进入错误态；如当前会话内存在 `pending` 记录，可继续展示这些记录。
- 如果之前运行过旧版本，而页面仍显示历史数据，请先在微信开发者工具中清除 Storage / 清缓存 / 编译缓存，再重新打开小程序验证空态。

## 8. 权限

MVP 阶段建议所有业务读写都走 `improv-api` 云函数。

私有数据必须由云函数通过 `cloud.getWXContext()` 写入 `ownerOpenId`，前端不传、不信任 `ownerOpenId`。

用户私有数据查询必须带：

- `ownerOpenId`
- `deletedAt: null`

删除优先软删除，使用 `deletedAt` 标记。
