# mock_data 导入说明

更新时间：2026-06-19

`mock_data/` 存放可手动导入 CloudBase 的演示数据，不参与小程序构建，也不参与云函数部署。当前项目采用重建策略，素材体系以 `Material` 为上位对象，不兼容旧 `Game` 集合数据。

## 1. 文件与集合对应关系

| 文件 | 对应集合 | 说明 |
| --- | --- | --- |
| `improv_materials.json` | `improv_materials` | 完整公共素材库，标准 JSON 数组格式，共 163 条。 |
| `improv_materials.import.json` | `improv_materials` | 完整公共素材库，JSON Lines 内容 + `.json` 后缀，共 163 条；微信开发者工具导入窗口优先使用这个文件。 |
| `improv_user_material_states.sample.json` | `improv_user_material_states` | 用户对素材的收藏、练过、最近使用状态样例。 |
| `improv_user_material_states.sample.import.json` | `improv_user_material_states` | 用户素材状态样例，JSON Lines 内容 + `.json` 后缀。 |
| `improv_inspirations.sample.json` | `improv_inspirations` | 灵感记录样例。 |
| `improv_inspirations.sample.import.json` | `improv_inspirations` | 灵感记录样例，JSON Lines 内容 + `.json` 后缀。 |
| `improv_rehearsals.sample.json` | `improv_rehearsals` | 排练记录样例，排练计划使用 `materialId`。 |
| `improv_rehearsals.sample.import.json` | `improv_rehearsals` | 排练记录样例，JSON Lines 内容 + `.json` 后缀。 |
| `improv_method_cards.sample.json` | `improv_method_cards` | 方法卡样例。 |
| `improv_method_cards.sample.import.json` | `improv_method_cards` | 方法卡样例，JSON Lines 内容 + `.json` 后缀。 |
| `improv_practice_records.sample.json` | `improv_practice_records` | 单次素材练习复盘样例。 |
| `improv_practice_records.sample.import.json` | `improv_practice_records` | 单次素材练习复盘样例，JSON Lines 内容 + `.json` 后缀。 |
| *(无对应文件)* | `improv_profiles` | 用户资料集合，在小程序中编辑个人资料时自动创建。 |

## 2. 建议导入顺序

1. `improv_materials.import.json`
2. `improv_user_material_states.sample.import.json`
3. `improv_inspirations.sample.import.json`
4. `improv_rehearsals.sample.import.json`
5. `improv_method_cards.sample.import.json`
6. `improv_practice_records.sample.import.json`

第 1 步先导入公共素材库，保证发现页搜索、分类、抽卡和详情链路可用。微信开发者工具的数据库导入窗口通常只允许选择 `.json` 文件，但导入任务可能要求 JSON Lines 内容；因此优先使用 `*.import.json`。这些文件后缀是 `.json`，内容是一行一条记录。第 2 步以后是私有数据样例，适合演示收藏、练过、灵感、排练、方法卡和练习复盘。

## 3. 导入前准备

在 CloudBase 中确认已创建这些集合：

- `improv_materials`
- `improv_user_material_states`
- `improv_inspirations`
- `improv_rehearsals`
- `improv_method_cards`
- `improv_practice_records`
- `improv_profiles`

同时确认已上传并部署云函数 `improv-api`。

## 4. ownerOpenId 替换规则

以下 5 个文件导入前，必须先把占位值 `__REPLACE_WITH_OPENID__` 替换成真实 `ownerOpenId`：

- `improv_user_material_states.sample.json` 或 `improv_user_material_states.sample.import.json`
- `improv_inspirations.sample.json` 或 `improv_inspirations.sample.import.json`
- `improv_rehearsals.sample.json` 或 `improv_rehearsals.sample.import.json`
- `improv_method_cards.sample.json` 或 `improv_method_cards.sample.import.json`
- `improv_practice_records.sample.json` 或 `improv_practice_records.sample.import.json`

`improv_materials.json` 和 `improv_materials.import.json` 不需要替换，文件里默认使用 `ownerOpenId: "system"` 表示系统公共素材库。

## 5. 如何拿到真实 ownerOpenId

1. 启动小程序并正常登录。
2. 去“发现”页点开一张素材，点击收藏。
3. 打开 CloudBase 控制台，找到 `improv_user_material_states`。
4. 展开刚新增的记录，复制 `ownerOpenId`。
5. 批量替换 `mock_data/*.sample.json` 里的 `__REPLACE_WITH_OPENID__`。

不要手写或猜测 `ownerOpenId`，否则导入后小程序无法识别这些私有数据属于当前用户。

## 6. 导入后验证

- 素材发现：验证 `discover` 和详情页是否能读到 `improv_materials`。
- 收藏/练过：验证 `improv_user_material_states` 状态是否合并到素材卡。
- 灵感记录：验证 `record`、`mine` 是否能看到 `improv_inspirations`。
- 排练记录：验证 `record`、`rehearsal-record`、`team-records` 是否能看到 `improv_rehearsals`。
- 方法卡：验证 `mine` 是否能看到 `improv_method_cards`。
- 练习复盘：验证素材练习结束后可新增 `improv_practice_records`。

## 7. 空数据说明

当前代码不再内置业务 mock 数据：

- 集合为空时，页面进入空态。
- 接口失败时，页面进入错误态；当前会话内的 `pending` 记录仍可显示。
- 只导入 `improv_materials.import.json` 或 `improv_materials.json` 时，发现页主链路可用，但“我的/记录”里的私有资产可能为空。
- 当前功能开发阶段不启用 store 本地持久化缓存，只保留当前会话内存态。
- 如果页面仍显示旧数据，请先在微信开发者工具中清除 Storage、清缓存、编译缓存，再重新打开小程序。

## 8. 相关文档

- `docs/data-inventory.md`
- `docs/data-api.md`
- `wechat-cloudbase-app/database.md`
