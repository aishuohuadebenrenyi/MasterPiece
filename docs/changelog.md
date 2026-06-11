# 变更记录

## 2026-06-11

- 清理仓库中的敏感配置：将 `wechat-cloudbase-app/project.config.json` 中的真实小程序 `appid` 改回占位值 `your-appid`，并在 `.gitignore` 中补充 `.env`、证书和私钥类文件的忽略规则，降低后续误提交风险。
- 完成最终一轮 UI/UX 冲刺收口：新增 `filter-section` 与 `selection-card` 两个中层组件，统一 `discover` 的筛选分组与全部剩余空态、`record` 的快速开启排练 chips 与开始游戏/今日记录列表卡、`rehearsal-record` 的候选游戏与计划调整卡、`inspiration-edit` 的整理方式 chips 与关联选择卡；同时把语音复用边界正式定为“字段级复用，不强并页面级语音弹层”，并同步到架构与详细设计文档。
- 完成中层 UI 组件化收口：新增并接入 `search-bar`、`empty-state-panel`、`record-card`、`record-detail-panel`、`asset-detail-panel`、`voice-field`、`game-form`、`subpage-header`，统一 `discover` / `record` / `rehearsal-record` 的搜索与新增表单结构、`game-records` / `team-records` / `mine` 的列表与详情结构，以及 `game-feedback` / `inspiration-edit` / `rehearsal-review` 的子页面页头；同时将主题模式正式收口为本地 UI 偏好并持久化到本机，整轮改动已通过 `npm run syntax-check`、`npm run typecheck` 和诊断检查。
- 继续收口 `record`、`mine`、`discover` 的全局语义：把 `sync-pill` 提升到 `app.wxss`，`record` 的快速开始 Meta 和今日记录空态切到全局 `meta-row` / `meta-pill` / `empty-state-card`，`mine` 的列表空态与列表/详情 Meta 也改用同一套语义类，`discover` 顶部加载错误提示切到全局 `notice-note-card`，并通过语法与类型校验。
- 继续推进全局语义层收口：`rehearsal-record`、`game-feedback`、`inspiration-edit` 三页开始切换到全局 `meta-row` / `meta-pill` / `empty-state-card` 语义类，减少页面内重复的 Meta 标签和空态卡样式定义，并保持语法检查与类型检查通过。
- 启动全局语义层的第一轮收口：在 `app.wxss` 新增了 `meta-row`、`meta-pill`、`state-note-card`、`notice-note-card`、`empty-state-card` 等全局语义类，并先在 `game-records`、`team-records` 两个历史回看页替换掉重复的页面级标题 / Meta / 提示 / 空态样式，验证“先全局类、后页面复用”的路径可行且未引入语法或类型问题。
- 继续收口“我的”和“记录”的两个边界：`mine` 页“已不再整理”现在会以本地 UI 偏好形式记住，重开小程序后不会立刻把同一条待整理项重新放回首页；`record` 页“快速开始游戏”弹层也拆分为“还没有游戏库”和“搜索无匹配”两套空态文案，不再只剩一条笼统的“未找到匹配的游戏”。
- 修复发现页自定义分类输入的 Skyline 中文输入风险：添加游戏弹层中的自定义分类不再用 `bindinput` 实时回写，而是改为在 `bindblur` / `bindconfirm` 时更新输入值和分类建议，避免拼音组合态被 `setData` 打断，同时保留“失焦看建议”和“回车直接添加分类”两条路径。
- 修正记录页与我的页的两条状态链路：记录页的“今日推荐”改为优先使用 `today.summary` 返回的 `recommendGameId`，不再始终回退成 `games[0]`；我的页“已不再整理”的待整理条目也会写入当前会话共享 store，离开页面再回来时不会立刻复活。
- 收紧发现与记录页的两个真实行为边界：发现页从条件抽卡/筛选弹层进入“添加游戏”时，改为先关闭已有弹层再打开新增弹层，避免多层半弹窗叠开；收藏按钮在云端同步失败时也会回滚本地状态并给出提示，不再出现“UI 已收藏、实际未保存”的假成功。
- 修复记录页的两处状态误导：当“随机 3 个收藏”实际上没有任何收藏游戏时，弹层会直接给出行内说明并禁用“开始排练”，不再创建 `0 个游戏` 的伪计划；语音速记存为灵感后也会清空草稿，避免后续进入灵感页或反馈页时误带上旧摘要。
- 收口多页首帧主题同步：为发现、记录、灵感编辑、排练记录、排练复盘、游戏记录、团队排练记录和我的页补齐 `onLoad` 阶段的 `themeClass` 初始化，并将我的页首屏主题同步提前到主数据回填前，避免首次进入或切回页面时先闪出默认主题、再跳到当前主题。
- 修复记录页与游戏反馈页的两个状态同步问题：记录页把误写的未声明字段 `activeRehearsalName` 收回到已声明的 `activeContextName`，避免语音速记上下文状态漂移；游戏反馈页也补齐了 `themeClass` 同步，进入反馈页和再次显示时都能跟随当前主题。
- 修复发现页与游戏详情页的两个状态边界：关闭“添加游戏”弹层时，会正确收起“补充玩法与提示”扩展区并恢复默认按钮文案；游戏详情页也补齐了 `themeClass` 同步，进入详情和从“我的”切换主题后都能正确继承当前主题外观。
- 修复排练复盘页“保存为方法卡”的失败兜底：云端创建方法卡失败时，不再直接中断，而是和灵感页、游戏反馈页一致，先落本地 `pending` 方法卡并提示“待同步”，避免用户刚写完的带领提醒丢失。
- 修复我的页“待整理”即时回填问题：在待整理详情中执行“不再整理”或“沉淀为方法卡”后，我的页底层的待整理卡、方法卡卡片、轻引导卡和统计数据会立刻按最新状态重算，不再需要先离开页面再返回才能刷新。
- 修复排练记录页“添加到排练”弹层的假成功反馈：列表不再重复展示已在当前计划中的游戏；当可加入项为空时，直接说明原因并引导去发现页补充游戏库；重复点选时也改为准确提示，而不是继续显示“已加入排练”。
- 修复历史回看页的样式串改：`game-records`、`team-records` 的标题强调样式重新收口到 `.section-title`，避免误把整张记录卡片继承为粗体；同时让排练记录页和游戏记录页一致，仅在确有历史记录时显示概览卡，空态下直接给出说明和回到主链路的动作。
- 修正发现链路的 UI 语义细节：发现页“添加游戏”半弹窗移除未实际使用的 `sheet-actions` 语义，避免空底栏残留；同时将游戏卡片和详情页中的收藏爱心颜色收口到 `theme.wxss` 的 `favorite` token，保证主题切换时收藏态也受全局配色接管。
- 收紧全局 UI 基线边界：`form-card`、`form-field` 基础组件补齐主题 token 导入，确保组件样式隔离下仍正确继承主题；同时收口 `app.wxss` 中过具体的结构辅助类，明确 `save-actions` 这类页面内联操作组不再和 fixed 底栏共用同一套全局按钮拉伸语义。
- 收口游戏字段事实源：以发现页“添加游戏”表单的显式输入字段为准，移除游戏卡片与详情页中无创建来源的展示内容，不再派生 `lead`、`fit`、`avoid`、`verdict` 等旧字段展示，并同步清理创建/更新逻辑、mock 数据与数据文档口径。

