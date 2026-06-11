# 即兴工具箱文档索引

更新时间：2026-06-07

`docs/` 是即兴工具箱当前产品的正式文档目录。后续产品、交互、架构、数据和路线信息都应优先沉淀到这里，避免根目录和历史过程文档形成多份事实源。

## 1. 正式文档

| 文档 | 用途 |
| --- | --- |
| [product.md](product.md) | 产品文档 / PRD，说明产品定位、用户、问题、目标、核心能力、MVP 和后续范围。 |
| [product-detailed-design.md](product-detailed-design.md) | 产品详细设计，说明页面级显示规则、状态策略、空态/错误态逻辑和关键交互细节。 |
| [information-architecture.md](information-architecture.md) | 信息架构与页面链路，说明三 Tab、十页面、弹层、跳转和编辑/查看边界。 |
| [architecture.md](architecture.md) | 技术架构，说明微信小程序、Skyline、CloudBase、状态层、组件层和工程约束。 |
| [data-api.md](data-api.md) | 数据与接口文档，说明核心数据对象、数据库集合、云函数 action、权限和隔离规则。 |
| [data-inventory.md](data-inventory.md) | 数据总览与用户链路，说明按用户链路分类的数据、入库范围、本地状态映射和 mock 迁移方案。 |
| [experience-guidelines.md](experience-guidelines.md) | 体验与交互规范，说明临场记录、底部操作栏、弹层、保存确认和三态规范。 |
| [roadmap.md](roadmap.md) | 产品路线与优先级，说明 P0/P1/P2/P3、MVP 发布差距和可后置能力。 |
| [project-context.md](project-context.md) | 项目上下文沉淀，汇总历史会话中确认的文档边界、实现事实、配置注意事项和协作守则。 |
| [changelog.md](changelog.md) | 文档和产品事实变更记录。 |

## 2. 工程文档

工程内文档保留在 `wechat-cloudbase-app/`：

- [wechat-cloudbase-app/README.md](../wechat-cloudbase-app/README.md)：小程序工程打开方式、配置、脚本和开发约定。
- [wechat-cloudbase-app/database.md](../wechat-cloudbase-app/database.md)：CloudBase 数据库和 action 事实源。

当 `docs/data-api.md` 与 `wechat-cloudbase-app/database.md` 出现差异时，以工程内 `database.md` 为实现事实源，并同步修订 `docs/data-api.md`。

## 3. 原型与品牌素材

- `prototype_complete/`：当前产品原型参考。
- `prototype_original/`、`prototype_v2/`：早期原型参考。
- `logo/即兴现场_专业品牌包/品牌规范.txt`：品牌规范。
- `logo/即兴现场_专业品牌包/启动页规范.txt`：启动页规范。
- `logo/即兴现场_专业品牌包/AppStore截图文案模板.txt`：发布文案素材。

品牌素材文档保留原位置，不合并进产品 PRD。

## 4. 过程归档

`.trae/documents/` 是历史计划、差异报告、整改清单、回归结果和过程分析的归档目录，仅供追溯参考。

归档规则：

- 不移动、不删除、不改写 `.trae/documents/` 中的文件。
- 若 `.trae/documents/` 与 `docs/` 或 `wechat-cloudbase-app/` 工程文档冲突，以 `docs/` 和工程文档为准。
- 历史计划中的方案不自动代表当前产品事实，只有被沉淀进 `docs/` 后才作为正式约定。

## 5. 跨 AI 记忆快照

`project_memory/` 是面向其他 AI 软件和后续开发者的集中协作入口目录。开工前先读 `project_memory/README.md`；其中 `memory/`、`tasks/` 直接维护协作记忆与任务状态，`AGENTS.md`、`.codex/`、`docs/project-context.md` 和外部 Codex memory note 则通过同步脚本刷新为入口快照。

边界规则：

- `project_memory/` 不替代 `docs/` 或 `wechat-cloudbase-app/` 工程文档事实源。
- 更新协作入口、规则、`docs/project-context.md` 或 `project_memory/` 同步系统说明后，运行：

```bash
node project_memory/scripts/sync.js
node project_memory/scripts/check.js
```

## 6. 文档维护约定

- 产品范围变化时，优先更新 `product.md` 和 `roadmap.md`。
- 页面实现细节、页面状态策略、专题详细设计变化时，优先更新 `product-detailed-design.md`。
- 页面、弹层、跳转变化时，优先更新 `information-architecture.md`。
- 技术栈、目录、状态层、组件策略变化时，优先更新 `architecture.md`。
- 数据集合、字段、云函数 action 变化时，先更新 `wechat-cloudbase-app/database.md`，再同步 `data-api.md`。
- 体验规则和交互基础设施变化时，更新 `experience-guidelines.md`。
- 当前阶段状态策略、空态/错误态、缓存策略变化时，同时更新 `architecture.md`、`data-inventory.md`、`experience-guidelines.md` 和 `wechat-cloudbase-app/database.md`。
- 新用户 / 无数据状态页面显示和逻辑的讨论结论，先更新 `product-detailed-design.md`，再同步到相关总文档。
- 历史会话中形成的稳定项目约定、排障经验和协作守则，沉淀到 `project-context.md`。
- 跨工具共享的协作规则、长期决策和任务状态，优先维护在 `project_memory/` 入口目录内。
- 跨 AI 工具需要共享的协作记忆快照，运行 `project_memory/` 同步脚本刷新。
- 每次较大的文档整理或产品事实变化，记录到 `changelog.md`。
