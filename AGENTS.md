# ImprovTool_2 协作入口

本文件是人和 AI 进入本项目时的第一入口。开始任何开发、文档整理或审查前，先按本文确认事实源、规则和验证方式。

## 1. 必读顺序

任何讨论、规划、审查、文档整理或代码改动前，先读 `project_memory/README.md`。它是当前项目的跨工具协作入口，集中组织了必读规则、协作记忆、任务状态和关键沉淀。

1. `project_memory/README.md`：开工前阅读入口和最小必读集合。
2. `project_memory/docs/project-context.md`：正式项目上下文沉淀快照。
3. `project_memory/memory/project-context.md`：长期协作背景和边界。
4. `project_memory/memory/decisions.md`：已确认的重要决策。
5. `project_memory/tasks/in-progress.md`、`project_memory/tasks/todo.md`：当前任务状态。
6. `docs/README.md`：正式产品文档索引。
7. `docs/architecture.md`：当前技术架构和约束。
8. `wechat-cloudbase-app/README.md`：小程序工程入口、脚本和开发约定。
9. `wechat-cloudbase-app/database.md`：CloudBase 集合和 action 事实源。

## 2. 事实源边界

- `docs/` 是正式产品、交互、架构、数据和路线文档的唯一正式入口。
- `wechat-cloudbase-app/README.md` 是工程入口。
- `wechat-cloudbase-app/database.md` 是数据库集合和云函数 action 的工程事实源。
- `.trae/documents/` 只作为历史过程归档，不移动、不删除、不改写。
- `project_memory/memory/` 只记录协作记忆，不替代正式文档。
- `.codex/` 只保存 AI/人类协作规则、提示词、模板和命令片段。
- `project_memory/tasks/` 只记录任务流转，不替代 Git 历史或 `docs/changelog.md`。

## 3. 开发前核对

改代码前必须先核对：

- 页面和导航：`wechat-cloudbase-app/frontend/app.json`
- 云函数 action：`wechat-cloudbase-app/backend/cloudfunctions/improv-api/index.js`
- 前端服务层：`wechat-cloudbase-app/frontend/services/*`
- 状态层：`wechat-cloudbase-app/frontend/store/index.ts`
- 领域类型：`wechat-cloudbase-app/frontend/types/domain.ts`

所有后续变更都必须先完成上面的 `project_memory/` 必读集阅读，再开始讨论或实现。讨论中确认的新规则、产品结论、架构决策、数据约定和经验复盘，必须在本次任务内同步更新到对应文档，不能只停留在聊天记录中。

当前架构默认保持：

- 微信小程序原生页面/组件体系。
- Skyline 渲染。
- Glass-Easel 组件框架。
- CloudBase 聚合云函数 `improv-api`。
- `improv_` 前缀数据库集合。
- 轻量内存 store，当前阶段不把本地缓存作为事实源。

## 4. 输出规范

- 代码输出遵守 `.codex/rules/coding-style.md`。
- 架构和数据变更遵守 `.codex/rules/architecture-constraints.md`。
- 文档更新遵守 `.codex/rules/documentation.md`。
- 安全检查遵守 `.codex/rules/security.md`。
- 开发任务可使用 `.codex/prompts/` 中的提示词。
- 计划、总结、决策记录可使用 `.codex/templates/`。
- 每次变更结束前，说明已同步更新哪些项目文档；若没有文档需要更新，也要说明原因。
- 更新 `AGENTS.md`、`.codex/`、`project_memory/memory/`、`project_memory/tasks/` 或 `docs/project-context.md` 后，运行 `node project_memory/scripts/sync.js` 和 `node project_memory/scripts/check.js`，刷新跨 AI 工具入口与受管快照。

## 5. 验证方式

在 `wechat-cloudbase-app/` 下优先运行：

```bash
npm run syntax-check
npm run typecheck
```

文档或协作体系变更至少检查：

- 新增文件结构是否清晰。
- 是否和 `docs/`、`.trae/` 形成重复事实源。
- `project_memory/` 快照是否已同步且 `node project_memory/scripts/check.js` 通过。
- 是否包含真实 AppID、envId、Apple ID、密钥或账号隐私。
- 是否误改业务代码或历史归档。

## 6. Git 约定

- 开始前查看 `git status --short`。
- 不回滚他人或既有改动。
- 提交前只暂存本次任务相关文件。
- 文档类提交也要检查私密信息。