## 2026-06-08

- 收口“减法展示”规则：记录页、我的页、灵感编辑页和排练记录页统一采用“有数据才显示正式卡片，无数据不强行占位”的页面策略，并将相关约定正式沉淀到 `product-detailed-design.md` 与 `experience-guidelines.md`。
- 调整记录页首屏信息密度：`今天已记录` 仅在今日确有内容时显示；`今日推荐` 保留“无游戏时提醒先记录灵感”的轻引导逻辑，同时为今日记录弹层补齐页面内空态说明。
- 收紧我的页资产展示：非全空场景下隐藏零数据资产卡，仅保留已有资产和高价值下一步动作，并新增轻引导卡承接继续记录。
- 修复灵感编辑页与排练记录页的空白容器问题：无可关联对象、无计划游戏、搜索无结果时统一展示空态说明和下一步动作，不再只剩空白列表。
- 统一回看页空态：`game-records` 与 `team-records` 在空数据时不再保留 `0 条` 摘要卡，改为直接展示空态说明和返回主链路动作；有记录时再恢复摘要卡。
- 收口排练/游戏互斥规则：进行中和暂停中的任务都视为活跃上下文，统一由 `store/index.ts` 拦截，禁止再次开启新游戏或新排练。
- 调整记录页“快速开启排练”交互：保留固定目标模板，并新增自定义目标输入；目标按钮文案统一保持单行，目标较多时改为横向滚动。
- 修正排练复盘数据链路：排练复盘只回写 `rehearsal` 记录本身，不再额外写入 `gameRecord` 集合。
- 修正发现页状态语义：补齐云端同步失败的友好提示，区分“无游戏库”“当前条件无匹配”“同步失败”三种状态，并禁止抽卡在无匹配时偷偷回退到全量结果。
- 收口历史排练边界：游戏反馈页移除“追加到历史排练”入口，历史排练继续保持只读，后续归档统一走“我的 -> 待整理”。
- 完善当前会话 `pending` 保护：灵感保存、方法卡沉淀、排练/游戏记录回看在云端失败时统一回落到当前会话内存态，并将提示文案从“本地记录”改为更准确的“本次会话记录”。
- 清理旧字段与文档歧义：移除正式代码/文档中的 `Game.verdict`、`Game.avoid`、`category` 旧口径，补齐 `improv_profiles`、`Profile.troupeName`、`today.summary` 和 `GameRecord` 字段命名说明。
- 统一底部固定操作栏样式：表单页底部按钮改为居中操作组，避免按钮被强行拉满整行；按钮文案统一不换行。
- 修复排练记录页主题读取报错：补齐 `rehearsal-record/index.js` 中缺失的 `getThemeClass` 引入。
- 收口前端主题配置体系：在 `frontend/styles/theme.wxss` 中引入 `theme-vivid`（沉浸主题）高对比度覆盖块，并为我的页（资料编辑弹窗内）提供一键主题切换开关。
- 修复“我的”页面个人卡片头部按钮重叠问题：移除右上角强塞的动作容器，恢复原有布局与 `flex: 1 1 0` 结构。
- 重构页面与组件级主题变量继承：所有页面根节点与底部 TabBar 统一绑定 `themeClass`，依赖 CSS 变量级联特性接管全局背景、卡片、浮层、按钮、输入框及轻提示（toast）样式。
- 修复半弹窗和 `root-portal` 组件在切换主题时的白底/割裂问题：对 `bottom-sheet`、`floating-card` 组件和轻提示注入主题状态订阅（store subscribe）和变量透传。

