# CloudBase 数据库重建说明

本小程序使用 `improv_` 前缀集合。当前版本采用重建策略，不兼容旧数据。

## 集合

- `improv_games`：即兴游戏库。
- `improv_user_game_states`：用户对游戏的收藏、玩过、最近排练状态。
- `improv_inspirations`：灵感记录。
- `improv_rehearsals`：排练记录。
- `improv_game_records`：单次游戏实践反馈。
- `improv_method_cards`：个人沉淀方法卡。

## improv_games

固定字段：

- `id`
- `title`
- `desc`
- `category`
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
- `createdAt`
- `updatedAt`
- `deletedAt`

## improv_user_game_states

固定字段：

- `ownerOpenId`
- `gameId`
- `saved`
- `playedCount`
- `lastPlayedAt`
- `lastRehearsalAt`
- `createdAt`
- `updatedAt`

## 云函数 action

统一云函数：`improv-api`

- `game.seed`：清空并重建 `improv_games` seed 数据。
- `game.list`：返回游戏列表，并合并当前用户收藏/玩过状态。
- `game.create`：创建自定义游戏。
- `game.updateState`：统一更新 `saved` / `played`。
- `today.summary`：返回记录页今日统计和推荐卡。
- `inspiration.create` / `inspiration.list`
- `rehearsal.create` / `rehearsal.list`
- `gameRecord.create` / `gameRecord.list`
- `methodCard.create` / `methodCard.list`

兼容别名：

- `seed.games` 仍会执行 `game.seed`。
- `game.updateSaved` / `game.updatePlayed` 会转到 `game.updateState`。

## 初始化

1. 在 CloudBase 控制台删除旧 `improv_` 集合或确认可以重建。
2. 创建上方集合。
3. 上传并部署云函数 `improv-api`。
4. 调用：

```js
wx.cloud.callFunction({
  name: 'improv-api',
  data: {
    action: 'game.seed',
    requestId: `improv_seed_${Date.now()}`
  }
})
```

期望返回：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "removed": 0,
    "inserted": 3,
    "total": 3
  }
}
```

## 权限

MVP 阶段建议所有业务读写都走 `improv-api` 云函数。私有数据必须由云函数通过 `cloud.getWXContext()` 写入 `ownerOpenId`，前端不传、不信任 `ownerOpenId`。
