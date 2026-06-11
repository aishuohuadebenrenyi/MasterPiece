# mock_data 导入说明

更新时间：2026-06-06

`mock_data/` 存放的是可手动导入 CloudBase 的数据文件，不参与小程序构建，也不参与云函数部署。

## 1. 文件与集合对应关系

| 文件 | 对应集合 | 说明 |
| --- | --- | --- |
| `improv_games.json` | `improv_games` | 公共游戏库，可直接导入。 |
| `improv_user_game_states.sample.json` | `improv_user_game_states` | 用户游戏状态样例，导入前必须替换 `ownerOpenId`。 |
| `improv_inspirations.sample.json` | `improv_inspirations` | 灵感记录样例，导入前必须替换 `ownerOpenId`。 |
| `improv_rehearsals.sample.json` | `improv_rehearsals` | 排练记录样例，导入前必须替换 `ownerOpenId`。 |
| `improv_method_cards.sample.json` | `improv_method_cards` | 方法卡样例，导入前必须替换 `ownerOpenId`。 |
| `improv_game_records.sample.json` | `improv_game_records` | 单次游戏反馈样例，导入前必须替换 `ownerOpenId`。 |
| *(无对应文件)* | `improv_profiles` | 用户资料集合。当你在小程序中编辑个人资料时会自动创建记录，无需手动导入 mock 数据。 |

## 2. 建议导入顺序

1. `improv_games.json`
2. `improv_user_game_states.sample.json`
3. `improv_inspirations.sample.json`
4. `improv_rehearsals.sample.json`
5. `improv_method_cards.sample.json`
6. `improv_game_records.sample.json`

说明：

- 第 1 步先导入公共游戏库，保证前端“找游戏”链路先可用。
- 第 2 步以后是私有数据样例，适合拿来演示“收藏/玩过/灵感/排练/方法卡/反馈”链路。

## 3. 导入前准备

1. 在 CloudBase 中确认已创建这些集合：
   - `improv_games`
   - `improv_user_game_states`
   - `improv_inspirations`
   - `improv_rehearsals`
   - `improv_method_cards`
   - `improv_game_records`
2. 已上传并部署云函数 `improv-api`。
3. 明确本次要导入给哪个真实用户账号。

## 4. ownerOpenId 替换规则

以下 5 个文件导入前，必须先把占位值 `__REPLACE_WITH_OPENID__` 替换成真实 `ownerOpenId`：

- `improv_user_game_states.sample.json`
- `improv_inspirations.sample.json`
- `improv_rehearsals.sample.json`
- `improv_method_cards.sample.json`
- `improv_game_records.sample.json`

`improv_games.json` 不需要替换，文件里默认使用 `ownerOpenId: "system"` 表示系统公共库。

## 5. 如何拿到真实 ownerOpenId

在微信云开发体系中，**用户的唯一标识（User ID）就是微信自动生成的 `OPENID`**。我们不需要像传统开发那样去专门建一个 `users` 表来注册账号，这个 ID 是微信底层直接给我们的。

获取你自己的真实 `OPENID` 最简单的方法如下：

1. **先启动小程序**并在开发者工具或手机上正常登录。
2. **触发一次真实的数据库写入**：
   - 最简单的方式是：去“发现”页随便点开一个游戏，**点击一下右上角的“收藏（☆）”按钮**。
3. **去云端复制 ID**：
   - 打开 CloudBase（微信开发者工具上的“云开发”按钮）控制台。
   - 找到 `improv_user_game_states` 这个集合。
   - 你会看到里面刚新增了一条记录（就是你刚才点的收藏）。
   - 展开那条记录，**复制里面的 `ownerOpenId` 字段的值**。
4. **批量替换**：
   - 把 `mock_data/*.sample.json` 中所有的 `__REPLACE_WITH_OPENID__` 替换成你刚才复制的那个值。
   - 然后再导入控制台。

> **提示**：不要自己瞎猜或者随便手写一串字符作为 `ownerOpenId`，否则导入后小程序里依然认不出这些数据是你自己的。

## 6. 导入步骤

以 CloudBase 控制台为例：

1. 打开对应集合。
2. 选择“导入”。
3. 选择对应的 `json` 文件。
4. 确认 JSON 为数组结构。
5. 执行导入。

注意：

- 如果集合里已经有旧数据，建议先清理或确认是否允许重复。
- 本项目当前采用重建策略，旧结构数据不保证兼容。
- `sample` 文件是演示数据，不建议直接当生产正式数据长期保留。

## 7. 导入后怎么验证

导入完成后，可以在小程序中按链路验证：

- 找游戏
  - 验证 `discover` 和 `game-detail` 是否能读到 `improv_games`。
- 收藏/玩过
  - 验证是否能看到 `improv_user_game_states` 对应状态。
- 灵感记录
  - 验证 `record`、`mine` 是否能看到 `improv_inspirations`。
- 排练记录
  - 验证 `record`、`team-records` 是否能看到 `improv_rehearsals`。
- 方法卡
  - 验证 `mine` 是否能看到 `improv_method_cards`。
- 游戏反馈
  - 验证 `game-feedback` 相关链路是否能读取和新增 `improv_game_records`。

## 8. 空数据现象说明

当前代码已经去掉业务 mock 数据。

这意味着：

- 如果集合为空，页面会显示空态或没有数据。
- 如果接口失败，不会再自动回退示例数据。
- 如果只导入了 `improv_games.json`，那么“发现”链路可用，但“我的/记录”里的私有资产可能仍为空。
- 当前功能开发阶段不启用 `store` 本地持久化缓存，只保留当前会话内存态。
- 如果之前运行过旧版本，而页面仍显示历史数据，请先在微信开发者工具中清除 Storage / 清缓存 / 编译缓存，再重新打开小程序。

## 9. 相关文档

- `docs/data-inventory.md`
- `docs/data-api.md`
- `wechat-cloudbase-app/database.md`