## 2026-06-07

- 发现页主链路调整为“进详情后开始游戏”，移除发现页和抽卡弹层直接进入游戏实践反馈的入口。
- 记录页快速开始游戏弹层改为搜索框、默认可见列表和确认按钮结构，提升小屏设备可用性。
- 我的页新增“待整理”聚合入口，可从灵感、游戏实践和排练复盘手动沉淀方法卡。
- 待整理详情支持“不再整理”当前条目，并保留原始灵感、游戏实践或排练记录。
- 将卡片中的 pending 状态展示文案从“待同步”改为“本地暂存”，避免和“待整理”混淆。
- 个人沉淀列表新增来源筛选，支持按灵感、游戏实践和排练复盘查看方法卡。
- 删除未引用的旧 `frontend/services/local-state.js`，当前阶段状态来源收敛到云端结果和 `store/index.ts`。
- 同步页面矩阵为 10 个页面，补充 `pages/game-records/index`。

## 2026-06-06

- 抽取小程序配色体系：扩展 `frontend/styles/theme.wxss` 的 `--improv-*` 主题 token，替换页面、组件、TabBar 和全局样式中的散落硬编码色值，并预留 `.theme-alt` 覆盖块用于后续主题切换。
- 优化短内容半弹窗（如“语音速记”）的高度显示：为 `record/index.wxml` 中的“语音速记”半弹窗增加 `bodyMode="fit"` 属性，使其高度根据内部实际内容自适应，不再显示大面积的底部留白；同时在通用 `.sheet-scroll-static` 样式中补充了 `overflow-y: auto`，确保即便内容超出也能正常滑动。
- 修复未配置云开发环境（Env Not Exists）导致保存个人资料失败的问题：为 `profile.update` 和头像上传增加了优雅降级（Graceful Degradation）逻辑。当无法连接到云环境时，头像图片将使用本地临时路径，资料数据会同步保存至本地 `store` 中，确保在离线体验或纯本地开发模式下 UI 交互的完整性和流畅性。
- 修复选择相册图片返回后底部栏异常出现的 Bug：通过在 `syncTabBar` 中增加对页面 `modalOpen` 状态的判断，确保从小程序原生相册/相机（会触发 `onShow`）返回时，如果底层弹窗仍在开启状态，则继续保持自定义底部栏隐藏，防止 UI 层叠穿透。
- 修复弹窗打开时自定义底部栏不隐藏的 Bug：调整了 `utils/modal.js` 中的时序，将隐藏底部栏的动作从 `setData` 异步回调中移至同步执行，并在 `utils/tabbar.js` 中捕获了旧版基础库可能抛出的 `wx.hideTabBar` 异常；同时在 CSS 中对自定义底部栏添加了 `display: none !important` 的强力约束，确保在 Skyline 下弹窗开启时，底部导航栏被彻底隐藏。
- 修复中文输入法被强制中断的问题：将资料编辑弹窗中名字输入框的 `bindinput` 事件改为 `bindblur` 和 `bindconfirm`，并增加 `type="nickname"` 属性。此改动不仅防止了 Skyline 引擎在每次拼音击键时强行更新输入框（导致无法输入中文），还原生支持了“微信昵称一键填入”的优雅交互。
- 精简并重构编辑资料半弹窗：移除冗余的标题、说明文字和独立的上传按钮；将头像居中并添加“点击更换头像”轻量提示，实现更简约优雅的交互体验。
- 修复编辑按钮变形问题：将个人卡片头部的 `编辑` 按钮从 `button` 标签改为 `view` 标签，避免微信默认按钮样式干扰，使其恢复正常的圆角胶囊形态。
- 优化底部安全距离：增加了资料编辑半弹窗的 `padding-bottom`，使底部的 `保存` 按钮不再紧贴屏幕下边缘。
- 修复我的页个人卡片头部在 Skyline 下的渲染灾难：废弃导致文字竖排的 Grid 布局，恢复为稳定的 Flex 布局；通过绝对定位将编辑按钮脱离文档流放置于右上角，并修复了标签在空间不足时过度挤压的问题。
- 从整体上重构我的页个人资料编辑区：个人卡片头部改为 `头像 + 标题信息 + 编辑按钮` 三列结构，编辑按钮不再挤占标题流；资料弹窗头像区改为 `头像预览 + 说明 + 上传按钮` 的专用编辑区，避免继续被通用按钮样式带偏。
- 收口我的页个人资料编辑样式边界：`编辑` 按钮改为真正的右上角角标操作，不再依赖标题区让位；`上传头像` 按钮从全局 `small-btn` 体系中剥离，改为资料弹窗专属局部按钮。
- 修复我的页个人资料编辑链路：`编辑` 按钮收口为右上角小操作钮，并修正 `bottom-sheet` 的资料弹窗承载模式，避免 `scroll-view` 高度塌缩导致“只显示标题、正文看不到”。
- 为我的页顶部个人卡片增加编辑入口，支持修改名字和上传头像；新增 `profile.get` / `profile.update` 资料链路，并将个人标签收敛为 `即兴主理人`、`个人空间`。
- 调整记录页首屏英雄区：去掉主标题上方的“记录”小标题，并收紧“今天已记录”统计行的文案间距，避免中段信息显得过散。
- 明确发现页“添加游戏”弹层的语音按钮布局决策：名称、简短描述、补充玩法步骤的语音入口继续保持在输入字段外侧，不统一内嵌到输入框内部；多行输入优先保留完整编辑空间。
- 修复发现页“添加游戏”任务型半弹窗：拉开分类区与后续字段的分组间距，恢复自定义分类输入框正常输入，稳定人数/时长双列对齐，并让补充玩法步骤展开后仍可继续滚动查看。
- 调整发现页无游戏库大卡片：主标题与辅助文案改为居中显示，`添加游戏` 按钮下移到文案下方。
- 将 `project_memory/README.md` 升级为开工前默认协作入口，要求任何讨论、规划、审查、文档整理或代码改动前先读取最小必读集合。
- 更新 `AGENTS.md`、`.codex/` 规则和提示词，统一改为优先读取 `project_memory/`，并将长期记忆与任务状态路径收敛到 `project_memory/memory/`、`project_memory/tasks/`。
- 调整 `project_memory/manifest.json` 和 `project_memory/scripts/sync.js`，明确 `project_memory/memory/`、`project_memory/tasks/` 为原地维护内容，不再由同步脚本覆盖。
- 新增 `project_memory/` 自动同步系统，提供跨 AI 工具可读的协作入口、规则、记忆、任务、项目上下文和外部 Codex memory note 快照。
- 新增 `project_memory/scripts/sync.js`、`check.js`、`lib.js` 和 `manifest.json`，支持手动同步与一致性检查，不新增 npm 依赖。
- 更新 `AGENTS.md` 与 [README.md](README.md)，说明 `project_memory/` 的事实源边界、同步命令和维护规则。
- 新增 [project-context.md](project-context.md)，集中沉淀历史会话确认的文档边界、当前实现事实、云开发配置注意事项、数据与 mock 策略、状态策略和后续协作守则。
- 更新 [README.md](README.md)，将项目上下文沉淀文档纳入正式文档索引，并补充历史会话稳定约定的维护入口。
- 明确半弹窗容器分级：轻量半弹窗、任务型半弹窗和子页面替代。
- 收敛添加游戏半弹窗：当前实现为名称、主分类 chips、人数、时长、标签、简短描述和可选玩法步骤。
- 调整添加游戏主按钮：作为内容流最后一项居中显示，不再使用独立白色底栏。
- 统一轻提示策略：普通提示使用柔和白色半透明胶囊，`待同步` 使用暖色 tone，黑色系统 toast 只作为兜底。
- 沉淀本轮真机适配和交互整改结论：安全区布局、返回按钮、底部操作栏、筛选分组、统一轻提示、pending 状态、编辑态/查看态边界。
- 更新 [experience-guidelines.md](experience-guidelines.md)，补充顶部安全区与返回按钮规则、筛选弹层分组规则，并将轻提示口径修正为柔和白色/暖色胶囊。
- 更新 [information-architecture.md](information-architecture.md)，明确团队排练记录在当前页打开只读详情，不默认进入可编辑排练过程页。
- 更新 [product-detailed-design.md](product-detailed-design.md)，新增“当前已确认交互基础设施”，沉淀真机安全区、临场表单密度、保存后置沉淀、筛选弹层和全局轻提示规则。
- 更新 [roadmap.md](roadmap.md)，标记 P0/P1/P2/P3 中已收敛的交互和数据稳定性项。
- 更新 `memory/decisions.md` 与 `memory/lessons-learned.md`，记录长期协作决策和复盘经验。
- 新增 [product-detailed-design.md](product-detailed-design.md)，作为产品详细设计正式文档，用于承接页面级显示规则、状态策略、空态/错误态逻辑和关键交互细节。
- 在 [product-detailed-design.md](product-detailed-design.md) 中落地第一部分“新用户或无数据状态页面的显示和逻辑”，当前优先覆盖发现页、新建游戏和条件抽卡。
- 新增 [data-inventory.md](data-inventory.md)，按用户链路梳理入库数据、页面链路、本地状态映射和 mock 迁移方案。
- 更新 [README.md](README.md)，收录数据总览文档。
- 更新 [data-api.md](data-api.md) 与 `wechat-cloudbase-app/database.md`，将初始化方式改为从仓库根目录 `mock_data/` 手动导入。
- 将业务 mock 数据规划迁移到仓库根目录 `mock_data/`，不再放在 `wechat-cloudbase-app/` 项目核心代码目录内。
- 更新 [architecture.md](architecture.md)、[data-inventory.md](data-inventory.md)、[experience-guidelines.md](experience-guidelines.md)、[information-architecture.md](information-architecture.md) 与 `wechat-cloudbase-app/database.md`，明确当前开发阶段不启用本地持久化缓存，只使用当前会话内存态、云端结果和空态/错误态。
- 更新 [data-api.md](data-api.md)，补充“云端成功空数组不回退旧本地数据、请求失败才显示错误态/当前会话 pending 数据”的前端消费约定。
- 收敛发现页无数据态方案：无游戏库时只显示一个大卡片，文案为“添加游戏 / 马上开玩”，主按钮点击后打开现有添加游戏底部弹层；存在游戏后恢复正常发现页结构。
- 收敛首次进入与我的页首登策略：从产品定位上采用轻登录，不做首次强制登录；我的页在没有个人数据时优先展示价值引导首屏，而不是默认完整资料页。

## 2026-06-05

- 新建 `docs/` 作为正式文档目录。
- 将根目录产品文档迁移为 [product.md](product.md)。
- 将根目录架构文档迁移为 [architecture.md](architecture.md)。
- 将体验与数据链路分析拆分沉淀为 [experience-guidelines.md](experience-guidelines.md)、[roadmap.md](roadmap.md) 和 [data-api.md](data-api.md)。
- 新增 [information-architecture.md](information-architecture.md)，沉淀三 Tab、九页面、弹层和关键链路。
- 新增 [README.md](README.md)，明确正式文档、工程文档、原型品牌素材和 `.trae/documents/` 过程归档边界。
- 更新 `wechat-cloudbase-app/README.md`，补充文档入口、脚本和事实源约定。
- 更新 `wechat-cloudbase-app/database.md`，补齐当前 `improv-api` action 清单和兼容别名。
