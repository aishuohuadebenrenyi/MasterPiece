# 项目上下文沉淀

更新时间：2026-06-21

本文档沉淀历史会话中已经确认、并且对后续协作有长期价值的信息。它不替代 PRD、技术架构或数据接口文档，而是作为跨文档的项目备忘：以后修改产品、代码、数据或文档时，先看这里确认边界和事实源。

## 1. 文档事实源

正式产品文档统一维护在 `docs/`。

- 产品范围、用户、核心链路：以 [product.md](product.md) 为准。
- 页面级显示规则、状态策略、空态和错误态：以 [product-detailed-design.md](product-detailed-design.md) 为准。
- 页面结构、跳转和弹层边界：以 [information-architecture.md](information-architecture.md) 为准。
- 技术栈、目录分层、状态层和组件策略：以 [architecture.md](architecture.md) 为准。
- 数据对象、集合、action 和权限规则：以 [data-api.md](data-api.md) 和 [../wechat-cloudbase-app/database.md](../wechat-cloudbase-app/database.md) 为准。
- 数据链路、入库范围、mock 迁移方案：以 [data-inventory.md](data-inventory.md) 为准。

工程文档保留在 `wechat-cloudbase-app/`，用于打开项目、配置云开发、运行脚本和说明数据库初始化。若 `docs/` 与 `wechat-cloudbase-app/database.md` 在集合或 action 上冲突，先以 `database.md` 和云函数代码为准，再同步修正文档。

## 2. 历史会话确认过的文档规则

- **开发期不向下兼容旧数据**：明确项目在开发阶段，不编写兜底兼容旧错误数据或废弃字段的代码。遇到不兼容的旧脏数据（如缺失关键字段），直接通知开发者在控制台手动清理。
- `docs/` 是正式文档目录，根目录不再保留重复的产品/架构事实源。
- `.trae/documents/` 保留为过程归档，不移动、不删除、不改写。
- `.trae/documents/` 中的历史计划、差异报告和整改清单只供追溯；只有沉淀进 `docs/` 或工程文档后，才成为当前约定。
- 每次较大的文档整理、产品事实变化或实现策略变化，应同步更新 [changelog.md](changelog.md)。
- 更新文档前要先对照当前代码，尤其是 `frontend/app.json`、`backend/cloudfunctions/improv-api/index.js` 和 `wechat-cloudbase-app/database.md`。

## 3. 当前实现事实

当前工程是 `wechat-cloudbase-app/`，产品形态是微信小程序原生应用。

已确认的实现基线：

- 主 Tab：发现、记录、我的。
- 已声明页面：发现、记录、我的、素材详情、灵感记录、素材练习复盘、排练记录、排练复盘、团队排练记录、练习记录、设置、使用帮助、隐私政策，共 13 个页面。
- 渲染与组件：Skyline + Glass-Easel。
- 前端分层：页面层、组件层、服务层、轻量 store、类型层。
- 后端模式：腾讯云 CloudBase 聚合云函数，不是独立 HTTP 服务。
- 统一云函数：`improv-api`。
- 统一前端调用封装：`frontend/services/cloud.ts`。
- 业务集合前缀：`improv_`。
- 云存储路径前缀：`improv/`。

## 4. 云开发和本地配置注意事项

仓库中的云开发配置默认保留占位符，避免提交个人 AppID 或环境 ID。

本地运行或上传云函数前需要确认：

- `wechat-cloudbase-app/project.config.json` 中的 `appid` 保持占位值 `your-appid`，本地调试时再替换为真实微信小程序 AppID。
- `wechat-cloudbase-app/frontend/config/env.js` 中的 `DEFAULT_PROD_ENV_ID` 已替换为真实 CloudBase 环境 ID。
- 开发环境 `develop.envId` 不应长期为空；本地调试时建议指向可用的开发 CloudBase 环境。
- 微信开发者工具顶部或云开发面板中已经选中一个云环境。
- 上传云函数时，在 `backend/cloudfunctions/improv-api` 上执行“上传并部署：云端安装依赖”。

