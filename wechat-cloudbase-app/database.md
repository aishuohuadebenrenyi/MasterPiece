# CloudBase 数据库与接口说明

更新时间：2026-06-19

本小程序使用 `improv_` 前缀集合。当前版本采用重建策略，素材体系以 `Material` 为上位对象，不兼容旧游戏集合数据。

## 1. 集合

- `improv_materials`：即兴素材库，包含游戏、角色、才艺、格式、主理、技巧、复盘、路径。
- `improv_user_material_states`：用户对素材的收藏、练过、最近使用状态。
- `improv_profiles`：用户个人资料。
- `improv_inspirations`：灵感记录。
- `improv_rehearsals`：排练记录。
- `improv_practice_records`：单次素材练习复盘。
- `improv_method_cards`：个人沉淀方法卡。

## 2. improv_materials

固定字段：

- `id`
- `title`
- `desc`
- `type`：`游戏`、`角色`、`才艺`、`格式`、`主理`、`技巧`、`复盘`、`路径`
- `tags`
- `abilities`
- `scenes`
- `meta`
- `steps`
- `tips`
- `variant`
- `issue`
- `relatedMaterialId`
- `referenceOnly`
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

说明：

- `路径` 是参考型素材，`referenceOnly` 必须为 `true`；只支持查看、收藏和筛选跳转，不进入训练计时、抽卡训练池或复盘链路。
- 学习地图和训练路径的个人自定义版本复用 `路径` 素材：官方预设保持只读，用户副本写入当前用户 `ownerOpenId`，并用 `relatedMaterialId` 关联预设 key。
- 其他素材类型可收藏、标记练过、开始训练、暂停、结束复盘。

## 3. improv_user_material_states

固定字段：

- `ownerOpenId`
- `materialId`
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
- `improv_practice_records`
- `improv_method_cards`

### improv_rehearsals

固定字段：

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
- `ownerOpenId`
- `createdAt`
- `updatedAt`
- `deletedAt`

说明：

- `goals` 支持固定目标与自定义目标混合写入。
- `plan` 中每一项使用 `materialId`，可加入除 `路径` 外的多类型素材。
- 排练复盘直接更新在 `improv_rehearsals` 上，不额外写入 `improv_practice_records`。
- 历史排练保持只读，不支持事后追加编辑；后续归档统一在“我的 -> 待整理”中完成。

### improv_practice_records

固定字段：

- `id`
- `materialId`
- `rehearsalId`
- `title`
- `desc`
- `effect`
- `keep`
- `try`
- `reminder`
- `duration`
- `meta`
- `ownerOpenId`
- `createdAt`
- `updatedAt`
- `deletedAt`

说明：

- `title` 为本次练习对应的素材名。
- `rehearsalId` 只记录当前排练或从复盘新建的排练，不回写历史排练。

### improv_profiles

固定字段：

- `id`
- `displayName`
- `avatarUrl`
- `troupeName`
- `ownerOpenId`
- `createdAt`
- `updatedAt`
- `deletedAt`

## 5. 云函数 action

统一云函数：`improv-api`

