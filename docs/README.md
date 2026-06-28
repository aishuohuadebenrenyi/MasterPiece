# 即兴工具箱文档索引

更新时间：2026-06-26

`docs/` 是即兴工具箱当前产品的正式文档目录。后续产品、交互、架构、数据和路线信息都应优先沉淀到这里，避免根目录和历史过程文档形成多份事实源。

## 1. 正式文档

| 文档 | 用途 |
| --- | --- |
| [product.md](product.md) | 产品文档 / PRD，说明产品定位、用户、问题、目标、核心能力、MVP 和后续范围。 |
| [product-design-and-experience.md](product-design-and-experience.md) | 产品设计与交互体验规范，涵盖信息架构、页面详细设计、全局体验规范及页面状态策略。 |
| [architecture.md](architecture.md) | 技术架构，说明微信小程序、Skyline、CloudBase、状态层、组件层和工程约束。 |
| [data-architecture.md](data-architecture.md) | 数据架构与接口说明，说明按用户链路的数据流转、集合、数据对象、云函数 action 及权限规则。 |
| [material-inventory.md](material-inventory.md) | 素材报告与预置数据清单，说明当前完整素材来源、类型分布、标签能力场景维度、导入字段和完整素材索引。 |
| [ui-architecture-audit.md](ui-architecture-audit.md) | 架构与 UI 交互体系分析报告，盘点技术分层、组件复用、卡片体系、视觉风格、交互差异和整改优先级。 |
| [copy-audit.md](copy-audit.md) | 全产品提示文案审查清单，逐页记录精简建议、推荐文案、优先级及帮助与隐私页面的减法原则。 |
| [roadmap.md](roadmap.md) | 产品路线与优先级，说明 P0/P1/P2/P3、MVP 发布差距和可后置能力。 |
| [release-runbook.md](release-runbook.md) | 发布运行手册，记录 AppID/envId、云函数资源、安全规则、核心链路、隐私审核、依赖审计和真机截图验收要求。 |
| [versioning.md](versioning.md) | 1.0.0 正式上线后的版本治理规则，说明补丁版本、次版本、大版本、发布后契约和问题流转。 |
| [project-context.md](project-context.md) | 项目上下文沉淀，汇总历史会话中确认的文档边界、实现事实、配置注意事项和协作守则。 |
| [research-improv-landscape.md](research-improv-landscape.md) | 即兴领域全球素材分析，覆盖即兴艺术形态的流派谱系、训练体系、机构节庆与经典著作。 |
| [brand-guidelines.md](brand-guidelines.md) | Zentro｜即兴一下品牌视觉规范，包含品牌色、Logo、字体、双主题 token、对比度和应用边界。 |
| [changelog.md](changelog.md) | 文档和产品事实变更记录。 |

## 2. 工程文档

工程与发布辅助文档保留在 `release-support/wechat-cloudbase-app/`：

- [release-support/wechat-cloudbase-app/README.md](../release-support/wechat-cloudbase-app/README.md)：小程序工程打开方式、配置、脚本和开发约定。
- [release-support/wechat-cloudbase-app/database.md](../release-support/wechat-cloudbase-app/database.md)：CloudBase 数据库和 action 事实源。

当 `docs/data-architecture.md` 与 `release-support/wechat-cloudbase-app/database.md` 出现差异时，以 `release-support/wechat-cloudbase-app/database.md` 为文档事实源、以云函数代码为运行事实源，并同步修订 `docs/data-architecture.md`。

## 3. 分析报告与原型

- `docs/reports/`：存放工具生成的各类分析报告（如架构映射、素材角色清单、分类体系分析等）。
- [reports/pre-launch-audit-2026-06-25.md](reports/pre-launch-audit-2026-06-25.md)：上线前最终核查报告，覆盖架构、组件、数据链路、用户体验、风险分级和发布门禁。
- [reports/visual-design-audit-2026-06-24/README.md](reports/visual-design-audit-2026-06-24/README.md)：品牌一致性、全页面/组件、双主题、运行态证据限制与整改优先级审计。
- `release-support/prototypes/legacy/prototype_complete/`：当前产品原型参考。
- `release-support/prototypes/legacy/prototype_original/`、`release-support/prototypes/legacy/prototype_v2/`：早期原型参考。

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
- 产品设计、信息架构或交互体验变化时，优先更新 `product-design-and-experience.md`。
- 技术栈、目录、状态层、组件策略变化时，优先更新 `architecture.md`。
- 数据集合、字段、云函数 action 变化时，先更新 `release-support/wechat-cloudbase-app/database.md`，再同步 `data-architecture.md`。
- 历史会话中形成的稳定项目约定、排障经验和协作守则，沉淀到 `project-context.md`。
- 跨工具共享的协作规则、长期决策和任务状态，优先维护在 `project_memory/` 入口目录内。
- 跨 AI 工具需要共享的协作记忆快照，运行 `project_memory/` 同步脚本刷新。
- 每次较大的文档整理或产品事实变化，记录到 `changelog.md`。
