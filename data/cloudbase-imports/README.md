# CloudBase 演示数据

本目录只提供可公开的最小演示数据，不包含生产数据或完整内容库。

| 文件 | 集合 | 说明 |
| --- | --- | --- |
| `improv_materials.sample.json` | `improv_materials` | 8 条人工编写的素材，标准 JSON 数组 |
| `improv_materials.sample.import.json` | `improv_materials` | 同一组素材，JSON Lines 导入格式 |
| `improv_*sample.json` | 对应私有集合 | 使用占位 ownerOpenId 的单条示例 |
| `improv_*sample.import.json` | 对应私有集合 | JSON Lines 导入格式 |

导入私有集合样例前，将 `__REPLACE_WITH_OPENID__` 替换成测试账号的 OpenID。替换后的文件包含环境身份信息，不得提交。

建议先导入 `improv_materials.sample.import.json`，再按需导入其他样例。字段与权限以 [`../../apps/wechat-cloudbase/docs/database.md`](../../apps/wechat-cloudbase/docs/database.md) 为准。

示例数据仅用于开发和测试，不属于 MIT 授权范围，也不代表完整内容库。