| action | 说明 |
| --- | --- |
| `material.seed` | 已停用代码内 seed，调用时提示改为手动导入 `mock_data/improv_materials.json`。 |
| `material.list` | 返回素材列表，并合并当前用户收藏/练过状态。 |
| `material.create` | 创建自定义素材。 |
| `material.update` | 更新当前用户创建的自定义素材。 |
| `material.delete` | 软删除当前用户创建的自定义素材。 |
| `material.updateState` | 统一更新 `saved` / `played` / `lastRehearsalAt`。 |
| `profile.get` | 返回当前用户个人资料；没有资料时返回空。 |
| `profile.update` | 更新当前用户的名字、头像和 `troupeName`。 |
| `today.summary` | 返回记录页今日聚合：`inspirations`、`rehearsals`、`recommendMaterialId`。 |
| `inspiration.list` | 返回当前用户灵感记录。 |
| `inspiration.create` | 创建灵感记录。 |
| `inspiration.update` | 更新当前用户灵感记录。 |
| `inspiration.delete` | 软删除当前用户灵感记录。 |
| `methodCard.list` | 返回当前用户方法卡。 |
| `methodCard.create` | 创建方法卡。 |
| `methodCard.update` | 更新当前用户方法卡。 |
| `methodCard.delete` | 软删除当前用户方法卡。 |
| `rehearsal.list` | 返回当前用户排练记录。 |
| `rehearsal.create` | 创建排练记录；`goals` 支持自定义字符串。 |
| `rehearsal.update` | 更新排练记录，也承载暂停、完成与复盘字段写回。 |
| `rehearsal.delete` | 软删除当前用户排练记录。 |
| `rehearsal.updateMaterialStatus` | 更新排练计划中单个素材的状态、Keep、Try。 |
| `practiceRecord.list` | 返回当前用户单次素材练习复盘。 |
| `practiceRecord.create` | 创建单次素材练习复盘，不用于保存排练复盘。 |
| `practiceRecord.update` | 更新当前用户单次素材练习复盘。 |
| `practiceRecord.delete` | 软删除当前用户单次素材练习复盘。 |

`material.list` 可选 `payload`：

- `query`：按标题、描述、类型、标签、能力、场景和 meta 做文本匹配。
- `type`：素材类型；`all` 或空值表示全部类型。
- `ability`：训练能力；`all` 或空值表示不限。
- `scene`：使用场景；`all` 或空值表示不限。
- `status`：`all`、`saved`、`played`、`unplayed`。
- `limit`：返回数量上限，当前最大 100。

说明：

- `material.list` 只返回公共系统素材（`ownerOpenId: "system"`）和当前用户自己的自定义素材。
- `saved`、`played`、`unplayed` 依赖当前用户状态，云函数会先合并 `improv_user_material_states` 再过滤。

说明：当前云函数 action 只以 `material.*`、`practiceRecord.*`、`rehearsal.updateMaterialStatus` 等素材语义作为正式入口；旧 `game.*`、`gameRecord.*` 和 `rehearsal.updateGameStatus` 不再作为当前工程口径。

## 6. 请求与返回结构

前端通过 `wx.cloud.callFunction` 调用：

```js
wx.cloud.callFunction({
  name: 'improv-api',
  data: {
    action: 'material.list',
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

- `mock_data/improv_materials.json`
- `mock_data/improv_user_material_states.sample.json`
- `mock_data/improv_inspirations.sample.json`
- `mock_data/improv_rehearsals.sample.json`
- `mock_data/improv_method_cards.sample.json`
- `mock_data/improv_practice_records.sample.json`

5. 导入私有集合前，先把 `ownerOpenId` 替换为真实值：

- `improv_user_material_states`
- `improv_inspirations`
- `improv_rehearsals`
- `improv_practice_records`
- `improv_method_cards`

6. 导入完成后，在小程序中验证：

- `material.list`
- `inspiration.list`
- `rehearsal.list`
- `practiceRecord.list`
- `methodCard.list`

当前开发阶段补充说明：

- 前端暂不启用 `store` 本地持久化缓存，只保留当前会话内存态。
- 云端接口成功返回空数组时，前端应按空态处理，不回退旧本地缓存数据。
- 云端接口失败时，前端才进入错误态；如当前会话内存在 `pending` 记录，可继续展示这些记录。
- 文档里的“本地记录”统一指当前会话内存态，不等同于持久化历史缓存。
- 如果之前运行过旧版本，而页面仍显示历史数据，请先在微信开发者工具中清除 Storage / 清缓存 / 编译缓存，再重新打开小程序验证空态。

## 8. 权限

MVP 阶段建议所有业务读写都走 `improv-api` 云函数。

私有数据必须由云函数通过 `cloud.getWXContext()` 写入 `ownerOpenId`，前端不传、不信任 `ownerOpenId`。

用户私有数据查询必须带：

- `ownerOpenId`
- `deletedAt: null`

删除优先软删除，使用 `deletedAt` 标记。