常见现象和含义：

- 如果上传提示“请在编辑器云函数根目录 cloudfunctionRoot 选择一个云环境”，通常是 AppID 或云环境没有绑定成功，而不是 `cloudfunctionRoot` 路径写错。
- 如果前端 `wx.cloud.callFunction` 返回“没有权限，请先开通云开发或者云托管”，优先检查 AppID、CloudBase 环境 ID、开发者权限和当前工具选中的云环境。
- 当前 `cloudfunctionRoot` 应保持为 `backend/cloudfunctions/`，云函数目录应保持为 `backend/cloudfunctions/improv-api`。

## 5. 数据与 mock 策略

当前阶段已经将业务 mock 从小程序核心代码中抽离，导入数据放在仓库根目录 `mock_data/`。

稳定规则：

- 云函数代码内不再维护 seed 游戏数组。
- 旧游戏 seed action 不再作为当前入口；素材初始化改为手动导入 `mock_data/improv_materials.json`。
- 私有集合示例数据使用 `sample` 后缀，导入前必须替换 `ownerOpenId`。
- MVP 阶段业务读写统一走 `improv-api`，前端不直接信任或传入 `ownerOpenId`。
- 用户私有数据由云函数通过 `cloud.getWXContext()` 写入 `ownerOpenId`。

## 6. 当前状态策略

当前功能开发和页面交互开发阶段，不启用本地持久化缓存作为事实源。

页面展示优先级：

1. 云端成功结果。
2. 空态。
3. 错误态。

重要边界：

- 云端成功返回空数组时，页面进入空态。
- 云端请求失败时，页面进入错误态。
- 云端写入失败时保留当前表单草稿，不将未入库记录写入历史 Store，也不显示“待同步”。
- 不再用旧本地缓存或业务示例数据伪装真实数据。
- 如果之前跑过旧版本，验证空态前需要清除微信开发者工具 Storage、清缓存和编译缓存。

## 7. 产品与交互沉淀

当前产品定位是“找素材 + 快记录 + 可沉淀”，不是单纯游戏百科。

已经收敛的关键交互结论：

- 首次无素材库时，发现页聚焦一个“添加素材 / 马上开玩”的大卡片，不保留完整筛选和抽卡骨架。
- 有素材库但筛选无结果时，说明条件过窄，并提供清空或放宽筛选动作。
- 顶部 chips 是快捷筛选，不承载完整筛选逻辑。
- “最近排练”等没有真实数据支撑的伪条件，不应继续作为主筛选入口。
- 轻量操作用半弹窗，长表单、深读和排练过程进入子页面。
- 我的页首登策略采用轻登录，不做首次强制登录；没有个人数据时优先做价值引导。
- 当前 MVP 不提供 app 内置音频采集、转写、摘要或 AI 整理；记录页采用文本优先输入，口述输入交给系统输入法自带的语音转文字能力。
- “我的”页右上角提供设置入口；设置页统一承载静态使用帮助、应用内意见反馈、主题、隐私、版本和账号注销。反馈通过 `feedback.create` 写入 `improv_feedback`，首版由开发者在 CloudBase 控制台处理。

## 8. 后续协作守则

- 修改正式文档前，先确认是否已有对应事实源，避免新增重复文档。
- 修改数据、action 或云函数时，先改实现，再同步 `wechat-cloudbase-app/database.md` 和 `docs/data-api.md`。
- 修改页面结构时，同步 `docs/information-architecture.md`。
- 修改页面状态、空态、错误态或缓存策略时，同步 `docs/product-detailed-design.md`、`docs/architecture.md`、`docs/data-inventory.md` 和 `docs/experience-guidelines.md`。
- 不把 `.trae/documents/` 的历史方案直接当作当前实现依据；需要先验证、再沉淀。
